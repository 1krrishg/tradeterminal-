"""
TradeTerminal — FastAPI backend orchestrator.
Runs on localhost:8000 for local/demo use.

Pipeline:
1. Check demo cache
2. Bright Data scrape (ecommerce + government portals)
3. Chunk + embed via Runpod Flash BGE-M3 → ChromaDB
4. Retrieve top-K chunks + send to Qwen3.5-2B on Runpod Flash
5. Freightos shipping rate
6. Compute landed cost + margin gap
7. Return combined JSON to frontend
"""
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from demo_data import get_demo, DEMO_CACHE
from scrapers import scrape_all
from freightos import get_shipping_rate
from supabase_cache import get_cached, save_result

DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "")

app = FastAPI(title="TradeTerminal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    product: str
    origin: str
    destination: str


@app.get("/health")
async def health():
    return {"status": "ok", "demo_mode": DEMO_MODE, "runpod_configured": bool(RUNPOD_API_KEY)}


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    product = req.product.strip()
    origin = req.origin.strip()
    destination = req.destination.strip()

    if not product or not origin or not destination:
        raise HTTPException(status_code=400, detail="product, origin, and destination are required")

    # 1. Check in-memory demo cache
    cached = get_demo(product, origin, destination)
    if cached:
        return cached
    if DEMO_MODE:
        return next(iter(DEMO_CACHE.values()))

    # 2. Check Supabase cache
    db_cached = await get_cached(product, origin, destination)
    if db_cached:
        print(f"[analyze] Supabase cache hit for {product} {origin}→{destination}")
        return db_cached

    # 2. Full pipeline — needs Runpod + Bright Data
    if not RUNPOD_API_KEY:
        # Graceful fallback: return structured error with guidance
        raise HTTPException(
            status_code=503,
            detail="RUNPOD_API_KEY not configured. Set it in backend/.env or use a demo route (Spices/Nepal/India, Textiles/Bangladesh/Germany, Coffee/Ethiopia/Japan)."
        )

    # Import RAG modules only when needed (they depend on chromadb being installed)
    from rag import index_documents, retrieve, clear
    from runpod_client import extract_trade_data

    try:
        # 2. Scrape
        print(f"[analyze] Scraping for {product} {origin}→{destination}")
        scraped = await scrape_all(product, origin, destination)
        all_texts = scraped["ecommerce"] + scraped["regulations"]

        # 3. Index into ChromaDB via Runpod Flash embedder
        clear()
        print(f"[analyze] Indexing {len(all_texts)} documents")
        indexed = await index_documents(all_texts, {"product": product, "destination": destination})
        print(f"[analyze] Indexed {indexed} chunks")

        # 4. Retrieve top-K + LLM extraction
        query = f"Import requirements, duties, certifications, and market prices for {product} exported from {origin} to {destination}"
        chunks = await retrieve(query, top_k=8)
        print(f"[analyze] Retrieved {len(chunks)} chunks, calling Qwen3.5-2B")
        extracted = await extract_trade_data(query, chunks)

        compliance = extracted.get("compliance", {})
        market = extracted.get("market", {})

        # 5. Freightos shipping
        print(f"[analyze] Fetching shipping rates")
        shipping = await get_shipping_rate(origin, destination)

        # 6. Landed cost + margin gap
        landed_cost, margin_gap, margin_label = _compute_economics(market, shipping, compliance)

        result = {
            "product": product,
            "origin": origin,
            "destination": destination,
            "compliance": compliance,
            "market": market,
            "shipping": shipping,
            "landed_cost": landed_cost,
            "margin_gap_usd": margin_gap,
            "margin_gap_label": margin_label,
            "data_source": "Bright Data scraped · AI: Qwen3.5-2B on Runpod Flash · Shipping: Freightos",
            "cached": False,
        }

        # Save to Supabase for future cache hits
        try:
            await save_result(product, origin, destination, result)
            print(f"[analyze] Saved to Supabase cache")
        except Exception as e:
            print(f"[analyze] Supabase save failed (non-fatal): {e}")

        return result

    except Exception as e:
        print(f"[analyze] ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _parse_price(price_str: str) -> float:
    """Try to extract a USD float from a price string like '₹320/kg' or '$5.20/unit'."""
    import re
    # Exchange rates (rough, for demo)
    currency_to_usd = {"₹": 0.012, "$": 1.0, "€": 1.08, "¥": 0.0067, "£": 1.27}
    for symbol, rate in currency_to_usd.items():
        if symbol in price_str:
            nums = re.findall(r"[\d,]+\.?\d*", price_str.replace(",", ""))
            if nums:
                return float(nums[0]) * rate
    nums = re.findall(r"[\d,]+\.?\d*", price_str.replace(",", ""))
    return float(nums[0]) if nums else 0.0


def _compute_economics(market: dict, shipping: dict | None, compliance: dict) -> tuple:
    """Compute landed cost and margin gap. Returns (landed_cost_dict, margin_usd, label)."""
    product_cost = 500.0  # assume $500 product cost for 200kg reference shipment
    shipping_usd = float(shipping["estimated_cost_usd"]) if shipping else 0.0
    duty_pct = compliance.get("duty_rate_percent") or 0.0
    tariff_usd = product_cost * (duty_pct / 100)
    other_fees = 80.0  # inspection, handling, docs

    total = product_cost + shipping_usd + tariff_usd + other_fees

    landed_cost = {
        "product_cost_usd": product_cost,
        "shipping_usd": shipping_usd,
        "tariff_usd": round(tariff_usd, 2),
        "other_fees_usd": other_fees,
        "total_usd": round(total, 2),
    }

    # Try to get local market price for margin
    local_price_str = market.get("local_avg_price", "")
    local_price_usd = _parse_price(local_price_str) * 200 if local_price_str else 0.0  # scale to 200kg

    if local_price_usd > 0:
        margin = round(local_price_usd - total, 2)
        label = (
            f"Strong margin — {market.get('competition_level', '')} competition market"
            if margin > 200
            else "Marginal — review pricing strategy"
            if margin > 0
            else "Negative margin — reconsider route or reduce costs"
        )
        return landed_cost, margin, label

    return landed_cost, None, None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

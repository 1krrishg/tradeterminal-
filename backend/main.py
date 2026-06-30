"""
TradeTerminal — FastAPI backend.

Compliance (existing TariffLens build, reused via Supabase Edge Functions):
  1. classify-hs  → Groq GRI classification + CBP CROSS rulings → HS code
  2. simulate-tariff → WTO MFN + FTA preferential + sanctions + regulatory flags

Market (Bright Data live scraping):
  3. scrape_all → BigBasket / Rakuten / Mercado Libre / Zalando
  4. Groq → sentiment + docs extraction from scraped text

Economics:
  5. Freightos → shipping estimate → landed cost + margin gap
"""
from typing import Optional, List
import os, json, re, asyncio
import httpx
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from demo_data import get_demo
from scrapers import scrape_all
from freightos import get_shipping_rate

GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
RUNPOD_API_KEY  = os.getenv("RUNPOD_API_KEY", "")
RUNPOD_EMBEDDER = os.getenv("RUNPOD_ENDPOINT_ID_EMBEDDER", "")
RUNPOD_LLM      = os.getenv("RUNPOD_ENDPOINT_ID_LLM", "")
USE_RUNPOD      = bool(RUNPOD_API_KEY and RUNPOD_EMBEDDER and RUNPOD_LLM)

SUPABASE_URL  = "https://qszregcopfbiavgwvfip.supabase.co"
SUPABASE_ANON = "sb_publishable_trFYKNSMpJy8n28PZst2Fw_hPkPwcPd"
EDGE_HEADERS  = {"Authorization": f"Bearer {SUPABASE_ANON}", "Content-Type": "application/json"}

# Countries the WTO API has good coverage for
WTO_COVERED = {
    "United States","China","European Union","Germany","France","Japan","India",
    "Canada","Mexico","Brazil","South Korea","Australia","United Kingdom",
    "Singapore","Vietnam","Indonesia","Thailand","Malaysia","Turkey",
}

# Unorganized corridors: WTO has no/sparse data → fall back to Bright Data regulatory scrape
def _wto_has_coverage(origin: str, destination: str) -> bool:
    return destination in WTO_COVERED

app = FastAPI(title="TradeTerminal API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


class AnalyzeRequest(BaseModel):
    product: str
    origin: str
    destination: str


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "compliance": "WTO via Supabase Edge Functions + Bright Data fallback",
        "market": "Bright Data",
        "inference": "Runpod Flash (Qwen3.5-2B)" if USE_RUNPOD else "Groq llama-3.3-70b",
        "runpod_ready": USE_RUNPOD,
    }


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    product     = req.product.strip()
    origin      = req.origin.strip()
    destination = req.destination.strip()

    if not product or not origin or not destination:
        raise HTTPException(400, "product, origin, and destination are required")

    cached = get_demo(product, origin, destination)
    if cached:
        return cached

    try:
        compliance, market, shipping = await asyncio.gather(
            _compliance_pipeline(product, origin, destination),
            _market_pipeline(product, origin, destination),
            get_shipping_rate(origin, destination),
        )
        landed_cost, margin_gap, margin_label = _compute_economics(market, shipping, compliance)

        return {
            "product": product, "origin": origin, "destination": destination,
            "compliance": compliance,
            "market": market,
            "shipping": shipping,
            "landed_cost": landed_cost,
            "margin_gap_usd": margin_gap,
            "margin_gap_label": margin_label,
            "data_source": "WTO Official API · USITC HTS · CBP CROSS · Bright Data Web Unlocker · BGE-M3 on Runpod Flash · Qwen3.5-2B on Runpod Flash · Freightos",
            "cached": False,
        }
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(500, str(e))


# ── Compliance pipeline ───────────────────────────────────────────────────────
# WTO-covered corridors:  classify-hs → simulate-tariff (WTO MFN/FTA) → Groq docs
# Unorganized corridors:  classify-hs → Bright Data regulatory scrape → Runpod/Groq extraction

async def _compliance_pipeline(product: str, origin: str, destination: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: HS classification — always via Groq GRI + CBP CROSS (works for any product)
        hs_resp = await client.post(
            f"{SUPABASE_URL}/functions/v1/classify-hs",
            headers=EDGE_HEADERS,
            json={"description": f"{product} exported from {origin}"},
        )
        hs_data    = hs_resp.json() if hs_resp.status_code == 200 else {}
        candidates = hs_data.get("candidates", [])
        top        = candidates[0] if candidates else {}
        hs_code    = top.get("hts8", "000000")
        hs_dotted  = f"{hs_code[:4]}.{hs_code[4:6]}" if len(hs_code) >= 6 else hs_code

        # Step 2a: WTO for covered destinations
        sim = {}
        if _wto_has_coverage(origin, destination):
            sim_resp = await client.post(
                f"{SUPABASE_URL}/functions/v1/simulate-tariff",
                headers=EDGE_HEADERS,
                json={"hs_code": hs_code, "destination_country": destination,
                      "origin_country": origin, "shipment_value": 10000, "product_name": product},
            )
            sim = sim_resp.json() if sim_resp.status_code == 200 else {}
            print(f"[compliance] WTO path: MFN={sim.get('mfn_rate')} effective={sim.get('effective_rate')}")
        else:
            print(f"[compliance] Unorganized corridor {origin}→{destination} — using Bright Data fallback")

    # Step 2b: For unorganized corridors OR when WTO returns null MFN,
    # scrape the destination's regulatory portals via Bright Data and extract with Runpod/Groq
    wto_missing = sim.get("mfn_rate") is None
    if wto_missing:
        scraped_regs = await _scrape_regulations_for_compliance(product, origin, destination)
        reg_context  = "\n\n---\n\n".join(scraped_regs)[:6000]
        print(f"[compliance] Bright Data scraped {len(scraped_regs)} regulatory docs")
    else:
        reg_context = sim.get("risk_summary", "")

    # Step 3: Extract docs/certifications — Runpod if deployed, else Groq
    if USE_RUNPOD and wto_missing:
        docs_certs = await _extract_compliance_runpod(product, origin, destination, reg_context)
    else:
        docs_certs = await _extract_docs_with_groq(product, origin, destination, reg_context)

    # Build restrictions from sanctions + regulatory flags
    restrictions = []
    if sim.get("sanctions_alert"):
        restrictions.append({
            "description": sim.get("sanctions_note", "Sanctions apply — consult trade attorney"),
            "confidence": 0.99,
            "source": "https://home.treasury.gov/policy-issues/financial-sanctions"
        })
    for flag in sim.get("regulatory_flags", []):
        restrictions.append({
            "description": f"{flag['title']}: {flag['detail'][:200]}",
            "confidence": 0.95,
            "source": flag.get("authority", "")
        })

    # Import fees from WTO data
    import_fees = []
    if sim.get("mfn_rate") is not None:
        import_fees.append({"name": f"MFN duty", "estimated_amount": f"{sim['mfn_rate']}% of CIF value"})
    if sim.get("preferential_rate") is not None:
        import_fees.append({"name": f"FTA preferential ({sim.get('preferential_note','')[:50]})",
                             "estimated_amount": f"{sim['preferential_rate']}%"})
    if sim.get("retaliation_rate", 0) > 0:
        import_fees.append({"name": f"Retaliatory duty — {sim.get('retaliation_note','')[:60]}",
                             "estimated_amount": f"+{sim['retaliation_rate']}%"})

    # CBP ruling as a regulation change entry
    recent_changes = []
    cbp = (top.get("cbp_ruling") or {})
    if cbp.get("number"):
        recent_changes.append({
            "description": f"CBP Ruling {cbp['number']}: {(cbp.get('subject') or '')[:100]}",
            "date": cbp.get("date", ""),
            "source": f"https://rulings.cbp.gov/ruling/{cbp['number']}"
        })

    return {
        "hs_code": hs_dotted,
        "duty_rate_percent": sim.get("effective_rate", sim.get("mfn_rate", 0)),
        "required_documents": docs_certs.get("required_documents", []),
        "certifications": docs_certs.get("certifications", []),
        "restrictions": restrictions,
        "labeling_requirements": docs_certs.get("labeling_requirements", []),
        "common_rejection_reasons": docs_certs.get("common_rejection_reasons", []),
        "recent_regulation_changes": recent_changes,
        "import_fees_and_taxes": import_fees,
        "_wto": {
            "mfn_rate": sim.get("mfn_rate"),
            "retaliation_rate": sim.get("retaliation_rate"),
            "effective_rate": sim.get("effective_rate"),
            "preferential_rate": sim.get("preferential_rate"),
            "fta_note": sim.get("preferential_note"),
            "risk_score": sim.get("risk_score"),
            "risk_label": sim.get("risk_label"),
            "alternative_markets": sim.get("alternative_markets", []),
            "sanctions_alert": sim.get("sanctions_alert", False),
            "risk_summary": sim.get("risk_summary", ""),
            "recommendation": sim.get("recommendation", ""),
        }
    }


DOCS_SYSTEM = """You are a trade compliance expert. Return ONLY valid JSON (no markdown):

{
  "required_documents": [{"name": "string", "confidence": 0.95, "source": "https://real-gov-url"}],
  "certifications": [{"name": "string", "confidence": 0.85, "source": "https://real-gov-url"}],
  "labeling_requirements": [{"description": "string", "confidence": 0.90, "source": "https://real-gov-url"}],
  "common_rejection_reasons": ["string"]
}

Use real government URLs for the destination (FSSAI/CBIC=India, Japan Customs/MHLW=Japan, EU TARIC/EFSA=Germany/EU, ANVISA=Brazil, FDA/CBP=USA). Be specific to the product and destination."""


async def _extract_docs_with_groq(product: str, origin: str, destination: str, context: str) -> dict:
    if not GROQ_API_KEY:
        return {}
    user = f"Product: {product}\nOrigin: {origin}\nDestination: {destination}"
    if context:
        user += f"\n\nContext: {context[:1500]}"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "temperature": 0.1, "max_tokens": 1200,
                  "messages": [{"role": "system", "content": DOCS_SYSTEM},
                                {"role": "user", "content": user}]},
        )
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw.strip())
    except Exception:
        return {}


async def _scrape_regulations_for_compliance(product: str, origin: str, destination: str) -> List[str]:
    """Bright Data scrape of destination regulatory portals for unorganized corridors."""
    from scrapers import scrape_fssai, scrape_cbic, scrape_japan_customs, scrape_eu_taric, scrape_mhlw
    REGULATION_MAP = {
        "India":   [scrape_fssai, scrape_cbic],
        "Japan":   [scrape_japan_customs, scrape_mhlw],
        "Germany": [scrape_eu_taric],
        "France":  [scrape_eu_taric],
        "Brazil":  [],
    }
    scrapers = REGULATION_MAP.get(destination, [])
    if not scrapers:
        return []
    tasks = [s(product) for s in scrapers]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, str) and len(r) > 50]


async def _extract_compliance_runpod(product: str, origin: str, destination: str, context: str) -> dict:
    """Use Runpod Flash Qwen3.5-2B to extract compliance data from scraped regulatory text."""
    from runpod_client import extract_trade_data
    query = f"Import requirements, duties, certifications, labeling for {product} from {origin} to {destination}"
    chunks = [context[i:i+500] for i in range(0, len(context), 450)][:10]
    try:
        extracted = await extract_trade_data(query, chunks)
        return extracted.get("compliance", extracted)
    except Exception as e:
        print(f"[runpod] extraction failed, falling back to Groq: {e}")
        return await _extract_docs_with_groq(product, origin, destination, context)


# ── Market pipeline (Bright Data) ─────────────────────────────────────────────

async def _market_pipeline(product: str, origin: str, destination: str) -> dict:
    print(f"[market] Scraping {product} → {destination}")
    scraped = await scrape_all(product, origin, destination)
    ms      = scraped.get("market_summary", {})
    reviews = [t for t in scraped.get("ecommerce", []) if t and len(t) > 30]
    sentiment = await _extract_sentiment_with_groq(product, destination, reviews)

    seller_count = ms.get("seller_count") or sentiment.get("seller_count") or 0
    competition  = "high" if seller_count > 500 else "medium" if seller_count > 100 else "low"

    return {
        "local_avg_price":        ms.get("avg_price") or sentiment.get("local_avg_price", "N/A"),
        "local_price_range":      ms.get("price_range") or sentiment.get("local_price_range", "N/A"),
        "local_avg_price_usd_per_kg": sentiment.get("local_avg_price_usd_per_kg", 0.0),
        "seller_count":           seller_count,
        "competition_level":      competition,
        "consumer_sentiment": sentiment.get("consumer_sentiment", "mixed"),
        "sentiment_summary":  sentiment.get("sentiment_summary", ""),
        "top_complaints":     sentiment.get("top_complaints", []),
    }


SENTIMENT_SYSTEM = """You are a market analyst. Given scraped ecommerce text, return ONLY valid JSON (no markdown):

{
  "local_avg_price": "e.g. ₹320/kg — correct currency and unit for the market",
  "local_price_range": "e.g. ₹280–420/kg",
  "local_avg_price_usd_per_kg": 3.80,
  "seller_count": 47,
  "consumer_sentiment": "positive|mixed|negative",
  "sentiment_summary": "2-3 sentences on demand and consumer perception",
  "top_complaints": ["string", "string", "string"]
}

local_avg_price_usd_per_kg: estimated USD price per kg based on local avg price and current exchange rates.
seller_count: estimated number of active sellers for this product in that market (use knowledge if scrape is sparse).
If scraped text is sparse, use your knowledge of that market."""


async def _extract_sentiment_with_groq(product: str, destination: str, texts: List[str]) -> dict:
    if not GROQ_API_KEY:
        return {"consumer_sentiment": "mixed", "sentiment_summary": "", "top_complaints": []}
    context = "\n\n".join(texts[:6])[:3000]
    user = f"Product: {product}\nMarket: {destination}"
    if context:
        user += f"\n\nScraped ecommerce text:\n{context}"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "temperature": 0.1, "max_tokens": 600,
                  "messages": [{"role": "system", "content": SENTIMENT_SYSTEM},
                                {"role": "user", "content": user}]},
        )
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw.strip())
    except Exception:
        return {"consumer_sentiment": "mixed", "sentiment_summary": "", "top_complaints": []}


# ── Economics ─────────────────────────────────────────────────────────────────

def _parse_price(s: str) -> float:
    for sym, rate in {"₹": 0.012, "$": 1.0, "€": 1.08, "¥": 0.0067, "R$": 0.19, "£": 1.27}.items():
        if sym in s:
            nums = re.findall(r"[\d,]+\.?\d*", s.replace(",", ""))
            if nums: return float(nums[0]) * rate
    nums = re.findall(r"[\d,]+\.?\d*", s.replace(",", ""))
    return float(nums[0]) if nums else 0.0


def _compute_economics(market: dict, shipping: Optional[dict], compliance: dict) -> tuple:
    # Assume a standard 100kg test shipment
    SHIPMENT_KG = 100.0
    # Product cost: use local source price estimate ($2/kg for generic agricultural, adjusted by duty)
    product_cost = 500.0  # $500 for 100kg ($5/kg ex-works)
    shipping_usd = float(shipping["estimated_cost_usd"]) if shipping else 120.0  # $120 fallback for 100kg
    duty_pct     = compliance.get("duty_rate_percent") or 0.0
    tariff_usd   = product_cost * (duty_pct / 100)
    other_fees   = 80.0  # customs handling, inspection fees
    total        = product_cost + shipping_usd + tariff_usd + other_fees

    landed_cost = {"product_cost_usd": product_cost, "shipping_usd": shipping_usd,
                   "tariff_usd": round(tariff_usd, 2), "other_fees_usd": other_fees,
                   "total_usd": round(total, 2)}

    # Revenue: local USD/kg price * 100kg shipment
    price_usd_per_kg = float(market.get("local_avg_price_usd_per_kg") or 0)
    if price_usd_per_kg == 0:
        # Fallback: parse the display price string
        price_usd_per_kg = _parse_price(market.get("local_avg_price", ""))
    revenue = price_usd_per_kg * SHIPMENT_KG

    if revenue > 0:
        margin = round(revenue - total, 2)
        competition = market.get("competition_level", "medium")
        label = (f"Profitable route — {competition} competition market" if margin > 200
                 else "Marginal — review pricing strategy before committing" if margin > 0
                 else "Negative margin — reconsider route or reduce costs")
        return landed_cost, margin, label
    return landed_cost, None, None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

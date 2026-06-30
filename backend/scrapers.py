"""
Bright Data scrapers — geo-restricted ecommerce + government customs portals.
Uses Bright Data Web Unlocker (bypasses geo-blocks, CAPTCHAs, bot detection).
"""
import os
import re
import httpx
import asyncio
from typing import Optional

BRIGHT_DATA_API_KEY = os.getenv("BRIGHT_DATA_API_KEY", "")
BRIGHT_DATA_ZONE = os.getenv("BRIGHT_DATA_ZONE", "tradeterminal")

UNLOCKER_URL = "https://api.brightdata.com/request"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {BRIGHT_DATA_API_KEY}",
        "Content-Type": "application/json",
    }


async def _fetch(url: str, country: Optional[str] = None, timeout: float = 45.0) -> str:
    """Fetch any URL through Bright Data Web Unlocker."""
    if not BRIGHT_DATA_API_KEY:
        raise ValueError("BRIGHT_DATA_API_KEY not set")

    payload: dict = {"zone": BRIGHT_DATA_ZONE, "url": url, "format": "raw"}
    if country:
        payload["country"] = country

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(UNLOCKER_URL, json=payload, headers=_headers())
        resp.raise_for_status()
        return resp.text


# ── Price extraction helpers ────────────────────────────────────────────────

def _extract_prices(html: str) -> list[float]:
    """Pull numeric prices from HTML — works across BigBasket, Rakuten, Mercado Libre."""
    patterns = [
        r'₹\s*([\d,]+)',        # INR
        r'¥\s*([\d,]+)',        # JPY
        r'R\$\s*([\d,.]+)',     # BRL
        r'\$\s*([\d,.]+)',      # USD
        r'€\s*([\d,.]+)',       # EUR
        r'"price"[:\s]+"?([\d.]+)"?',   # JSON price fields
        r'"Price"[:\s]+"?([\d.]+)"?',
        r'data-price="([\d.]+)"',
        r'class="[^"]*price[^"]*"[^>]*>([\d,\.]+)',
    ]
    found = []
    for p in patterns:
        for m in re.findall(p, html):
            try:
                val = float(str(m).replace(",", ""))
                if 0.5 < val < 500000:
                    found.append(val)
            except ValueError:
                pass
    return found


def _extract_seller_count(html: str) -> int:
    """Estimate seller/product count from result counts in HTML."""
    patterns = [
        r'([\d,]+)\s*(?:results|products|items|sellers|listings)',
        r'"totalResults":\s*(\d+)',
        r'"total":\s*(\d+)',
        r'Showing\s+\d+.*?of\s+([\d,]+)',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            try:
                return int(m.group(1).replace(",", ""))
            except ValueError:
                pass
    return 0


def _extract_reviews(html: str) -> list[str]:
    """Pull review snippets from HTML."""
    patterns = [
        r'"reviewBody":\s*"([^"]{20,200})"',
        r'class="[^"]*review[^"]*"[^>]*>([^<]{20,200})<',
        r'class="[^"]*comment[^"]*"[^>]*>([^<]{20,200})<',
    ]
    reviews = []
    for p in patterns:
        reviews.extend(re.findall(p, html, re.IGNORECASE))
    return reviews[:10]


def _currency_symbol(destination: str) -> str:
    return {"India": "₹", "Japan": "¥", "Brazil": "R$", "Germany": "€",
            "France": "€", "United States": "$"}.get(destination, "$")


def _summarize_prices(prices: list[float], destination: str) -> tuple[str, str]:
    """Return (avg_price_str, range_str) with correct currency."""
    if not prices:
        return "N/A", "N/A"
    sym = _currency_symbol(destination)
    avg = sum(prices) / len(prices)
    return f"{sym}{avg:,.0f}", f"{sym}{min(prices):,.0f}–{sym}{max(prices):,.0f}"


# ── Ecommerce scrapers ───────────────────────────────────────────────────────

async def scrape_bigbasket(product: str) -> dict:
    url = f"https://www.bigbasket.com/ps/?q={product.replace(' ', '+')}&tab=prd"
    try:
        html = await _fetch(url, country="in")
        prices = _extract_prices(html)
        sellers = _extract_seller_count(html)
        reviews = _extract_reviews(html)
        avg, rng = _summarize_prices(prices, "India")
        return {
            "source": "BigBasket.in",
            "prices": prices[:20],
            "avg_price": avg,
            "price_range": rng,
            "seller_count": sellers,
            "reviews": reviews,
            "raw_snippet": html[2000:5000],
        }
    except Exception as e:
        return {"source": "BigBasket.in", "error": str(e)}


async def scrape_amazon_in(product: str) -> dict:
    url = f"https://www.amazon.in/s?k={product.replace(' ', '+')}"
    try:
        html = await _fetch(url, country="in")
        prices = _extract_prices(html)
        sellers = _extract_seller_count(html)
        reviews = _extract_reviews(html)
        avg, rng = _summarize_prices(prices, "India")
        return {
            "source": "Amazon.in",
            "prices": prices[:20],
            "avg_price": avg,
            "price_range": rng,
            "seller_count": sellers,
            "reviews": reviews,
            "raw_snippet": html[2000:5000],
        }
    except Exception as e:
        return {"source": "Amazon.in", "error": str(e)}


async def scrape_rakuten(product: str) -> dict:
    url = f"https://search.rakuten.co.jp/search/mall/{product.replace(' ', '%20')}/"
    try:
        html = await _fetch(url, country="jp")
        prices = _extract_prices(html)
        sellers = _extract_seller_count(html)
        reviews = _extract_reviews(html)
        avg, rng = _summarize_prices(prices, "Japan")
        return {
            "source": "Rakuten.co.jp",
            "prices": prices[:20],
            "avg_price": avg,
            "price_range": rng,
            "seller_count": sellers,
            "reviews": reviews,
            "raw_snippet": html[2000:5000],
        }
    except Exception as e:
        return {"source": "Rakuten.co.jp", "error": str(e)}


async def scrape_mercadolibre(product: str) -> dict:
    url = f"https://lista.mercadolivre.com.br/{product.replace(' ', '-')}"
    try:
        html = await _fetch(url, country="br")
        prices = _extract_prices(html)
        sellers = _extract_seller_count(html)
        reviews = _extract_reviews(html)
        avg, rng = _summarize_prices(prices, "Brazil")
        return {
            "source": "MercadoLivre.com.br",
            "prices": prices[:20],
            "avg_price": avg,
            "price_range": rng,
            "seller_count": sellers,
            "reviews": reviews,
            "raw_snippet": html[2000:5000],
        }
    except Exception as e:
        return {"source": "MercadoLivre.com.br", "error": str(e)}


async def scrape_zalando(product: str) -> dict:
    url = f"https://www.zalando.de/suche/?q={product.replace(' ', '+')}"
    try:
        html = await _fetch(url, country="de")
        prices = _extract_prices(html)
        sellers = _extract_seller_count(html)
        avg, rng = _summarize_prices(prices, "Germany")
        return {
            "source": "Zalando.de",
            "prices": prices[:20],
            "avg_price": avg,
            "price_range": rng,
            "seller_count": sellers,
            "reviews": [],
            "raw_snippet": html[2000:5000],
        }
    except Exception as e:
        return {"source": "Zalando.de", "error": str(e)}


# ── Government / regulation scrapers ────────────────────────────────────────

async def scrape_fssai() -> str:
    try:
        html = await _fetch("https://www.fssai.gov.in/cms/import-of-food-products.php")
        return f"FSSAI import regulations:\n{_clean_html(html)[:3000]}"
    except Exception as e:
        return f"FSSAI: {e}"


async def scrape_cbic() -> str:
    try:
        html = await _fetch("https://www.cbic.gov.in/htdocs-cbec/customs/cst2024-250424/cst2024-idx.htm")
        return f"CBIC customs tariff:\n{_clean_html(html)[:3000]}"
    except Exception as e:
        return f"CBIC: {e}"


async def scrape_japan_customs() -> str:
    try:
        html = await _fetch("https://www.customs.go.jp/english/tariff/2024_4/index.htm", country="jp")
        return f"Japan Customs tariff:\n{_clean_html(html)[:3000]}"
    except Exception as e:
        return f"Japan Customs: {e}"


async def scrape_eu_taric() -> str:
    try:
        html = await _fetch("https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp")
        return f"EU TARIC:\n{_clean_html(html)[:3000]}"
    except Exception as e:
        return f"EU TARIC: {e}"


async def scrape_mhlw() -> str:
    try:
        html = await _fetch("https://www.mhlw.go.jp/english/topics/importedfoods/index.html", country="jp")
        return f"Japan MHLW food import rules:\n{_clean_html(html)[:3000]}"
    except Exception as e:
        return f"MHLW: {e}"


def _clean_html(html: str) -> str:
    """Strip tags, collapse whitespace."""
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


# ── Route dispatcher ─────────────────────────────────────────────────────────

ECOMMERCE_MAP = {
    "India":      [scrape_bigbasket, scrape_amazon_in],
    "Japan":      [scrape_rakuten],
    "Brazil":     [scrape_mercadolibre],
    "Germany":    [scrape_zalando],
    "France":     [scrape_zalando],
}

REGULATION_MAP = {
    "India":      [scrape_fssai, scrape_cbic],
    "Japan":      [scrape_japan_customs, scrape_mhlw],
    "Brazil":     [],
    "Germany":    [scrape_eu_taric],
    "France":     [scrape_eu_taric],
}


async def scrape_all(product: str, origin: str, destination: str) -> dict:
    """
    Run all scrapers for the route in parallel.
    Returns {"ecommerce": [...dicts], "regulations": [str, ...], "market_summary": dict}
    """
    ec_scrapers = ECOMMERCE_MAP.get(destination, [])
    reg_scrapers = REGULATION_MAP.get(destination, [])

    ec_tasks = [s(product) for s in ec_scrapers]
    reg_tasks = [s() for s in reg_scrapers]

    ec_results, reg_results = await asyncio.gather(
        asyncio.gather(*ec_tasks, return_exceptions=True),
        asyncio.gather(*reg_tasks, return_exceptions=True),
    )

    # Filter successful ecommerce results
    ec_good = [r for r in ec_results if isinstance(r, dict) and "error" not in r]
    ec_text = []
    for r in ec_good:
        ec_text.append(
            f"Source: {r['source']}\n"
            f"Avg price: {r.get('avg_price','N/A')} | Range: {r.get('price_range','N/A')}\n"
            f"Listings/sellers: {r.get('seller_count', 0)}\n"
            f"Review snippets: {'; '.join(r.get('reviews', [])[:3])}\n"
            f"Page snippet: {r.get('raw_snippet','')[:500]}"
        )

    # Aggregate market data across sources
    all_prices = []
    total_sellers = 0
    all_reviews = []
    for r in ec_good:
        all_prices.extend(r.get("prices", []))
        total_sellers += r.get("seller_count", 0)
        all_reviews.extend(r.get("reviews", []))

    avg_price_str, price_range_str = _summarize_prices(all_prices, destination)
    market_summary = {
        "avg_price": avg_price_str,
        "price_range": price_range_str,
        "seller_count": total_sellers,
        "reviews": all_reviews[:10],
        "sources": [r["source"] for r in ec_good],
    }

    reg_text = [str(r) for r in reg_results if isinstance(r, str)]

    return {
        "ecommerce": ec_text,
        "regulations": reg_text,
        "market_summary": market_summary,
    }

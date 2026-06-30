"""
Bright Data scraper — geo-restricted ecommerce + government customs portals.
Uses Bright Data's Web Unlocker (proxy) and SERP API.
"""
import os
import httpx
import asyncio
from typing import Optional

BRIGHT_DATA_API_KEY = os.getenv("BRIGHT_DATA_API_KEY", "")
BRIGHT_DATA_ZONE = os.getenv("BRIGHT_DATA_ZONE", "residential")

# Bright Data Web Unlocker endpoint
UNLOCKER_URL = "https://api.brightdata.com/request"


def _bright_headers() -> dict:
    return {
        "Authorization": f"Bearer {BRIGHT_DATA_API_KEY}",
        "Content-Type": "application/json",
    }


async def fetch_url(url: str, zone: str = "unlocker", country: Optional[str] = None) -> str:
    """Fetch a URL through Bright Data Web Unlocker."""
    payload = {
        "zone": zone,
        "url": url,
        "format": "raw",
    }
    if country:
        payload["country"] = country

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(UNLOCKER_URL, json=payload, headers=_bright_headers())
        resp.raise_for_status()
        return resp.text


async def scrape_bigbasket(product: str) -> str:
    """Scrape BigBasket.com for India pricing and reviews."""
    url = f"https://www.bigbasket.com/ps/?q={product.replace(' ', '+')}&tab=prd"
    try:
        html = await fetch_url(url, country="in")
        # Extract price/seller info from HTML (simplified — real impl would parse DOM)
        return f"BigBasket search for {product}: {html[:3000]}"
    except Exception as e:
        return f"BigBasket scrape failed: {e}"


async def scrape_rakuten(product: str) -> str:
    """Scrape Rakuten Japan for pricing and reviews."""
    url = f"https://search.rakuten.co.jp/search/mall/{product.replace(' ', '%20')}/"
    try:
        html = await fetch_url(url, country="jp")
        return f"Rakuten Japan search for {product}: {html[:3000]}"
    except Exception as e:
        return f"Rakuten scrape failed: {e}"


async def scrape_mercadolibre(product: str) -> str:
    """Scrape Mercado Libre Brazil for pricing."""
    url = f"https://lista.mercadolivre.com.br/{product.replace(' ', '-')}"
    try:
        html = await fetch_url(url, country="br")
        return f"Mercado Livre search for {product}: {html[:3000]}"
    except Exception as e:
        return f"Mercado Libre scrape failed: {e}"


async def scrape_amazon_in(product: str) -> str:
    """Scrape Amazon India for pricing and reviews."""
    url = f"https://www.amazon.in/s?k={product.replace(' ', '+')}"
    try:
        html = await fetch_url(url, country="in")
        return f"Amazon India search for {product}: {html[:3000]}"
    except Exception as e:
        return f"Amazon India scrape failed: {e}"


async def scrape_customs_india(product: str) -> str:
    """Scrape CBIC India for customs duties."""
    url = f"https://www.cbic.gov.in/resources//htdocs-cbec/customs/cs-act/formatted-htmls/csexns.pdf"
    try:
        html = await fetch_url(url)
        return f"CBIC India customs data: {html[:3000]}"
    except Exception as e:
        return f"CBIC scrape failed: {e}. Falling back to known data."


async def scrape_fssai(product: str) -> str:
    """Scrape FSSAI for food import regulations."""
    url = "https://www.fssai.gov.in/cms/import-of-food-products.php"
    try:
        html = await fetch_url(url)
        return f"FSSAI import regulations: {html[:3000]}"
    except Exception as e:
        return f"FSSAI scrape failed: {e}"


async def scrape_japan_customs(product: str) -> str:
    """Scrape Japan Customs portal."""
    url = "https://www.customs.go.jp/english/tariff/2024_4/index.htm"
    try:
        html = await fetch_url(url, country="jp")
        return f"Japan Customs tariff data: {html[:3000]}"
    except Exception as e:
        return f"Japan Customs scrape failed: {e}"


async def scrape_brazil_comex(product: str) -> str:
    """Scrape Brazilian COMEX for import duties."""
    url = f"https://www.gov.br/comexstat/pt-br/assuntos/legislacao-e-normas"
    try:
        html = await fetch_url(url, country="br")
        return f"Brazil COMEX import data: {html[:3000]}"
    except Exception as e:
        return f"Brazil COMEX scrape failed: {e}"


async def scrape_eu_customs(product: str) -> str:
    """Scrape EU Customs tariff database."""
    url = f"https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp"
    try:
        html = await fetch_url(url)
        return f"EU TARIC customs data: {html[:3000]}"
    except Exception as e:
        return f"EU TARIC scrape failed: {e}"


ECOMMERCE_SCRAPERS = {
    "India": [scrape_bigbasket, scrape_amazon_in],
    "Japan": [scrape_rakuten],
    "Brazil": [scrape_mercadolibre],
}

REGULATION_SCRAPERS = {
    "India": [scrape_customs_india, scrape_fssai],
    "Japan": [scrape_japan_customs],
    "Brazil": [scrape_brazil_comex],
    "Germany": [scrape_eu_customs],
}


async def scrape_all(product: str, origin: str, destination: str) -> dict[str, list[str]]:
    """
    Run all relevant scrapers for a trade route.
    Returns {"ecommerce": [...], "regulations": [...]}
    """
    tasks_ecommerce = []
    for scraper in ECOMMERCE_SCRAPERS.get(destination, []):
        tasks_ecommerce.append(scraper(product))

    tasks_regulations = []
    for scraper in REGULATION_SCRAPERS.get(destination, []):
        tasks_regulations.append(scraper(product))

    ecommerce_results = await asyncio.gather(*tasks_ecommerce, return_exceptions=True)
    regulation_results = await asyncio.gather(*tasks_regulations, return_exceptions=True)

    return {
        "ecommerce": [str(r) for r in ecommerce_results if not isinstance(r, Exception)],
        "regulations": [str(r) for r in regulation_results if not isinstance(r, Exception)],
    }

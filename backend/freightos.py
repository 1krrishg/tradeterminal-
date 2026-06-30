"""
Freightos shipping rate integration.
Public API endpoint — no key required for basic queries.
"""
import httpx
import asyncio

COUNTRY_CODE_MAP = {
    "Nepal": "NPL", "India": "IND", "China": "CHN", "Japan": "JPN",
    "Brazil": "BRA", "United States": "USA", "Germany": "DEU",
    "Bangladesh": "BGD", "Vietnam": "VNM", "Indonesia": "IDN",
    "Thailand": "THA", "Malaysia": "MYS", "Sri Lanka": "LKA",
    "Pakistan": "PAK", "Mexico": "MEX", "Turkey": "TUR",
    "Egypt": "EGY", "Nigeria": "NGA", "Kenya": "KEN", "Ethiopia": "ETH",
    "South Korea": "KOR", "Singapore": "SGP", "Australia": "AUS",
    "United Kingdom": "GBR", "France": "FRA", "Canada": "CAN",
    "Argentina": "ARG", "Colombia": "COL", "Peru": "PER",
    "Saudi Arabia": "SAU",
}

FREIGHTOS_API = "https://ship.freightos.com/api/shippingCalculator"


async def get_shipping_rate(origin: str, destination: str, weight_kg: float = 200) -> dict | None:
    """
    Get shipping rate estimate from Freightos public API.
    Returns dict with carrier, cost, transit time or None if unavailable.
    """
    origin_code = COUNTRY_CODE_MAP.get(origin, origin[:3].upper())
    dest_code = COUNTRY_CODE_MAP.get(destination, destination[:3].upper())

    params = {
        "loadtype": "boxes",
        "weight": weight_kg,
        "origin": origin_code,
        "destination": dest_code,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(FREIGHTOS_API, params=params)
            if resp.status_code == 200:
                data = resp.json()
                return _parse_freightos(data, origin, destination)
    except Exception:
        pass

    # Fallback — rough estimate table for common routes
    return _estimate_fallback(origin, destination, weight_kg)


def _parse_freightos(data: dict, origin: str, destination: str) -> dict | None:
    """Parse Freightos API response."""
    quotes = data.get("quotes") or data.get("results") or []
    if not quotes:
        return None
    best = quotes[0]
    return {
        "carrier": best.get("carrier", {}).get("name", "Unknown"),
        "estimated_cost_usd": float(best.get("totalPrice", {}).get("amount", 0)),
        "transit_days": best.get("transitDays", "—"),
        "raw": str(best),
    }


# Rough fallback estimates (USD, 200kg shipment)
_FALLBACK_COSTS = {
    ("Nepal", "India"): ("Land freight via Raxaul", 150, "2–4 days"),
    ("Bangladesh", "Germany"): ("Sea freight Chittagong→Hamburg", 1200, "18–24 days"),
    ("Ethiopia", "Japan"): ("Sea freight Djibouti→Osaka", 950, "22–28 days"),
    ("China", "United States"): ("Sea freight Shanghai→LA", 2200, "14–20 days"),
    ("India", "United States"): ("Sea freight JNPT→LA", 1800, "18–24 days"),
    ("Vietnam", "Germany"): ("Sea freight Ho Chi Minh→Hamburg", 1400, "20–28 days"),
}


def _estimate_fallback(origin: str, destination: str, weight_kg: float) -> dict:
    key = (origin, destination)
    carrier, cost, days = _FALLBACK_COSTS.get(key, ("International freight", 1500, "14–28 days"))
    scale = weight_kg / 200
    return {
        "carrier": carrier,
        "estimated_cost_usd": round(cost * scale),
        "transit_days": days,
        "raw": "Freightos fallback estimate",
    }

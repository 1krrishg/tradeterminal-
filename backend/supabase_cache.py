"""
Supabase cache for TradeTerminal query results.
Checks trade_queries table before running the full pipeline.
Saves results after pipeline completes.
"""
import os
import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qszregcopfbiavgwvfip.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # service role key for writes

ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenJlZ2NvcGZiaWF2Z3d2ZmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjI4MDYsImV4cCI6MjA5NTkzODgwNn0.6kEdoJ63_sUsMNafzggVHFPJCopco3RliddII0Y-wUk"


def _headers(write: bool = False) -> dict:
    key = (SUPABASE_KEY if write and SUPABASE_KEY else ANON_KEY)
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def get_cached(product: str, origin: str, destination: str) -> dict | None:
    """Look up a previous result in trade_queries."""
    url = f"{SUPABASE_URL}/rest/v1/trade_queries"
    params = {
        "product": f"eq.{product.lower()}",
        "origin": f"eq.{origin.lower()}",
        "destination": f"eq.{destination.lower()}",
        "order": "queried_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params, headers=_headers())
        rows = resp.json()
        if not rows:
            return None
        row = rows[0]
        return {
            "product": product,
            "origin": origin,
            "destination": destination,
            "compliance": row.get("compliance_json") or {},
            "market": row.get("market_json") or {},
            "shipping": row.get("shipping_json"),
            "landed_cost": row.get("landed_cost_json"),
            "margin_gap_usd": row.get("margin_gap_usd"),
            "margin_gap_label": row.get("margin_gap_label"),
            "data_source": row.get("data_source", "Supabase cache"),
            "cached": True,
        }


async def save_result(product: str, origin: str, destination: str, result: dict):
    """Upsert a result into trade_queries."""
    url = f"{SUPABASE_URL}/rest/v1/trade_queries"
    payload = {
        "product": product.lower(),
        "origin": origin.lower(),
        "destination": destination.lower(),
        "compliance_json": result.get("compliance"),
        "market_json": result.get("market"),
        "shipping_json": result.get("shipping"),
        "landed_cost_json": result.get("landed_cost"),
        "margin_gap_usd": result.get("margin_gap_usd"),
        "margin_gap_label": result.get("margin_gap_label"),
        "data_source": result.get("data_source", ""),
    }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, json=payload, headers=_headers(write=True))

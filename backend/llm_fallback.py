"""
Claude API fallback for trade data extraction.
Used when Runpod Flash endpoints are not yet deployed.
Falls back gracefully with a rule-based response if Claude key is also missing.
"""
import os
import json
import re

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are a trade compliance and market intelligence expert. Given a product, origin country, and destination country, return a JSON object with realistic trade data.

Return ONLY valid JSON — no markdown, no explanation. Use this exact schema:

{
  "compliance": {
    "hs_code": "string (e.g. 0910.91)",
    "duty_rate_percent": number,
    "required_documents": [{"name": "string", "confidence": 0.0-1.0, "source": "https://..."}],
    "certifications": [{"name": "string", "confidence": 0.0-1.0, "source": "https://..."}],
    "restrictions": [{"description": "string", "confidence": 0.0-1.0, "source": "https://..."}],
    "labeling_requirements": [{"description": "string", "confidence": 0.0-1.0, "source": "https://..."}],
    "common_rejection_reasons": ["string"],
    "recent_regulation_changes": [{"description": "string", "date": "2024 or 2025", "source": "https://..."}],
    "import_fees_and_taxes": [{"name": "string", "estimated_amount": "string"}]
  },
  "market": {
    "local_avg_price": "string with currency and unit (e.g. ₹320/kg or ¥2400/kg)",
    "local_price_range": "string",
    "seller_count": number,
    "competition_level": "low" or "medium" or "high",
    "consumer_sentiment": "positive" or "mixed" or "negative",
    "sentiment_summary": "2-3 sentence summary",
    "top_complaints": ["string", "string", "string"]
  }
}

Use real source URLs for that destination country's regulatory body. Be accurate about duty rates and document requirements."""


async def extract_with_claude(product: str, origin: str, destination: str, scraped_context: str = "") -> dict:
    """Call Claude API to extract structured trade data."""
    if not ANTHROPIC_API_KEY:
        return _rule_based_fallback(product, origin, destination)

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    user_msg = f"Product: {product}\nOrigin: {origin}\nDestination: {destination}"
    if scraped_context:
        user_msg += f"\n\nAdditional context from live scraping:\n{scraped_context[:4000]}"

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = msg.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw.strip())


def _rule_based_fallback(product: str, origin: str, destination: str) -> dict:
    """Minimal structured fallback when no LLM is available."""
    dest_sources = {
        "India": {"reg": "https://www.fssai.gov.in/", "customs": "https://www.cbic.gov.in/", "duty": 30},
        "Japan": {"reg": "https://www.mhlw.go.jp/english/", "customs": "https://www.customs.go.jp/english/", "duty": 8},
        "Germany": {"reg": "https://ec.europa.eu/taxation_customs/", "customs": "https://ec.europa.eu/taxation_customs/", "duty": 12},
        "Brazil": {"reg": "https://www.gov.br/anvisa/en", "customs": "https://www.gov.br/receitafederal/", "duty": 18},
        "United States": {"reg": "https://www.fda.gov/", "customs": "https://www.cbp.gov/", "duty": 5},
    }
    d = dest_sources.get(destination, {"reg": "https://www.wto.org/", "customs": "https://www.wto.org/", "duty": 10})

    return {
        "compliance": {
            "hs_code": "0000.00",
            "duty_rate_percent": d["duty"],
            "required_documents": [
                {"name": "Commercial Invoice", "confidence": 0.98, "source": d["customs"]},
                {"name": "Packing List", "confidence": 0.98, "source": d["customs"]},
                {"name": "Certificate of Origin", "confidence": 0.90, "source": d["customs"]},
            ],
            "certifications": [
                {"name": f"Import permit for {product}", "confidence": 0.75, "source": d["reg"]},
            ],
            "restrictions": [],
            "labeling_requirements": [
                {"description": "Destination country language required on packaging", "confidence": 0.85, "source": d["reg"]},
            ],
            "common_rejection_reasons": ["Incomplete documentation", "Labeling non-compliance"],
            "recent_regulation_changes": [],
            "import_fees_and_taxes": [
                {"name": f"Import duty ({d['duty']}%)", "estimated_amount": f"{d['duty']}% of CIF value"},
            ],
        },
        "market": {
            "local_avg_price": "N/A (set ANTHROPIC_API_KEY for live data)",
            "local_price_range": "N/A",
            "seller_count": 0,
            "competition_level": "medium",
            "consumer_sentiment": "mixed",
            "sentiment_summary": f"Market data for {product} in {destination} requires live scraping. Add ANTHROPIC_API_KEY to backend/.env for AI-powered extraction.",
            "top_complaints": [],
        },
    }

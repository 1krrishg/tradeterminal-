"""
Runpod Flash client — calls BGE-M3 embedder and Qwen3.5-2B extractor endpoints.
Runpod Flash = serverless GPU, no Docker, pay per second of compute.
"""
import os
import json
import httpx
import asyncio

RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "")
EMBEDDER_ID = os.getenv("RUNPOD_ENDPOINT_ID_EMBEDDER", "")
LLM_ID = os.getenv("RUNPOD_ENDPOINT_ID_LLM", "")

BASE = "https://api.runpod.ai/v2"
HEADERS = lambda: {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}


async def _run_sync(endpoint_id: str, payload: dict, timeout: float = 120.0) -> dict:
    """Submit job and poll until complete (Runpod sync endpoint)."""
    url = f"{BASE}/{endpoint_id}/runsync"
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json={"input": payload}, headers=HEADERS())
        resp.raise_for_status()
        data = resp.json()
    # runsync returns output directly; async would need polling
    if data.get("status") == "COMPLETED":
        return data.get("output", {})
    elif data.get("status") in ("FAILED", "CANCELLED"):
        raise RuntimeError(f"Runpod job failed: {data}")
    # Poll if still running
    job_id = data.get("id")
    if not job_id:
        return data.get("output", data)
    return await _poll(endpoint_id, job_id, timeout)


async def _poll(endpoint_id: str, job_id: str, timeout: float) -> dict:
    url = f"{BASE}/{endpoint_id}/status/{job_id}"
    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient(timeout=30) as client:
        while asyncio.get_event_loop().time() < deadline:
            resp = await client.get(url, headers=HEADERS())
            data = resp.json()
            if data.get("status") == "COMPLETED":
                return data.get("output", {})
            elif data.get("status") in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"Runpod job failed: {data}")
            await asyncio.sleep(2)
    raise TimeoutError(f"Runpod job {job_id} timed out after {timeout}s")


async def embed_text(text: str) -> list[float]:
    """
    Call BGE-M3 embedder endpoint on Runpod Flash.
    Endpoint expects: {"text": "..."} → returns {"embedding": [...]}
    """
    if not EMBEDDER_ID or not RUNPOD_API_KEY:
        raise ValueError("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID_EMBEDDER must be set")
    result = await _run_sync(EMBEDDER_ID, {"text": text})
    return result["embedding"]


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in parallel."""
    tasks = [embed_text(t) for t in texts]
    return await asyncio.gather(*tasks)


SYSTEM_PROMPT = """You are a trade compliance and market analysis engine. You receive a query about exporting a product between countries, plus retrieved data chunks from regulatory and market sources.

Output ONLY valid JSON. No explanations, no markdown, no preamble. No text before or after the JSON object.

{
  "compliance": {
    "hs_code": "string",
    "duty_rate_percent": number,
    "required_documents": [{"name": "string", "confidence": 0.0-1.0, "source": "url"}],
    "certifications": [{"name": "string", "confidence": 0.0-1.0, "source": "url"}],
    "restrictions": [{"description": "string", "confidence": 0.0-1.0, "source": "url"}],
    "labeling_requirements": [{"description": "string", "confidence": 0.0-1.0, "source": "url"}],
    "common_rejection_reasons": ["string"],
    "recent_regulation_changes": [{"description": "string", "date": "string", "source": "url"}],
    "import_fees_and_taxes": [{"name": "string", "estimated_amount": "string"}]
  },
  "market": {
    "local_avg_price": "string with currency and unit",
    "local_price_range": "string",
    "seller_count": number,
    "competition_level": "low|medium|high",
    "consumer_sentiment": "positive|mixed|negative",
    "sentiment_summary": "string",
    "top_complaints": ["string"]
  }
}

If data not available, set confidence to 0.0. Never hallucinate — only extract from provided context. For any field without data, use null or empty array."""


async def extract_trade_data(query: str, context_chunks: list[str]) -> dict:
    """
    Call Qwen3.5-2B on Runpod Flash with RAG context.
    Returns parsed compliance + market JSON.
    """
    if not LLM_ID or not RUNPOD_API_KEY:
        raise ValueError("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID_LLM must be set")

    context = "\n\n---\n\n".join(context_chunks[:10])  # cap context size
    user_message = f"Query: {query}\n\nContext from regulatory and market sources:\n{context}"

    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "max_new_tokens": 2048,
        "temperature": 0.1,  # low temp for structured extraction
    }

    result = await _run_sync(LLM_ID, payload)
    # result should be {"text": "..."} or {"choices": [...]}
    raw = result.get("text") or result.get("output") or ""
    if isinstance(result, dict) and "choices" in result:
        raw = result["choices"][0]["message"]["content"]

    # Parse JSON — Qwen sometimes wraps in ```json
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())

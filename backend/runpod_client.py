from typing import Optional, List, Dict
"""
Runpod Serverless client — calls vLLM endpoint (OpenAI-compatible) for Qwen2.5-1.5B extraction.
Endpoint: xooolc9fph35fp (worker-vllm v2.22.5)
"""
import os
import json
import httpx
import asyncio

RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "")
LLM_ID = os.getenv("RUNPOD_ENDPOINT_ID_LLM", "")

BASE = "https://api.runpod.ai/v2"


def _headers() -> dict:
    return {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}


async def _run_sync(endpoint_id: str, payload: dict, timeout: float = 120.0) -> dict:
    """Submit job and poll until complete."""
    url = f"{BASE}/{endpoint_id}/runsync"
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json={"input": payload}, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") == "COMPLETED":
        return data.get("output", {})
    elif data.get("status") in ("FAILED", "CANCELLED"):
        raise RuntimeError(f"Runpod job failed: {data}")

    job_id = data.get("id")
    if not job_id:
        return data.get("output", data)
    return await _poll(endpoint_id, job_id, timeout)


async def _poll(endpoint_id: str, job_id: str, timeout: float) -> dict:
    url = f"{BASE}/{endpoint_id}/status/{job_id}"
    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient(timeout=30) as client:
        while asyncio.get_event_loop().time() < deadline:
            resp = await client.get(url, headers=_headers())
            data = resp.json()
            if data.get("status") == "COMPLETED":
                return data.get("output", {})
            elif data.get("status") in ("FAILED", "CANCELLED"):
                raise RuntimeError(f"Runpod job failed: {data}")
            await asyncio.sleep(3)
    raise TimeoutError(f"Runpod job {job_id} timed out after {timeout}s")


SYSTEM_PROMPT = """You are a trade compliance and market analysis engine. Extract structured data from the provided regulatory and market context.

Output ONLY valid JSON matching this exact schema — no markdown, no explanation:

{"compliance":{"hs_code":"string","duty_rate_percent":0,"required_documents":[{"name":"string","confidence":0.9,"source":"url"}],"certifications":[{"name":"string","confidence":0.9,"source":"url"}],"restrictions":[{"description":"string","confidence":0.9,"source":"url"}],"labeling_requirements":[{"description":"string","confidence":0.9,"source":"url"}],"common_rejection_reasons":["string"],"recent_regulation_changes":[{"description":"string","date":"string","source":"url"}],"import_fees_and_taxes":[{"name":"string","estimated_amount":"string"}]},"market":{"local_avg_price":"string","local_price_range":"string","seller_count":0,"competition_level":"low","consumer_sentiment":"positive","sentiment_summary":"string","top_complaints":["string"]}}

Only extract from provided context. Set confidence 0.0 for unknown fields. Never hallucinate."""


async def extract_trade_data(query: str, context_chunks: List[str]) -> dict:
    """
    Call Qwen2.5-1.5B on Runpod vLLM endpoint via OpenAI-compatible chat format.
    Returns parsed compliance + market JSON.
    """
    if not LLM_ID or not RUNPOD_API_KEY:
        raise ValueError("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID_LLM must be set")

    context = "\n\n---\n\n".join(context_chunks[:10])
    user_message = f"Query: {query}\n\nContext from regulatory and market sources:\n{context}"

    # vLLM worker-vllm uses OpenAI chat completions format wrapped in {"input": ...}
    payload = {
        "model": "Qwen/Qwen2.5-1.5B-Instruct",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "max_tokens": 2048,
        "temperature": 0.1,
    }

    result = await _run_sync(LLM_ID, payload)

    # vLLM returns OpenAI-format response
    raw = ""
    if isinstance(result, dict):
        choices = result.get("choices", [])
        if choices:
            raw = choices[0].get("message", {}).get("content", "")
        elif "output" in result:
            raw = result["output"]
        elif "compliance" in result:
            return result

    if isinstance(result, str):
        raw = result

    raw = raw.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    return json.loads(raw.strip())

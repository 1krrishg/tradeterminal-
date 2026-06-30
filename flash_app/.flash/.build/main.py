"""
TradeTerminal — Runpod Flash endpoints
Two endpoints, one file, zero Docker.

Endpoint 1: tradeterminal-embedder  (BGE-M3, GPU)
Endpoint 2: tradeterminal-extractor (Qwen3.5-2B, GPU)

Deploy:
    cd flash_app
    export RUNPOD_API_KEY=your_key
    flash deploy

Dev (runs on remote GPU, hot-reload):
    flash dev
"""
from runpod_flash import Endpoint, GpuGroup

# ── Endpoint 1: BGE-M3 Embedder ─────────────────────────────────────────────
# Use runpod/pytorch base — has torch + CUDA pre-installed, skips the slow pip

@Endpoint(
    name="tradeterminal-embedder",
    gpu=GpuGroup.AMPERE_16,
    workers=(0, 3),
    idle_timeout=120,
    dependencies=["sentence-transformers"],  # torch already in base image
    flashboot=True,
)
async def embed(data: dict):
    """
    Input:  {"text": "string"}  OR  {"texts": ["a", "b", ...]}
    Output: {"embedding": [...]}  OR  {"embeddings": [[...], ...]}
    """
    from sentence_transformers import SentenceTransformer
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SentenceTransformer("BAAI/bge-m3", device=device)

    if "texts" in data:
        embeddings = model.encode(data["texts"], normalize_embeddings=True, batch_size=32)
        return {"embeddings": embeddings.tolist()}

    text = data.get("text", "")
    embedding = model.encode(text, normalize_embeddings=True)
    return {"embedding": embedding.tolist()}


# ── Endpoint 2: Qwen3.5-2B Trade Extractor ──────────────────────────────────

@Endpoint(
    name="tradeterminal-extractor",
    gpu=GpuGroup.AMPERE_16,
    workers=(0, 2),
    idle_timeout=120,
    dependencies=["transformers", "accelerate"],  # torch already in base image
    flashboot=True,
)
async def extract(data: dict):
    """
    Input:  {"query": "string", "context_chunks": ["...", "..."]}
    Output: {"compliance": {...}, "market": {...}}
    """
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import torch
    import json
    import re

    SYSTEM_PROMPT = """You are a trade compliance and market analysis engine. You receive a query about exporting a product between countries, plus retrieved data chunks from regulatory and market sources.

Output ONLY valid JSON. No explanations, no markdown, no preamble. No text before or after the JSON object.

{"compliance":{"hs_code":"string","duty_rate_percent":0,"required_documents":[{"name":"string","confidence":0.9,"source":"url"}],"certifications":[{"name":"string","confidence":0.9,"source":"url"}],"restrictions":[{"description":"string","confidence":0.9,"source":"url"}],"labeling_requirements":[{"description":"string","confidence":0.9,"source":"url"}],"common_rejection_reasons":["string"],"recent_regulation_changes":[{"description":"string","date":"string","source":"url"}],"import_fees_and_taxes":[{"name":"string","estimated_amount":"string"}]},"market":{"local_avg_price":"string","local_price_range":"string","seller_count":0,"competition_level":"low","consumer_sentiment":"positive","sentiment_summary":"string","top_complaints":["string"]}}

If data is not available, set confidence to 0.0 and use empty arrays. Never hallucinate — only extract from provided context."""

    MODEL_ID = "Qwen/Qwen3.5-2B"
    device = "cuda" if torch.cuda.is_available() else "cpu"

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto",
        trust_remote_code=True,
    )
    model.eval()

    query = data.get("query", "")
    chunks = data.get("context_chunks", [])
    context = "\n\n---\n\n".join(chunks[:10])

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Query: {query}\n\nContext:\n{context}"},
    ]

    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt").to(device)

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=2048,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated = output_ids[0][inputs["input_ids"].shape[1]:]
    raw = tokenizer.decode(generated, skip_special_tokens=True).strip()

    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    return json.loads(raw.strip())

"""
Runpod Flash Endpoint — BGE-M3 Multilingual Embedder
Deploy this as a Runpod serverless endpoint (no Docker required with Flash).

Input:  {"text": "chunk of text to embed"}
        OR {"texts": ["batch", "of", "texts"]}
Output: {"embedding": [0.1, 0.2, ...]}
        OR {"embeddings": [[...], [...]]}

Model: BAAI/bge-m3 — multilingual, 1024-dim, excellent for trade docs
"""
import runpod
from sentence_transformers import SentenceTransformer
import torch

# Load model once at startup (Runpod Flash caches the container between calls)
print("[embedder] Loading BGE-M3...")
model = SentenceTransformer(
    "BAAI/bge-m3",
    device="cuda" if torch.cuda.is_available() else "cpu",
)
print("[embedder] BGE-M3 loaded")


def handler(job: dict) -> dict:
    inp = job.get("input", {})

    # Batch mode
    if "texts" in inp:
        texts = inp["texts"]
        if not texts:
            return {"error": "texts list is empty"}
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32)
        return {"embeddings": embeddings.tolist()}

    # Single mode
    text = inp.get("text", "")
    if not text:
        return {"error": "text field is required"}

    embedding = model.encode(text, normalize_embeddings=True)
    return {"embedding": embedding.tolist()}


runpod.serverless.start({"handler": handler})

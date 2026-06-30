"""
RAG pipeline — chunk scraped text, embed via Runpod Flash BGE-M3, store in ChromaDB, retrieve top-K.
"""
import chromadb
import hashlib
from runpod_client import embed_text, embed_batch

# In-memory ChromaDB (no persistence needed for hackathon)
_client = chromadb.Client()
_collection = _client.get_or_create_collection(
    name="trade_docs",
    metadata={"hnsw:space": "cosine"},
)


def _chunk(text: str, max_tokens: int = 500, overlap: int = 50) -> list[str]:
    """Simple word-based chunker (approx 1 token ≈ 1 word for English)."""
    words = text.split()
    chunks = []
    step = max_tokens - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + max_tokens])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def _doc_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


async def index_documents(texts: list[str], metadata_tags: dict | None = None) -> int:
    """Chunk, embed, and store documents. Returns number of chunks indexed."""
    all_chunks = []
    for text in texts:
        if not text or len(text) < 20:
            continue
        all_chunks.extend(_chunk(text))

    if not all_chunks:
        return 0

    # Embed all chunks via Runpod Flash BGE-M3
    embeddings = await embed_batch(all_chunks)

    ids = [_doc_id(c) for c in all_chunks]
    metas = [metadata_tags or {} for _ in all_chunks]

    _collection.upsert(
        ids=ids,
        documents=all_chunks,
        embeddings=embeddings,
        metadatas=metas,
    )
    return len(all_chunks)


async def retrieve(query: str, top_k: int = 8) -> list[str]:
    """Embed query and retrieve top-K similar chunks."""
    q_embedding = await embed_text(query)
    results = _collection.query(
        query_embeddings=[q_embedding],
        n_results=min(top_k, _collection.count() or 1),
    )
    docs = results.get("documents", [[]])[0]
    return docs


def clear():
    """Clear the collection (between queries if needed)."""
    global _collection
    try:
        _client.delete_collection("trade_docs")
    except Exception:
        pass
    _collection = _client.get_or_create_collection(
        name="trade_docs",
        metadata={"hnsw:space": "cosine"},
    )

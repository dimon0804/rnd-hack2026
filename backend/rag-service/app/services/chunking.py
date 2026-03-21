"""Разбиение текста на чанки: LangChain, LlamaIndex или legacy (скользящее окно)."""

from app.core.config import settings
from app.services.text_sanitize import sanitize_postgres_text


def split_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    text = sanitize_postgres_text(text)
    if not text.strip():
        return []

    mode = settings.rag_chunker
    if mode == "legacy":
        return _split_legacy(text, chunk_size, chunk_overlap)
    if mode == "llama_index":
        return _split_llama_index(text, chunk_size, chunk_overlap)
    return _split_langchain(text, chunk_size, chunk_overlap)


def _split_legacy(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    clean = " ".join(text.split())
    if not clean:
        return []
    if len(clean) <= chunk_size:
        return [clean]

    chunks: list[str] = []
    step = max(1, chunk_size - chunk_overlap)
    start = 0
    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        chunks.append(clean[start:end])
        if end == len(clean):
            break
        start += step
    return chunks


def _split_langchain(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    parts = splitter.split_text(text)
    return [p.strip() for p in parts if p.strip()]


def _split_llama_index(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    from llama_index.core import Document
    from llama_index.core.node_parser import SentenceSplitter

    splitter = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    doc = Document(text=text)
    nodes = splitter.get_nodes_from_documents([doc])
    out: list[str] = []
    for n in nodes:
        c = n.get_content().strip()
        if c:
            out.append(c)
    return out

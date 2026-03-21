"""Разбиение текста на чанки: semantic (смысловые границы), LangChain, LlamaIndex или legacy."""

from __future__ import annotations

import re

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
    if mode == "semantic":
        return _split_semantic(text, chunk_size, chunk_overlap)
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


def _ensure_paragraph_breaks(text: str) -> str:
    """Если из PDF пришёл почти без переносов — добавляем границы после конца предложения (перед заглавной)."""
    if text.count("\n") >= max(3, len(text) // 3000):
        return text
    return re.sub(r"([.!?])\s+(?=[А-ЯЁA-Z])", r"\1\n\n", text)


def _split_oversized_block(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Длинный абзац режем по предложениям/строкам, не склеивая с другими блоками."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=[
            "\n\n",
            "\n",
            ". ",
            "! ",
            "? ",
            ".\n",
            "; ",
            " — ",
            ", ",
            " ",
            "",
        ],
    )
    parts = splitter.split_text(text)
    return [p.strip() for p in parts if p.strip()]


def _split_semantic(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Смысловое разбиение: сначала абзацы (пустые строки), каждый абзац — отдельный чанк или
    внутренний сплит без смешения с соседними абзацами — меньше «две темы в одном чанке».
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _ensure_paragraph_breaks(text)
    # Нормализация пробелов внутри строк, сохраняем \n
    lines = [" ".join(line.split()) for line in text.split("\n")]
    text = "\n".join(lines)

    raw_paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    if not raw_paragraphs:
        return []

    out: list[str] = []
    tiny_buf: list[str] = []
    tiny_max = min(120, chunk_size // 5)

    def flush_tiny() -> None:
        nonlocal tiny_buf
        if not tiny_buf:
            return
        merged = "\n\n".join(tiny_buf)
        tiny_buf = []
        if len(merged) <= chunk_size:
            out.append(merged)
        else:
            out.extend(_split_oversized_block(merged, chunk_size, chunk_overlap))

    for p in raw_paragraphs:
        if len(p) <= tiny_max and len(p) < chunk_size:
            if tiny_buf and sum(len(x) + 2 for x in tiny_buf) + len(p) + 2 > chunk_size:
                flush_tiny()
            tiny_buf.append(p)
            continue
        flush_tiny()

        if len(p) <= chunk_size:
            out.append(p)
        else:
            out.extend(_split_oversized_block(p, chunk_size, chunk_overlap))

    flush_tiny()
    return out


def _split_langchain(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
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

from app.services.text_sanitize import sanitize_postgres_text


def split_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    text = sanitize_postgres_text(text)
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

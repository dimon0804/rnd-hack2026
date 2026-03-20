"""Извлечение текста из загруженных файлов (PDF, DOCX, TXT)."""

from pathlib import Path


def extract_text_from_file(mime_type: str, path: Path) -> str:
    mt = mime_type.split(";")[0].strip().lower()
    if mt == "application/pdf":
        return _pdf(path)
    if mt == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _docx(path)
    if mt == "text/plain":
        return _txt(path)
    raise ValueError(f"Неподдерживаемый тип: {mime_type}")


def _pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    return "\n".join(parts)


def _docx(path: Path) -> str:
    from docx import Document

    document = Document(str(path))
    return "\n".join(p.text for p in document.paragraphs if p.text)


def _txt(path: Path) -> str:
    raw = path.read_bytes()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1", errors="replace")

import os
import re
import uuid
from pathlib import Path

from app.core.config import settings

_ALLOWED_MIME = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }
)


def allowed_mime(content_type: str | None) -> bool:
    if not content_type:
        return False
    base = content_type.split(";")[0].strip().lower()
    return base in _ALLOWED_MIME


def sanitize_filename(name: str) -> str:
    base = os.path.basename(name.replace("\\", "/"))
    base = re.sub(r"[^\w.\- ()\[\]]+", "_", base).strip()
    return base or "file"


async def save_upload(document_id: uuid.UUID, filename: str, data: bytes) -> str:
    root = Path(settings.upload_dir) / str(document_id)
    root.mkdir(parents=True, exist_ok=True)
    safe = sanitize_filename(filename)
    path = root / safe
    path.write_bytes(data)
    return str(path.relative_to(settings.upload_dir))


def validate_size(size: int) -> None:
    if size <= 0:
        raise ValueError("Empty file")
    if size > settings.max_upload_bytes:
        raise ValueError(f"File too large (max {settings.max_upload_bytes} bytes)")

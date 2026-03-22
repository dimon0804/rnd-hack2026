import os
import re
import uuid
from pathlib import Path

from app.core.config import settings

_ALLOWED_MIME = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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


def read_document_bytes(storage_path: str) -> bytes:
    """Прочитать файл из UPLOAD_DIR по относительному storage_path (как в Document)."""
    root = Path(settings.upload_dir).resolve()
    rel = storage_path.replace("\\", "/").lstrip("/")
    try:
        full = (root / rel).resolve()
    except (OSError, ValueError) as e:
        raise ValueError("Invalid storage path") from e
    if not str(full).startswith(str(root)):
        raise ValueError("Invalid storage path")
    if not full.is_file():
        raise FileNotFoundError("File not found on disk")
    return full.read_bytes()


async def copy_document_file_to_new_id(src_storage_path: str, original_filename: str, new_id: uuid.UUID) -> str:
    """Скопировать байты в новый каталог документа (для импорта из общей ссылки)."""
    data = read_document_bytes(src_storage_path)
    validate_size(len(data))
    return await save_upload(new_id, original_filename, data)


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

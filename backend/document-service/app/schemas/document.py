import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    status: str
    status_message: str | None
    created_at: datetime
    topic_group_id: uuid.UUID | None = None
    group_document_ids: list[uuid.UUID] = Field(default_factory=list)
    collection_ids: list[uuid.UUID] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    status: str
    message: str = Field(default="Uploaded and queued for indexing")
    topic_group_id: uuid.UUID | None = None


class BatchUploadItem(BaseModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    status: str
    message: str
    topic_group_id: uuid.UUID | None = None


class BatchUploadResponse(BaseModel):
    results: list[BatchUploadItem]
    groups_note: str = Field(
        default="",
        description="Кратко: какие файлы объединены по теме, какие отдельно",
    )

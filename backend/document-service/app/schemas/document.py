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


class MimeTypeStat(BaseModel):
    """Сводка по одному MIME-типу для личного кабинета."""

    mime_type: str
    label_ru: str
    count: int
    bytes_total: int = Field(ge=0)


class TopicGroupMemberStat(BaseModel):
    """Документ внутри тематической группы."""

    document_id: uuid.UUID
    original_filename: str
    status: str


class TopicGroupStat(BaseModel):
    """Одна тематическая группа (пакетная загрузка, общая тема)."""

    topic_group_id: uuid.UUID
    document_count: int = Field(ge=1)
    total_bytes: int = Field(ge=0)
    members: list[TopicGroupMemberStat] = Field(default_factory=list)


class DocumentStatsResponse(BaseModel):
    """Агрегаты по документам текущего пользователя."""

    total_documents: int = Field(ge=0)
    total_bytes: int = Field(ge=0)
    ready_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    pending_or_processing_count: int = Field(ge=0)
    mime_breakdown: list[MimeTypeStat] = Field(default_factory=list)
    topic_groups_count: int = Field(ge=0, description="Число различных тематических групп (≥2 файлов в группе)")
    documents_in_groups: int = Field(ge=0)
    documents_standalone: int = Field(ge=0)
    topic_groups: list[TopicGroupStat] = Field(
        default_factory=list,
        description="Список групп с составом файлов (для личного кабинета)",
    )
    first_upload_at: datetime | None = None
    last_upload_at: datetime | None = None

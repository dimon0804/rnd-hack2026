import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.document import DocumentResponse


class CollectionResponse(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class CollectionRename(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class DocumentCollectionsBody(BaseModel):
    collection_ids: list[uuid.UUID] = Field(default_factory=list)


class CollectionShareCreate(BaseModel):
    """Создать read-only ссылку на документы в выбранных коллекциях (объединение по OR)."""

    collection_ids: list[uuid.UUID] = Field(min_length=1, max_length=32)
    title: str | None = Field(default=None, max_length=200)


class CollectionShareCreated(BaseModel):
    token: uuid.UUID
    url_path: str = Field(description="Относительный путь для фронта, например /share/{token}")


class CollectionShareSummary(BaseModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime
    revoked_at: datetime | None
    collection_ids: list[uuid.UUID]


class SharedCollectionLabel(BaseModel):
    id: uuid.UUID
    name: str


class SharedCollectionView(BaseModel):
    title: str | None
    collections: list[SharedCollectionLabel]
    documents: list[DocumentResponse]
    viewer_role: Literal["viewer", "owner"] = Field(
        default="viewer",
        description="owner — если запрос с JWT владельца ссылки; иначе viewer",
    )

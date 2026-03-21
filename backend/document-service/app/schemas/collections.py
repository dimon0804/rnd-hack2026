import uuid
from datetime import datetime

from pydantic import BaseModel, Field


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

from pydantic import BaseModel, Field


class IndexDocumentRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=10)
    chunk_size: int = Field(default=700, ge=200, le=2000)
    chunk_overlap: int = Field(default=100, ge=0, le=500)


class IndexDocumentResponse(BaseModel):
    document_id: str
    chunks_indexed: int


class QueryRequest(BaseModel):
    query: str = Field(min_length=2)
    top_k: int = Field(default=4, ge=1, le=20)
    document_ids: list[str] | None = Field(
        default=None,
        description="Ограничить поиск чанками этих document_id (документы текущего пользователя).",
    )


class ChunkResult(BaseModel):
    document_id: str
    chunk_id: int
    score: float
    text: str


class QueryResponse(BaseModel):
    results: list[ChunkResult]

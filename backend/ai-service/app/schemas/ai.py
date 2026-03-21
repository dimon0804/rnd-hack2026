from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    system_prompt: str = Field(default="You are a helpful assistant.")
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=800, ge=1, le=4096)


class ChatResponse(BaseModel):
    content: str
    model: str


class TranscribeResponse(BaseModel):
    text: str


class ExtractTableRequest(BaseModel):
    """Текст из RAG/документа → одна таблица в формате CSV (разделитель запятая)."""

    source_text: str = Field(min_length=1, max_length=32000)
    focus: str | None = Field(default=None, max_length=500)
    temperature: float = Field(default=0.12, ge=0, le=2)
    max_tokens: int = Field(default=2000, ge=200, le=4096)


class ExtractTableResponse(BaseModel):
    csv_text: str
    model: str


class TopicGroupItem(BaseModel):
    filename: str = Field(min_length=1, max_length=512)
    preview: str = Field(min_length=0, max_length=12000)


class TopicGroupsRequest(BaseModel):
    """Фрагменты текстов для разбиения по теме (индексы 0..n-1)."""

    items: list[TopicGroupItem] = Field(min_length=2, max_length=20)


class TopicGroupsResponse(BaseModel):
    """Списки индексов файлов; каждый индекс встречается ровно один раз."""

    groups: list[list[int]]

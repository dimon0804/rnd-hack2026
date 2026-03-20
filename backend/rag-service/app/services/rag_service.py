from app.schemas.rag import ChunkResult, IndexDocumentResponse, QueryResponse
from app.services.chunking import split_text
from app.services.vector_store import InMemoryVectorStore


class RagService:
    def __init__(self, store: InMemoryVectorStore) -> None:
        self._store = store

    def index_document(self, document_id: str, text: str, chunk_size: int, chunk_overlap: int) -> IndexDocumentResponse:
        chunks = split_text(text=text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        count = self._store.add_document_chunks(document_id=document_id, chunks=chunks)
        return IndexDocumentResponse(document_id=document_id, chunks_indexed=count)

    def query(self, query_text: str, top_k: int, document_ids: list[str] | None = None) -> QueryResponse:
        allowed = set(document_ids) if document_ids is not None else None
        rows = self._store.query(query=query_text, top_k=top_k, allowed_document_ids=allowed)
        return QueryResponse(
            results=[
                ChunkResult(
                    document_id=row.document_id,
                    chunk_id=row.chunk_id,
                    score=score,
                    text=row.text,
                )
                for row, score in rows
            ]
        )

from app.db.chunk_repository import ChunkRepository
from app.schemas.rag import ChunkResult, IndexDocumentResponse, QueryResponse
from app.services.chunking import split_text
from app.services.vector_store import InMemoryVectorStore


class RagService:
    def __init__(self, store: InMemoryVectorStore, chunk_repo: ChunkRepository | None = None) -> None:
        self._store = store
        self._chunk_repo = chunk_repo

    def index_document(self, document_id: str, text: str, chunk_size: int, chunk_overlap: int) -> IndexDocumentResponse:
        chunks = split_text(text=text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        count = self._store.add_document_chunks(document_id=document_id, chunks=chunks)
        if self._chunk_repo is not None:
            if chunks:
                self._chunk_repo.save_document_chunks(document_id, chunks)
            else:
                self._chunk_repo.delete_document(document_id)
        return IndexDocumentResponse(document_id=document_id, chunks_indexed=count)

    def query(
        self,
        query_text: str,
        top_k: int,
        document_ids: list[str] | None = None,
        search_mode: str = "semantic",
    ) -> QueryResponse:
        allowed = set(document_ids) if document_ids is not None else None
        rows = self._store.query(
            query=query_text,
            top_k=top_k,
            allowed_document_ids=allowed,
            search_mode=search_mode,
        )
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

    def chunks_for_document(self, document_id: str) -> QueryResponse:
        chunks = self._store.chunks_for_document(document_id)
        return QueryResponse(
            results=[
                ChunkResult(document_id=c.document_id, chunk_id=c.chunk_id, score=1.0, text=c.text) for c in chunks
            ]
        )

    def index_stats(self) -> dict[str, int | str]:
        return self._store.stats()

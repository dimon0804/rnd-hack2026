from fastapi import APIRouter, Request

from app.schemas.rag import IndexDocumentRequest, IndexDocumentResponse, QueryRequest, QueryResponse

router = APIRouter()


@router.post("/index", response_model=IndexDocumentResponse)
def index_document(body: IndexDocumentRequest, request: Request) -> IndexDocumentResponse:
    rag_service = request.app.state.rag_service
    return rag_service.index_document(
        document_id=body.document_id,
        text=body.text,
        chunk_size=body.chunk_size,
        chunk_overlap=body.chunk_overlap,
    )


@router.post("/query", response_model=QueryResponse)
def query(body: QueryRequest, request: Request) -> QueryResponse:
    rag_service = request.app.state.rag_service
    return rag_service.query(query_text=body.query, top_k=body.top_k)

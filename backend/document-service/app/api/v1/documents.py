import uuid

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id_optional, require_user_or_anonymous
from app.models.document import Document, DocumentStatus
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services.rag_client import notify_ingest_safe
from app.services.storage import allowed_mime, save_upload, validate_size

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> DocumentUploadResponse:
    content_type = file.content_type
    if not allowed_mime(content_type):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Allowed types: PDF, DOCX, TXT",
        )

    data = await file.read()
    try:
        validate_size(len(data))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e)) from e

    doc_id = uuid.uuid4()
    storage_rel = await save_upload(doc_id, file.filename or "file", data)

    doc = Document(
        id=doc_id,
        user_id=user_id,
        original_filename=file.filename or "file",
        mime_type=content_type.split(";")[0].strip(),
        size_bytes=len(data),
        storage_path=storage_rel,
        status=DocumentStatus.pending.value,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    client: httpx.AsyncClient = request.app.state.http_client
    err = await notify_ingest_safe(client, doc.id, doc.storage_path, doc.mime_type, user_id)
    if err:
        doc.status = DocumentStatus.failed.value
        doc.status_message = err[:1000]
    else:
        doc.status = DocumentStatus.queued.value
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentUploadResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        message="Uploaded and queued for indexing" if not err else "Stored but RAG handoff failed",
    )


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> list[Document]:
    if user_id is None:
        return []
    rows = db.scalars(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc()),
    ).all()
    return list(rows)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id_optional),
) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id is not None:
        if user_id is None or user_id != doc.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    elif not settings.allow_anonymous_upload and user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return doc

import logging
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id_optional, require_user_or_anonymous
from app.models.collection import DocumentCollection, DocumentCollectionMember
from app.models.document import Document, DocumentStatus
from app.schemas.collections import (
    CollectionCreate,
    CollectionRename,
    CollectionResponse,
    DocumentCollectionsBody,
)
from app.schemas.document import (
    BatchUploadItem,
    BatchUploadResponse,
    DocumentResponse,
    DocumentUploadResponse,
)
from app.services.batch_upload import (
    ai_partition_topics,
    assign_topic_group_ids,
    fallback_singleton_groups,
    groups_note_ru,
    rag_extract_preview,
    validate_groups,
)
from app.services.collection_links import (
    batch_collection_ids_map,
    parse_collection_ids_json,
    set_document_collection_links,
)
from app.services.rag_client import notify_ingest_safe
from app.services.storage import allowed_mime, save_upload, validate_size

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_BATCH_FILES = 15


def _attach_collections_if_any(
    db: Session,
    doc_id: uuid.UUID,
    user_id: int | None,
    collection_ids_raw: str | None,
) -> None:
    if user_id is None:
        return
    cids = parse_collection_ids_json(collection_ids_raw)
    if not cids:
        return
    try:
        set_document_collection_links(db, doc_id, user_id, cids)
    except ValueError:
        logger.warning("collection_ids rejected for document %s", doc_id)


def _group_ids_for(db: Session, doc: Document) -> list[uuid.UUID]:
    if doc.topic_group_id is None:
        return [doc.id]
    q = select(Document.id).where(Document.topic_group_id == doc.topic_group_id)
    if doc.user_id is not None:
        q = q.where(Document.user_id == doc.user_id)
    else:
        q = q.where(Document.user_id.is_(None))
    rows = db.scalars(q.order_by(Document.created_at.asc())).all()
    return list(rows)


def build_document_response(
    db: Session,
    doc: Document,
    collection_ids: list[uuid.UUID] | None = None,
) -> DocumentResponse:
    if collection_ids is None:
        collection_ids = list(
            db.scalars(
                select(DocumentCollectionMember.collection_id).where(
                    DocumentCollectionMember.document_id == doc.id,
                ),
            ).all(),
        )
    return DocumentResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        status_message=doc.status_message,
        created_at=doc.created_at,
        topic_group_id=doc.topic_group_id,
        group_document_ids=_group_ids_for(db, doc),
        collection_ids=collection_ids,
    )


# --- Коллекции (маршруты до /{document_id}, чтобы не пересекаться с UUID) ---


@router.get("/collections", response_model=list[CollectionResponse])
def list_collections(
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> list[CollectionResponse]:
    if user_id is None:
        return []
    rows = db.scalars(
        select(DocumentCollection)
        .where(DocumentCollection.user_id == user_id)
        .order_by(DocumentCollection.name.asc()),
    ).all()
    return list(rows)


@router.post("/collections", response_model=CollectionResponse)
def create_collection(
    body: CollectionCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> DocumentCollection:
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Войдите, чтобы создавать коллекции")
    col = DocumentCollection(user_id=user_id, name=body.name.strip())
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


@router.patch("/collections/{collection_id}", response_model=CollectionResponse)
def rename_collection(
    collection_id: uuid.UUID,
    body: CollectionRename,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> DocumentCollection:
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    col = db.get(DocumentCollection, collection_id)
    if col is None or col.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    col.name = body.name.strip()
    db.add(col)
    db.commit()
    db.refresh(col)
    return col


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> Response:
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    col = db.get(DocumentCollection, collection_id)
    if col is None or col.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    db.delete(col)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{document_id}/collections", response_model=DocumentResponse)
def patch_document_collections(
    document_id: uuid.UUID,
    body: DocumentCollectionsBody,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id_optional),
) -> DocumentResponse:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id is None or user_id is None or doc.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    try:
        set_document_collection_links(db, doc.id, user_id, body.collection_ids)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    db.refresh(doc)
    return build_document_response(db, doc)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    collection_ids: str | None = Form(None),
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
        topic_group_id=None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    client: httpx.AsyncClient = request.app.state.http_client
    outcome = await notify_ingest_safe(client, doc.id, doc.storage_path, doc.mime_type, user_id)
    if outcome.success:
        doc.status = DocumentStatus.ready.value
        doc.status_message = outcome.detail[:1000] if outcome.detail else None
        upload_msg = outcome.detail or f"Проиндексировано фрагментов: {outcome.chunks_indexed}"
    else:
        doc.status = DocumentStatus.failed.value
        doc.status_message = outcome.detail[:1000]
        upload_msg = outcome.detail or "Не удалось проиндексировать документ"
    db.add(doc)
    db.commit()
    db.refresh(doc)

    _attach_collections_if_any(db, doc.id, user_id, collection_ids)

    return DocumentUploadResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        message=upload_msg,
        topic_group_id=None,
    )


@router.post("/upload-batch", response_model=BatchUploadResponse)
async def upload_document_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    collection_ids: str | None = Form(None),
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
) -> BatchUploadResponse:
    """Несколько файлов: проверка тематики (LLM), объединение в группы или отдельные документы."""
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет файлов")
    if len(files) > _MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не более {_MAX_BATCH_FILES} файлов за раз",
        )

    prepared: list[tuple[str, str, bytes]] = []
    for f in files:
        ct = f.content_type
        if not allowed_mime(ct):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Неподдерживаемый тип: {f.filename}",
            )
        data = await f.read()
        try:
            validate_size(len(data))
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{f.filename}: {e}",
            ) from e
        mime = ct.split(";")[0].strip()
        prepared.append((f.filename or "file", mime, data))

    n = len(prepared)
    client: httpx.AsyncClient = request.app.state.http_client

    if n == 1:
        filename, mime, data = prepared[0]
        doc_id = uuid.uuid4()
        storage_rel = await save_upload(doc_id, filename, data)
        doc = Document(
            id=doc_id,
            user_id=user_id,
            original_filename=filename,
            mime_type=mime,
            size_bytes=len(data),
            storage_path=storage_rel,
            status=DocumentStatus.pending.value,
            topic_group_id=None,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        outcome = await notify_ingest_safe(client, doc.id, doc.storage_path, doc.mime_type, user_id)
        if outcome.success:
            doc.status = DocumentStatus.ready.value
            doc.status_message = outcome.detail[:1000] if outcome.detail else None
            msg = outcome.detail or f"Проиндексировано фрагментов: {outcome.chunks_indexed}"
        else:
            doc.status = DocumentStatus.failed.value
            doc.status_message = outcome.detail[:1000]
            msg = outcome.detail or "Не удалось проиндексировать документ"
        db.add(doc)
        db.commit()
        db.refresh(doc)
        _attach_collections_if_any(db, doc.id, user_id, collection_ids)
        return BatchUploadResponse(
            results=[
                BatchUploadItem(
                    id=doc.id,
                    original_filename=doc.original_filename,
                    mime_type=doc.mime_type,
                    size_bytes=doc.size_bytes,
                    status=doc.status,
                    message=msg,
                    topic_group_id=None,
                ),
            ],
            groups_note="Один файл — группировка по теме не требуется.",
        )

    previews: list[str] = []
    filenames = [p[0] for p in prepared]
    for filename, mime, data in prepared:
        try:
            pv = await rag_extract_preview(client, data, filename, mime)
        except Exception as exc:  # noqa: BLE001
            previews.append("")
            logger.warning("preview extract failed for %s: %s", filename, str(exc)[:200])
        else:
            previews.append(pv)

    items_ai: list[dict[str, str]] = []
    for fn, pv in zip(filenames, previews):
        items_ai.append({"filename": fn, "preview": pv[:4000] if pv else "(текст не извлечён)"})

    groups: list[list[int]] = fallback_singleton_groups(n)
    try:
        groups = await ai_partition_topics(client, items_ai)
        if not validate_groups(groups, n):
            groups = fallback_singleton_groups(n)
    except Exception:  # noqa: BLE001
        groups = fallback_singleton_groups(n)

    index_to_topic = assign_topic_group_ids(groups)
    note = groups_note_ru(groups, filenames)

    results: list[BatchUploadItem] = []
    for i, (filename, mime, data) in enumerate(prepared):
        doc_id = uuid.uuid4()
        storage_rel = await save_upload(doc_id, filename, data)
        tgid = index_to_topic.get(i)
        doc = Document(
            id=doc_id,
            user_id=user_id,
            original_filename=filename,
            mime_type=mime,
            size_bytes=len(data),
            storage_path=storage_rel,
            status=DocumentStatus.pending.value,
            topic_group_id=tgid,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        outcome = await notify_ingest_safe(client, doc.id, doc.storage_path, doc.mime_type, user_id)
        if outcome.success:
            doc.status = DocumentStatus.ready.value
            doc.status_message = outcome.detail[:1000] if outcome.detail else None
            msg = outcome.detail or f"Проиндексировано фрагментов: {outcome.chunks_indexed}"
        else:
            doc.status = DocumentStatus.failed.value
            doc.status_message = outcome.detail[:1000]
            msg = outcome.detail or "Не удалось проиндексировать документ"
        db.add(doc)
        db.commit()
        db.refresh(doc)
        _attach_collections_if_any(db, doc.id, user_id, collection_ids)
        results.append(
            BatchUploadItem(
                id=doc.id,
                original_filename=doc.original_filename,
                mime_type=doc.mime_type,
                size_bytes=doc.size_bytes,
                status=doc.status,
                message=msg,
                topic_group_id=doc.topic_group_id,
            ),
        )

    return BatchUploadResponse(results=results, groups_note=note)


@router.post("/{document_id}/reindex", response_model=DocumentUploadResponse)
async def reindex_document(
    document_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id_optional),
) -> DocumentUploadResponse:
    """Повторная индексация в RAG с диска (после рестарта rag-service, пустого индекса и т.п.)."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id is not None:
        if user_id is None or user_id != doc.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    elif not settings.allow_anonymous_upload and user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    client: httpx.AsyncClient = request.app.state.http_client
    outcome = await notify_ingest_safe(client, doc.id, doc.storage_path, doc.mime_type, user_id)
    if outcome.success:
        doc.status = DocumentStatus.ready.value
        doc.status_message = outcome.detail[:1000] if outcome.detail else None
        msg = outcome.detail or f"Проиндексировано фрагментов: {outcome.chunks_indexed}"
    else:
        doc.status = DocumentStatus.failed.value
        doc.status_message = outcome.detail[:1000]
        msg = outcome.detail or "Не удалось проиндексировать документ"
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentUploadResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        status=doc.status,
        message=msg,
        topic_group_id=doc.topic_group_id,
    )


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    user_id: int | None = Depends(require_user_or_anonymous),
    collection_id: uuid.UUID | None = Query(
        None,
        description="Устаревший одиночный фильтр; эквивалент одного значения в collection_ids",
    ),
    collection_ids: list[uuid.UUID] = Query(
        default=[],
        description="Документы, состоящие хотя бы в одной из перечисленных коллекций (объединение)",
    ),
) -> list[DocumentResponse]:
    if user_id is None:
        return []
    q = select(Document).where(Document.user_id == user_id)
    filter_ids: set[uuid.UUID] = set(collection_ids)
    if collection_id is not None:
        filter_ids.add(collection_id)
    if filter_ids:
        for cid in filter_ids:
            col = db.get(DocumentCollection, cid)
            if col is None or col.user_id != user_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
        q = q.join(
            DocumentCollectionMember,
            DocumentCollectionMember.document_id == Document.id,
        ).where(DocumentCollectionMember.collection_id.in_(filter_ids))
    rows = db.scalars(q.order_by(Document.created_at.desc())).unique().all()
    ids = [d.id for d in rows]
    batch = batch_collection_ids_map(db, ids)
    return [build_document_response(db, d, batch.get(d.id, [])) for d in rows]


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id_optional),
) -> DocumentResponse:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id is not None:
        if user_id is None or user_id != doc.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    elif not settings.allow_anonymous_upload and user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return build_document_response(db, doc)


@router.get("/{document_id}/file")
def download_document_file(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id_optional),
) -> FileResponse:
    """Оригинальный загруженный файл (те же права, что у GET /documents/{id})."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.user_id is not None:
        if user_id is None or user_id != doc.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    elif not settings.allow_anonymous_upload and user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    root = Path(settings.upload_dir).resolve()
    rel = doc.storage_path.replace("\\", "/").lstrip("/")
    try:
        full = (root / rel).resolve()
    except (OSError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid storage path") from e
    if not str(full).startswith(str(root)):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid storage path")
    if not full.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    return FileResponse(
        path=str(full),
        filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
    )

import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id_optional, require_user_or_anonymous
from app.models.document import Document, DocumentStatus
from app.schemas.document import (
    BatchUploadItem,
    BatchUploadResponse,
    DocumentResponse,
    DocumentStatsResponse,
    DocumentUploadResponse,
    MimeTypeStat,
    TopicGroupMemberStat,
    TopicGroupStat,
)
from app.services.batch_upload import (
    ai_partition_topics,
    assign_topic_group_ids,
    fallback_singleton_groups,
    groups_note_ru,
    rag_extract_preview,
    validate_groups,
)
from app.services.rag_client import notify_ingest_safe
from app.services.storage import allowed_mime, save_upload, validate_size

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_BATCH_FILES = 15

_MIME_LABEL_RU: dict[str, str] = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (DOCX)",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint (PPTX)",
    "text/plain": "Текст (TXT)",
}


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


def build_document_response(db: Session, doc: Document) -> DocumentResponse:
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
    )


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
) -> list[DocumentResponse]:
    if user_id is None:
        return []
    rows = db.scalars(
        select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc()),
    ).all()
    return [build_document_response(db, d) for d in rows]


@router.get("/stats", response_model=DocumentStatsResponse)
def document_stats(
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id_optional),
) -> DocumentStatsResponse:
    """Сводка по загруженным документам пользователя (личный кабинет)."""
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Войдите в аккаунт, чтобы открыть личный кабинет.",
        )
    rows = db.scalars(select(Document).where(Document.user_id == user_id)).all()
    if not rows:
        return DocumentStatsResponse(
            total_documents=0,
            total_bytes=0,
            ready_count=0,
            failed_count=0,
            pending_or_processing_count=0,
            mime_breakdown=[],
            topic_groups_count=0,
            documents_in_groups=0,
            documents_standalone=0,
            topic_groups=[],
            first_upload_at=None,
            last_upload_at=None,
        )

    total_bytes = sum(d.size_bytes for d in rows)

    def _norm_status(s: str) -> str:
        return (s or "").strip().lower()

    ready_count = sum(1 for d in rows if _norm_status(d.status) == "ready")
    failed_count = sum(1 for d in rows if _norm_status(d.status) == "failed")
    pending_or_processing_count = sum(
        1 for d in rows if _norm_status(d.status) not in ("ready", "failed")
    )

    by_mime: dict[str, tuple[int, int]] = {}
    for d in rows:
        mime = (d.mime_type or "").split(";")[0].strip().lower()
        if not mime:
            mime = "unknown"
        cnt, bts = by_mime.get(mime, (0, 0))
        by_mime[mime] = (cnt + 1, bts + d.size_bytes)

    mime_breakdown = [
        MimeTypeStat(
            mime_type=m,
            label_ru=_MIME_LABEL_RU.get(m, m if m != "unknown" else "Неизвестный тип"),
            count=c,
            bytes_total=b,
        )
        for m, (c, b) in sorted(by_mime.items(), key=lambda x: -x[1][0])
    ]

    gids = {d.topic_group_id for d in rows if d.topic_group_id is not None}
    documents_in_groups = sum(1 for d in rows if d.topic_group_id is not None)
    documents_standalone = sum(1 for d in rows if d.topic_group_id is None)

    by_tg: dict[uuid.UUID, list[Document]] = {}
    for d in rows:
        if d.topic_group_id is None:
            continue
        by_tg.setdefault(d.topic_group_id, []).append(d)

    _dt_min = datetime.min.replace(tzinfo=timezone.utc)
    topic_groups_list: list[TopicGroupStat] = []
    for tgid, members in by_tg.items():
        members_sorted = sorted(
            members,
            key=lambda x: x.created_at if x.created_at is not None else _dt_min,
        )
        topic_groups_list.append(
            TopicGroupStat(
                topic_group_id=tgid,
                document_count=len(members_sorted),
                total_bytes=sum(m.size_bytes for m in members_sorted),
                members=[
                    TopicGroupMemberStat(
                        document_id=m.id,
                        original_filename=m.original_filename,
                        status=m.status,
                    )
                    for m in members_sorted
                ],
            ),
        )

    def _group_latest(g: TopicGroupStat) -> datetime:
        ms = by_tg[g.topic_group_id]
        dates = [m.created_at for m in ms if m.created_at is not None]
        return max(dates) if dates else _dt_min

    topic_groups_list.sort(key=_group_latest, reverse=True)

    created = [d.created_at for d in rows if d.created_at is not None]
    first_upload_at = min(created) if created else None
    last_upload_at = max(created) if created else None

    return DocumentStatsResponse(
        total_documents=len(rows),
        total_bytes=total_bytes,
        ready_count=ready_count,
        failed_count=failed_count,
        pending_or_processing_count=pending_or_processing_count,
        mime_breakdown=mime_breakdown,
        topic_groups_count=len(gids),
        documents_in_groups=documents_in_groups,
        documents_standalone=documents_standalone,
        topic_groups=topic_groups_list,
        first_upload_at=first_upload_at,
        last_upload_at=last_upload_at,
    )


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

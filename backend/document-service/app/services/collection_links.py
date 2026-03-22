"""Связь документов с персональными коллекциями пользователя."""

from __future__ import annotations

import json
import logging
import uuid
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.collection import DocumentCollection, DocumentCollectionMember

logger = logging.getLogger(__name__)


def parse_collection_ids_json(raw: str | None) -> list[uuid.UUID]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out: list[uuid.UUID] = []
    for x in data:
        try:
            out.append(uuid.UUID(str(x)))
        except (ValueError, TypeError):
            continue
    return out


def verify_collections_owned(db: Session, user_id: int, ids: list[uuid.UUID]) -> None:
    if not ids:
        return
    q = select(DocumentCollection.id).where(
        DocumentCollection.user_id == user_id,
        DocumentCollection.id.in_(ids),
    )
    found = set(db.scalars(q).all())
    missing = set(ids) - found
    if missing:
        raise ValueError("Неизвестная коллекция или нет доступа")


def set_document_collection_links(
    db: Session,
    document_id: uuid.UUID,
    user_id: int,
    collection_ids: list[uuid.UUID],
) -> None:
    verify_collections_owned(db, user_id, collection_ids)
    db.execute(delete(DocumentCollectionMember).where(DocumentCollectionMember.document_id == document_id))
    for cid in collection_ids:
        db.add(DocumentCollectionMember(document_id=document_id, collection_id=cid))
    db.commit()


def batch_collection_ids_map(db: Session, doc_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[uuid.UUID]]:
    if not doc_ids:
        return {}
    q = select(DocumentCollectionMember.document_id, DocumentCollectionMember.collection_id).where(
        DocumentCollectionMember.document_id.in_(doc_ids),
    )
    out: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    for row in db.execute(q).all():
        out[row[0]].append(row[1])
    return dict(out)

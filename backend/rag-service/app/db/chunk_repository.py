"""Персистентное хранение чанков RAG в PostgreSQL (индекс TF-IDF или эмбеддинги пересобирается в памяти при старте)."""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import TYPE_CHECKING

import psycopg
from psycopg.rows import tuple_row

from app.services.text_sanitize import sanitize_postgres_text
from app.services.vector_store import InMemoryVectorStore, StoredChunk, _norm_doc_id

if TYPE_CHECKING:
    from app.core.config import Settings

logger = logging.getLogger(__name__)

_TABLE = "rag_index_chunks"


class ChunkRepository:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _connect(self) -> psycopg.Connection:
        return psycopg.connect(
            host=self._settings.postgres_host,
            port=self._settings.postgres_port,
            dbname=self._settings.postgres_db,
            user=self._settings.postgres_user,
            password=self._settings.postgres_password,
            connect_timeout=15,
        )

    def init_schema(self) -> None:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {_TABLE} (
                        document_id VARCHAR(64) NOT NULL,
                        chunk_id INTEGER NOT NULL,
                        chunk_text TEXT NOT NULL,
                        PRIMARY KEY (document_id, chunk_id)
                    );
                    """
                )
                cur.execute(
                    f"CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON {_TABLE} (document_id);"
                )
            conn.commit()
        logger.info("RAG chunks table ready in PostgreSQL")

    def save_document_chunks(self, document_id: str, chunks: list[str]) -> None:
        """Сохранить чанки документа. UPSERT устраняет duplicate key при параллельном reindex."""
        nid = _norm_doc_id(document_id)
        upsert = f"""
            INSERT INTO {_TABLE} (document_id, chunk_id, chunk_text)
            VALUES (%s, %s, %s)
            ON CONFLICT (document_id, chunk_id) DO UPDATE
            SET chunk_text = EXCLUDED.chunk_text
        """
        with self._connect() as conn:
            with conn.cursor() as cur:
                if not chunks:
                    cur.execute(f"DELETE FROM {_TABLE} WHERE document_id = %s", (nid,))
                else:
                    cur.execute(
                        f"DELETE FROM {_TABLE} WHERE document_id = %s AND chunk_id >= %s",
                        (nid, len(chunks)),
                    )
                    for i, text in enumerate(chunks):
                        cur.execute(upsert, (nid, i, sanitize_postgres_text(text)))
            conn.commit()

    def delete_document(self, document_id: str) -> None:
        nid = _norm_doc_id(document_id)
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {_TABLE} WHERE document_id = %s", (nid,))
            conn.commit()

    def fetch_all_grouped(self) -> dict[str, list[tuple[int, str]]]:
        """document_id (normalized) -> ordered (chunk_id, text)."""
        with self._connect() as conn:
            with conn.cursor(row_factory=tuple_row) as cur:
                cur.execute(
                    f"SELECT document_id, chunk_id, chunk_text FROM {_TABLE} ORDER BY document_id, chunk_id"
                )
                rows = cur.fetchall()
            conn.commit()
        by_doc: dict[str, list[tuple[int, str]]] = defaultdict(list)
        for row in rows:
            document_id, chunk_id, chunk_text = row[0], row[1], row[2]
            by_doc[document_id].append((chunk_id, chunk_text))
        return dict(by_doc)


def load_persisted_into_store(store: InMemoryVectorStore, repo: ChunkRepository) -> int:
    """Восстановить индекс в памяти из БД (одна пересборка TF-IDF или эмбеддингов)."""
    grouped = repo.fetch_all_grouped()
    if not grouped:
        logger.info("No RAG chunks in database yet")
        return 0
    ordered: list[StoredChunk] = []
    for doc_id in sorted(grouped.keys()):
        parts = sorted(grouped[doc_id], key=lambda x: x[0])
        for chunk_id, text in parts:
            ordered.append(StoredChunk(document_id=doc_id, chunk_id=chunk_id, text=text))
    store.replace_all_chunks(ordered)
    logger.info("Loaded %s chunks from PostgreSQL into RAG index", len(ordered))
    return len(ordered)

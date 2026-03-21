from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class StoredChunk:
    document_id: str
    chunk_id: int
    text: str


def _norm_doc_id(document_id: str) -> str:
    return document_id.strip().lower()


def _l2_normalize_rows(x: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(x, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-12)
    return x / norms


class InMemoryVectorStore:
    """
    Хранение чанков и поиск: либо TF-IDF (по умолчанию), либо dense-эмбеддинги
    через callback `embed_texts` (OpenAI /v1/embeddings).
    """

    def __init__(self, embed_texts: Callable[[list[str]], list[list[float]]] | None = None) -> None:
        self._embed_texts = embed_texts
        self._chunks: list[StoredChunk] = []
        self._vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
        self._tfidf_matrix = None  # sparse, только без эмбеддера
        self._embed_matrix: np.ndarray | None = None  # (n, dim), строки L2-нормированы

    def stats(self) -> dict[str, int | str]:
        """Сводка для демо-панели: размер индекса и режим поиска."""
        n = len(self._chunks)
        docs = len({c.document_id for c in self._chunks}) if n else 0
        mode = "embeddings" if self._embed_matrix is not None else "tfidf"
        return {"chunks_total": n, "documents_indexed": docs, "search_mode": mode}

    def replace_all_chunks(self, chunks: list[StoredChunk]) -> None:
        """Атомарно заменить весь индекс (например, загрузка из PostgreSQL)."""
        self._chunks = list(chunks)
        self._rebuild_index()

    def add_document_chunks(self, document_id: str, chunks: list[str]) -> int:
        document_id = _norm_doc_id(document_id)
        existing = [c for c in self._chunks if c.document_id != document_id]
        self._chunks = existing
        if not chunks:
            self._rebuild_index()
            return 0
        self._chunks.extend(
            StoredChunk(document_id=document_id, chunk_id=i, text=chunk) for i, chunk in enumerate(chunks)
        )
        self._rebuild_index()
        return len(chunks)

    def chunks_for_document(self, document_id: str) -> list[StoredChunk]:
        nid = _norm_doc_id(document_id)
        return sorted((c for c in self._chunks if c.document_id == nid), key=lambda c: c.chunk_id)

    def query(
        self,
        query: str,
        top_k: int,
        allowed_document_ids: set[str] | None = None,
    ) -> list[tuple[StoredChunk, float]]:
        if not self._chunks:
            return []

        allowed_norm: set[str] | None = None
        if allowed_document_ids is not None:
            allowed_norm = {_norm_doc_id(x) for x in allowed_document_ids}

        if self._embed_matrix is not None and self._embed_texts is not None:
            q_emb = self._embed_texts([query])[0]
            q = np.asarray(q_emb, dtype=np.float32).reshape(1, -1)
            q = _l2_normalize_rows(q)
            sims = (self._embed_matrix @ q.T).ravel()
        elif self._tfidf_matrix is not None:
            q = self._vectorizer.transform([query])
            sims = cosine_similarity(q, self._tfidf_matrix)[0]
        else:
            return self._fallback_chunks_by_document(allowed_norm, top_k)

        if sims.size == 0:
            return self._fallback_chunks_by_document(allowed_norm, top_k)

        embed_mode = self._embed_matrix is not None
        pairs: list[tuple[int, float]] = []
        for i, score in enumerate(sims):
            if allowed_norm is not None and self._chunks[i].document_id not in allowed_norm:
                continue
            if not embed_mode and score <= 0:
                continue
            if embed_mode and (not np.isfinite(score)):
                continue
            pairs.append((i, float(score)))
        pairs.sort(key=lambda x: -x[1])
        out = pairs[:top_k]
        if out:
            return [(self._chunks[i], score) for i, score in out]

        return self._fallback_chunks_by_document(allowed_norm, top_k)

    def _fallback_chunks_by_document(
        self,
        allowed_norm: set[str] | None,
        top_k: int,
    ) -> list[tuple[StoredChunk, float]]:
        if allowed_norm is None:
            return []
        rows = [(i, c) for i, c in enumerate(self._chunks) if c.document_id in allowed_norm]
        rows.sort(key=lambda x: (x[1].document_id, x[1].chunk_id))
        return [(c, 0.0) for _, c in rows[:top_k]]

    def _rebuild_index(self) -> None:
        if not self._chunks:
            self._tfidf_matrix = None
            self._embed_matrix = None
            return

        corpus = [c.text for c in self._chunks]

        if self._embed_texts is None:
            self._embed_matrix = None
            self._tfidf_matrix = self._vectorizer.fit_transform(corpus)
            return

        self._tfidf_matrix = None
        vecs = self._embed_texts(corpus)
        arr = np.asarray(vecs, dtype=np.float32)
        self._embed_matrix = _l2_normalize_rows(arr)

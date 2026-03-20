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


class InMemoryVectorStore:
    def __init__(self) -> None:
        self._chunks: list[StoredChunk] = []
        self._vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
        self._matrix = None

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

    def query(
        self,
        query: str,
        top_k: int,
        allowed_document_ids: set[str] | None = None,
    ) -> list[tuple[StoredChunk, float]]:
        if not self._chunks or self._matrix is None:
            return []
        allowed_norm: set[str] | None = None
        if allowed_document_ids is not None:
            allowed_norm = {_norm_doc_id(x) for x in allowed_document_ids}

        q = self._vectorizer.transform([query])
        sims = cosine_similarity(q, self._matrix)[0]
        if sims.size == 0:
            return self._fallback_chunks_by_document(allowed_norm, top_k)

        pairs: list[tuple[int, float]] = []
        for i, score in enumerate(sims):
            if score <= 0:
                continue
            if allowed_norm is not None and self._chunks[i].document_id not in allowed_norm:
                continue
            pairs.append((i, float(score)))
        pairs.sort(key=lambda x: -x[1])
        out = pairs[:top_k]
        if out:
            return [(self._chunks[i], score) for i, score in out]

        # TF-IDF не нашёл пересечений с запросом (часто для «общих» формулировок и PDF с таблицами),
        # но чанки документа в индексе есть — отдаём начало документа по порядку.
        return self._fallback_chunks_by_document(allowed_norm, top_k)

    def _fallback_chunks_by_document(
        self,
        allowed_norm: set[str] | None,
        top_k: int,
    ) -> list[tuple[StoredChunk, float]]:
        if allowed_norm is None:
            return []
        rows = [
            (i, c)
            for i, c in enumerate(self._chunks)
            if c.document_id in allowed_norm
        ]
        rows.sort(key=lambda x: (x[1].document_id, x[1].chunk_id))
        return [(c, 0.0) for _, c in rows[:top_k]]

    def _rebuild_index(self) -> None:
        if not self._chunks:
            self._matrix = None
            return
        corpus = [c.text for c in self._chunks]
        self._matrix = self._vectorizer.fit_transform(corpus)

from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class StoredChunk:
    document_id: str
    chunk_id: int
    text: str


class InMemoryVectorStore:
    def __init__(self) -> None:
        self._chunks: list[StoredChunk] = []
        self._vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
        self._matrix = None

    def add_document_chunks(self, document_id: str, chunks: list[str]) -> int:
        existing = [c for c in self._chunks if c.document_id != document_id]
        self._chunks = existing
        self._chunks.extend(
            StoredChunk(document_id=document_id, chunk_id=i, text=chunk) for i, chunk in enumerate(chunks)
        )
        self._rebuild_index()
        return len(chunks)

    def query(self, query: str, top_k: int) -> list[tuple[StoredChunk, float]]:
        if not self._chunks or self._matrix is None:
            return []
        q = self._vectorizer.transform([query])
        sims = cosine_similarity(q, self._matrix)[0]
        if sims.size == 0:
            return []
        top_idx = np.argsort(sims)[::-1][:top_k]
        return [(self._chunks[i], float(sims[i])) for i in top_idx if sims[i] > 0]

    def _rebuild_index(self) -> None:
        if not self._chunks:
            self._matrix = None
            return
        corpus = [c.text for c in self._chunks]
        self._matrix = self._vectorizer.fit_transform(corpus)

"""Клиент к OpenAI-совместимому POST /v1/embeddings (vLLM и т.п.)."""

from __future__ import annotations

from typing import Any

import httpx


def embed_texts_openai_compatible(
    texts: list[str],
    *,
    base_url: str,
    model: str | None,
    timeout: float,
    batch_size: int,
) -> list[list[float]]:
    """
    Возвращает эмбеддинги в том же порядке, что и входные строки.
    Батчи уменьшают размер запроса и нагрузку на сервер.
    """
    base = base_url.rstrip("/")
    url = f"{base}/v1/embeddings"
    out: list[list[float]] = []

    with httpx.Client(timeout=timeout) as client:
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            payload: dict[str, Any] = {"input": batch}
            if model and model.strip():
                payload["model"] = model.strip()

            try:
                resp = client.post(url, json=payload)
            except httpx.ConnectError as e:
                hint = (
                    "Если rag-service в Docker, а эмбеддер на вашем ПК, в .env укажите "
                    "EMBEDDER_BASE_URL=http://host.docker.internal:6620 (localhost из контейнера — это не хост)."
                )
                raise RuntimeError(f"Эмбеддер недоступен {base!r}: {e}. {hint}") from e
            except OSError as e:
                if getattr(e, "errno", None) == -5 or "hostname" in str(e).lower():
                    raise RuntimeError(
                        f"Не удаётся разрешить имя хоста для эмбеддера {base!r}: {e}. "
                        "Проверьте URL; в Docker для сервиса на хосте используйте host.docker.internal."
                    ) from e
                raise
            resp.raise_for_status()
            data = resp.json()
            items = data.get("data") or []
            items_sorted = sorted(items, key=lambda x: int(x.get("index", 0)))

            if len(items_sorted) != len(batch):
                raise ValueError(
                    f"embeddings: ожидалось {len(batch)} векторов, пришло {len(items_sorted)}",
                )

            for item in items_sorted:
                emb = item.get("embedding")
                if not isinstance(emb, list):
                    raise ValueError("embeddings: нет поля embedding")
                out.append([float(x) for x in emb])

    return out

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      const first = j.detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  } catch {
    /* ignore */
  }
  return text || res.statusText;
}

export type RagChunk = {
  document_id: string;
  chunk_id: number;
  score: number;
  text: string;
};

/** keyword — TF-IDF (точнее по словам); semantic — векторы при наличии эмбеддера, иначе TF-IDF. */
export type RagSearchMode = "keyword" | "semantic";

export async function ragQuery(
  query: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  topK = 6,
  /** Только эти документы (обычно UUID ваших файлов с /api/v1/documents). */
  documentIds?: string[],
  searchMode: RagSearchMode = "semantic",
): Promise<RagChunk[]> {
  const body: Record<string, unknown> = { query, top_k: topK, search_mode: searchMode };
  if (documentIds !== undefined) {
    body.document_ids = documentIds;
  }
  const res = await authFetch(`${apiBase()}/api/v1/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { results: RagChunk[] };
  return data.results ?? [];
}

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Несколько документов: один глобальный top_k часто отдаёт все чанки из одного файла.
 * Делаем отдельный запрос по каждому document_id, затем объединяем и режем по score.
 */
export async function ragQueryBalanced(
  query: string,
  authFetch: AuthFetch,
  topK: number,
  documentIds: string[],
  searchMode: RagSearchMode = "semantic",
): Promise<RagChunk[]> {
  const ids = documentIds.filter(Boolean);
  if (ids.length <= 1) {
    return ragQuery(query, authFetch, topK, ids.length === 1 ? ids : undefined, searchMode);
  }

  const n = ids.length;
  const perDoc = Math.max(3, Math.ceil(topK / n));
  const perDocK = Math.min(12, perDoc);

  const merged: RagChunk[] = [];
  const seen = new Set<string>();
  for (const docId of ids) {
    const part = await ragQuery(query, authFetch, perDocK, [docId], searchMode);
    for (const c of part) {
      const key = `${c.document_id}:${c.chunk_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}

/** Текст для system prompt: фрагменты с подписью файла. */
export function formatRagChunksForLlm(
  chunks: RagChunk[],
  docLabel: (documentId: string) => string,
  maxChars = 14000,
): string {
  const blocks: string[] = [];
  let total = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const name = docLabel(c.document_id);
    const block = `--- [${i + 1}] Файл: ${name} — чанк #${c.chunk_id}, релевантность ~${Math.round(Math.min(1, Math.max(0, c.score)) * 100)}% ---\n${c.text}`;
    if (total + block.length > maxChars) {
      blocks.push("… [контекст обрезан по длине]");
      break;
    }
    blocks.push(block);
    total += block.length;
  }
  return blocks.join("\n\n");
}

/** Все чанки документа по порядку (без TF-IDF) — надёжный контекст для саммари и карточек. */
export async function ragDocumentChunks(
  documentId: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<RagChunk[]> {
  const res = await authFetch(
    `${apiBase()}/api/v1/rag/documents/${encodeURIComponent(documentId)}/chunks`,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { results: RagChunk[] };
  return data.results ?? [];
}

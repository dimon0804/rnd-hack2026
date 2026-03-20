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

export async function ragQuery(
  query: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  topK = 6,
  /** Только эти документы (обычно UUID ваших файлов с /api/v1/documents). */
  documentIds?: string[],
): Promise<RagChunk[]> {
  const body: Record<string, unknown> = { query, top_k: topK };
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

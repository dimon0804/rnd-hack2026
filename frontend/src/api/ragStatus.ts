function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

export type RagStatusPayload = {
  service: string;
  status: string;
  chunks_total: number;
  documents_indexed: number;
  search_mode: string;
  db_persist_enabled: boolean;
  last_ingest_error: string | null;
  last_ingest_error_at: string | null;
};

/** Публичная сводка RAG (демо-панель «живая система»). Без авторизации. */
export async function fetchRagStatus(): Promise<RagStatusPayload> {
  const res = await fetch(`${apiBase()}/api/v1/rag/status`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json() as Promise<RagStatusPayload>;
}

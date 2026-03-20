export type DocumentUploadResult = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  message: string;
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

export async function uploadDocument(
  file: File,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<DocumentUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(`${apiBase()}/api/v1/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DocumentUploadResult>;
}

export type DocumentItem = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  status_message: string | null;
  created_at: string;
};

export async function listDocuments(
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<DocumentItem[]> {
  const res = await authFetch(`${apiBase()}/api/v1/documents`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DocumentItem[]>;
}

export async function getDocument(
  id: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<DocumentItem> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/${id}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DocumentItem>;
}

/** Повторная индексация в RAG с диска (если индекс пуст после рестарта и т.д.). */
export async function reindexDocument(
  id: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<DocumentUploadResult> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/${encodeURIComponent(id)}/reindex`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DocumentUploadResult>;
}

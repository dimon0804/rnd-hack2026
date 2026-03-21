export type DocumentUploadResult = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  message: string;
  topic_group_id?: string | null;
};

export type BatchUploadItem = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  message: string;
  topic_group_id?: string | null;
};

export type BatchUploadResult = {
  results: BatchUploadItem[];
  groups_note: string;
};

import { humanizeDocumentsApiError, isDocumentIdFormatValid } from "../lib/apiError";

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

/** Несколько файлов: тематическая группировка на бэкенде и общий RAG для совпадающих по теме. */
export async function uploadDocumentBatch(
  files: File[],
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<BatchUploadResult> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", f);
  }
  const res = await authFetch(`${apiBase()}/api/v1/documents/upload-batch`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<BatchUploadResult>;
}

export type DocumentItem = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  status_message: string | null;
  created_at: string;
  topic_group_id?: string | null;
  group_document_ids?: string[];
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
  if (!isDocumentIdFormatValid(id)) {
    throw new Error(
      "Неверный идентификатор в адресе страницы. Откройте документ из списка «Мои документы» на странице загрузки.",
    );
  }
  const res = await authFetch(`${apiBase()}/api/v1/documents/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(humanizeDocumentsApiError(res.status, text));
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

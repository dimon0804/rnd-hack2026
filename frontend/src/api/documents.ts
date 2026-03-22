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

export type CollectionItem = {
  id: string;
  name: string;
  created_at: string;
};

export async function uploadDocument(
  file: File,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  options?: { collectionIds?: string[] },
): Promise<DocumentUploadResult> {
  const form = new FormData();
  form.append("file", file);
  if (options?.collectionIds?.length) {
    form.append("collection_ids", JSON.stringify(options.collectionIds));
  }
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
  options?: { collectionIds?: string[] },
): Promise<BatchUploadResult> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", f);
  }
  if (options?.collectionIds?.length) {
    form.append("collection_ids", JSON.stringify(options.collectionIds));
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
  /** Персональные коллекции (папки/контексты), в которых состоит документ. */
  collection_ids?: string[];
};

export type MimeTypeStat = {
  mime_type: string;
  label_ru: string;
  count: number;
  bytes_total: number;
};

export type TopicGroupMemberStat = {
  document_id: string;
  original_filename: string;
  status: string;
  /** Персональные коллекции (метки) документа. */
  collection_ids?: string[];
};

export type TopicGroupStat = {
  topic_group_id: string;
  document_count: number;
  total_bytes: number;
  members: TopicGroupMemberStat[];
};

/** Сводка для личного кабинета (`GET /documents/stats`). */
export type DocumentStats = {
  total_documents: number;
  total_bytes: number;
  ready_count: number;
  failed_count: number;
  pending_or_processing_count: number;
  mime_breakdown: MimeTypeStat[];
  topic_groups_count: number;
  documents_in_groups: number;
  documents_standalone: number;
  topic_groups: TopicGroupStat[];
  first_upload_at: string | null;
  last_upload_at: string | null;
};

export async function fetchDocumentStats(
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<DocumentStats> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/stats`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DocumentStats>;
}

export async function listDocuments(
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  params?: { collectionIds?: string[] | null },
): Promise<DocumentItem[]> {
  let url = `${apiBase()}/api/v1/documents`;
  const ids = params?.collectionIds?.filter(Boolean) ?? [];
  if (ids.length > 0) {
    const sp = new URLSearchParams();
    for (const id of ids) {
      sp.append("collection_ids", id);
    }
    url += `?${sp.toString()}`;
  }
  const res = await authFetch(url);
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

/** Бинарный оригинал файла (GET …/documents/{id}/file). */
export async function fetchDocumentFileBlob(
  id: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<{ blob: Blob; filename: string }> {
  if (!isDocumentIdFormatValid(id)) {
    throw new Error("Неверный идентификатор документа.");
  }
  const res = await authFetch(`${apiBase()}/api/v1/documents/${encodeURIComponent(id)}/file`, {
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(humanizeDocumentsApiError(res.status, text));
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  let filename = "document";
  const star = /filename\*=(?:UTF-8''|)([^;\s]+)/i.exec(cd);
  const plain = /filename="([^"]+)"/i.exec(cd) || /filename=([^;\s]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      filename = decodeURIComponent(star[1].replace(/['"]/g, "").trim());
    } catch {
      filename = star[1].replace(/['"]/g, "").trim();
    }
  } else if (plain?.[1]) {
    filename = plain[1].replace(/['"]/g, "").trim();
  }
  return { blob, filename: filename || "document" };
}

export async function listCollections(
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<CollectionItem[]> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/collections`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<CollectionItem[]>;
}

export async function createCollection(
  name: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<CollectionItem> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<CollectionItem>;
}

export async function renameCollection(
  id: string,
  name: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<CollectionItem> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/collections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<CollectionItem>;
}

export async function deleteCollection(
  id: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const res = await authFetch(`${apiBase()}/api/v1/documents/collections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}

export async function setDocumentCollections(
  documentId: string,
  collectionIds: string[],
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<DocumentItem> {
  if (!isDocumentIdFormatValid(documentId)) {
    throw new Error("Неверный идентификатор документа.");
  }
  const res = await authFetch(
    `${apiBase()}/api/v1/documents/${encodeURIComponent(documentId)}/collections`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection_ids: collectionIds }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(humanizeDocumentsApiError(res.status, text));
  }
  return res.json() as Promise<DocumentItem>;
}

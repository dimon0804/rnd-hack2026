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
  token?: string | null,
): Promise<DocumentUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase()}/api/v1/documents/upload`, {
    method: "POST",
    body: form,
    headers,
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

export async function listDocuments(token?: string | null): Promise<DocumentItem[]> {
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${apiBase()}/api/v1/documents`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DocumentItem[]>;
}

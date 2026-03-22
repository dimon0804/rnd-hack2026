const PREFIX = "aiplatform.chat.v1";
const MAX_MESSAGES = 200;

export type PersistedMsg = {
  role: "user" | "assistant";
  content: string;
};

/** Ключ потока в workspace: группа документов RAG. */
export function workspaceChatStorageKey(ragIds: string[]): string {
  const sorted = [...ragIds].sort().join(",");
  return `${PREFIX}.ws:${sorted}`;
}

/** Ключ глобального чата по всем документам (разделение по пользователю). */
export function chatPanelStorageKey(email: string | null): string {
  const id = email?.trim() ? encodeURIComponent(email.trim().toLowerCase()) : "anon";
  return `${PREFIX}.panel:${id}`;
}

function safeParse(raw: string | null): PersistedMsg[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: PersistedMsg[] = [];
    for (const row of j) {
      if (!row || typeof row !== "object") continue;
      const role = (row as { role?: string }).role;
      const content = (row as { content?: string }).content;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string" || !content.trim()) continue;
      out.push({ role, content: content.trim() });
      if (out.length >= MAX_MESSAGES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function loadPersistedMessages(storageKey: string): PersistedMsg[] {
  try {
    return safeParse(localStorage.getItem(storageKey));
  } catch {
    return [];
  }
}

export function savePersistedMessages(storageKey: string, messages: PersistedMsg[]): void {
  try {
    const slice = messages.slice(-MAX_MESSAGES);
    localStorage.setItem(storageKey, JSON.stringify(slice));
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedMessages(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

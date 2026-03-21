import { stripAiMarkdown } from "../lib/stripAiMarkdown";

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

export type ChatResult = {
  content: string;
  model: string;
};

export async function aiChat(
  prompt: string,
  systemPrompt: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  options?: { temperature?: number; maxTokens?: number },
): Promise<ChatResult> {
  const res = await authFetch(`${apiBase()}/api/v1/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      system_prompt: systemPrompt,
      temperature: options?.temperature ?? 0.25,
      max_tokens: options?.maxTokens ?? 1200,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const raw = (await res.json()) as ChatResult;
  return { ...raw, content: stripAiMarkdown(raw.content) };
}

export type ExtractTableResult = {
  csv_text: string;
  model: string;
};

/** Таблица CSV по тексту документа (без strip markdown — сохраняем запятые и кавычки). */
export async function aiExtractTable(
  sourceText: string,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  opts?: { focus?: string; maxTokens?: number; temperature?: number },
): Promise<ExtractTableResult> {
  const res = await authFetch(`${apiBase()}/api/v1/ai/extract-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_text: sourceText,
      focus: opts?.focus?.trim() || null,
      max_tokens: opts?.maxTokens ?? 2000,
      temperature: opts?.temperature ?? 0.12,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const j = (await res.json()) as Record<string, unknown>;
  const csvRaw = j.csv_text ?? j.csvText;
  const modelRaw = j.model ?? j.llm_model;
  const csv_text = typeof csvRaw === "string" ? csvRaw : "";
  const model = typeof modelRaw === "string" ? modelRaw : "";
  return { csv_text, model };
}

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
  return res.json() as Promise<ChatResult>;
}

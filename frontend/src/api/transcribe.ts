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

/** Распознавание речи через бэкенд (STT /v1/audio/transcriptions). Не задавайте Content-Type — браузер выставит multipart. */
export async function transcribeAudio(
  file: File,
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  opts?: { language?: string; model?: string },
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.language) form.append("language", opts.language);
  if (opts?.model) form.append("model", opts.model);

  const res = await authFetch(`${apiBase()}/api/v1/ai/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const j = (await res.json()) as { text: string };
  if (typeof j.text !== "string") throw new Error("Нет поля text в ответе");
  return j.text.trim();
}

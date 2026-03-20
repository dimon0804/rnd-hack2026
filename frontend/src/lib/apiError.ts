/** Читает тело ответа API и возвращает короткое сообщение об ошибке. */
export async function messageFromResponse(res: Response): Promise<string> {
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
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length < 800) return trimmed;
  return res.statusText || `HTTP ${res.status}`;
}

/** Делает сообщение об ошибке из бэкенда понятнее пользователю. */
export function humanizeChatError(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("mistral_api_key") || t.includes("not configured")) {
    return "На сервере не задан ключ Mistral (MISTRAL_API_KEY в .env для ai-service). Без него ответы не генерируются.";
  }
  if (t.includes("mistral api error") || t.includes("502") || t.includes("bad gateway")) {
    return "Сервис Mistral недоступен или отклонил запрос. Проверьте ключ, лимиты и интернет.";
  }
  if (t.includes("401") || t.includes("unauthorized")) {
    return "Сессия истекла. Выйдите и войдите снова.";
  }
  if (t.includes("403") || t.includes("forbidden")) {
    return "Нет доступа к этому действию.";
  }
  if (raw.length > 500) return `${raw.slice(0, 500)}…`;
  return raw;
}

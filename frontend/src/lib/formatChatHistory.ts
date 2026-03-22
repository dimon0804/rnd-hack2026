/** Краткая история диалога для LLM (уточняющие вопросы, «как выше»). */

export type ChatHistoryMsg = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Последние реплики без источников/метаданных. Ограничение по символам — чтобы не съедать бюджет под RAG-контекст.
 */
export function formatBriefChatHistory(
  messages: readonly ChatHistoryMsg[],
  opts?: { maxMessages?: number; maxChars?: number },
): string {
  const maxMessages = opts?.maxMessages ?? 12;
  const maxChars = opts?.maxChars ?? 4000;
  const slice = messages.slice(-maxMessages);
  const parts: string[] = [];
  let total = 0;
  for (const m of slice) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const tag = m.role === "user" ? "Пользователь" : "Ассистент";
    const line = `${tag}: ${m.content.trim()}`;
    const sep = parts.length ? 2 : 0;
    if (total + sep + line.length > maxChars) break;
    parts.push(line);
    total += sep + line.length;
  }
  return parts.join("\n\n");
}

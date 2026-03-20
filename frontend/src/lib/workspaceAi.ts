import { aiChat } from "../api/ai";
import { ragQuery } from "../api/rag";

const MAX_CTX = 10000;

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function contextFromDocument(documentId: string, authFetch: AuthFetch): Promise<string> {
  const chunks = await ragQuery("основное содержание документа ключевые разделы", authFetch, 8, [documentId]);
  let text = chunks.map((c) => c.text).join("\n\n");
  if (text.length > MAX_CTX) text = text.slice(0, MAX_CTX) + "\n…";
  return text;
}

/** Авто после открытия workspace: краткое содержание + темы. */
export async function generateSummaryAndTopics(documentId: string, authFetch: AuthFetch): Promise<{
  summary: string;
  topics: string[];
}> {
  const ctx = await contextFromDocument(documentId, authFetch);
  if (!ctx.trim()) {
    return { summary: "Недостаточно текста в индексе для этого документа.", topics: [] };
  }
  const system = `Ты аналитик текстов. Отвечай только на русском. Формат ответа строго такой (без markdown-заголовков #):
КРАТКО: (2–4 предложения суть документа)
ТЕМЫ: (каждая тема с новой строки, начинай строку с «- »)`;
  const prompt = `Вот фрагменты из документа:\n\n${ctx}\n\nСделай КРАТКО и ТЕМЫ по инструкции.`;
  const res = await aiChat(prompt, system, authFetch, { maxTokens: 900, temperature: 0.2 });
  const content = res.content;
  const krIdx = content.indexOf("КРАТКО:");
  const temIdx = content.indexOf("ТЕМЫ:");
  let summary = content.trim();
  const topics: string[] = [];
  if (krIdx >= 0 && temIdx > krIdx) {
    summary = content.slice(krIdx + 7, temIdx).trim();
    const rest = content.slice(temIdx + 6);
    for (const line of rest.split("\n")) {
      const t = line.replace(/^[-*]\s*/, "").trim();
      if (t) topics.push(t);
    }
  } else {
    summary = content.slice(0, 800);
  }
  return { summary, topics: topics.slice(0, 12) };
}

export async function runQuickAction(
  kind: "simple" | "short" | "test" | "podcast" | "mindmap",
  documentId: string,
  authFetch: AuthFetch,
): Promise<string> {
  const ctx = await contextFromDocument(documentId, authFetch);
  const prompts: Record<typeof kind, { system: string; user: string }> = {
    simple: {
      system: "Объясняй простым языком, как для старшеклассника. Только русский.",
      user: `Объясни простыми словами, о чём этот материал:\n\n${ctx}`,
    },
    short: {
      system: "Сжато и по делу. Русский.",
      user: `Сделай очень краткий пересказ в 3–5 предложениях:\n\n${ctx}`,
    },
    test: {
      system: "Составь учебный тест на русском. Формат: для каждого вопроса номер, вопрос, строки А) Б) В) Г), затем строка «Правильно: буква».",
      user: `По тексту составь 5 вопросов с вариантами:\n\n${ctx}`,
    },
    podcast: {
      system: "Пиши сценарий подкаста на русском: два ведущих, короткие реплики.",
      user: `Сделай диалог на 12–16 реплик о содержании:\n\n${ctx}`,
    },
    mindmap: {
      system: "Выдай иерархию тем в виде вложенного списка с отступами (без JSON). Русский.",
      user: `Построй структуру тем и подтем:\n\n${ctx}`,
    },
  };
  const p = prompts[kind];
  const res = await aiChat(p.user, p.system, authFetch, { maxTokens: 2000, temperature: 0.35 });
  return res.content;
}

export async function generateFlashcards(documentId: string, authFetch: AuthFetch): Promise<{ q: string; a: string }[]> {
  const ctx = await contextFromDocument(documentId, authFetch);
  const system =
    "Сгенерируй 8 карточек для запоминания. Формат: каждая карточка две строки: В: вопрос и О: ответ. Русский.";
  const res = await aiChat(`Текст:\n\n${ctx}`, system, authFetch, { maxTokens: 1800, temperature: 0.25 });
  const out: { q: string; a: string }[] = [];
  const lines = res.content.split("\n");
  let q = "";
  for (const line of lines) {
    const v = line.replace(/^В:\s*/i, "").replace(/^О:\s*/i, "").trim();
    if (/^В:/i.test(line)) q = v;
    else if (/^О:/i.test(line) && q) {
      out.push({ q, a: v });
      q = "";
    }
  }
  if (out.length === 0) {
    return [{ q: "Содержание", a: res.content.slice(0, 500) }];
  }
  return out;
}

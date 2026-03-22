import { aiChat } from "../api/ai";

type AuthFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SuggestedQuestions = {
  popular: string[];
  chatty: string[];
};

function parseJsonQuestions(raw: string): SuggestedQuestions {
  const empty: SuggestedQuestions = { popular: [], chatty: [] };
  const trimmed = raw.trim();
  if (!trimmed) return empty;
  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const pop = j.popular ?? j.Popular;
    const chat = j.chatty ?? j.chatty_questions ?? j.Chatty;
    const popular = Array.isArray(pop) ? pop.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim()).slice(0, 6) : [];
    const chatty = Array.isArray(chat) ? chat.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim()).slice(0, 5) : [];
    return { popular, chatty };
  } catch {
    return empty;
  }
}

/**
 * Предлагает «популярные» и «разговорные» вопросы по краткому описанию и темам документа (мнение модели).
 */
export async function fetchSuggestedChatQuestions(
  summary: string,
  topics: string[],
  authFetch: AuthFetchFn,
): Promise<SuggestedQuestions> {
  const topicsLine = topics.length > 0 ? topics.join(", ") : "(темы не выделены)";
  const system = `Ты помощник для интерфейса чата с документом. По краткому описанию и темам придумай вопросы на русском, которые пользователь мог бы задать в чате по этому материалу.

Верни СТРОГО один JSON-объект без текста до или после:
{"popular":["вопрос1","вопрос2",...],"chatty":["вопрос1","вопрос2",...]}

popular: 4 коротких, самых типичных и полезных вопроса по сути документа (как в FAQ).
chatty: 3 более живых или любопытных вопроса, как в обычном диалоге.
Каждый вопрос — одно предложение, без нумерации и markdown.`;

  const user = `Краткое описание документа:\n${summary.trim() || "(нет)"}\n\nТемы:\n${topicsLine}`;

  const reply = await aiChat(user, system, authFetch, {
    maxTokens: 900,
    temperature: 0.4,
    jsonMode: true,
    stripMarkdown: false,
  });

  return parseJsonQuestions(reply.content);
}

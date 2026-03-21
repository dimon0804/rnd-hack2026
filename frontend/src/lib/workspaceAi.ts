import { aiChat, aiExtractTable } from "../api/ai";
import { reindexDocument } from "../api/documents";
import { ragDocumentChunks, ragQuery, type RagChunk } from "../api/rag";
import { parseInfographicJson, type InfographicSpec } from "./infographicSpec";
import { stripAiMarkdown } from "./stripAiMarkdown";
import { parseVideoRecapJson, type VideoRecapPlan } from "./videoRecapPlan";

const MAX_CTX = 12000;

/** Во все ответы для UI — без #, ** и прочего markdown. */
const PLAIN_TEXT_RULE =
  "Пиши обычным текстом для человека. Запрещено markdown: не используй #, ##, **, __, обратные кавычки для выделения.";

export type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Чанки из RAG: сначала полный список по документу, иначе TF-IDF; ошибки сети не рвут поток. */
async function fetchMergedChunks(documentId: string, authFetch: AuthFetch): Promise<RagChunk[]> {
  let merged: RagChunk[] = [];
  try {
    merged = await ragDocumentChunks(documentId, authFetch);
  } catch {
    merged = [];
  }
  if (merged.length > 0) return merged;

  try {
    const q1 = await ragQuery("основное содержание документа ключевые разделы", authFetch, 16, [documentId]);
    const seen = new Set(q1.map((c) => c.chunk_id));
    const q2 = await ragQuery("текст содержание разделы выводы", authFetch, 16, [documentId]);
    merged = [...q1];
    for (const c of q2) {
      if (!seen.has(c.chunk_id)) {
        seen.add(c.chunk_id);
        merged.push(c);
      }
    }
    merged.sort((a, b) => a.chunk_id - b.chunk_id);
  } catch {
    merged = [];
  }
  return merged;
}

async function contextFromDocuments(documentIds: string[], authFetch: AuthFetch): Promise<string> {
  if (documentIds.length === 0) return "";
  const merged: RagChunk[] = [];
  for (const id of documentIds) {
    merged.push(...(await fetchMergedChunks(id, authFetch)));
  }
  merged.sort((a, b) => {
    const dc = a.document_id.localeCompare(b.document_id);
    if (dc !== 0) return dc;
    return a.chunk_id - b.chunk_id;
  });
  if (merged.length === 0) {
    try {
      await reindexDocument(documentIds[0], authFetch);
      for (const id of documentIds) {
        merged.push(...(await fetchMergedChunks(id, authFetch)));
      }
      merged.sort((a, b) => {
        const dc = a.document_id.localeCompare(b.document_id);
        if (dc !== 0) return dc;
        return a.chunk_id - b.chunk_id;
      });
    } catch {
      /* reindex недоступен или нет прав — оставляем пустой контекст */
    }
  }
  let text = merged.map((c) => c.text).join("\n\n");
  if (text.length > MAX_CTX) text = text.slice(0, MAX_CTX) + "\n…";
  return text;
}

/** Авто после открытия workspace: краткое содержание + темы. */
export async function generateSummaryAndTopics(documentIds: string[], authFetch: AuthFetch): Promise<{
  summary: string;
  topics: string[];
}> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    return {
      summary:
        "Недостаточно текста в индексе для этих документов (повторная индексация не помогла или файлы недоступны).",
      topics: [],
    };
  }
  const multi = documentIds.length > 1;
  const system = `Ты аналитик текстов. Отвечай только на русском. ${PLAIN_TEXT_RULE}
Формат ответа строго такой:
КРАТКО: (2–4 предложения суть ${multi ? "материалов" : "документа"})
ТЕМЫ: (каждая тема с новой строки, начинай строку с «- »)`;
  const prompt = `Вот фрагменты из ${multi ? "нескольких связанных документов" : "документа"}:\n\n${ctx}\n\nСделай КРАТКО и ТЕМЫ по инструкции.`;
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
  return {
    summary: stripAiMarkdown(summary),
    topics: topics.slice(0, 12).map((t) => stripAiMarkdown(t)),
  };
}

export type PodcastTone = "academic" | "popular";
export type PodcastPace = "slow" | "normal" | "fast";

/** Аудиопересказ: сценарий двух ведущих; тон и темп задают стиль и длину реплик. */
export async function runPodcastAction(
  documentIds: string[],
  authFetch: AuthFetch,
  opts: { tone: PodcastTone; pace: PodcastPace },
): Promise<string> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    return "Текст документа не найден в индексе RAG после повторной индексации. Проверьте статус документа или загрузите файл снова.";
  }
  const toneRu =
    opts.tone === "academic"
      ? "Научный стиль: точные формулировки, термины по делу, без лишних метафор."
      : "Популярный стиль: простые объяснения, понятные аналогии, живой разговорный тон без канцелярита.";
  const paceRu =
    opts.pace === "slow"
      ? "Темп медленный: развёрнутые реплики по 2–4 предложения, больше пояснений."
      : opts.pace === "fast"
        ? "Темп быстрый: короткие реплики по 1–2 предложения, динамичный диалог."
        : "Темп умеренный: реплики по 1–3 предложения.";
  const system = `Ты пишешь сценарий аудиоподкаста на русском. Два ведущих: Алексей и Мария.
${toneRu}
${paceRu}
${PLAIN_TEXT_RULE}
Формат строго: каждая реплика с новой строки, префикс «Алексей: » или «Мария: » (без звёздочек и решёток). Всего 14–22 реплики, только о содержании материала.`;
  const res = await aiChat(`Материал для обсуждения:\n\n${ctx}`, system, authFetch, {
    maxTokens: 2400,
    temperature: 0.38,
  });
  return res.content;
}

/** Официальная справка / резюме по шаблону (деловой стиль). */
export async function generateOfficialReport(documentIds: string[], authFetch: AuthFetch): Promise<string> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    return "Нет текста в индексе для формирования отчёта. Проверьте статус документа.";
  }
  const system = `Ты составитель официальных справок. Только русский, строго деловой стиль (внутренняя справка для руководства).
${PLAIN_TEXT_RULE}
Используй ровно такую структуру и заголовки ЗАГЛАВНЫМИ словами без символа #:

СПРАВКА
ОБЪЕКТ: (одна строка — о чём документ)

1. ЦЕЛЬ И ЗАДАЧА
(2–4 предложения)

2. КРАТКОЕ СОДЕРЖАНИЕ
(структурированный пересказ основных разделов)

3. КЛЮЧЕВЫЕ ПОЛОЖЕНИЯ
(нумерованный список 4–7 пунктов)

4. ВЫВОДЫ
(3–5 предложений)

5. РЕКОМЕНДАЦИИ
(если в тексте нет основы — напиши: «В документе рекомендации не сформулированы»)

`;
  const res = await aiChat(`Исходные фрагменты документа:\n\n${ctx}`, system, authFetch, {
    maxTokens: 2200,
    temperature: 0.2,
  });
  return res.content;
}

/** Текст иерархии с отступами для парсинга в mindmap-граф. */
export async function generateMindmapText(documentIds: string[], authFetch: AuthFetch): Promise<string> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) return "";
  const system = `Построй иерархию ключевых понятий для интеллект-карты. Только русский. ${PLAIN_TEXT_RULE}
Формат:
- Каждая строка — одна тема; вложенность задаётся отступом из двух пробелов на уровень (не табуляция).
- Корневые темы без отступа; подтемы с 2, 4, 6… пробелов в начале.
- После отступа можно «- » перед названием.
- Без нумерации вида «1.», только многострочный список с отступами.
- 12–28 строк, без дубликатов.`;
  const res = await aiChat(`Текст документа:\n\n${ctx}`, system, authFetch, {
    maxTokens: 1600,
    temperature: 0.28,
  });
  return res.content.trim();
}

/**
 * JSON для PPTX (стиль Gamma): только валидный JSON, без markdown и без пояснений до/после.
 * Клиент собирает .pptx (pptxgenjs) и предлагает скачать.
 */
export async function generatePresentationDeckJson(documentIds: string[], authFetch: AuthFetch): Promise<string> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    return JSON.stringify({
      deck_title: "Ошибка",
      slides: [
        {
          type: "title",
          title: "Нет данных",
          subtitle: "Текст документа не найден в индексе RAG. Проверьте статус и повторите индексацию.",
        },
      ],
    });
  }
  const multi = documentIds.length > 1;
  const system = `Ты составитель презентаций в стиле Gamma (крупные заголовки, тёмный фон, мало текста на слайд). Только русский.
Верни ТОЛЬКО один JSON-объект без markdown, без \`\`\`, без комментариев до или после.

Схема:
{
  "deck_title": "короткое название всей презентации",
  "slides": [ ... ]
}

Элементы slides — объекты с полем "type":
- "title" — первый слайд: { "type": "title", "title": "...", "subtitle": "...", "image_hint": "english stock photo search phrase" }
- "section" — разделитель: { "type": "section", "title": "...", "subtitle": "опционально", "image_hint": "..." }
- "content" — основной контент: { "type": "content", "title": "...", "bullets": ["..."], "image_hint": "..." } — 2–4 тезиса
- "closing" — финал: { "type": "closing", "title": "...", "line": "опционально", "image_hint": "..." }

Обязательно для КАЖДОГО слайда поле "image_hint": одна английская фраза — это ТОТ ЖЕ запрос, по которому в стоке ищут фото (Pexels/Openverse), поэтому фраза должна по смыслу совпадать с заголовком и тезисами слайда. 5–14 слов, латиница, без кавычек внутри. Если заголовок слайда на русском — всё равно опиши сцену по-английски и включи соответствующие термины (например для «аппаратные ресурсы», IRQ/DMA: "close-up computer motherboard with cpu and capacitors technician workshop"). Не абстрактные слова вроде "business success", а что увидит зритель. Разные слайды — разные сцены. Для технических тем — платы, кабели, дата-центр, осциллограф, серверная; не предлагай животных, мемы, статуи, еду, туристические пейзажи без связи со слайдом.

Всего 8–14 слайдов (включая title и closing). Логичная последовательность; без дублирования.
${multi ? "Несколько связанных документов — логично сгруппируй слайды по темам." : ""}

Экранируй кавычки внутри строк как \\" в JSON.`;
  const res = await aiChat(`Исходный текст:\n\n${ctx}`, system, authFetch, {
    maxTokens: 3200,
    temperature: 0.22,
    stripMarkdown: false,
  });
  return res.content.trim();
}

export async function runQuickAction(
  kind: "simple" | "short" | "test",
  documentIds: string[],
  authFetch: AuthFetch,
): Promise<string> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    return "Текст документа не найден в индексе RAG после повторной индексации. Проверьте статус документа или загрузите файл снова.";
  }
  const prompts: Record<typeof kind, { system: string; user: string }> = {
    simple: {
      system: `Объясняй простым языком, как для старшеклассника. Только русский. ${PLAIN_TEXT_RULE}`,
      user: `Объясни простыми словами, о чём этот материал:\n\n${ctx}`,
    },
    short: {
      system: `Сжато и по делу. Русский. ${PLAIN_TEXT_RULE}`,
      user: `Сделай очень краткий пересказ в 3–5 предложениях:\n\n${ctx}`,
    },
    test: {
      system: `Составь учебный тест на русском. ${PLAIN_TEXT_RULE} Формат: для каждого вопроса номер, вопрос, строки А) Б) В) Г), затем строка «Правильно: буква».`,
      user: `По тексту составь 5 вопросов с вариантами:\n\n${ctx}`,
    },
  };
  const p = prompts[kind];
  const res = await aiChat(p.user, p.system, authFetch, { maxTokens: 2000, temperature: 0.35 });
  return res.content;
}

export async function generateFlashcards(documentIds: string[], authFetch: AuthFetch): Promise<{ q: string; a: string }[]> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    return [
      {
        q: "Нет текста в индексе",
        a: "Индекс пуст или повторная индексация не сработала. Убедитесь, что документ в статусе «Готово», RAG и document-service доступны; при необходимости загрузите файл заново.",
      },
    ];
  }
  const system = `Ты помощник для учёбы. Ниже уже передан ПОЛНЫЙ текст документа — работай только с ним.
НЕ проси пользователя прислать текст. НЕ отвечай отказом.
${PLAIN_TEXT_RULE}
Сгенерируй 8 карточек для запоминания по этому тексту. Только русский язык.
Формат строго: для каждой карточки две строки:
В: <краткий вопрос>
О: <ответ>`;
  const res = await aiChat(
    `Текст документа для карточек:\n\n${ctx}`,
    system,
    authFetch,
    { maxTokens: 1800, temperature: 0.25 },
  );
  const out: { q: string; a: string }[] = [];
  const lines = res.content.split("\n");
  let q = "";
  for (const line of lines) {
    const v = line.replace(/^В:\s*/i, "").replace(/^О:\s*/i, "").trim();
    if (/^В:/i.test(line)) q = v;
    else if (/^О:/i.test(line) && q) {
      out.push({ q: stripAiMarkdown(q), a: stripAiMarkdown(v) });
      q = "";
    }
  }
  if (out.length > 0) {
    return out;
  }
  const raw = res.content.trim();
  const looksLikeRefusal =
    /пришлите|пришли|отправьте|нет текста|не вижу текста|не предоставлен/i.test(raw);
  if (looksLikeRefusal) {
    return [
      {
        q: "Модель не вернула карточки",
        a: "Повторите генерацию. Если снова пусто — сократите документ или проверьте ключ LLM в настройках.",
      },
    ];
  }
  return [{ q: "Карточки (свободный формат)", a: raw.slice(0, 1200) }];
}

/** Таблица в CSV по содержимому документа из RAG (открывается в Excel). */
export async function generateStructuredTableCsv(
  documentIds: string[],
  authFetch: AuthFetch,
  focus?: string,
): Promise<{ csv: string; model: string }> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    throw new Error("Нет текста в индексе для извлечения таблицы.");
  }
  const res = await aiExtractTable(ctx, authFetch, { focus, maxTokens: 2200 });
  return { csv: res.csv_text, model: res.model };
}

export type { InfographicSpec } from "./infographicSpec";
export type { VideoRecapPlan } from "./videoRecapPlan";

/**
 * План видео-пересказа: сцены с кадром (image_hint → сток) и текстом озвучки.
 * Сборка в один MP4 не выполняется — только единый сценарий и тайминги для монтажа.
 */
export async function generateVideoRecapPlan(documentIds: string[], authFetch: AuthFetch): Promise<VideoRecapPlan> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    throw new Error("Нет текста в индексе для сценария видео.");
  }
  const multi = documentIds.length > 1;
  const system = `Ты режиссёр короткого образовательного видео. Текст озвучки — только русский.
Верни ТОЛЬКО один JSON-объект без markdown, без \`\`\`, без комментариев до или после.

Схема:
{
  "video_title": "название ролика",
  "total_duration_sec": число (сумма сцен или ориентир),
  "narrator_note_ru": "опционально — тон, темп, ударения для диктора",
  "scenes": [
    {
      "scene_index": 1,
      "title_ru": "заголовок сцены",
      "voiceover_ru": "текст для озвучки: 2–5 предложений, только факты из источника",
      "duration_sec": 12,
      "image_hint_en": "english stock photo phrase 6–14 words, concrete visual scene"
    }
  ]
}

Правила: 5–8 сцен; duration_sec у каждой 8–20; озвучка опирается на приведённый материал, без выдуманных цифр.
image_hint_en — визуал для стока (латиница), в духе слайдов Gamma: не абстрактный «business», а что увидит зритель.
${multi ? "Несколько документов — логичная последовательность, без дублирования." : ""}`;
  const res = await aiChat(`Материал для сценария:\n\n${ctx}`, system, authFetch, {
    maxTokens: 3400,
    temperature: 0.24,
    stripMarkdown: false,
  });
  return parseVideoRecapJson(res.content);
}

/** Инфографика: числа из источников и тип диаграммы для отрисовки в UI. */
export async function generateInfographicSpec(documentIds: string[], authFetch: AuthFetch): Promise<InfographicSpec> {
  const ctx = await contextFromDocuments(documentIds, authFetch);
  if (!ctx.trim()) {
    throw new Error("Нет текста в индексе для инфографики.");
  }
  const multi = documentIds.length > 1;
  const system = `Ты аналитик данных. Извлеки из текста ЧИСЛА с подписями (показатели, проценты, объёмы, сроки в виде чисел).
Верни ТОЛЬКО один JSON без markdown и без \`\`\`.

Схема:
{
  "title": "заголовок блока",
  "subtitle": "опционально",
  "chart_type": "bar" | "horizontal_bar" | "donut",
  "items": [
    { "label": "подпись", "value": число, "unit": "опционально млн, %, ч", "source_hint": "кратко откуда в тексте" }
  ],
  "footnote_ru": "опционально — оговорки по данным"
}

6–16 пунктов; value — число (для процентов как 12.5, не строка). Только то, что есть в материале; если цифр мало — возьми главные 4–6.
Внутри строк JSON не используй неэкранированные двойные кавычки — замени на «ёлочки» в тексте или экранируй как \\". Не ставь запятую после последнего элемента в массиве или объекте. Без комментариев // в JSON.
${multi ? "Учитывай все связанные документы; подписи различай по контексту." : ""}`;
  const res = await aiChat(`Текст для извлечения метрик:\n\n${ctx}`, system, authFetch, {
    maxTokens: 2200,
    temperature: 0.2,
    stripMarkdown: false,
  });
  return parseInfographicJson(res.content);
}

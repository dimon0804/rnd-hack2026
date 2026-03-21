/**
 * Извлечение и разбор JSON из ответов LLM: markdown-ограды, «умные» кавычки,
 * хвостовые запятые, срез по сбалансированным фигурным скобкам (не «первый { … последний }»).
 */

import { jsonrepair } from "jsonrepair";

const SMART_QUOTES = /[\u201c\u201d\u201e\u201f\u00ab\u00bb\u2033\u2036]/g;

function stripTrailingCommasDeep(s: string): string {
  let prev = "";
  let out = s;
  while (out !== prev) {
    prev = out;
    out = out.replace(/,\s*([}\]])/g, "$1");
  }
  return out;
}

function normalizeSmartQuotes(s: string): string {
  return s.replace(SMART_QUOTES, '"');
}

/** JSON.parse не принимает NaN / Infinity — модели иногда вставляют их как в JS. */
function sanitizeInvalidJsonLiterals(s: string): string {
  return s.replace(/:\s*NaN\b/g, ": null").replace(/:\s*-Infinity\b/g, ": null").replace(/:\s*Infinity\b/g, ": null");
}

/** Срез одного верхнего JSON-объекта с учётом строк и escape (не путаем `}` внутри текста). */
export function extractBalancedJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractFromMarkdownFence(t: string): string | null {
  const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (!m) return null;
  return m[1].trim();
}

/** Текст от модели → строка JSON-объекта. */
export function extractJsonObjectString(raw: string): string {
  const t = raw.trim().replace(/^\uFEFF/, "");
  const fenced = extractFromMarkdownFence(t);
  if (fenced) {
    const bal = extractBalancedJsonObject(fenced);
    if (bal) return bal;
    return fenced;
  }
  const bal = extractBalancedJsonObject(t);
  if (bal) return bal;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Разбор JSON-объекта с несколькими попытками «починить» типичные ошибки модели. */
export function parseAiJsonObject(raw: string): unknown {
  const base = extractJsonObjectString(raw);
  const fixedLiterals = sanitizeInvalidJsonLiterals(base);
  const variants = [
    base,
    fixedLiterals,
    normalizeSmartQuotes(base),
    stripTrailingCommasDeep(base),
    stripTrailingCommasDeep(fixedLiterals),
    stripTrailingCommasDeep(normalizeSmartQuotes(base)),
    normalizeSmartQuotes(stripTrailingCommasDeep(base)),
    sanitizeInvalidJsonLiterals(stripTrailingCommasDeep(normalizeSmartQuotes(base))),
  ];
  for (const v of variants) {
    const parsed = tryParseJson(v);
    if (parsed !== null && typeof parsed === "object") return parsed;
    try {
      const repaired = jsonrepair(v);
      const parsed2 = tryParseJson(repaired);
      if (parsed2 !== null && typeof parsed2 === "object") return parsed2;
    } catch {
      /* следующий вариант */
    }
  }
  throw new Error(
    "Модель вернула некорректный JSON (часто лишняя запятая или кавычки в тексте). Повторите «Построить по данным».",
  );
}

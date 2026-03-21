/** Общая модель слайдов (Gamma-подобная логика: мало текста, чёткая структура). */

export type GammaSlide =
  | { type: "title"; title: string; subtitle: string; image_hint?: string }
  | { type: "content"; title: string; bullets: string[]; image_hint?: string }
  | { type: "section"; title: string; subtitle?: string; image_hint?: string }
  | { type: "closing"; title: string; line?: string; image_hint?: string };

export type GammaDeck = { deck_title: string; slides: GammaSlide[] };

function normalizeBullets(b: unknown): string[] {
  if (!Array.isArray(b)) return [];
  return b.map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
}

/** Парсинг JSON из ответа LLM (возможны обёртки ```json). */
export function parseGammaDeckJson(raw: string): GammaDeck {
  const t = raw.trim();
  let jsonStr = t;
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) jsonStr = fence[1].trim();
  else {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) jsonStr = t.slice(start, end + 1);
  }
  const data = JSON.parse(jsonStr) as unknown;
  if (!data || typeof data !== "object") throw new Error("Некорректный JSON");
  const o = data as Record<string, unknown>;
  const deck_title = String(o.deck_title ?? "Презентация").trim() || "Презентация";
  const slidesIn = o.slides;
  if (!Array.isArray(slidesIn)) throw new Error("В JSON нет массива slides");

  const slides: GammaSlide[] = [];
  for (const item of slidesIn) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const type = String(s.type ?? "").toLowerCase();
    const imageHint =
      s.image_hint != null && String(s.image_hint).trim() ? String(s.image_hint).trim().slice(0, 200) : undefined;
    if (type === "title") {
      slides.push({
        type: "title",
        title: String(s.title ?? "").trim() || deck_title,
        subtitle: String(s.subtitle ?? "").trim() || " ",
        ...(imageHint ? { image_hint: imageHint } : {}),
      });
    } else if (type === "content") {
      slides.push({
        type: "content",
        title: String(s.title ?? "").trim() || "Слайд",
        bullets: normalizeBullets(s.bullets),
        ...(imageHint ? { image_hint: imageHint } : {}),
      });
    } else if (type === "section") {
      slides.push({
        type: "section",
        title: String(s.title ?? "").trim() || "Раздел",
        subtitle: s.subtitle != null ? String(s.subtitle).trim() : undefined,
        ...(imageHint ? { image_hint: imageHint } : {}),
      });
    } else if (type === "closing") {
      slides.push({
        type: "closing",
        title: String(s.title ?? "").trim() || "Спасибо",
        line: s.line != null ? String(s.line).trim() : undefined,
        ...(imageHint ? { image_hint: imageHint } : {}),
      });
    }
  }
  if (slides.length === 0) throw new Error("Не удалось разобрать слайды");
  return { deck_title, slides };
}

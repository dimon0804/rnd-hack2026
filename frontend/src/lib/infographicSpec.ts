/** Инфографика: числа из источников + тип диаграммы для отрисовки в UI. */

import { parseAiJsonObject } from "./aiJsonParse";

export type InfographicItem = {
  label: string;
  value: number;
  unit?: string;
  source_hint?: string;
};

export type InfographicSpec = {
  title: string;
  subtitle?: string;
  items: InfographicItem[];
  chart_type: "bar" | "horizontal_bar" | "donut";
  footnote_ru?: string;
};

export function parseInfographicJson(raw: string): InfographicSpec {
  const data = parseAiJsonObject(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Некорректный JSON: ожидался объект");
  const o = data as Record<string, unknown>;
  const title = String(o.title ?? "Инфографика").trim() || "Инфографика";
  const subtitle = o.subtitle != null && String(o.subtitle).trim() ? String(o.subtitle).trim().slice(0, 200) : undefined;
  const ct = String(o.chart_type ?? "bar").toLowerCase();
  const chart_type: InfographicSpec["chart_type"] =
    ct === "horizontal_bar" || ct === "donut" ? ct : "bar";
  const itemsIn = o.items;
  const items: InfographicItem[] = [];
  if (Array.isArray(itemsIn)) {
    for (const row of itemsIn) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const label = String(r.label ?? "").trim();
      const value = Number(r.value);
      if (!label || Number.isNaN(value)) continue;
      items.push({
        label: label.slice(0, 120),
        value,
        unit: r.unit != null ? String(r.unit).trim().slice(0, 24) : undefined,
        source_hint: r.source_hint != null ? String(r.source_hint).trim().slice(0, 160) : undefined,
      });
    }
  }
  if (items.length === 0) throw new Error("Нет числовых данных для графика");
  const footnote_ru =
    o.footnote_ru != null && String(o.footnote_ru).trim()
      ? String(o.footnote_ru).trim().slice(0, 400)
      : undefined;
  return { title, subtitle, items: items.slice(0, 24), chart_type, footnote_ru };
}

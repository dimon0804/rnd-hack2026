/** План видео-пересказа: кадры (изображение) + текст озвучки = единый формат «видео» без серверного FFmpeg. */

import { parseAiJsonObject } from "./aiJsonParse";

export type VideoScene = {
  scene_index: number;
  title_ru: string;
  voiceover_ru: string;
  duration_sec: number;
  image_hint_en: string;
};

export type VideoRecapPlan = {
  video_title: string;
  total_duration_sec: number;
  scenes: VideoScene[];
  narrator_note_ru?: string;
};

export function parseVideoRecapJson(raw: string): VideoRecapPlan {
  const data = parseAiJsonObject(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Некорректный JSON: ожидался объект");
  const o = data as Record<string, unknown>;
  const video_title = String(o.video_title ?? "Видео-пересказ").trim() || "Видео-пересказ";
  const total_duration_sec = Math.max(0, Number(o.total_duration_sec) || 0);
  const scenesIn = o.scenes;
  if (!Array.isArray(scenesIn)) throw new Error("В JSON нет массива scenes");

  const scenes: VideoScene[] = [];
  for (let i = 0; i < scenesIn.length; i++) {
    const item = scenesIn[i];
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    scenes.push({
      scene_index: typeof s.scene_index === "number" ? s.scene_index : i + 1,
      title_ru: String(s.title_ru ?? `Сцена ${i + 1}`).trim() || `Сцена ${i + 1}`,
      voiceover_ru: String(s.voiceover_ru ?? "").trim() || "—",
      duration_sec: Math.min(60, Math.max(3, Number(s.duration_sec) || 12)),
      image_hint_en: String(s.image_hint_en ?? "professional presentation abstract").trim().slice(0, 240),
    });
  }
  if (scenes.length === 0) throw new Error("Нет ни одной сцены");
  const narrator_note_ru =
    o.narrator_note_ru != null && String(o.narrator_note_ru).trim()
      ? String(o.narrator_note_ru).trim().slice(0, 500)
      : undefined;
  return {
    video_title,
    total_duration_sec: total_duration_sec || scenes.reduce((a, x) => a + x.duration_sec, 0),
    scenes,
    narrator_note_ru,
  };
}

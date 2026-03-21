import type { GammaDeck, GammaSlide } from "./gammaDeck";
import type { AuthFetch } from "./workspaceAi";

const W = 960;
const H = 540;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

function slideMainText(sl: GammaSlide): string {
  switch (sl.type) {
    case "title":
      return `${sl.title} ${sl.subtitle}`;
    case "section":
      return [sl.title, sl.subtitle ?? ""].join(" ");
    case "content":
      return [sl.title, ...sl.bullets].join(" ");
    case "closing":
      return [sl.title, sl.line ?? ""].join(" ");
    default:
      return "";
  }
}

/** Название презентации только латиницей — можно безопасно добавить к запросу в сток. */
function latinDeckTitle(deckTitle: string): string | null {
  const t = deckTitle.trim();
  if (!t || /[а-яА-ЯёЁ]/.test(t)) return null;
  if (!/[a-zA-Z]/.test(t)) return null;
  return t.length > 120 ? t.slice(0, 120) : t;
}

/** Если модель не дала image_hint — короткий английский запрос по типичным маркерам в тексте слайда. */
function semanticFallback(sl: GammaSlide): string | undefined {
  const blob = slideMainText(sl);
  if (/IRQ|DMA|I\s*\/\s*O|I-O|interrupt|motherboard|microcontroller|PCI|шина|порт|память|процессор/i.test(blob)) {
    return "computer motherboard circuit board microcontroller data bus electronics workshop";
  }
  if (/TCP|IP|OSI|router|ethernet|packet|сетев|протокол|LAN|Wi-?Fi/i.test(blob)) {
    return "network cables server room fiber optic data center technician";
  }
  if (/SQL|PostgreSQL|mysql|база данных|таблиц|запрос/i.test(blob)) {
    return "database administrator office monitors sql analytics";
  }
  if (/безопас|security|password|крипт|encryption|firewall|взлом/i.test(blob)) {
    return "cybersecurity professional server room lock digital";
  }
  return undefined;
}

/**
 * Фраза для Pexels/Openverse: подсказка модели + при необходимости тема презентации (латиница);
 * без подсказки — эвристика по тексту слайда.
 */
export function buildImageSearchQuery(deck: GammaDeck, sl: GammaSlide): string {
  let q = (sl.image_hint ?? "").trim();
  const deckExtra = latinDeckTitle(deck.deck_title ?? "");
  if (q && deckExtra) {
    const words = deckExtra.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const qLow = q.toLowerCase();
    const overlap = words.some((w) => qLow.includes(w));
    if (!overlap) {
      q = `${q} ${deckExtra}`.trim();
    }
  }
  if (!q) {
    q = semanticFallback(sl) ?? "professional presentation abstract slide";
  }
  return q.slice(0, 240);
}

async function fetchPicsumFallback(seedSource: string, slideIndex: number): Promise<string | null> {
  const raw = seedSource.trim().toLowerCase();
  const ascii = raw.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").slice(0, 40);
  const base = ascii.replace(/^-+|-+$/g, "") || `slide-${slideIndex}`;
  const seed = `${base}-${slideIndex}`;
  const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${W}/${H}`;
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    const b64 = arrayBufferToBase64(buf);
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * Картинка по смыслу: запрос собирается из image_hint и темы; шлюз → Pexels / Openverse / Picsum.
 */
export async function fetchSlideImageDataUrl(
  deck: GammaDeck,
  sl: GammaSlide,
  slideIndex: number,
  authFetch: AuthFetch,
): Promise<string | null> {
  const q = buildImageSearchQuery(deck, sl);
  const url = `${apiBase()}/api/v1/stock-image/photo?q=${encodeURIComponent(q)}&i=${slideIndex}`;
  try {
    const res = await authFetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return fetchPicsumFallback(q, slideIndex);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    const b64 = arrayBufferToBase64(buf);
    return `data:${mime};base64,${b64}`;
  } catch {
    return fetchPicsumFallback(q, slideIndex);
  }
}

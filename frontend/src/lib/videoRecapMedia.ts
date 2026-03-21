/** Кадры для видео-плана: тот же stock API, что и для слайдов Gamma. */

import type { AuthFetch } from "./workspaceAi";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchPicsumFallback(seedSource: string, sceneIndex: number): Promise<string | null> {
  const raw = seedSource.trim().toLowerCase();
  const ascii = raw.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").slice(0, 40);
  const base = ascii.replace(/^-+|-+$/g, "") || `scene-${sceneIndex}`;
  const seed = `${base}-${sceneIndex}`;
  const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/960/540`;
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

/** Изображение по английской фразе (как image_hint) для превью кадра. */
export async function fetchStockImageByQuery(
  authFetch: AuthFetch,
  queryEn: string,
  sceneIndex: number,
): Promise<string | null> {
  const q = (queryEn || "professional presentation abstract").trim().slice(0, 240);
  const url = `${apiBase()}/api/v1/stock-image/photo?q=${encodeURIComponent(q)}&i=${sceneIndex}`;
  try {
    const res = await authFetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return fetchPicsumFallback(q, sceneIndex);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
    const b64 = arrayBufferToBase64(buf);
    return `data:${mime};base64,${b64}`;
  } catch {
    return fetchPicsumFallback(q, sceneIndex);
  }
}

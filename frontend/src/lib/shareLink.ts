const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Из полного URL, пути `/share/uuid` или голого UUID извлекает токен общей коллекции.
 */
export function parseShareTokenFromInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (UUID_RE.test(t)) return t.toLowerCase();

  const lower = t.toLowerCase();
  const shareIdx = lower.lastIndexOf("/share/");
  if (shareIdx >= 0) {
    const rest = t.slice(shareIdx + 7).split(/[/?#]/)[0]?.trim() ?? "";
    if (UUID_RE.test(rest)) return rest.toLowerCase();
  }

  try {
    const u = new URL(t.includes("://") ? t : `https://example.com${t.startsWith("/") ? "" : "/"}${t}`);
    const path = u.pathname.replace(/\/+$/, "");
    const m = path.match(/\/share\/([0-9a-f-]{36})(?:\/|$)/i);
    if (m?.[1] && UUID_RE.test(m[1])) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }

  const pathOnly = t.split(/[\s?#]/)[0] ?? "";
  const m2 = pathOnly.match(/(?:^|[/])share\/([0-9a-f-]{36})(?:\/|$)/i);
  if (m2?.[1] && UUID_RE.test(m2[1])) return m2[1].toLowerCase();

  return null;
}

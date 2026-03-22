import { useCallback, useEffect, useState } from "react";
import { fetchRagStatus, type RagStatusPayload } from "../api/ragStatus";

const POLL_MS = 8000;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
  } catch {
    return iso;
  }
}

function searchModeRu(mode: string): string {
  const m = mode.toLowerCase();
  if (m === "embeddings") return "эмбеддинги";
  if (m === "tfidf") return "TF‑IDF";
  if (m === "hybrid") return "TF‑IDF + эмбеддинги";
  return mode;
}

/**
 * Компактная демо-панель: RAG онлайн, размер индекса, последняя ошибка ingest (без секретов).
 * По умолчанию выключена; включение: `VITE_SHOW_LIVE_PANEL=true` в `.env`.
 */
export function LiveSystemPanel() {
  if (import.meta.env.VITE_SHOW_LIVE_PANEL !== "true") {
    return null;
  }

  const [data, setData] = useState<RagStatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const j = await fetchRagStatus();
      setData(j);
      setErr(null);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const ok = data && data.status === "ok";

  return (
    <aside className="live-system-panel" aria-label="Статус RAG и индекса">
      <div className="live-system-panel__head">
        <span className="live-system-panel__dot" data-state={loading ? "pending" : ok ? "ok" : "err"} aria-hidden />
        <strong className="live-system-panel__title">RAG</strong>
        <span className="live-system-panel__badge">
          {loading ? "…" : ok ? "онлайн" : err ? "нет связи" : "—"}
        </span>
      </div>
      {data ? (
        <>
          <p className="live-system-panel__line">
            <span className="live-system-panel__k">Чанков</span> {data.chunks_total}
            <span className="live-system-panel__sep" aria-hidden>
              ·
            </span>
            <span className="live-system-panel__k">Документов</span> {data.documents_indexed}
          </p>
          <p className="live-system-panel__line live-system-panel__line--muted">
            Поиск: {searchModeRu(data.search_mode)} · БД чанков: {data.db_persist_enabled ? "да" : "нет"}
          </p>
          {data.last_ingest_error ? (
            <p className="live-system-panel__err" role="status">
              <span className="live-system-panel__k">Последняя ошибка индекса</span>
              {formatWhen(data.last_ingest_error_at) ? (
                <span className="live-system-panel__when"> · {formatWhen(data.last_ingest_error_at)}</span>
              ) : null}
              <br />
              {data.last_ingest_error}
            </p>
          ) : (
            <p className="live-system-panel__ok">Ошибок индексации не зафиксировано.</p>
          )}
        </>
      ) : err ? (
        <p className="live-system-panel__err" role="alert">
          {err.length > 120 ? `${err.slice(0, 120)}…` : err}
        </p>
      ) : null}
      <p className="live-system-panel__foot">Обновление каждые {POLL_MS / 1000} с</p>
    </aside>
  );
}

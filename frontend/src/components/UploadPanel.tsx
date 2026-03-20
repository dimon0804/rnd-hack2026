import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listDocuments, uploadDocument, type DocumentItem, type DocumentUploadResult } from "../api/documents";
import { documentStatusRu } from "../lib/documentStatus";
import { ProcessingOverlay } from "./workspace/ProcessingOverlay";
import { useAuth } from "../context/AuthContext";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel() {
  const navigate = useNavigate();
  const { isAuthenticated, isHydrated, authFetch } = useAuth();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentUploadResult | null>(null);
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);

  const refreshList = useCallback(async () => {
    if (!isAuthenticated) {
      setDocs(null);
      return;
    }
    try {
      const rows = await listDocuments(authFetch);
      setDocs(rows);
    } catch {
      setDocs([]);
    }
  }, [isAuthenticated, authFetch]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    void refreshList();
  }, [isHydrated, isAuthenticated, refreshList]);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await uploadDocument(file, authFetch);
      setResult(res);
      await refreshList();
      if (isAuthenticated && res.id) {
        navigate(`/workspace/${res.id}`, { replace: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  const canUseMyDocs = useMemo(() => isHydrated && isAuthenticated, [isHydrated, isAuthenticated]);

  return (
    <>
      <ProcessingOverlay active={busy} />
      <div style={styles.wrap}>
      <div style={styles.top}>
        <div>
          <p style={styles.kicker}>Рабочий стол</p>
          <h1 style={styles.title}>Загрузка документов</h1>
          <p style={styles.subtitle}>
            PDF, DOCX или TXT до 50&nbsp;MB. Файл сохраняется и ставится в очередь на чанкинг и индексацию в RAG.
          </p>
        </div>
        <ol style={styles.steps}>
          <li style={styles.step}>
            <span style={styles.stepNum}>1</span>
            <span>Файл</span>
          </li>
          <li style={styles.stepMuted}>→</li>
          <li style={styles.step}>
            <span style={styles.stepNum}>2</span>
            <span>Индексация</span>
          </li>
          <li style={styles.stepMuted}>→</li>
          {canUseMyDocs ? (
            <li style={styles.step}>
              <span style={styles.stepNum}>3</span>
              <span>Рабочая область</span>
            </li>
          ) : (
            <li style={styles.stepDim}>
              <span style={styles.stepNumDim}>3</span>
              <span>Рабочая область</span>
            </li>
          )}
        </ol>
        {canUseMyDocs ? (
          <p style={styles.chatBar}>
            После загрузки откроется <strong style={{ color: "var(--text)" }}>страница документа</strong> с кратким
            содержанием, чатом и тестами.
          </p>
        ) : null}
      </div>

      {!isHydrated ? null : !isAuthenticated ? (
        <div style={styles.callout}>
          <div>
            <strong style={styles.calloutTitle}>Загрузка без входа</strong>
            <p style={styles.calloutText}>
              Файл можно отправить и без аккаунта. Чтобы видеть список «Мои документы» и привязку к пользователю —
              войдите или зарегистрируйтесь.
            </p>
          </div>
          <div style={styles.calloutActions}>
            <Link to="/login" style={styles.btnSmPrimary}>
              Войти
            </Link>
            <Link to="/register" style={styles.btnSmGhost}>
              Регистрация
            </Link>
          </div>
        </div>
      ) : null}

      <div className="upload-layout">
        <section style={styles.mainCard}>
          <div
            style={{
              ...styles.drop,
              ...(drag ? styles.dropActive : {}),
              ...(busy ? styles.dropBusy : {}),
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void onFiles(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              style={styles.file}
              disabled={busy}
              onChange={(e) => void onFiles(e.target.files)}
            />
            <div style={styles.dropInner}>
              <span style={styles.dropIcon} aria-hidden>
                ⬆
              </span>
              <span style={styles.dropTitle}>{busy ? "Загрузка…" : "Перетащите файл сюда"}</span>
              <span style={styles.dropHint}>или нажмите в эту область, чтобы выбрать с диска</span>
              <span style={styles.formats}>PDF · DOCX · TXT</span>
            </div>
          </div>

          {error ? (
            <p style={styles.err} role="alert">
              {error}
            </p>
          ) : null}

          {result ? (
            <div style={styles.okCard}>
              <div style={styles.okRow}>
                <span style={styles.badge}>{documentStatusRu(result.status)}</span>
                <strong style={styles.okName}>{result.original_filename}</strong>
              </div>
              <p style={styles.okMeta}>
                {formatBytes(result.size_bytes)} · {result.mime_type}
              </p>
              <p style={styles.okMsg}>{result.message}</p>
              <p style={styles.id}>id: {result.id}</p>
              {canUseMyDocs && result.status.toLowerCase() === "ready" ? (
                <div style={styles.okActions}>
                  <Link to={`/workspace/${result.id}`} style={styles.btnChat}>
                    Открыть рабочую область
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside style={styles.sideCard}>
          <div style={styles.sideHead}>
            <h2 style={styles.h2}>Мои документы</h2>
            <button
              type="button"
              style={styles.btnGhost}
              disabled={!canUseMyDocs || busy}
              onClick={() => void refreshList()}
            >
              Обновить
            </button>
          </div>
          {!canUseMyDocs ? (
            <p style={styles.muted}>
              После входа здесь появятся ваши файлы со статусом обработки (например QUEUED, INDEXED).
            </p>
          ) : docs === null ? (
            <p style={styles.muted}>Загрузка списка…</p>
          ) : docs.length === 0 ? (
            <p style={styles.muted}>Пока пусто — загрузите первый файл слева.</p>
          ) : (
            <ul style={styles.list}>
              {docs.map((d) => (
                <li key={d.id} style={styles.li}>
                  <Link to={`/workspace/${d.id}`} style={styles.liLink}>
                    <div style={styles.liMain}>
                      <div style={styles.docName}>{d.original_filename}</div>
                      <div style={styles.docMeta}>
                        {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleString()}
                      </div>
                    </div>
                  </Link>
                  <span style={styles.badge}>{documentStatusRu(d.status)}</span>
                </li>
              ))}
            </ul>
          )}
          <div style={styles.sideFoot}>
            <Link to="/" style={styles.inlineLink}>
              На главную
            </Link>
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "28px 20px 72px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  top: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    animation: "fadeUp 0.45s ease both",
  },
  kicker: {
    margin: "0 0 6px",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  title: { margin: "0 0 8px", fontSize: "clamp(1.45rem, 3vw, 1.75rem)", fontWeight: 700, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, color: "var(--muted)", fontSize: "0.98rem", lineHeight: 1.6, maxWidth: 640 },
  steps: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    fontSize: "0.85rem",
  },
  step: { display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontWeight: 500 },
  stepMuted: { color: "var(--muted)", padding: "0 4px" },
  stepDim: { display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontWeight: 500 },
  stepChatLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "var(--accent)",
    fontWeight: 600,
    textDecoration: "none",
  },
  chatBar: { margin: 0, fontSize: "0.92rem", color: "var(--muted)", lineHeight: 1.5 },
  chatCta: {
    color: "var(--accent)",
    fontWeight: 700,
    textDecoration: "none",
  },
  chatBarHint: { color: "var(--muted)", fontWeight: 400 },
  stepNum: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  stepNumDim: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    color: "var(--muted)",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  callout: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "16px 18px",
    borderRadius: "var(--radius)",
    border: "1px solid rgba(110, 231, 183, 0.25)",
    background: "rgba(110, 231, 183, 0.06)",
  },
  calloutTitle: { display: "block", marginBottom: 6, fontSize: "0.95rem" },
  calloutText: { margin: 0, color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5, maxWidth: 560 },
  calloutActions: { display: "flex", gap: 10, flexShrink: 0 },
  btnSmPrimary: {
    padding: "8px 16px",
    borderRadius: 10,
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "0.88rem",
    textDecoration: "none",
  },
  btnSmGhost: {
    padding: "8px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: "0.88rem",
    textDecoration: "none",
  },
  mainCard: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 24,
    boxShadow: "var(--shadow)",
    animation: "fadeUp 0.5s ease both",
  },
  sideCard: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 20,
    boxShadow: "var(--shadow)",
    animation: "fadeUp 0.55s ease both",
  },
  sideHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  sideFoot: {
    margin: "16px 0 0",
    paddingTop: 12,
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  sideFootSep: { color: "var(--muted)", userSelect: "none" },
  inlineLink: { color: "var(--muted)", fontSize: "0.88rem" },
  inlineLinkAccent: { color: "var(--accent)", fontSize: "0.88rem", fontWeight: 700, textDecoration: "none" },
  drop: {
    position: "relative",
    border: "1px dashed rgba(255,255,255,0.22)",
    borderRadius: 14,
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    transition: "border-color 0.2s, background 0.2s, transform 0.2s",
    cursor: "pointer",
  },
  dropActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-dim)",
    transform: "scale(1.005)",
  },
  dropBusy: { opacity: 0.7, pointerEvents: "none" },
  file: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
  },
  dropInner: {
    textAlign: "center",
    pointerEvents: "none",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  dropIcon: {
    fontSize: "1.75rem",
    opacity: 0.85,
    marginBottom: 4,
  },
  dropTitle: { display: "block", fontWeight: 700, fontSize: "1.05rem" },
  dropHint: { color: "var(--muted)", fontSize: "0.92rem" },
  formats: {
    marginTop: 4,
    fontSize: "0.78rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--muted)",
  },
  err: { color: "var(--danger)", marginTop: 14, fontSize: "0.9rem" },
  okCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 12,
    background: "rgba(110, 231, 183, 0.08)",
    border: "1px solid rgba(110, 231, 183, 0.25)",
  },
  okRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  okName: { fontSize: "1rem" },
  okMeta: { margin: "6px 0 0", color: "var(--muted)", fontSize: "0.85rem" },
  okMsg: { margin: "8px 0 0", fontSize: "0.9rem" },
  id: { margin: "6px 0 0", fontSize: "0.75rem", color: "var(--muted)", wordBreak: "break-all" },
  okActions: { marginTop: 14 },
  btnChat: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 10,
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "0.9rem",
    textDecoration: "none",
  },
  badge: {
    fontSize: "0.72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid var(--border)",
  },
  h2: { margin: 0, fontSize: "1.05rem", fontWeight: 700 },
  btnGhost: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontSize: "0.88rem",
  },
  muted: { color: "var(--muted)", margin: 0, fontSize: "0.9rem", lineHeight: 1.5 },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  li: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
  },
  liLink: {
    flex: 1,
    minWidth: 0,
    color: "inherit",
    textDecoration: "none",
  },
  liMain: { minWidth: 0, flex: 1 },
  docName: { fontWeight: 600, fontSize: "0.92rem", wordBreak: "break-word" },
  docMeta: { color: "var(--muted)", fontSize: "0.8rem", marginTop: 4 },
};

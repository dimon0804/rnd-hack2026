import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { listDocuments, uploadDocument, type DocumentItem, type DocumentUploadResult } from "../api/documents";

const TOKEN_KEY = "access_token";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPanel() {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentUploadResult | null>(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);

  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  const persistToken = (value: string) => {
    setToken(value);
    if (value.trim()) {
      localStorage.setItem(TOKEN_KEY, value.trim());
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const refreshList = useCallback(async () => {
    if (!hasToken) {
      setDocs(null);
      return;
    }
    try {
      const rows = await listDocuments(token.trim());
      setDocs(rows);
    } catch {
      setDocs([]);
    }
  }, [hasToken, token]);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const tok = hasToken ? token.trim() : null;
      const res = await uploadDocument(file, tok);
      setResult(res);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <section style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.title}>Загрузка документов</h1>
          <p style={styles.subtitle}>
            PDF, DOCX или TXT до 50&nbsp;MB. После сохранения файл передаётся в RAG pipeline (чанкинг и индексация).
          </p>
        </header>

        <label style={styles.label}>Access token (опционально, для списка «мои документы»)</label>
        <input
          style={styles.input}
          type="password"
          autoComplete="off"
          placeholder="Bearer из /api/v1/auth/login"
          value={token}
          onChange={(e) => persistToken(e.target.value)}
        />

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
            <span style={styles.dropTitle}>{busy ? "Загрузка…" : "Перетащите файл сюда"}</span>
            <span style={styles.dropHint}>или нажмите, чтобы выбрать</span>
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
              <span style={styles.badge}>{result.status}</span>
              <strong style={styles.okName}>{result.original_filename}</strong>
            </div>
            <p style={styles.okMeta}>
              {formatBytes(result.size_bytes)} · {result.mime_type}
            </p>
            <p style={styles.okMsg}>{result.message}</p>
            <p style={styles.id}>id: {result.id}</p>
          </div>
        ) : null}
      </section>

      <section style={styles.card}>
        <div style={styles.rowBetween}>
          <h2 style={styles.h2}>Мои документы</h2>
          <button type="button" style={styles.btnGhost} disabled={!hasToken || busy} onClick={() => void refreshList()}>
            Обновить
          </button>
        </div>
        {!hasToken ? (
          <p style={styles.muted}>Укажите access token, чтобы увидеть список.</p>
        ) : docs === null ? (
          <p style={styles.muted}>Нажмите «Обновить», чтобы загрузить список.</p>
        ) : docs.length === 0 ? (
          <p style={styles.muted}>Пока нет загруженных файлов.</p>
        ) : (
          <ul style={styles.list}>
            {docs.map((d) => (
              <li key={d.id} style={styles.li}>
                <div>
                  <div style={styles.docName}>{d.original_filename}</div>
                  <div style={styles.docMeta}>
                    {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <span style={styles.badge}>{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "48px 20px 64px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  card: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 24,
    boxShadow: "var(--shadow)",
    animation: "fadeUp 0.45s ease both",
  },
  header: { marginBottom: 16 },
  title: { margin: "0 0 8px", fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em" },
  subtitle: { margin: 0, color: "var(--muted)", fontSize: "0.95rem" },
  label: { display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    marginBottom: 16,
    outline: "none",
  },
  drop: {
    position: "relative",
    border: "1px dashed rgba(255,255,255,0.2)",
    borderRadius: 12,
    minHeight: 160,
    display: "grid",
    placeItems: "center",
    transition: "border-color 0.2s, background 0.2s, transform 0.2s",
    cursor: "pointer",
  },
  dropActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-dim)",
    transform: "scale(1.01)",
  },
  dropBusy: { opacity: 0.7, pointerEvents: "none" },
  file: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
  },
  dropInner: { textAlign: "center", pointerEvents: "none" },
  dropTitle: { display: "block", fontWeight: 600, marginBottom: 4 },
  dropHint: { color: "var(--muted)", fontSize: "0.9rem" },
  err: { color: "var(--danger)", marginTop: 12, fontSize: "0.9rem" },
  okCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    background: "rgba(110, 231, 183, 0.08)",
    border: "1px solid rgba(110, 231, 183, 0.25)",
  },
  okRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  okName: { fontSize: "1rem" },
  okMeta: { margin: "6px 0 0", color: "var(--muted)", fontSize: "0.85rem" },
  okMsg: { margin: "8px 0 0", fontSize: "0.9rem" },
  id: { margin: "6px 0 0", fontSize: "0.75rem", color: "var(--muted)", wordBreak: "break-all" },
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
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  h2: { margin: 0, fontSize: "1.1rem" },
  btnGhost: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
  },
  muted: { color: "var(--muted)", margin: 0, fontSize: "0.92rem" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 },
  li: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.03)",
  },
  docName: { fontWeight: 600 },
  docMeta: { color: "var(--muted)", fontSize: "0.82rem", marginTop: 4 },
};

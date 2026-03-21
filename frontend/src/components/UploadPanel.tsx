import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

const DOCS_PAGE_SIZE = 8;
import { Link, useNavigate } from "react-router-dom";
import {
  listDocuments,
  uploadDocument,
  uploadDocumentBatch,
  type BatchUploadResult,
  type DocumentItem,
  type DocumentUploadResult,
} from "../api/documents";
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
  const [batchResult, setBatchResult] = useState<BatchUploadResult | null>(null);
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [docsPage, setDocsPage] = useState(1);

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

  const docsTotalPages = useMemo(() => {
    if (!docs?.length) return 1;
    return Math.max(1, Math.ceil(docs.length / DOCS_PAGE_SIZE));
  }, [docs]);

  const pagedDocs = useMemo(() => {
    if (!docs) return [];
    const start = (docsPage - 1) * DOCS_PAGE_SIZE;
    return docs.slice(start, start + DOCS_PAGE_SIZE);
  }, [docs, docsPage]);

  useEffect(() => {
    if (docs === null) return;
    setDocsPage((p) => Math.min(Math.max(1, p), docsTotalPages));
  }, [docs, docsTotalPages]);

  const onFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setError(null);
    setResult(null);
    setBatchResult(null);
    setBusy(true);
    try {
      if (list.length === 1) {
        const res = await uploadDocument(list[0], authFetch);
        setResult(res);
        await refreshList();
        if (isAuthenticated && res.id) {
          navigate(`/workspace/${res.id}`, { replace: false });
        }
      } else {
        const res = await uploadDocumentBatch(list, authFetch);
        setBatchResult(res);
        await refreshList();
        const first = res.results[0];
        if (isAuthenticated && first?.id) {
          navigate(`/workspace/${first.id}`, { replace: false });
        }
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
            PDF, DOCX, PPTX или TXT до 50&nbsp;MB каждый. Можно выбрать несколько файлов: схожие по теме объединятся для
            общего чата (проверка на бэкенде), разные темы — загрузятся отдельно.
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
              multiple
              accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
              style={styles.file}
              disabled={busy}
              onChange={(e) => void onFiles(e.target.files)}
            />
            <div style={styles.dropInner}>
              <span style={styles.dropIcon} aria-hidden>
                ⬆
              </span>
              <span style={styles.dropTitle}>{busy ? "Загрузка…" : "Перетащите файлы сюда"}</span>
              <span style={styles.dropHint}>или нажмите — можно выбрать несколько (Ctrl/Shift)</span>
              <span style={styles.formats}>PDF · DOCX · PPTX · TXT</span>
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

          {batchResult ? (
            <div style={styles.okCard}>
              <p style={styles.okMeta}>Загружено файлов: {batchResult.results.length}</p>
              {batchResult.groups_note ? <p style={styles.okMsg}>{batchResult.groups_note}</p> : null}
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: "0.88rem" }}>
                {batchResult.results.map((r) => (
                  <li key={r.id} style={{ marginBottom: 6 }}>
                    <strong>{r.original_filename}</strong> — {documentStatusRu(r.status)}
                    {r.topic_group_id ? (
                      <span style={{ color: "var(--muted)" }}> (группа)</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}> (отдельно)</span>
                    )}
                  </li>
                ))}
              </ul>
              {canUseMyDocs && batchResult.results[0]?.status.toLowerCase() === "ready" ? (
                <div style={styles.okActions}>
                  <Link to={`/workspace/${batchResult.results[0].id}`} style={styles.btnChat}>
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
            <>
              <ul style={styles.list}>
                {pagedDocs.map((d) => (
                  <li key={d.id} style={styles.li}>
                    <Link to={`/workspace/${d.id}`} style={styles.liLink} title={d.original_filename}>
                      <div style={styles.liMain}>
                        <div style={styles.docName}>
                          {d.topic_group_id && (d.group_document_ids?.length ?? 0) > 1 ? (
                            <span style={styles.groupMark} title="Один набор тем — чат по всем файлам группы">
                              🔗{" "}
                            </span>
                          ) : null}
                          {d.original_filename}
                        </div>
                        <div style={styles.docMeta}>
                          {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleString()}
                          {d.topic_group_id && (d.group_document_ids?.length ?? 0) > 1 ? (
                            <span> · группа {d.group_document_ids?.length} файлов</span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                    <span style={styles.liBadgeWrap}>
                      <span style={styles.badge}>{documentStatusRu(d.status)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {docs.length > DOCS_PAGE_SIZE ? (
                <div style={styles.pagination}>
                  <button
                    type="button"
                    style={{ ...styles.pageBtn, ...(docsPage <= 1 ? styles.pageBtnDisabled : {}) }}
                    disabled={docsPage <= 1}
                    onClick={() => setDocsPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span style={styles.pageInfo}>
                    {(docsPage - 1) * DOCS_PAGE_SIZE + 1}–{Math.min(docsPage * DOCS_PAGE_SIZE, docs.length)} из{" "}
                    {docs.length}
                  </span>
                  <button
                    type="button"
                    style={{
                      ...styles.pageBtn,
                      ...(docsPage >= docsTotalPages ? styles.pageBtnDisabled : {}),
                    }}
                    disabled={docsPage >= docsTotalPages}
                    onClick={() => setDocsPage((p) => Math.min(docsTotalPages, p + 1))}
                  >
                    Вперёд
                  </button>
                </div>
              ) : (
                <p style={styles.listMeta}>
                  {docs.length} {docs.length === 1 ? "файл" : docs.length < 5 ? "файла" : "файлов"}
                </p>
              )}
            </>
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
    maxWidth: 1240,
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
    padding: "22px 22px 20px",
    boxShadow: "var(--shadow)",
    animation: "fadeUp 0.55s ease both",
    minWidth: 0,
  },
  sideHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
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
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: "min(62vh, 640px)",
    overflowY: "auto",
    paddingRight: 4,
  },
  li: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 12,
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
  liBadgeWrap: { flexShrink: 0, paddingTop: 2 },
  docName: {
    fontWeight: 600,
    fontSize: "0.95rem",
    lineHeight: 1.35,
    wordBreak: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } as CSSProperties,
  docMeta: { color: "var(--muted)", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.4 },
  groupMark: { color: "var(--accent)", fontSize: "0.85rem" },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid var(--border)",
  },
  pageBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.05)",
    color: "var(--text)",
    fontSize: "0.86rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  pageBtnDisabled: { opacity: 0.42, cursor: "not-allowed" },
  pageInfo: { fontSize: "0.86rem", color: "var(--muted)", flex: 1, textAlign: "center", minWidth: 120 },
  listMeta: { margin: "12px 0 0", fontSize: "0.82rem", color: "var(--muted)" },
};

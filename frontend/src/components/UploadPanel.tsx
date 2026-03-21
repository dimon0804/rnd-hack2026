import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createCollection,
  deleteCollection,
  listCollections,
  listDocuments,
  setDocumentCollections,
  uploadDocument,
  uploadDocumentBatch,
  type BatchUploadResult,
  type CollectionItem,
  type DocumentItem,
  type DocumentUploadResult,
} from "../api/documents";
import { documentStatusRu } from "../lib/documentStatus";
import { ProcessingOverlay } from "./workspace/ProcessingOverlay";
import { useAuth } from "../context/AuthContext";

const DOCS_PAGE_SIZE = 8;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadgeClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "ready" || s === "indexed") return "status-ready";
  if (s === "queued") return "status-queued";
  if (s === "processing") return "status-processing";
  if (s === "error" || s === "failed") return "status-error";
  return "";
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
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [uploadCollectionIds, setUploadCollectionIds] = useState<string[]>([]);
  const [newCollName, setNewCollName] = useState("");
  const [collBusy, setCollBusy] = useState(false);
  /** Блокировка чекбоксов меток на время PATCH одного документа */
  const [patchingDocId, setPatchingDocId] = useState<string | null>(null);

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

  const refreshCollections = useCallback(async () => {
    if (!isAuthenticated) {
      setCollections([]);
      return;
    }
    try {
      setCollections(await listCollections(authFetch));
    } catch {
      setCollections([]);
    }
  }, [isAuthenticated, authFetch]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    void refreshList();
    void refreshCollections();
  }, [isHydrated, isAuthenticated, refreshList, refreshCollections]);

  const toggleUploadColl = (id: string) => {
    setUploadCollectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onCreateCollection = async () => {
    const n = newCollName.trim();
    if (!n || collBusy) return;
    setCollBusy(true);
    setError(null);
    try {
      await createCollection(n, authFetch);
      setNewCollName("");
      await refreshCollections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать коллекцию");
    } finally {
      setCollBusy(false);
    }
  };

  const onDeleteCollection = async (id: string) => {
    if (collBusy) return;
    if (!window.confirm("Удалить коллекцию? Документы останутся, связи с меткой снимутся.")) return;
    setCollBusy(true);
    setError(null);
    try {
      await deleteCollection(id, authFetch);
      setUploadCollectionIds((prev) => prev.filter((x) => x !== id));
      await refreshCollections();
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить коллекцию");
    } finally {
      setCollBusy(false);
    }
  };

  const onToggleDocCollection = async (doc: DocumentItem, collectionId: string, checked: boolean) => {
    const cur = new Set(doc.collection_ids ?? []);
    if (checked) cur.add(collectionId);
    else cur.delete(collectionId);
    setError(null);
    setPatchingDocId(doc.id);
    try {
      await setDocumentCollections(doc.id, [...cur], authFetch);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить коллекции документа");
    } finally {
      setPatchingDocId(null);
    }
  };

  const collectionLabel = (id: string) => collections.find((c) => c.id === id)?.name ?? id.slice(0, 8);

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
      const collOpt =
        uploadCollectionIds.length > 0 ? { collectionIds: uploadCollectionIds } : undefined;
      if (list.length === 1) {
        const res = await uploadDocument(list[0], authFetch, collOpt);
        setResult(res);
        await refreshList();
        if (isAuthenticated && res.id) {
          navigate(`/workspace/${res.id}`, { replace: false });
        }
      } else {
        const res = await uploadDocumentBatch(list, authFetch, collOpt);
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
      <main className="main main--wide" id="main" tabIndex={-1}>
        <p className="kick-label kick-label--page">Рабочий стол</p>
        <h1 className="page-title">Загрузка документов</h1>
        <p className="page-sub">
          PDF, DOCX, PPTX или TXT до 50&nbsp;MB каждый. Можно выбрать несколько файлов: схожие по теме объединятся для
          общего чата (проверка на бэкенде), разные темы — загрузятся отдельно.
        </p>

        <ol className="stepper" aria-label="Этапы">
          <li className="stepper-step is-done">
            <span className="stepper-num">1</span> Файл
          </li>
          <li className="stepper-step is-done">
            <span className="stepper-num">2</span> Индексация
          </li>
          <li className={`stepper-step${canUseMyDocs ? " is-done" : " is-muted"}`}>
            <span className="stepper-num">3</span> Рабочая область
          </li>
        </ol>

        {canUseMyDocs ? (
          <p className="page-note">
            После загрузки откроется страница документа с кратким содержанием, чатом и тестами.
          </p>
        ) : null}

        {!isHydrated ? null : !isAuthenticated ? (
          <div className="callout callout--guest">
            <h2 className="callout-title">Загрузка без входа</h2>
            <p>
              Файл можно отправить и без аккаунта. Чтобы видеть список «Мои документы» и привязку к пользователю — войдите
              или зарегистрируйтесь.
            </p>
            <div className="callout-actions">
              <Link to="/login" className="btn-solid btn-compact">
                Войти
              </Link>
              <Link to="/register" className="btn-outline btn-compact">
                Регистрация
              </Link>
            </div>
          </div>
        ) : null}

        <div className="upload-layout">
          <section>
            <div
              className={`drop-zone${drag ? " is-drag" : ""}`}
              style={{
                position: "relative",
                ...(busy ? { opacity: 0.72, pointerEvents: "none" } : {}),
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
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                }}
                disabled={busy}
                onChange={(e) => void onFiles(e.target.files)}
              />
              <span aria-hidden style={{ fontSize: "1.75rem", marginBottom: 4 }}>
                ⬆
              </span>
              <p className="drop-zone-title">{busy ? "Загрузка…" : "Перетащите файлы сюда"}</p>
              <p className="drop-zone-sub">или нажмите — можно выбрать несколько (Ctrl/Shift)</p>
              <p className="drop-zone-formats">PDF · DOCX · PPTX · TXT</p>
            </div>

            {error ? (
              <p className="form-error" role="alert" style={{ marginTop: 16 }}>
                {error}
              </p>
            ) : null}

            {result ? (
              <div className="result-card" style={{ marginTop: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className={`status-badge ${statusBadgeClass(result.status)}`}>{documentStatusRu(result.status)}</span>
                  <strong className="result-name">{result.original_filename}</strong>
                </div>
                <p className="result-meta">
                  {formatBytes(result.size_bytes)} · {result.mime_type}
                </p>
                <p className="result-msg">{result.message}</p>
                <p className="result-id">id: {result.id}</p>
                {canUseMyDocs && result.status.toLowerCase() === "ready" ? (
                  <Link to={`/workspace/${result.id}`} className="btn-solid">
                    Открыть рабочую область
                  </Link>
                ) : null}
              </div>
            ) : null}

            {batchResult ? (
              <div className="result-card" style={{ marginTop: 18 }}>
                <p className="result-meta">Загружено файлов: {batchResult.results.length}</p>
                {batchResult.groups_note ? <p className="result-msg">{batchResult.groups_note}</p> : null}
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: "0.88rem", color: "var(--muted)" }}>
                  {batchResult.results.map((r) => (
                    <li key={r.id} style={{ marginBottom: 6 }}>
                      <strong>{r.original_filename}</strong> — {documentStatusRu(r.status)}
                      {r.topic_group_id ? (
                        <span> (группа)</span>
                      ) : (
                        <span> (отдельно)</span>
                      )}
                    </li>
                  ))}
                </ul>
                {canUseMyDocs && batchResult.results[0]?.status.toLowerCase() === "ready" ? (
                  <Link to={`/workspace/${batchResult.results[0].id}`} className="btn-solid" style={{ marginTop: 12, display: "inline-block" }}>
                    Открыть рабочую область
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="workspace-aside">
            {canUseMyDocs ? (
              <section className="collections-card" aria-label="Коллекции">
                <header className="collections-card__head">
                  <h2 className="collections-card__title">Коллекции</h2>
                  <p className="collections-card__hint">
                    Метки для контекста (работа, учёба, проект). Выбор меток ниже влияет только на следующую загрузку в
                    зону слева — список «Мои документы» показывает все файлы.
                  </p>
                  <details className="collections-more">
                    <summary>Подробнее про поиск и чат</summary>
                    <p>
                      В рабочей области чат и RAG идут по этому файлу и связанным документам одной тематической группы.
                    </p>
                  </details>
                </header>

                <div className="collections-panel">
                  <h3 className="collections-panel__title">Новая метка</h3>
                  <div className="collections-create-row">
                    <input
                      className="input-bordered collections-create-input"
                      placeholder="Например: Хакатон 2026"
                      value={newCollName}
                      disabled={collBusy}
                      onChange={(e) => setNewCollName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void onCreateCollection();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-solid btn-compact collections-create-btn"
                      disabled={!newCollName.trim() || collBusy}
                      onClick={() => void onCreateCollection()}
                    >
                      {collBusy ? "…" : "Создать"}
                    </button>
                  </div>
                </div>

                {collections.length > 0 ? (
                  <div className="collections-panel collections-panel--upload">
                    <h3 className="collections-panel__title">Метки для следующей загрузки</h3>
                    <p className="collections-panel__hint">Выбранные метки прикрепятся к файлам в зоне слева.</p>
                    <div className="collections-chip-row" role="group" aria-label="Метки для загрузки">
                      {collections.map((c) => {
                        const on = uploadCollectionIds.includes(c.id);
                        return (
                          <div
                            key={`up-${c.id}`}
                            className={`collections-tag${on ? " collections-tag--selected" : ""}`}
                          >
                            <button
                              type="button"
                              className="collections-tag__filter"
                              disabled={busy}
                              onClick={() => toggleUploadColl(c.id)}
                              aria-pressed={on}
                            >
                              <span className="collections-tag__signal" aria-hidden />
                              <span className="collections-tag__label">{c.name}</span>
                            </button>
                            <button
                              type="button"
                              className="collections-tag__remove"
                              disabled={collBusy}
                              title={`Удалить коллекцию «${c.name}»`}
                              aria-label={`Удалить коллекцию ${c.name}`}
                              onClick={(e) => {
                                e.preventDefault();
                                void onDeleteCollection(c.id);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="collections-empty">Создайте метку выше — появятся быстрые переключатели для загрузки.</p>
                )}
              </section>
            ) : null}
            <div className="panel-head">
              <h2 className="panel-title">Мои документы</h2>
              <button
                type="button"
                className="btn-outline btn-compact"
                disabled={!canUseMyDocs || busy}
                onClick={() => {
                  void refreshList();
                  void refreshCollections();
                }}
              >
                Обновить
              </button>
            </div>
            {!canUseMyDocs ? (
              <p className="panel-empty">
                После входа здесь появятся ваши файлы со статусом обработки (например QUEUED, INDEXED).
              </p>
            ) : docs === null ? (
              <p className="panel-empty">Загрузка списка…</p>
            ) : docs.length === 0 ? (
              <p className="panel-empty">Пока пусто — загрузите первый файл слева.</p>
            ) : (
              <>
                <ul className="doc-list">
                  {pagedDocs.map((d) => (
                    <li key={d.id}>
                      <div className="doc-card-wrap">
                        <Link to={`/workspace/${d.id}`} className="doc-card" title={d.original_filename}>
                          <span className="doc-card-name">
                            {d.topic_group_id && (d.group_document_ids?.length ?? 0) > 1 ? (
                              <span style={{ color: "var(--accent)" }} title="Один набор тем — чат по всем файлам группы">
                                🔗{" "}
                              </span>
                            ) : null}
                            {d.original_filename}
                          </span>
                          <span className="doc-card-meta">
                            {formatBytes(d.size_bytes)} · {new Date(d.created_at).toLocaleString()}
                            {d.topic_group_id && (d.group_document_ids?.length ?? 0) > 1 ? (
                              <span> · группа {d.group_document_ids?.length} файлов</span>
                            ) : null}
                          </span>
                          <span className={`status-badge ${statusBadgeClass(d.status)}`}>{documentStatusRu(d.status)}</span>
                        </Link>
                        {collections.length > 0 ? (
                          <div className="doc-coll-strip">
                            <div className="doc-coll-tags">
                              {(d.collection_ids ?? []).length > 0 ? (
                                (d.collection_ids ?? []).map((cid) => (
                                  <span key={cid} className="doc-coll-tag" title={collectionLabel(cid)}>
                                    {collectionLabel(cid)}
                                  </span>
                                ))
                              ) : (
                                <span className="doc-coll-none">без меток</span>
                              )}
                            </div>
                            <details className="doc-coll-details">
                              <summary>Изменить метки</summary>
                              <div className="doc-coll-edit">
                                {collections.map((c) => (
                                  <label key={`${d.id}-${c.id}`}>
                                    <input
                                      type="checkbox"
                                      checked={d.collection_ids?.includes(c.id) ?? false}
                                      disabled={patchingDocId === d.id}
                                      onChange={(e) => void onToggleDocCollection(d, c.id, e.target.checked)}
                                    />
                                    {c.name}
                                  </label>
                                ))}
                              </div>
                            </details>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {docs.length > DOCS_PAGE_SIZE ? (
                  <div className="pagination">
                    <button
                      type="button"
                      className="btn-outline btn-compact"
                      disabled={docsPage <= 1}
                      onClick={() => setDocsPage((p) => Math.max(1, p - 1))}
                    >
                      Назад
                    </button>
                    <span className="pagination-info">
                      {(docsPage - 1) * DOCS_PAGE_SIZE + 1}–{Math.min(docsPage * DOCS_PAGE_SIZE, docs.length)} из{" "}
                      {docs.length}
                    </span>
                    <button
                      type="button"
                      className="btn-outline btn-compact"
                      disabled={docsPage >= docsTotalPages}
                      onClick={() => setDocsPage((p) => Math.min(docsTotalPages, p + 1))}
                    >
                      Вперёд
                    </button>
                  </div>
                ) : (
                  <p className="pagination-info" style={{ marginTop: 12 }}>
                    {docs.length} {docs.length === 1 ? "файл" : docs.length < 5 ? "файла" : "файлов"}
                  </p>
                )}
              </>
            )}
            <Link to="/" className="footer-back">
              На главную
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}

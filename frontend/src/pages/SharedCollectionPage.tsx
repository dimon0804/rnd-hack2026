import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchSharedCollection,
  fetchSharedDocumentFileBlob,
  importSharedDocument,
  type SharedCollectionView,
} from "../api/documents";
import { useAuth } from "../context/AuthContext";
import { documentStatusRu } from "../lib/documentStatus";
import { parseShareTokenFromInput } from "../lib/shareLink";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isDocReady(status: string): boolean {
  return status.trim().toLowerCase() === "ready";
}

export function SharedCollectionPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { authFetch, isAuthenticated, isHydrated } = useAuth();
  const [data, setData] = useState<SharedCollectionView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlId, setDlId] = useState<string | null>(null);
  const [importBusyId, setImportBusyId] = useState<string | null>(null);

  const shareReturnPath = useMemo(() => (token?.trim() ? `/share/${token.trim()}` : "/share"), [token]);

  const load = useCallback(async () => {
    const effective = token ? parseShareTokenFromInput(token) : null;
    if (!effective) {
      setErr("Неверная ссылка.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const json = await fetchSharedCollection(
        effective,
        isAuthenticated ? authFetch : undefined,
      );
      setData(json);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated, authFetch]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!token?.trim()) {
      setErr("Неверная ссылка.");
      return;
    }
    void load();
  }, [load, isHydrated, token]);

  const onDownload = async (documentId: string) => {
    const effective = token ? parseShareTokenFromInput(token) : null;
    if (!effective) return;
    setDlId(documentId);
    try {
      const { blob, filename } = await fetchSharedDocumentFileBlob(effective, documentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {
      setDlId(null);
    }
  };

  const onImportToWorkspace = async (documentId: string) => {
    const effective = token ? parseShareTokenFromInput(token) : null;
    if (!effective || !isAuthenticated) return;
    setImportBusyId(documentId);
    setErr(null);
    try {
      const doc = await importSharedDocument(effective, documentId, authFetch);
      navigate(`/workspace/${doc.id}`, { replace: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось добавить файл к себе");
    } finally {
      setImportBusyId(null);
    }
  };

  const isOwner = data?.viewer_role === "owner";
  const title = data?.title?.trim() || "Общая коллекция";
  const uploadCollectionsHref =
    data && data.collections.length > 0
      ? `/upload?collections=${data.collections.map((c) => c.id).join(",")}`
      : "/upload";

  return (
    <main className="main main--wide" id="main" tabIndex={-1}>
      <p className="kick-label kick-label--page">{isOwner ? "Ваша общая коллекция" : "Read-only"}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">
        {isOwner ? (
          <>
            Так эту подборку видят по вашей ссылке другие (только список и скачивание). Ниже — ваш полный доступ: чат,
            тесты и правки меток на странице загрузки.
          </>
        ) : (
          <>
            Просмотр и скачивание — всем. Чтобы открыть ту же рабочую область (чат, тесты, саммари), войдите и нажмите
            «К себе в рабочую область» у файла — копия появится в ваших документах.
          </>
        )}
      </p>

      {!isOwner && isHydrated && !isAuthenticated ? (
        <div className="shared-coll-guest-cta">
          <p className="shared-coll-guest-cta__text">
            <Link to="/login" state={{ from: shareReturnPath }} className="btn-solid btn-compact">
              Войти
            </Link>{" "}
            или{" "}
            <Link to="/register" state={{ from: shareReturnPath }} className="btn-outline btn-compact">
              Регистрация
            </Link>
            — затем можно перенести файл к себе и открыть рабочую область.
          </p>
        </div>
      ) : null}

      {isOwner ? (
        <div className="shared-owner-actions">
          <Link to={uploadCollectionsHref} className="btn-outline btn-compact">
            Метки и загрузка
          </Link>
        </div>
      ) : null}

      {!isHydrated || loading ? <p className="page-note">Загрузка…</p> : null}
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}

      {!loading && data ? (
        <>
          {data.collections.length > 0 ? (
            <section className="shared-coll-meta">
              <p className="collections-panel__hint" style={{ marginBottom: 8 }}>
                Метки в этой ссылке:
              </p>
              <div className="collections-chip-row" role="list">
                {data.collections.map((c) => (
                  <span key={c.id} className="collections-tag collections-tag--readonly" role="listitem">
                    <span className="collections-tag__label">{c.name}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <div className="panel-head" style={{ marginTop: 24 }}>
            <h2 className="panel-title">Документы ({data.documents.length})</h2>
          </div>
          {data.documents.length === 0 ? (
            <p className="page-note">В выбранных метках пока нет файлов.</p>
          ) : (
            <ul className="doc-list shared-doc-list">
              {data.documents.map((d) => (
                <li key={d.id} className="shared-doc-row">
                  <div className="shared-doc-row__main">
                    <span className="shared-doc-row__name">{d.original_filename}</span>
                    <span className="shared-doc-row__meta">
                      {formatBytes(d.size_bytes)} · {documentStatusRu(d.status)}
                    </span>
                  </div>
                  <div className="shared-doc-row__actions">
                    {isOwner && isDocReady(d.status) ? (
                      <Link to={`/workspace/${d.id}`} className="btn-solid btn-compact">
                        Рабочая область
                      </Link>
                    ) : null}
                    {!isOwner && isAuthenticated && isHydrated ? (
                      <button
                        type="button"
                        className="btn-solid btn-compact"
                        disabled={importBusyId === d.id}
                        title="Скопировать файл в ваши документы и открыть чат с RAG"
                        onClick={() => void onImportToWorkspace(d.id)}
                      >
                        {importBusyId === d.id ? "…" : "К себе в рабочую область"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn-outline btn-compact"
                      disabled={dlId === d.id}
                      onClick={() => void onDownload(d.id)}
                    >
                      {dlId === d.id ? "…" : "Скачать"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <p className="page-note" style={{ marginTop: 28 }}>
        <Link to="/">На главную</Link>
        {apiBase() === "" ? (
          <>
            {" "}
            · для скачивания в dev укажите <code>VITE_API_BASE</code> (тот же хост, что и API)
          </>
        ) : null}
      </p>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getDocument, type DocumentItem } from "../api/documents";
import { DocumentWorkspace } from "../components/workspace/DocumentWorkspace";
import { useAuth } from "../context/AuthContext";

export function WorkspacePage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { isAuthenticated, isHydrated, authFetch } = useAuth();
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!documentId) return;
    try {
      const d = await getDocument(documentId, authFetch);
      setDoc(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить документ.");
      setDoc(null);
    }
  }, [documentId, authFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!doc || !documentId) return;
    const s = doc.status.trim().toLowerCase();
    if (s === "ready" || s === "failed") return;
    const t = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(t);
  }, [doc, documentId, refresh]);

  if (!isHydrated) {
    return (
      <main className="main main--wide" id="main" tabIndex={-1}>
        <p className="panel-empty" style={{ padding: "3rem 1rem", textAlign: "center" }}>
          Загрузка…
        </p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: documentId ? `/workspace/${documentId}` : "/upload" }} />;
  }

  if (!documentId) {
    return <Navigate to="/upload" replace />;
  }

  if (error) {
    return (
      <main className="main main--wide workspace-missing" id="main" tabIndex={-1}>
        <div className="workspace-missing-wrap">
          <p className="kick-label">Рабочая область</p>
          <h1 className="page-title">Документ недоступен</h1>
          <p className="workspace-missing-text">{error}</p>
          <div className="not-found-actions">
            <Link to="/upload" className="btn-solid btn-cta">
              Мои документы
            </Link>
            <Link to="/" className="btn-outline btn-cta">
              На главную
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="main main--wide" id="main" tabIndex={-1}>
        <p className="panel-empty" style={{ padding: "3rem 1rem", textAlign: "center" }}>
          Загрузка документа…
        </p>
      </main>
    );
  }

  return <DocumentWorkspace document={doc} />;
}

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
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
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
      <main className="main main--wide" id="main" tabIndex={-1}>
        <div className="callout callout--danger" style={{ maxWidth: 560 }}>
          <strong>Ошибка</strong>
          <p style={{ margin: "0.5rem 0 0" }}>{error}</p>
          <Link to="/upload" className="btn-back-link" style={{ marginTop: 12, display: "inline-block" }}>
            ← К загрузке
          </Link>
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

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
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
        Загрузка…
      </div>
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
      <div style={{ maxWidth: 560, margin: "48px auto", padding: 24 }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <Link to="/upload" style={{ color: "var(--accent)" }}>
          ← К загрузке
        </Link>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
        Загрузка документа…
      </div>
    );
  }

  return <DocumentWorkspace document={doc} />;
}

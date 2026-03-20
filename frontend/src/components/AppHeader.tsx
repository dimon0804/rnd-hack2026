import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { CSSProperties } from "react";

export function AppHeader() {
  const { email, isAuthenticated, isHydrated, logout } = useAuth();

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <Link to="/" style={styles.brand}>
          <span style={styles.brandMark}>AI</span>
          <span>Platform</span>
        </Link>
        <nav style={styles.nav}>
          {isHydrated && isAuthenticated ? (
            <Link to="/upload" style={styles.navLink}>
              Загрузка
            </Link>
          ) : null}
          {!isHydrated ? (
            <span style={styles.muted}>…</span>
          ) : isAuthenticated ? (
            <div style={styles.user}>
              <span style={styles.email}>{email ?? "Аккаунт"}</span>
              <button type="button" style={styles.btnGhost} onClick={logout}>
                Выйти
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" style={styles.btnGhost}>
                Войти
              </Link>
              <Link to="/register" style={styles.btnAccent}>
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    borderBottom: "1px solid var(--border)",
    background: "rgba(15, 18, 25, 0.85)",
    backdropFilter: "blur(12px)",
  },
  inner: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 700,
    fontSize: "1.05rem",
    letterSpacing: "-0.02em",
    color: "var(--text)",
    textDecoration: "none",
  },
  brandMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--accent-dim)",
    border: "1px solid rgba(110, 231, 183, 0.35)",
    color: "var(--accent)",
    fontSize: "0.85rem",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navLink: {
    color: "var(--muted)",
    textDecoration: "none",
    fontSize: "0.92rem",
    fontWeight: 500,
    padding: "6px 8px",
    borderRadius: 8,
  },
  user: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  email: {
    fontSize: "0.88rem",
    color: "var(--muted)",
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  muted: { color: "var(--muted)", fontSize: "0.9rem" },
  btnGhost: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.88rem",
    textDecoration: "none",
    display: "inline-block",
  },
  btnAccent: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "0.88rem",
    textDecoration: "none",
    display: "inline-block",
  },
};

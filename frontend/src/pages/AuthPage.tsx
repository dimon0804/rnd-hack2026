import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthForm } from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";
import type { CSSProperties } from "react";

type Props = { mode: "login" | "register" };

function safeNextPath(from: unknown): string {
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/upload";
}

export function AuthPage({ mode }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeNextPath((location.state as { from?: string } | null)?.from);
  const { isAuthenticated, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && isAuthenticated) navigate(next, { replace: true });
  }, [isHydrated, isAuthenticated, navigate, next]);

  const title = mode === "login" ? "Вход" : "Регистрация";
  const subtitle =
    mode === "login"
      ? "Войдите, чтобы видеть «Мои документы» и синхронизировать работу между устройствами."
      : "Создайте аккаунт — пароль не менее 8 символов.";

  return (
    <div style={styles.wrap}>
      <div style={styles.intro}>
        <h1 style={styles.h1}>{title}</h1>
        <p style={styles.sub}>{subtitle}</p>
      </div>
      <AuthForm
        key={mode}
        initialMode={mode}
        onSuccess={() => navigate(next, { replace: true })}
      />
      <p style={styles.footer}>
        <Link to="/" style={styles.link}>
          ← На главную
        </Link>
      </p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 440,
    margin: "0 auto",
    padding: "32px 20px 64px",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 24,
  },
  intro: { textAlign: "center" },
  h1: { margin: "0 0 8px", fontSize: "1.55rem", fontWeight: 700, letterSpacing: "-0.02em" },
  sub: { margin: 0, color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.55 },
  footer: { margin: 0, textAlign: "center" },
  link: { color: "var(--muted)", fontSize: "0.9rem", textDecoration: "underline" },
};

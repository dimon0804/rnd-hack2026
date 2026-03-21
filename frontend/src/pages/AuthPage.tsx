import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthForm } from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";

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
    <main className="main main--auth" id="main" tabIndex={-1}>
      <div className="auth-grid">
        <div className="auth-rail" aria-hidden>
          <span className="auth-rail-line">доступ</span>
          <span className="auth-rail-line auth-rail-line--accent">кабинет</span>
        </div>
        <div className="auth-stage">
          <span className="auth-watermark" aria-hidden>
            {mode === "login" ? "вход" : "новый"}
          </span>
          <div className="auth-card">
            <p className="auth-meta">{mode === "login" ? "аккаунт" : "регистрация"}</p>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-lede">{subtitle}</p>
            <AuthForm key={mode} initialMode={mode} onSuccess={() => navigate(next, { replace: true })} />
          </div>
          <Link to="/" className="btn-back-link">
            ← На главную
          </Link>
        </div>
      </div>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "register";

type Props = {
  initialMode: Mode;
  onSuccess?: () => void;
};

export function AuthForm({ initialMode, onSuccess }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(formEmail.trim(), password);
      } else {
        await register(formEmail.trim(), password);
      }
      setPassword("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="auth-tabs" role="tablist" aria-label="Режим">
        <Link
          to="/login"
          className={`auth-tab${mode === "login" ? " is-active" : ""}`}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Вход
        </Link>
        <Link
          to="/register"
          className={`auth-tab${mode === "register" ? " is-active" : ""}`}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Регистрация
        </Link>
      </div>
      <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">Пароль</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : 1}
          />
        </div>
        {mode === "register" ? <p className="field-hint">Минимум 8 символов</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-solid btn-wide" disabled={busy}>
          {busy ? "…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
    </>
  );
}

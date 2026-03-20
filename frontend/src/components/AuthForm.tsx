import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
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
    <div style={styles.card}>
      <div style={styles.tabs}>
        <Link
          to="/login"
          style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Вход
        </Link>
        <Link
          to="/register"
          style={{ ...styles.tab, ...(mode === "register" ? styles.tabActive : {}) }}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Регистрация
        </Link>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} style={styles.form}>
        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          autoComplete="email"
          value={formEmail}
          onChange={(e) => setFormEmail(e.target.value)}
          required
        />
        <label style={styles.label}>Пароль</label>
        <input
          style={styles.input}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 8 : 1}
        />
        {mode === "register" ? (
          <p style={styles.hint}>Минимум 8 символов</p>
        ) : null}
        {error ? (
          <p style={styles.err} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" style={styles.btnPrimary} disabled={busy}>
          {busy ? "…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "var(--shadow)",
  },
  tabs: { display: "flex", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
    textAlign: "center",
    textDecoration: "none",
  },
  tabActive: {
    borderColor: "var(--accent)",
    color: "var(--text)",
    background: "var(--accent-dim)",
  },
  form: { display: "flex", flexDirection: "column", gap: 0 },
  label: { display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text)",
    marginBottom: 12,
    outline: "none",
    boxSizing: "border-box",
  },
  hint: { margin: "-8px 0 4px", fontSize: "0.8rem", color: "var(--muted)" },
  err: { color: "var(--danger)", margin: "4px 0 8px", fontSize: "0.88rem" },
  btnPrimary: {
    marginTop: 8,
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    cursor: "pointer",
  },
};

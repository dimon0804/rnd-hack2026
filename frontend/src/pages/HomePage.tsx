import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { CSSProperties } from "react";

export function HomePage() {
  const { isAuthenticated, isHydrated } = useAuth();

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.kicker}>Работа с текстами и подготовка</p>
        <h1 style={styles.h1}>
          Задавайте вопросы по&nbsp;своим материалам — не&nbsp;по&nbsp;интернету
        </h1>
        <p style={styles.lead}>
          Загрузите конспекты, статьи или рабочие документы и получайте ответы, которые опираются именно на&nbsp;ваши файлы.
          Удобно для учёбы, проектов и&nbsp;разбора больших объёмов текста.
        </p>
        <div style={styles.ctaRow}>
          {isHydrated && isAuthenticated ? (
            <Link to="/upload" style={styles.btnPrimary}>
              Загрузить документы
            </Link>
          ) : (
            <>
              <Link to="/login" style={styles.btnPrimary}>
                Войти
              </Link>
              <Link to="/register" style={styles.btnSecondary}>
                Создать аккаунт
              </Link>
            </>
          )}
        </div>
        {!isHydrated || !isAuthenticated ? (
          <p style={styles.note}>
            После регистрации вы сможете загружать файлы и вести свои материалы в одном месте.
          </p>
        ) : null}
      </section>

      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.h2}>Ваши источники</h2>
          <p style={styles.p}>
            Храните PDF, Word и текстовые файлы в одном кабинете и следите, как обрабатывается каждый документ.
          </p>
        </article>
        <article style={styles.card}>
          <h2 style={styles.h2}>Ответы по смыслу</h2>
          <p style={styles.p}>
            Система опирается на содержание ваших загруженных материалов — не на случайные страницы из сети.
          </p>
        </article>
        <article style={styles.card}>
          <h2 style={styles.h2}>Скоро</h2>
          <p style={styles.p}>
            Краткие конспекты, карточки для повторения и проверка знаний по вашим текстам — по мере появления функций.
          </p>
        </article>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "40px 20px 72px",
  },
  hero: {
    textAlign: "center",
    maxWidth: 720,
    margin: "0 auto 48px",
    animation: "fadeUp 0.5s ease both",
  },
  kicker: {
    margin: "0 0 12px",
    fontSize: "0.8rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--accent)",
  },
  h1: {
    margin: "0 0 16px",
    fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
  },
  lead: {
    margin: 0,
    color: "var(--muted)",
    fontSize: "1.05rem",
    lineHeight: 1.65,
  },
  ctaRow: {
    marginTop: 28,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPrimary: {
    padding: "12px 22px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "0.95rem",
    textDecoration: "none",
    display: "inline-block",
  },
  btnSecondary: {
    padding: "12px 22px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: "0.95rem",
    textDecoration: "none",
    display: "inline-block",
  },
  note: {
    marginTop: 20,
    fontSize: "0.85rem",
    color: "var(--muted)",
    maxWidth: 520,
    marginLeft: "auto",
    marginRight: "auto",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  card: {
    padding: 22,
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "var(--shadow)",
    animation: "fadeUp 0.55s ease both",
  },
  h2: { margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 700 },
  p: { margin: 0, color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.55 },
};

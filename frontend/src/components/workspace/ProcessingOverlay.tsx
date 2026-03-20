import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const STEPS = [
  "Анализируем документ…",
  "Извлекаем текст и делим на фрагменты…",
  "Строим представления и индекс…",
  "Создаём структуру знаний…",
];

type Props = { active: boolean };

export function ProcessingOverlay({ active }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    const t = window.setInterval(() => {
      setPhase((p) => (p + 1) % STEPS.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [active]);

  if (!active) return null;

  return (
    <div style={styles.overlay} role="status" aria-live="polite">
      <div style={styles.card}>
        <div style={styles.spinner} aria-hidden />
        <p style={styles.title}>Обрабатываем документ</p>
        <p style={styles.step}>{STEPS[phase]}</p>
        <p style={styles.hint}>Пожалуйста, не закрывайте страницу</p>
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <span key={i} style={{ ...styles.dot, ...(i === phase ? styles.dotOn : {}) }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(10, 12, 18, 0.82)",
    backdropFilter: "blur(8px)",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },
  card: {
    maxWidth: 400,
    padding: "32px 28px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "var(--shadow)",
    textAlign: "center",
  },
  spinner: {
    width: 48,
    height: 48,
    margin: "0 auto 16px",
    borderRadius: "50%",
    border: "3px solid rgba(110, 231, 183, 0.2)",
    borderTopColor: "var(--accent)",
    animation: "ws-spin 0.9s linear infinite",
  },
  title: { margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 700 },
  step: { margin: "0 0 12px", color: "var(--accent)", fontSize: "0.95rem", minHeight: "1.5em" },
  hint: { margin: 0, fontSize: "0.82rem", color: "var(--muted)" },
  dots: { display: "flex", justifyContent: "center", gap: 8, marginTop: 20 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    transition: "background 0.3s, transform 0.3s",
  },
  dotOn: { background: "var(--accent)", transform: "scale(1.2)" },
};

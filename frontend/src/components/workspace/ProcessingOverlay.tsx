import { useEffect, useState } from "react";

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
    <div className="processing-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="processing-card">
        <span className="spinner" aria-hidden />
        <div>
          <strong>Обрабатываем документ</strong>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", color: "var(--accent)" }}>{STEPS[phase]}</p>
          <p className="muted small" style={{ margin: "0.5rem 0 0" }}>
            Пожалуйста, не закрывайте страницу
          </p>
        </div>
      </div>
    </div>
  );
}

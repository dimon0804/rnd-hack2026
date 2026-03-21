import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "cookie_consent_v1";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = useCallback((value: "accepted" | "essential") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="cookie-consent-root" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
      <div className="cookie-consent-backdrop" aria-hidden />
      <div className="cookie-consent-panel">
        <div className="cookie-consent-glow" aria-hidden />
        <p id="cookie-consent-title" className="cookie-consent-title">
          Печеньки? 🍪
        </p>
        <p className="cookie-consent-text">
          Мы используем локальное хранилище браузера (тема, сессия, согласие), чтобы сайт работал удобнее. Без
          рекламных трекеров и продажи данных — только то, что нужно приложению.
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="btn-solid" onClick={() => dismiss("accepted")}>
            Ок, понятно
          </button>
          <button type="button" className="btn-outline" onClick={() => dismiss("essential")}>
            Только необходимое
          </button>
        </div>
        <p className="cookie-consent-foot">
          Подробнее в{" "}
          <Link to="/" onClick={() => dismiss("accepted")}>
            политике
          </Link>{" "}
          (скоро) — а пока просто жмите кнопку и продолжайте работу.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { truncateEmail } from "../lib/truncateEmail";
import { MoonIcon, SunIcon } from "./ThemeIcons";

export function AppHeader() {
  const { email, isAuthenticated, isHydrated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="AI platform — на главную">
          <span className="brand-glyph" aria-hidden>
            <span className="brand-orbit" />
            <span className="brand-dot" />
          </span>
          <span className="brand-lockup">
            <span className="brand-ai">AI</span>
            <span className="brand-platform">platform</span>
          </span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label={navOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={navOpen}
          aria-controls="primary-nav"
          onClick={() => setNavOpen((o) => !o)}
        >
          <span className="nav-toggle__bar" aria-hidden />
          <span className="nav-toggle__bar" aria-hidden />
          <span className="nav-toggle__bar" aria-hidden />
        </button>
        <nav
          id="primary-nav"
          className={`nav${navOpen ? " nav--open" : ""}`}
          aria-label="Основная навигация"
        >
          {!isHydrated ? (
            <span className="header-placeholder" aria-hidden>
              …
            </span>
          ) : isAuthenticated ? (
            <>
              <Link to="/cabinet" className="btn-text">
                Кабинет
              </Link>
              <Link to="/upload" className="btn-text">
                Загрузка
              </Link>
              <span className="header-email" title={email ?? undefined}>
                {truncateEmail(email ?? "")}
              </span>
              <button type="button" className="btn-outline btn-compact" onClick={() => void logout()}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-text">
                Войти
              </Link>
              <Link to="/register" className="btn-outline btn-compact">
                Регистрация
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn-ghost-round"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
        </nav>
      </div>
    </header>
  );
}

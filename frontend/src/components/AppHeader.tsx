import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { truncateEmail } from "../lib/truncateEmail";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { DEFAULT_FONT_SCALE_INDEX, FONT_SCALE_STEPS } from "../lib/fontScale";
import { MoonIcon, SpeakerOffIcon, SpeakerOnIcon, SunIcon } from "./ThemeIcons";

export function AppHeader() {
  const { email, isAuthenticated, isHydrated, logout } = useAuth();
  const {
    theme,
    toggleTheme,
    readingMode,
    toggleReadingMode,
    speechMuted,
    toggleSpeechMuted,
    fontScaleIndex,
    fontScale,
    increaseFont,
    decreaseFont,
    resetFontScale,
  } = useTheme();
  const fontScaleMax = FONT_SCALE_STEPS.length - 1;
  const location = useLocation();
  const online = useOnlineStatus();
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
          {!online ? (
            <Link to="/offline-snake" className="btn-text header-snake-link">
              Змейка
            </Link>
          ) : null}
          {readingMode ? (
            <div
              className="font-scale-group"
              role="group"
              aria-label="Размер текста на сайте"
            >
              <button
                type="button"
                className="btn-font-scale"
                onClick={decreaseFont}
                disabled={fontScaleIndex <= 0}
                aria-label="Уменьшить шрифт"
                title="Меньше"
              >
                <span className="btn-font-scale__glyph" aria-hidden>
                  A−
                </span>
              </button>
              <span className="font-scale-value" title="Текущий масштаб" aria-live="polite">
                {Math.round(fontScale * 100)}%
              </span>
              <button
                type="button"
                className="btn-font-scale"
                onClick={increaseFont}
                disabled={fontScaleIndex >= fontScaleMax}
                aria-label="Увеличить шрифт"
                title="Больше"
              >
                <span className="btn-font-scale__glyph" aria-hidden>
                  A+
                </span>
              </button>
              <button
                type="button"
                className="btn-font-scale btn-font-scale--reset"
                onClick={resetFontScale}
                disabled={fontScaleIndex === DEFAULT_FONT_SCALE_INDEX}
                aria-label="Стандартный размер шрифта"
                title="Стандарт"
              >
                <span aria-hidden>↺</span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={`btn-ghost-round btn-ghost-round--reading${readingMode ? " is-active" : ""}`}
            onClick={toggleReadingMode}
            aria-pressed={readingMode}
            aria-label={
              readingMode
                ? "Выключить версию для слабовидящих"
                : "Включить версию для слабовидящих: крупный текст, высокий контраст, озвучивание кнопок"
            }
            title="Версия для слабовидящих"
          >
            <span className="btn-reading-icon" aria-hidden>
              Аа
            </span>
          </button>
          {readingMode ? (
            <button
              type="button"
              className={`btn-ghost-round btn-ghost-round--speech${speechMuted ? "" : " is-active"}`}
              onClick={toggleSpeechMuted}
              aria-pressed={!speechMuted}
              aria-label={
                speechMuted
                  ? "Включить озвучивание: что под курсором и куда нажали"
                  : "Отключить озвучивание нажатий"
              }
              title={speechMuted ? "Включить озвучивание" : "Озвучивание включено"}
            >
              {speechMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
            </button>
          ) : null}
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

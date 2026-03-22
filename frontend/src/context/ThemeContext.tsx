import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  clampFontScaleIndex,
  DEFAULT_FONT_SCALE_INDEX,
  FONT_SCALE_STEPS,
} from "../lib/fontScale";

export type ThemeName = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeName;
  toggleTheme: () => void;
  /** Режим для слабовидящих: крупный шрифт и повышенный контраст (сохраняет светлую/тёмную базу). */
  readingMode: boolean;
  toggleReadingMode: () => void;
  /** Выкл. синтез речи при фокусе/нажатии (только при включённой теме для чтения). */
  speechMuted: boolean;
  toggleSpeechMuted: () => void;
  /** Индекс шага размера шрифта (0 … FONT_SCALE_STEPS.length − 1). */
  fontScaleIndex: number;
  fontScale: number;
  increaseFont: () => void;
  decreaseFont: () => void;
  resetFontScale: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";
const STORAGE_READING = "readingMode";
const STORAGE_SPEECH_MUTED = "a11ySpeechMuted";
const STORAGE_FONT_SCALE_INDEX = "fontScaleIndex";

function readInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readInitialReadingMode(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_READING);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

function readInitialSpeechMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_SPEECH_MUTED) === "1";
  } catch {
    return false;
  }
}

function readInitialFontScaleIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_FONT_SCALE_INDEX);
    if (raw == null) return DEFAULT_FONT_SCALE_INDEX;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return DEFAULT_FONT_SCALE_INDEX;
    return clampFontScaleIndex(n);
  } catch {
    return DEFAULT_FONT_SCALE_INDEX;
  }
}

function applyFontScaleToDocument(index: number) {
  const i = clampFontScaleIndex(index);
  const scale = FONT_SCALE_STEPS[i];
  document.documentElement.style.setProperty("--font-user-scale", String(scale));
  document.documentElement.setAttribute("data-font-scale-step", String(i));
}

/** Синхронно применяет тему к <html> — CSS и нативные контролы (select) реагируют сразу. */
function applyThemeToDocument(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

function applyReadingToDocument(reading: boolean) {
  if (reading) {
    document.documentElement.setAttribute("data-reading", "true");
  } else {
    document.documentElement.removeAttribute("data-reading");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const t = readInitialTheme();
    if (typeof document !== "undefined") {
      applyThemeToDocument(t);
    }
    return t;
  });

  const [readingMode, setReadingMode] = useState<boolean>(() => {
    const r = readInitialReadingMode();
    if (typeof document !== "undefined") {
      applyReadingToDocument(r);
    }
    return r;
  });

  const [speechMuted, setSpeechMuted] = useState<boolean>(() => readInitialSpeechMuted());

  const [fontScaleIndex, setFontScaleIndex] = useState<number>(() => readInitialFontScaleIndex());

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    applyReadingToDocument(readingMode);
    try {
      localStorage.setItem(STORAGE_READING, readingMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [readingMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SPEECH_MUTED, speechMuted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [speechMuted]);

  /** Вне режима для слабовидящих всегда стандартный масштаб; регулировка действует только при data-reading. */
  useLayoutEffect(() => {
    const effective = readingMode ? clampFontScaleIndex(fontScaleIndex) : DEFAULT_FONT_SCALE_INDEX;
    applyFontScaleToDocument(effective);
  }, [readingMode, fontScaleIndex]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FONT_SCALE_INDEX, String(fontScaleIndex));
    } catch {
      /* ignore */
    }
  }, [fontScaleIndex]);

  /** В обычном режиме — значения по умолчанию: масштаб шрифта и озвучивание (как при первом входе в режим для слабовидящих). */
  useEffect(() => {
    if (!readingMode) {
      setFontScaleIndex(DEFAULT_FONT_SCALE_INDEX);
      setSpeechMuted(false);
    }
  }, [readingMode]);

  const toggleTheme = useCallback(() => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };

    const apply = () => {
      flushSync(() => {
        setTheme((prev) => {
          const next: ThemeName = prev === "light" ? "dark" : "light";
          applyThemeToDocument(next);
          try {
            localStorage.setItem(STORAGE_KEY, next);
          } catch {
            /* ignore */
          }
          return next;
        });
      });
    };

    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* ignore */
    }

    if (reduced || typeof doc.startViewTransition !== "function") {
      apply();
      return;
    }

    try {
      doc.startViewTransition(apply);
    } catch {
      apply();
    }
  }, []);

  const toggleReadingMode = useCallback(() => {
    setReadingMode((prev) => !prev);
  }, []);

  const toggleSpeechMuted = useCallback(() => {
    setSpeechMuted((prev) => !prev);
  }, []);

  const increaseFont = useCallback(() => {
    setFontScaleIndex((i) => clampFontScaleIndex(i + 1));
  }, []);

  const decreaseFont = useCallback(() => {
    setFontScaleIndex((i) => clampFontScaleIndex(i - 1));
  }, []);

  const resetFontScale = useCallback(() => {
    setFontScaleIndex(DEFAULT_FONT_SCALE_INDEX);
  }, []);

  const fontScale = readingMode
    ? FONT_SCALE_STEPS[clampFontScaleIndex(fontScaleIndex)]
    : FONT_SCALE_STEPS[DEFAULT_FONT_SCALE_INDEX];

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

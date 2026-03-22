import { useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { cancelA11ySpeech, closestInteractive, speakElementIfNew } from "../lib/a11ySpeak";

/**
 * При включённой теме для чтения озвучивает доступное имя элемента при фокусе и при нажатии
 * (синтез речи браузера, язык ru-RU). Отключается переключателем «озвучивание».
 */
export function ReadingSpeechAnnouncer() {
  const { readingMode, speechMuted } = useTheme();

  useEffect(() => {
    if (!readingMode || speechMuted) {
      cancelA11ySpeech();
      return;
    }
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const onFocusIn = (e: FocusEvent) => {
      const el = closestInteractive(e.target);
      if (el) speakElementIfNew(el);
    };

    const onClick = (e: MouseEvent) => {
      const el = closestInteractive(e.target);
      if (!el) return;
      if (el instanceof HTMLElement) speakElementIfNew(el);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("click", onClick, true);
      cancelA11ySpeech();
    };
  }, [readingMode, speechMuted]);

  return null;
}

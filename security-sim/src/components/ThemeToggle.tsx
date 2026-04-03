"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { setThemeClass } from "./ThemeProvider";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        setThemeClass(next);
        setDark(next);
      }}
      className="rounded-full border border-ink/10 bg-surface-elevated px-3 py-1.5 text-xs font-medium text-ink-muted shadow-sm transition hover:border-accent/40 hover:text-ink dark:border-white/10"
      aria-label={dark ? t("light") : t("dark")}
    >
      {dark ? t("light") : t("dark")}
    </button>
  );
}

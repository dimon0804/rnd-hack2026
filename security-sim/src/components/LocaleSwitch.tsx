"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
const locales = ["ru", "en"] as const;

export function LocaleSwitch({ current }: { current: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex rounded-full border border-ink/10 bg-surface-elevated p-0.5 dark:border-white/10">
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
            current === loc
              ? "bg-accent text-white shadow-glow"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}

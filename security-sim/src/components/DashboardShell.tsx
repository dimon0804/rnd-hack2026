"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { GameProvider } from "@/context/GameContext";
import { Link } from "@/i18n/navigation";
import { LocaleSwitch } from "./LocaleSwitch";
import { SecurityHud } from "./SecurityHud";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/", key: "hub" as const },
  { href: "/mail", key: "mail" as const },
  { href: "/chat", key: "chat" as const },
  { href: "/profile", key: "profile" as const },
];

export function DashboardShell({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const t = useTranslations("nav");

  return (
    <GameProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-ink/10 bg-surface-elevated/80 px-3 py-6 backdrop-blur-md dark:border-white/10 md:flex">
          <div className="mb-8 px-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Cyber Drill
            </div>
            <div className="mt-1 text-sm font-semibold text-ink">SOC Gym</div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-accent/10 hover:text-ink"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-2 border-t border-ink/10 pt-4 dark:border-white/10">
            <LocaleSwitch current={locale} />
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 space-y-2 border-b border-ink/10 bg-surface/90 px-3 py-3 backdrop-blur-md dark:border-white/10 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink">Cyber Drill</span>
              <div className="flex items-center gap-2">
                <LocaleSwitch current={locale} />
                <ThemeToggle />
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto pb-1 text-xs font-semibold">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shrink-0 rounded-lg bg-surface-elevated px-2.5 py-1.5 text-ink-muted ring-1 ring-ink/10 dark:ring-white/10"
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          </header>
          <div className="border-b border-ink/10 bg-surface-elevated/50 px-4 py-3 dark:border-white/10 md:px-8">
            <SecurityHud />
          </div>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </GameProvider>
  );
}

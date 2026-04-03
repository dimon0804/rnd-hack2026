"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Link } from "@/i18n/navigation";
import { fetchScenarios, type ScenarioListItem } from "@/lib/api";

export function HubClient() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { completedScenarioIds } = useGame();
  const [items, setItems] = useState<ScenarioListItem[]>([]);

  useEffect(() => {
    void fetchScenarios(locale).then((r) => setItems(r.scenarios));
  }, [locale]);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-3">
        <motion.h1
          className="text-balance text-3xl font-bold tracking-tight text-ink md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {t("headline")}
        </motion.h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted md:text-base">
          {t("sub")}
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
          {t("scenarios")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((s, i) => {
            const href = s.type === "email" ? "/mail" : "/chat";
            const badge =
              s.type === "email" ? t("badgeEmail") : t("badgeChat");
            const done = completedScenarioIds.includes(s.id);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  href={href}
                  className="group flex h-full flex-col rounded-2xl border border-ink/10 bg-surface-elevated p-5 shadow-sm transition hover:border-accent/40 hover:shadow-glow dark:border-white/10"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      {badge}
                    </span>
                    {done && (
                      <span className="text-[10px] font-semibold text-success">
                        ✓
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink group-hover:text-accent">
                    {s.title}
                  </h3>
                  <p className="mt-2 flex-1 text-xs text-ink-muted">{s.id}</p>
                  <div className="mt-4 text-sm font-semibold text-accent">
                    {t("open")} →
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

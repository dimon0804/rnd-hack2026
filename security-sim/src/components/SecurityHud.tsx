"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useGame } from "@/context/GameContext";

export function SecurityHud() {
  const t = useTranslations("dashboard");
  const { securityScore, xp, level } = useGame();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
          <span>{t("securityBar")}</span>
          <span className="tabular-nums text-ink">{securityScore}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent via-accent-dim to-success"
            initial={false}
            animate={{ width: `${securityScore}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">
            {t("xp")}
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-ink">
            {xp}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">
            LVL
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-accent">
            {level}
          </div>
        </div>
      </div>
    </div>
  );
}

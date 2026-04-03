"use client";

import { useTranslations } from "next-intl";
import { useGame } from "@/context/GameContext";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const {
    accuracyPercent,
    criticalMistakes,
    completedScenarioIds,
    totalChoices,
    reset,
    securityScore,
    level,
    xp,
  } = useGame();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>

      <div className="grid gap-4">
        <StatCard
          label={t("accuracy")}
          value={accuracyPercent === null ? "—" : `${accuracyPercent}%`}
        />
        <StatCard label={t("mistakes")} value={String(criticalMistakes)} />
        <StatCard
          label={t("completed")}
          value={String(completedScenarioIds.length)}
        />
        <StatCard
          label={t("totalChoices")}
          value={String(totalChoices)}
        />
        <StatCard
          label={t("securityNow")}
          value={`${securityScore}%`}
        />
        <StatCard label={t("levelLabel")} value={String(level)} />
        <StatCard label={t("xpLabel")} value={String(xp)} />
      </div>

      <button
        type="button"
        onClick={reset}
        className="w-full rounded-xl border border-danger/40 bg-danger/10 py-3 text-sm font-semibold text-danger transition hover:bg-danger/20"
      >
        {t("reset")}
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-surface-elevated px-4 py-4 dark:border-white/10">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

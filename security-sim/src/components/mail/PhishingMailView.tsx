"use client";

import type { EmailScenario } from "@/lib/api";
import { useTranslations } from "next-intl";

export function PhishingMailView({ scenario }: { scenario: EmailScenario }) {
  const t = useTranslations("mail");

  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-ink/10 bg-surface-elevated shadow-card dark:border-white/10">
      <div className="flex items-center gap-2 border-b border-ink/10 bg-surface/80 px-4 py-3 dark:border-white/10">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-danger/80" />
          <span className="h-3 w-3 rounded-full bg-warning/80" />
          <span className="h-3 w-3 rounded-full bg-success/80" />
        </div>
        <div className="mx-auto flex max-w-md flex-1 items-center rounded-lg bg-surface px-3 py-1.5 text-xs text-ink-muted dark:bg-black/20">
          <span className="truncate">{t("searchPlaceholder")}</span>
        </div>
      </div>

      <div className="flex min-h-[420px]">
        <div className="hidden w-44 shrink-0 border-r border-ink/10 bg-surface/50 p-3 text-xs dark:border-white/10 sm:block">
          <div className="mb-2 font-semibold text-ink">{t("inbox")}</div>
          <div className="space-y-1 text-ink-muted">
            <div className="rounded-lg bg-accent/15 px-2 py-1.5 font-medium text-accent">
              {t("primary")}
            </div>
            <div className="px-2 py-1">{t("promotions")}</div>
            <div className="px-2 py-1">{t("spam")}</div>
            <div className="px-2 py-1">{t("drafts")}</div>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-4 dark:border-white/10">
            <div>
              <h1 className="text-lg font-semibold text-ink">{scenario.subject}</h1>
              <p className="mt-1 text-xs text-ink-muted">{scenario.preview}</p>
            </div>
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted dark:bg-white/10">
              {scenario.id}
            </span>
          </div>

          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dim text-sm font-bold text-white shadow-glow">
              {scenario.sender_display.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-ink">
                  {scenario.sender_display}
                </span>
                <span className="truncate font-mono text-xs text-ink-muted">
                  &lt;{scenario.sender_email}&gt;
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink/90">
                {scenario.body_paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-4 dark:bg-accent/10">
                <a
                  href="#"
                  className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                  onClick={(e) => e.preventDefault()}
                >
                  {scenario.cta_label}
                </a>
                <p className="mt-2 break-all font-mono text-[11px] text-ink-muted">
                  {scenario.cta_href_display}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Link } from "@/i18n/navigation";
import {
  fetchScenario,
  submitChoice,
  type ChatScenario,
  type EmailScenario,
} from "@/lib/api";
import { TelegramFake } from "@/components/chat/TelegramFake";
import { PhishingMailView } from "@/components/mail/PhishingMailView";
import { ChoiceGrid } from "./ChoiceGrid";
import { ConsequenceWizard } from "./ConsequenceWizard";
import { TeachSheet } from "./TeachSheet";

export function ScenarioRunner({ scenarioId }: { scenarioId: string }) {
  const locale = useLocale();
  const t = useTranslations("scenario");
  const { applyResult } = useGame();

  const [data, setData] = useState<EmailScenario | ChatScenario | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [shake, setShake] = useState(false);
  const [teachOpen, setTeachOpen] = useState(false);
  const [consequenceOpen, setConsequenceOpen] = useState(false);
  const [teach, setTeach] = useState<{
    title: string;
    body: string;
    severity: "none" | "low" | "medium" | "critical";
    showConsequences: boolean;
    steps: { title: string; detail: string }[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchScenario(scenarioId, locale);
      setData(res.scenario);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [scenarioId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedId(null);
    setLocked(false);
    setTeachOpen(false);
    setConsequenceOpen(false);
    setTeach(null);
  }, [scenarioId]);

  const onPick = async (choiceId: string) => {
    if (locked) return;
    setSelectedId(choiceId);
    setLocked(true);
    const res = await submitChoice(scenarioId, choiceId, locale);
    if (!res.ok || !res.result) {
      setLocked(false);
      setSelectedId(null);
      return;
    }
    const r = res.result;
    applyResult({
      scenarioId,
      isSafe: r.is_safe,
      severity: r.severity,
      securityDelta: r.security_delta,
      xpDelta: r.xp_delta,
    });
    setTeach({
      title: r.teach_title,
      body: r.teach_body,
      severity: r.severity,
      showConsequences: r.show_consequences,
      steps: r.consequence_steps ?? [],
    });
    if (!r.is_safe && r.severity === "critical") {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    }
    setTeachOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">
        {t("loading")}
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-ink">
        <p>{t("error")}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-ink"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
        transition={{ duration: 0.45 }}
      >
        {data.type === "email" ? (
          <PhishingMailView scenario={data} />
        ) : (
          <TelegramFake scenario={data} />
        )}
      </motion.div>

      <section className="rounded-2xl border border-ink/10 bg-surface-elevated/80 p-4 shadow-sm dark:border-white/10 md:p-6">
        <h2 className="text-sm font-semibold text-ink">{t("yourMove")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("choose")}</p>
        <div className="mt-4">
          <ChoiceGrid
            choices={data.choices}
            disabled={locked}
            selectedId={selectedId}
            onPick={onPick}
          />
        </div>
        {locked && (
          <div className="mt-4 flex justify-end">
            <Link
              href="/"
              className="text-xs font-semibold text-accent hover:underline"
            >
              {t("nextScenario")}
            </Link>
          </div>
        )}
      </section>

      <TeachSheet
        open={teachOpen && !!teach}
        title={teach?.title ?? ""}
        body={teach?.body ?? ""}
        severity={teach?.severity ?? "none"}
        consequenceCta={teach?.showConsequences}
        onConsequence={() => {
          setTeachOpen(false);
          setConsequenceOpen(true);
        }}
        onClose={() => setTeachOpen(false)}
      />

      <ConsequenceWizard
        open={consequenceOpen}
        steps={teach?.steps ?? []}
        onClose={() => setConsequenceOpen(false)}
      />
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

export function TeachSheet({
  open,
  title,
  body,
  severity,
  onClose,
  consequenceCta,
  onConsequence,
}: {
  open: boolean;
  title: string;
  body: string;
  severity: "none" | "low" | "medium" | "critical";
  onClose: () => void;
  consequenceCta?: boolean;
  onConsequence?: () => void;
}) {
  const t = useTranslations("scenario");

  const tone =
    severity === "critical"
      ? "border-danger/40 bg-danger/10"
      : severity === "low" || severity === "medium"
        ? "border-warning/40 bg-warning/10"
        : "border-success/40 bg-success/10";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            role="presentation"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl border border-ink/10 bg-surface-elevated p-6 shadow-card dark:border-white/10"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className={`mb-4 rounded-2xl border p-4 ${tone}`}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                {t("teachTitle")}
              </div>
              <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/90">{body}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {consequenceCta && onConsequence && (
                <button
                  type="button"
                  onClick={onConsequence}
                  className="rounded-xl border border-danger/50 bg-danger/15 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/25"
                >
                  {t("consequenceTitle")}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
              >
                {t("gotIt")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ConsequenceWizard({
  open,
  steps,
  onClose,
}: {
  open: boolean;
  steps: { title: string; detail: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("scenario");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];
  const isLast = index >= steps.length - 1;

  return (
    <AnimatePresence
      onExitComplete={() => {
        setIndex(0);
      }}
    >
      {open && steps.length > 0 && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-danger/30 bg-[#1a0a0c] p-6 text-slate-100 shadow-[0_0_80px_rgba(239,68,68,0.35)]"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-300/90">
                ⚠ {t("consequenceTitle")}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-200"
              >
                {t("close")}
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-200/80">
                  {t("step", { n: index + 1 })}
                </div>
                <h3 className="mt-2 text-xl font-bold text-white">{step?.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-red-100/85">
                  {step?.detail}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex gap-2">
              <div className="flex flex-1 gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i <= index ? "bg-red-400" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  {t("continue")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-900"
                >
                  {t("gotIt")}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

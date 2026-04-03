"use client";

import { motion } from "framer-motion";
import type { ScenarioChoice } from "@/lib/api";

export function ChoiceGrid({
  choices,
  disabled,
  selectedId,
  onPick,
}: {
  choices: ScenarioChoice[];
  disabled: boolean;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {choices.map((c, index) => {
        const active = selectedId === c.id;
        return (
          <motion.button
            key={c.id}
            type="button"
            disabled={disabled}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => onPick(c.id)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              active
                ? "border-accent bg-accent/15 text-ink shadow-glow"
                : "border-ink/10 bg-surface-elevated text-ink hover:border-accent/50 dark:border-white/10"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {c.label}
          </motion.button>
        );
      })}
    </div>
  );
}

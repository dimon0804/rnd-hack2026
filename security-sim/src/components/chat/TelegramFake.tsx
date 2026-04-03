"use client";

import type { ChatScenario } from "@/lib/api";
import { useTranslations } from "next-intl";

export function TelegramFake({ scenario }: { scenario: ChatScenario }) {
  const t = useTranslations("chat");

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-ink/10 bg-[#0e1621] text-slate-100 shadow-card">
      <div className="flex items-center gap-3 bg-[#17212b] px-3 py-2.5">
        <button
          type="button"
          className="text-slate-400"
          aria-hidden
        >
          ←
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold">
          {scenario.peer_name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{scenario.peer_name}</div>
          <div className="truncate text-[11px] text-emerald-400/90">
            @{scenario.peer_handle} · {t("online")}
          </div>
        </div>
      </div>

      <div
        className="space-y-3 px-3 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.08), transparent 40%), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.12), transparent 35%)",
        }}
      >
        {scenario.messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-md ${
                m.from === "me"
                  ? "rounded-br-sm bg-sky-500 text-white"
                  : "rounded-bl-sm bg-[#2b5278]"
              }`}
            >
              <p>{m.text}</p>
              <div
                className={`mt-1 text-[10px] opacity-70 ${
                  m.from === "me" ? "text-right" : "text-left"
                }`}
              >
                {m.time}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/5 bg-[#17212b] px-2 py-2">
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400"
          aria-label={t("attach")}
        >
          📎
        </button>
        <div className="flex-1 rounded-full bg-[#0e1621] px-3 py-2 text-xs text-slate-500">
          {t("typeMessage")}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400"
          aria-label={t("voice")}
        >
          🎤
        </button>
      </div>
    </div>
  );
}

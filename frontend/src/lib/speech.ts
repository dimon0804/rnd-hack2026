/** Озвучивание в браузере (Web Speech API). Подкаст — два голоса (Алексей / Мария), если доступны. */

export type SpeakRate = "slow" | "normal" | "fast";

const rateMap: Record<SpeakRate, number> = {
  slow: 0.84,
  normal: 1,
  fast: 1.14,
};

/** Chrome подгружает голоса асинхронно — вызвать перед первой озвучкой. */
export function prefetchVoices(): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    if (window.speechSynthesis.getVoices().length > 0) {
      done();
      return;
    }
    window.speechSynthesis.onvoiceschanged = done;
    setTimeout(done, 900);
  });
}

function pickRuVoices(): { alexey: SpeechSynthesisVoice | null; maria: SpeechSynthesisVoice | null } {
  const voices = window.speechSynthesis.getVoices();
  const ru = voices.filter((v) => v.lang.toLowerCase().startsWith("ru"));
  if (ru.length === 0) return { alexey: null, maria: null };

  const femaleScore = (n: string) =>
    /жен|female|irina|yekaterina|katya|elena|milena|natalia|svetlana|мария|oksana|galina|лариса|наталья|полина|дарья/i.test(
      n,
    )
      ? 1
      : 0;
  const maleScore = (n: string) =>
    /муж|male|dmitri|dmitry|pavel|алексей|andrey|иван|филипп|сергей|николай|egor|михаил|борис|егор/i.test(n)
      ? 1
      : 0;

  let bestF: SpeechSynthesisVoice | null = null;
  let bestM: SpeechSynthesisVoice | null = null;
  let sf = -1;
  let sm = -1;
  for (const v of ru) {
    const fs = femaleScore(v.name);
    const ms = maleScore(v.name);
    if (fs > sf) {
      sf = fs;
      bestF = v;
    }
    if (ms > sm) {
      sm = ms;
      bestM = v;
    }
  }

  if (bestF && bestM && bestF.voiceURI !== bestM.voiceURI) {
    return { alexey: bestM, maria: bestF };
  }

  const locals = ru.filter((v) => v.localService);
  const pool = locals.length >= 2 ? locals : ru;
  if (pool.length >= 2) {
    return { alexey: pool[0], maria: pool[1] };
  }
  return { alexey: ru[0], maria: ru[0] };
}

/** Обычный текст одним голосом. */
export function speakRussian(
  text: string,
  pace: SpeakRate = "normal",
  opts?: { onEnd?: () => void },
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    opts?.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const chunk = text.slice(0, 32000);
  const u = new SpeechSynthesisUtterance(chunk);
  u.lang = "ru-RU";
  u.rate = rateMap[pace];
  const { alexey, maria } = pickRuVoices();
  const v = alexey ?? maria;
  if (v) u.voice = v;
  u.pitch = 1;
  const done = () => opts?.onEnd?.();
  u.onend = done;
  u.onerror = done;
  window.speechSynthesis.speak(u);
}

/** Подпись «кто говорит» в сценарии (в т.ч. с ** в разметке) — для выбора голоса; в озвучку уходит только хвост после «:». */
const SPEAKER_LINE =
  /^\*{0,2}\s*(алексей|мария)\s*\*{0,2}\s*:\s*(.*)$/is;

function podcastLineForSpeech(line: string): {
  speech: string;
  speaker: "alexey" | "maria" | "neutral";
} {
  const m = line.match(SPEAKER_LINE);
  if (!m) return { speech: line, speaker: "neutral" };
  const who = m[1].toLowerCase();
  const speech = m[2].replace(/\*\*/g, "").trim();
  if (who === "алексей") return { speech, speaker: "alexey" };
  if (who === "мария") return { speech, speaker: "maria" };
  return { speech: line, speaker: "neutral" };
}

/**
 * Сценарий построчно: для строк «Алексей:» / «Мария:» — разные голоса; имена в интерфейсе остаются,
 * в динамик они не произносятся (озвучивается только текст после двоеточия).
 */
export function speakPodcastScript(script: string, pace: SpeakRate): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const rate = rateMap[pace];
  const { alexey, maria } = pickRuVoices();
  const lines = script
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let i = 0;
  const next = (): void => {
    if (i >= lines.length) return;
    const line = lines[i++];
    const { speech, speaker } = podcastLineForSpeech(line);
    if (!speech) {
      next();
      return;
    }

    const u = new SpeechSynthesisUtterance(speech.slice(0, 32000));
    u.lang = "ru-RU";
    u.rate = rate;

    if (speaker === "alexey") {
      if (alexey) u.voice = alexey;
      u.pitch = maria && alexey === maria ? 0.85 : 0.9;
    } else if (speaker === "maria") {
      if (maria) u.voice = maria;
      u.pitch = maria && alexey === maria ? 1.18 : 1.1;
    } else {
      if (alexey) u.voice = alexey;
      u.pitch = 1;
    }

    u.onend = next;
    window.speechSynthesis.speak(u);
  };

  next();
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

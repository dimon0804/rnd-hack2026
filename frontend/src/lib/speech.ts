/** Озвучивание в браузере (Web Speech API). Без отдельного TTS-сервера. */

export type SpeakRate = "slow" | "normal" | "fast";

const rateMap: Record<SpeakRate, number> = {
  slow: 0.82,
  normal: 1,
  fast: 1.18,
};

export function speakRussian(text: string, pace: SpeakRate = "normal"): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const chunk = text.slice(0, 32000);
  const u = new SpeechSynthesisUtterance(chunk);
  u.lang = "ru-RU";
  u.rate = rateMap[pace];
  const voices = window.speechSynthesis.getVoices();
  const ru = voices.find((v) => v.lang.startsWith("ru"));
  if (ru) u.voice = ru;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

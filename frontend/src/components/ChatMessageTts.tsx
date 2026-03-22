import type { Dispatch, SetStateAction } from "react";
import { prefetchVoices, speakRussian, stopSpeaking } from "../lib/speech";
import { stripAiMarkdown } from "../lib/stripAiMarkdown";

type Props = {
  content: string;
  messageIndex: number;
  playingIndex: number | null;
  setPlayingIndex: Dispatch<SetStateAction<number | null>>;
  disabled?: boolean;
};

/** Кнопка озвучки ответа ассистента (Web Speech API, русский голос). */
export function ChatMessageTts({
  content,
  messageIndex,
  playingIndex,
  setPlayingIndex,
  disabled,
}: Props) {
  const isPlaying = playingIndex === messageIndex;

  return (
    <button
      type="button"
      className="chat-tts-btn"
      data-a11y-speak="off"
      disabled={disabled}
      aria-label={isPlaying ? "Остановить озвучку ответа" : "Озвучить ответ"}
      aria-pressed={isPlaying}
      onClick={() => {
        if (disabled) return;
        if (isPlaying) {
          stopSpeaking();
          setPlayingIndex(null);
          return;
        }
        const plain = stripAiMarkdown(content);
        if (!plain.trim()) return;
        setPlayingIndex(messageIndex);
        void prefetchVoices().then(() => {
          speakRussian(plain, "normal", {
            onEnd: () =>
              setPlayingIndex((cur) => (cur === messageIndex ? null : cur)),
          });
        });
      }}
    >
      {isPlaying ? "Стоп" : "Озвучить"}
    </button>
  );
}

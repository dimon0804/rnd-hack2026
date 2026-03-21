import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { transcribeAudio } from "../api/transcribe";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { isVoiceRecordingSupported, voiceBlobToFile } from "../lib/voiceRecorder";

type Props = {
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onTextAppended: (text: string) => void;
  onSttError: (message: string) => void;
  /** Блокировка поля ввода: STT или запись голоса */
  onComposerBlockChange?: (blocked: boolean) => void;
  /** Блокировать кнопки (чат занят, документ не готов и т.д.) */
  disabled?: boolean;
};

function formatRecTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SttChatToolbar({ authFetch, onTextAppended, onSttError, onComposerBlockChange, disabled = false }: Props) {
  const [sttBusy, setSttBusy] = useState(false);
  const sttInputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecording();
  const [recSec, setRecSec] = useState(0);

  useEffect(() => {
    onComposerBlockChange?.(sttBusy || voice.isRecording);
  }, [sttBusy, voice.isRecording, onComposerBlockChange]);

  useEffect(() => {
    if (!voice.isRecording) return;
    setRecSec(0);
    const id = window.setInterval(() => setRecSec((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [voice.isRecording]);

  const onSttFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || sttBusy || disabled) return;
    setSttBusy(true);
    try {
      const text = await transcribeAudio(f, authFetch, { language: "ru" });
      onTextAppended(text);
    } catch (err) {
      onSttError(err instanceof Error ? err.message : "Ошибка STT");
    } finally {
      setSttBusy(false);
    }
  };

  const onVoiceStopAndTranscribe = async () => {
    const blob = await voice.stop();
    if (!blob || blob.size < 80) {
      onSttError("Запись слишком короткая — удерживайте запись дольше.");
      return;
    }
    setSttBusy(true);
    try {
      const file = voiceBlobToFile(blob);
      const text = await transcribeAudio(file, authFetch, { language: "ru" });
      onTextAppended(text);
    } catch (err) {
      onSttError(err instanceof Error ? err.message : "Ошибка STT");
    } finally {
      setSttBusy(false);
    }
  };

  const voiceOk = isVoiceRecordingSupported();
  const blocked = disabled || sttBusy;
  const recording = voice.isRecording;

  return (
    <div style={styles.wrap}>
      {voice.micError ? (
        <p style={styles.micErr} role="alert">
          {voice.micError}
        </p>
      ) : null}
      <div style={styles.row}>
        <input
          ref={sttInputRef}
          type="file"
          accept="audio/*,.webm,.wav,.mp3,.m4a,.ogg,.flac"
          style={{ display: "none" }}
          onChange={(e) => void onSttFile(e)}
        />
        <button
          type="button"
          style={styles.sttBtn}
          disabled={blocked || recording}
          title="Загрузить аудиофайл — текст в поле ввода"
          onClick={() => sttInputRef.current?.click()}
        >
          {sttBusy && !recording ? "…" : "🎤"}
        </button>
        {!recording ? (
          <button
            type="button"
            style={{ ...styles.sttBtn, ...(!voiceOk ? styles.sttBtnDisabled : {}) }}
            disabled={blocked || !voiceOk}
            title={
              voiceOk
                ? "Записать голосовое сообщение (как в мессенджере) — затем «Стоп»"
                : "Запись голоса не поддерживается в этом браузере"
            }
            onClick={() => void voice.start()}
          >
            🎙️
          </button>
        ) : (
          <div style={styles.recordingBar}>
            <span style={styles.recDot} aria-hidden />
            <span style={styles.timer}>{formatRecTime(recSec)}</span>
            <button type="button" style={styles.stopBtn} onClick={() => void onVoiceStopAndTranscribe()}>
              Стоп и в текст
            </button>
            <button type="button" style={styles.cancelBtn} onClick={() => voice.cancel()}>
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
  micErr: { margin: 0, fontSize: "0.8rem", color: "var(--danger)", maxWidth: 280 },
  sttBtn: {
    width: 44,
    minHeight: 48,
    flexShrink: 0,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.06)",
    fontSize: "1rem",
    cursor: "pointer",
    color: "var(--text)",
  },
  sttBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  recordingBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(248, 113, 113, 0.45)",
    background: "rgba(248, 113, 113, 0.08)",
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#f87171",
    animation: "voicePulse 1.2s ease-in-out infinite",
  },
  timer: { fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: "0.9rem", minWidth: 36 },
  stopBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "0.82rem",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--muted)",
    fontSize: "0.82rem",
    cursor: "pointer",
  },
};

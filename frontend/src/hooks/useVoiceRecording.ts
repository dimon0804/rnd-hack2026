import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceRecorderSession } from "../lib/voiceRecorder";

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const sessionRef = useRef<VoiceRecorderSession | null>(null);

  const start = useCallback(async () => {
    setMicError(null);
    try {
      const s = new VoiceRecorderSession();
      await s.start();
      sessionRef.current = s;
      setIsRecording(true);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "NotAllowedError"
            ? "Разрешите доступ к микрофону в настройках браузера."
            : e.message
          : "Не удалось начать запись";
      setMicError(msg);
      sessionRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setIsRecording(false);
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const s = sessionRef.current;
    if (!s) return null;
    sessionRef.current = null;
    setIsRecording(false);
    try {
      return await s.stop();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  return { isRecording, micError, setMicError, start, stop, cancel };
}

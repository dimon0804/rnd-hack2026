/** Запись голоса в браузере (MediaRecorder) — тот же пайплайн STT, что и для загруженного файла. */

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export class VoiceRecorderSession {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];

  get active(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === "recording";
  }

  async start(): Promise<void> {
    if (this.mediaRecorder) throw new Error("Запись уже идёт");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMimeType();
    this.mediaRecorder = mime
      ? new MediaRecorder(this.stream, { mimeType: mime })
      : new MediaRecorder(this.stream);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250);
  }

  /** Остановить и получить Blob (для отправки в STT). */
  stop(): Promise<Blob> {
    const mr = this.mediaRecorder;
    if (!mr || mr.state === "inactive") {
      this.cleanup();
      return Promise.reject(new Error("Нет активной записи"));
    }
    return new Promise((resolve, reject) => {
      mr.addEventListener(
        "error",
        () => {
          this.cleanup();
          reject(new Error("Ошибка записи"));
        },
        { once: true },
      );
      mr.addEventListener(
        "stop",
        () => {
          const type = mr.mimeType || "audio/webm";
          const blob = new Blob(this.chunks, { type });
          this.cleanup();
          resolve(blob);
        },
        { once: true },
      );
      mr.stop();
    });
  }

  /** Прервать без использования результата. */
  cancel(): void {
    const mr = this.mediaRecorder;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    this.chunks = [];
    this.cleanup();
  }

  private cleanup(): void {
    this.mediaRecorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/** Преобразовать запись в File для `transcribeAudio`. */
export function voiceBlobToFile(blob: Blob): File {
  const t = blob.type || "";
  let ext = "webm";
  if (t.includes("mp4") || t.includes("m4a")) ext = "m4a";
  else if (t.includes("ogg")) ext = "ogg";
  return new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });
}

export function isVoiceRecordingSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

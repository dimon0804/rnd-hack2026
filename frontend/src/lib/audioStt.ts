/**
 * STT (Mistral / OpenAI-совместимый) часто отклоняет audio/webm от MediaRecorder.
 * Декодируем в AudioBuffer и отдаём WAV PCM 16 kHz mono — универсальный формат для /v1/audio/transcriptions.
 */

function writeStr(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function encodeWavMonoPcm(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);
  return buffer;
}

/** Декодирование → ресемплинг в 16 kHz mono → WAV. */
export async function blobToWavFileForStt(blob: Blob): Promise<File> {
  const raw = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(raw.slice(0));
  } finally {
    await ctx.close();
  }
  if (decoded.duration < 0.05) {
    throw new Error("Запись слишком короткая");
  }

  const targetRate = 16000;
  const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(1, length, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const pcm = rendered.getChannelData(0);
  const wav = encodeWavMonoPcm(pcm, targetRate);
  return new File([wav], `voice-${Date.now()}.wav`, { type: "audio/wav" });
}

function needsWavConversion(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.includes("webm") || mime.includes("ogg")) return true;
  if (name.endsWith(".webm") || name.endsWith(".ogg")) return true;
  return false;
}

/** Перед STT: webm/ogg из браузера → WAV; остальные форматы без изменений. */
export async function ensureSttCompatibleFile(file: File): Promise<File> {
  if (!needsWavConversion(file)) return file;
  try {
    return await blobToWavFileForStt(file);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ошибка декодирования";
    throw new Error(
      `Не удалось подготовить аудио для распознавания (${msg}). Попробуйте файл WAV или MP3.`,
    );
  }
}

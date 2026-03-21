/**
 * STT (Mistral / OpenAI-совместимый) часто отклоняет audio/webm от MediaRecorder.
 * Декодируем в AudioBuffer → mono → линейный ресемплинг в 16 kHz → WAV PCM 16-bit.
 * OfflineAudioContext(startRendering) в части браузеров даёт тишину/битый сигнал — STT тогда
 * «угадывает» фразы вроде «Продолжение следует».
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

/** Свести каналы в один (среднее по каналам). */
function mixToMono(decoded: AudioBuffer): Float32Array {
  const len = decoded.length;
  const nCh = decoded.numberOfChannels;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < nCh; c++) {
      s += decoded.getChannelData(c)[i];
    }
    out[i] = s / nCh;
  }
  return out;
}

/** Линейная интерполяция: произвольная частота → 16 kHz (стандарт для Whisper/STT). */
function linearResampleToRate(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const f = srcPos - i0;
    out[i] = input[i0] * (1 - f) + input[i1] * f;
  }
  return out;
}

function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / samples.length);
}

/** Лёгкая нормализация тихой записи (микрофон), без клиппинга. */
function normalizeQuietSpeech(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak < 1e-5) return samples;
  if (peak >= 0.12) return samples;
  const gain = Math.min(0.92 / peak, 8);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

const STT_SAMPLE_RATE = 16000;

/** Декодирование → mono → ресемплинг 16 kHz → WAV. */
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

  let mono = mixToMono(decoded);
  if (rms(mono) < 0.0008) {
    throw new Error("Слишком тихо или нет сигнала — проверьте микрофон");
  }
  mono = normalizeQuietSpeech(mono);
  const resampled = linearResampleToRate(mono, decoded.sampleRate, STT_SAMPLE_RATE);
  if (rms(resampled) < 0.0005) {
    throw new Error("После обработки сигнал пустой — попробуйте запись ещё раз");
  }

  const wav = encodeWavMonoPcm(resampled, STT_SAMPLE_RATE);
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

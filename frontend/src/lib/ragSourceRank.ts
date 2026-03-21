import type { RagChunk } from "../api/rag";

/** Слова длиннее N символов — для пересечения ответа и чанка (RU/EN). */
const MIN_WORD = 3;

function wordSet(text: string): Set<string> {
  const t = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > MIN_WORD);
  return new Set(t);
}

/**
 * Насколько текст чанка «пересекается» с ответом ассистента (простая лексическая близость).
 * Помогает поднять в списке источников те фрагменты, на которых реально основан ответ.
 */
export function answerChunkOverlap(answer: string, chunkText: string): number {
  const ans = wordSet(answer);
  if (ans.size === 0) return 0;
  const ch = wordSet(chunkText);
  if (ch.size === 0) return 0;
  let hit = 0;
  for (const w of ch) {
    if (ans.has(w)) hit++;
  }
  // Нормализация: доля совпадений относительно размера ответа (не раздуваем за счёт длинного чанка)
  return hit / ans.size;
}

/**
 * Те же чанки, что ушли в контекст LLM, но порядок для UI: сначала те, что ближе к сформулированному ответу,
 * затем по score RAG.
 */
export function rankChunksForAssistantAnswer(chunks: RagChunk[], assistantAnswer: string): RagChunk[] {
  if (chunks.length <= 1) return chunks;
  const ans = assistantAnswer.trim();
  return [...chunks].sort((a, b) => {
    const oa = answerChunkOverlap(ans, a.text);
    const ob = answerChunkOverlap(ans, b.text);
    const diff = ob - oa;
    if (Math.abs(diff) > 0.0001) return diff;
    return b.score - a.score;
  });
}

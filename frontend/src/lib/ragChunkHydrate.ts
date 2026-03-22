import { ragDocumentChunks, type RagChunk } from "../api/rag";
import type { AuthFetch } from "./workspaceAi";

/** Как на бэкенде `_norm_doc_id` — для сопоставления document_id. */
function normDocId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Подставляет текст фрагмента из полного списка чанков документа (`GET .../documents/{id}/chunks`).
 * Так в блоке «Источники» показывается тот же текст, что лежит в индексе RAG, а не расхождение с ответом `query`.
 */
export async function hydrateChunkTextsFromDocuments(
  chunks: RagChunk[],
  authFetch: AuthFetch,
): Promise<RagChunk[]> {
  if (chunks.length === 0) return chunks;
  const docIds = [...new Set(chunks.map((c) => c.document_id))];
  const textByDocChunk = new Map<string, string>();

  await Promise.all(
    docIds.map(async (docId) => {
      try {
        const all = await ragDocumentChunks(docId, authFetch);
        for (const row of all) {
          textByDocChunk.set(`${normDocId(row.document_id)}:${row.chunk_id}`, row.text);
        }
      } catch {
        /* оставляем текст из query */
      }
    }),
  );

  return chunks.map((c) => {
    const key = `${normDocId(c.document_id)}:${c.chunk_id}`;
    const t = textByDocChunk.get(key);
    return t !== undefined && t.length > 0 ? { ...c, text: t } : c;
  });
}

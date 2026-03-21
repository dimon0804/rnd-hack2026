import JSZip from "jszip";
import { fetchDocumentFileBlob } from "../api/documents";
import { ragDocumentChunks } from "../api/rag";
import type { InfographicSpec } from "./infographicSpec";
import type { MindLayoutNode } from "./mindmapParse";
import type { AuthFetch } from "./workspaceAi";
import type { VideoRecapPlan } from "./videoRecapPlan";
import { formatVideoScriptText } from "./videoRecapPlan";

function safeFolderName(name: string): string {
  const t = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  return t.slice(0, 100) || "document";
}

/** Уникальное имя файла в originals/ при совпадении имён в группе. */
function safeOriginalEntryName(documentId: string, originalFilename: string): string {
  const base = safeFolderName(originalFilename.replace(/\.[^.]+$/, "") || "file");
  const ext = (() => {
    const m = /\.[^.]+$/.exec(originalFilename);
    return m ? m[0].slice(0, 12) : "";
  })();
  const short = documentId.replace(/-/g, "").slice(0, 8);
  return `${short}_${base}${ext}`;
}

export type PackageChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function formatChatLog(messages: PackageChatMessage[]): string {
  const lines: string[] = ["Чат workspace (текущая сессия в браузере)", ""];
  for (const m of messages) {
    const who = m.role === "user" ? "Вы" : "Ответ";
    lines.push(`--- ${who} ---`);
    lines.push(m.content.trim());
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildReadme(opts: {
  workspaceUrl: string;
  hasPptx: boolean;
  hasVideo: boolean;
  hasPodcast: boolean;
  hasInfographic: boolean;
  hasTable: boolean;
  hasSummary: boolean;
  hasOriginals: boolean;
  attemptedOriginals: boolean;
  originalsSkipped: number;
  hasChat: boolean;
  hasTests: boolean;
  hasFlashcards: boolean;
  hasMindmapRaw: boolean;
  hasMindmapLayout: boolean;
  hasTopics: boolean;
}): string {
  const lines: string[] = [];
  lines.push("Пакет документа (экспорт из workspace)");
  lines.push(`Сформировано: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Страница workspace:");
  lines.push(opts.workspaceUrl);
  lines.push("");
  lines.push("Состав архива:");
  lines.push("- text-from-index.txt — текст из чанков индекса RAG (не заменяет оригинал PDF/DOCX).");
  if (opts.hasOriginals) {
    lines.push("- originals/ — оригинальные загруженные файлы по документам группы.");
  } else if (opts.attemptedOriginals) {
    lines.push(
      "- originals/ — папка не заполнена (не удалось скачать оригиналы: права, сеть или файл не на диске).",
    );
  }
  if (opts.originalsSkipped > 0 && opts.hasOriginals) {
    lines.push(`  Пропущено файлов: ${opts.originalsSkipped}.`);
  }
  if (opts.hasSummary) lines.push("- summary.txt — краткое содержание («Обзор»).");
  if (opts.hasTopics) lines.push("- topics.txt — темы из «Обзора».");
  if (opts.hasChat) lines.push("- chat-log.txt — переписка из вкладки «Чат» в этой сессии.");
  if (opts.hasTests) lines.push("- tests.txt — текст тестов из вкладки «Тесты».");
  if (opts.hasFlashcards) lines.push("- flashcards.json — карточки (вопрос/ответ).");
  if (opts.hasMindmapRaw) lines.push("- mindmap-raw.txt — сырой список mindmap от модели.");
  if (opts.hasMindmapLayout) lines.push("- mindmap-layout.json — дерево с координатами для графа.");
  if (opts.hasVideo) lines.push("- video-script.txt — сценарий видео-пересказа.");
  if (opts.hasPodcast) lines.push("- podcast-script.txt — сценарий аудиопересказа.");
  if (opts.hasInfographic) lines.push("- infographic.json — данные инфографики.");
  if (opts.hasTable) lines.push("- table.csv — таблица из вкладки «Таблица».");
  if (opts.hasPptx) {
    lines.push("- presentation.pptx — презентация Gamma (если была сгенерирована в этой сессии).");
  }
  lines.push("");
  lines.push("Если presentation.pptx нет: вкладка «Презентация» → «Создать и скачать».");
  return lines.join("\n");
}

export type DocumentPackageOptions = {
  baseName: string;
  ragIds: string[];
  authFetch: AuthFetch;
  /** Полный URL страницы workspace (window.location.href). */
  workspaceUrl: string;
  summary?: string | null;
  topics?: string[];
  /** Сообщения чата текущей сессии (без чанков в файле — только роль и текст). */
  chatMessages?: PackageChatMessage[];
  testsText?: string | null;
  flashcards?: { q: string; a: string }[];
  mindmapRaw?: string | null;
  mindmapLayout?: MindLayoutNode | null;
  videoPlan?: VideoRecapPlan | null;
  podcastScript?: string | null;
  infographic?: InfographicSpec | null;
  tableCsv?: string | null;
  presentationBlob?: Blob | null;
  /** Скачать оригиналы для этих document_id (обычно ragIds группы). */
  includeOriginalFiles?: boolean;
};

/**
 * ZIP: индекс RAG, оригиналы, чат, тесты, карточки, mindmap, прочие артефакты, README.
 */
export async function buildDocumentPackageZip(opts: DocumentPackageOptions): Promise<Blob> {
  const root = safeFolderName(opts.baseName.replace(/\.[^.]+$/, "") || "document");
  const zip = new JSZip();
  const folder = zip.folder(root);
  if (!folder) throw new Error("Не удалось создать папку в архиве");

  const parts: string[] = [];
  for (const id of opts.ragIds) {
    try {
      const ch = await ragDocumentChunks(id, opts.authFetch);
      if (ch.length) {
        parts.push(`--- document_id: ${id} ---\n`);
        parts.push(ch.map((c) => c.text).join("\n\n"));
      }
    } catch {
      parts.push(`--- document_id: ${id} (ошибка чтения чанков) ---\n`);
    }
  }
  const indexed = parts.join("\n\n").trim() || "(пусто)";
  folder.file("text-from-index.txt", `\ufeff${indexed}`);

  let originalsSkipped = 0;
  let originalsAdded = 0;
  if (opts.includeOriginalFiles && opts.ragIds.length > 0) {
    const originals = folder.folder("originals");
    if (originals) {
      for (const id of opts.ragIds) {
        try {
          const { blob, filename } = await fetchDocumentFileBlob(id, opts.authFetch);
          if (blob.size > 0) {
            originals.file(safeOriginalEntryName(id, filename), blob);
            originalsAdded += 1;
          } else {
            originalsSkipped += 1;
          }
        } catch {
          originalsSkipped += 1;
        }
      }
    }
  }

  if (opts.summary && opts.summary.trim()) {
    folder.file("summary.txt", `\ufeff${opts.summary.trim()}`);
  }

  if (opts.topics && opts.topics.length > 0) {
    folder.file("topics.txt", `\ufeff${opts.topics.map((t) => `- ${t}`).join("\n")}`);
  }

  if (opts.chatMessages && opts.chatMessages.length > 0) {
    const slim = opts.chatMessages.map((m) => ({ role: m.role, content: m.content }));
    folder.file("chat-log.txt", `\ufeff${formatChatLog(slim)}`);
  }

  if (opts.testsText && opts.testsText.trim()) {
    folder.file("tests.txt", `\ufeff${opts.testsText.trim()}`);
  }

  if (opts.flashcards && opts.flashcards.length > 0) {
    folder.file("flashcards.json", JSON.stringify(opts.flashcards, null, 2));
  }

  if (opts.mindmapRaw && opts.mindmapRaw.trim()) {
    folder.file("mindmap-raw.txt", `\ufeff${opts.mindmapRaw.trim()}`);
  }

  if (opts.mindmapLayout) {
    folder.file("mindmap-layout.json", JSON.stringify(opts.mindmapLayout, null, 2));
  }

  if (opts.videoPlan) {
    folder.file("video-script.txt", `\ufeff${formatVideoScriptText(opts.videoPlan)}`);
  }

  if (opts.podcastScript && opts.podcastScript.trim()) {
    folder.file("podcast-script.txt", `\ufeff${opts.podcastScript.trim()}`);
  }

  if (opts.infographic) {
    folder.file("infographic.json", JSON.stringify(opts.infographic, null, 2));
  }

  if (opts.tableCsv && opts.tableCsv.trim()) {
    folder.file("table.csv", `\ufeff${opts.tableCsv}`);
  }

  if (opts.presentationBlob && opts.presentationBlob.size > 0) {
    folder.file("presentation.pptx", opts.presentationBlob);
  }

  const readme = buildReadme({
    workspaceUrl: opts.workspaceUrl,
    hasPptx: Boolean(opts.presentationBlob && opts.presentationBlob.size > 0),
    hasVideo: Boolean(opts.videoPlan),
    hasPodcast: Boolean(opts.podcastScript?.trim()),
    hasInfographic: Boolean(opts.infographic),
    hasTable: Boolean(opts.tableCsv?.trim()),
    hasSummary: Boolean(opts.summary?.trim()),
    hasOriginals: originalsAdded > 0,
    attemptedOriginals: Boolean(opts.includeOriginalFiles && opts.ragIds.length > 0),
    originalsSkipped,
    hasChat: Boolean(opts.chatMessages && opts.chatMessages.length > 0),
    hasTests: Boolean(opts.testsText?.trim()),
    hasFlashcards: Boolean(opts.flashcards && opts.flashcards.length > 0),
    hasMindmapRaw: Boolean(opts.mindmapRaw?.trim()),
    hasMindmapLayout: Boolean(opts.mindmapLayout),
    hasTopics: Boolean(opts.topics && opts.topics.length > 0),
  });
  folder.file("README.txt", `\ufeff${readme}`);

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

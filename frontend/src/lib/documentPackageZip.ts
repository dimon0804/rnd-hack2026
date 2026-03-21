import JSZip from "jszip";
import { ragDocumentChunks } from "../api/rag";
import type { InfographicSpec } from "./infographicSpec";
import type { AuthFetch } from "./workspaceAi";
import type { VideoRecapPlan } from "./videoRecapPlan";
import { formatVideoScriptText } from "./videoRecapPlan";

function safeFolderName(name: string): string {
  const t = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  return t.slice(0, 100) || "document";
}

function buildReadme(opts: {
  workspaceUrl: string;
  hasPptx: boolean;
  hasVideo: boolean;
  hasPodcast: boolean;
  hasInfographic: boolean;
  hasTable: boolean;
  hasSummary: boolean;
}): string {
  const lines: string[] = [];
  lines.push("Пакет документа (экспорт из workspace)");
  lines.push(`Сформировано: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Страница workspace:");
  lines.push(opts.workspaceUrl);
  lines.push("");
  lines.push("Состав архива:");
  lines.push("- text-from-index.txt — текст, собранный из чанков индекса RAG (не оригинальный PDF; для полного файла используйте копию загрузки).");
  if (opts.hasSummary) lines.push("- summary.txt — краткое содержание из вкладки «Обзор».");
  if (opts.hasVideo) lines.push("- video-script.txt — сценарий видео-пересказа (сцены и озвучка).");
  if (opts.hasPodcast) lines.push("- podcast-script.txt — сценарий аудиопересказа (диалог).");
  if (opts.hasInfographic) lines.push("- infographic.json — данные инфографики (JSON).");
  if (opts.hasTable) lines.push("- table.csv — таблица из вкладки «Таблица».");
  if (opts.hasPptx) {
    lines.push("- presentation.pptx — презентация Gamma, если она была в этой сессии при выгрузке.");
  }
  lines.push("");
  lines.push("Презентация (Gamma, .pptx)");
  lines.push("Если presentation.pptx нет в архиве: откройте вкладку «Презентация» на странице workspace и нажмите «Создать и скачать» — файл сохранится в папку загрузок браузера.");
  lines.push("Прямая ссылка на страницу документа см. выше.");
  return lines.join("\n");
}

export type DocumentPackageOptions = {
  baseName: string;
  ragIds: string[];
  authFetch: AuthFetch;
  /** Полный URL страницы workspace (window.location.href). */
  workspaceUrl: string;
  summary?: string | null;
  videoPlan?: VideoRecapPlan | null;
  podcastScript?: string | null;
  infographic?: InfographicSpec | null;
  tableCsv?: string | null;
  presentationBlob?: Blob | null;
};

/**
 * Один ZIP: сценарии, текст из индекса, инфографика, CSV, README со ссылками, опционально .pptx.
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

  if (opts.summary && opts.summary.trim()) {
    folder.file("summary.txt", `\ufeff${opts.summary.trim()}`);
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
  });
  folder.file("README.txt", `\ufeff${readme}`);

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

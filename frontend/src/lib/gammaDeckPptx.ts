import pptxgen from "pptxgenjs";
import type { GammaDeck, GammaSlide } from "./gammaDeck";
import { fetchSlideImageDataUrl } from "./gammaDeckImages";
import type { AuthFetch } from "./workspaceAi";

const BG = "12121C";
const TEXT = "F5F3FF";
const MUTED = "9CA3C4";
const ACCENT = "A78BFA";
const BAR = "7C3AED";
const GREEN = "34D399";
const BULLET = "D8D4EC";

const SLIDE_H = 5.625;

const IMG_X = 5.1;
const IMG_W = 4.75;
const TEXT_W = 4.45;

/** Скачивание Blob. Если расширение не указано — подставляется .pptx (исторически для презентаций). */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const lower = filename.toLowerCase();
  const hasKnownExt =
    lower.endsWith(".pptx") ||
    lower.endsWith(".zip") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json") ||
    lower.endsWith(".txt");
  a.download = hasKnownExt ? filename : `${filename}.pptx`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function addAccentBar(pptx: InstanceType<typeof pptxgen>, slide: ReturnType<InstanceType<typeof pptxgen>["addSlide"]>) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.14,
    h: SLIDE_H,
    fill: { color: BAR },
    line: { width: 0 },
  });
}

function addSlideNumber(slide: ReturnType<InstanceType<typeof pptxgen>["addSlide"]>, index: number, total: number) {
  slide.addText(`${index + 1} / ${total}`, {
    x: 8.45,
    y: 0.22,
    w: 1.45,
    h: 0.28,
    fontSize: 9,
    color: MUTED,
    align: "right",
  });
}

function addSlideBody(
  slide: ReturnType<InstanceType<typeof pptxgen>["addSlide"]>,
  sl: GammaSlide,
  imageDataUrl: string | null,
): void {
  const hasImg = Boolean(imageDataUrl);
  const tw = hasImg ? TEXT_W : 8.9;

  if (hasImg && imageDataUrl) {
    slide.addImage({
      data: imageDataUrl,
      x: IMG_X,
      y: 0.2,
      w: IMG_W,
      h: 5.25,
      rounding: true,
    });
  }

  switch (sl.type) {
    case "title":
      slide.addText("ПРЕЗЕНТАЦИЯ", {
        x: 0.55,
        y: 0.85,
        w: tw,
        h: 0.35,
        fontSize: 11,
        color: GREEN,
        bold: true,
      });
      slide.addText(sl.title, {
        x: 0.55,
        y: 1.3,
        w: tw,
        h: 1.45,
        fontSize: hasImg ? 28 : 32,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      slide.addText(sl.subtitle, {
        x: 0.55,
        y: 2.85,
        w: tw,
        h: 2.2,
        fontSize: 15,
        color: MUTED,
        valign: "top",
      });
      break;
    case "section":
      slide.addText("РАЗДЕЛ", {
        x: 0.55,
        y: 1.75,
        w: tw,
        h: 0.35,
        fontSize: 11,
        color: ACCENT,
        bold: true,
      });
      slide.addText(sl.title, {
        x: 0.55,
        y: 2.2,
        w: tw,
        h: 1.35,
        fontSize: hasImg ? 26 : 30,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      if (sl.subtitle) {
        slide.addText(sl.subtitle, {
          x: 0.55,
          y: 3.65,
          w: tw,
          h: 1.35,
          fontSize: 16,
          color: MUTED,
          valign: "top",
        });
      }
      break;
    case "closing":
      slide.addText(sl.title, {
        x: 0.55,
        y: 1.95,
        w: tw,
        h: 1.35,
        fontSize: hasImg ? 28 : 32,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      if (sl.line) {
        slide.addText(sl.line, {
          x: 0.55,
          y: 3.45,
          w: tw,
          h: 1.35,
          fontSize: 16,
          color: MUTED,
          valign: "top",
        });
      }
      break;
    case "content": {
      slide.addText(sl.title, {
        x: 0.55,
        y: 0.5,
        w: tw,
        h: 0.9,
        fontSize: hasImg ? 22 : 26,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      if (sl.bullets.length > 0) {
        const lines = sl.bullets.map((b) => ({
          text: b,
          options: { bullet: true as boolean, color: BULLET, fontSize: hasImg ? 15 : 17 },
        }));
        slide.addText(lines, {
          x: 0.55,
          y: 1.4,
          w: tw,
          h: 3.65,
          valign: "top",
        });
      } else {
        slide.addText("Ключевая мысль сформулирована в заголовке.", {
          x: 0.55,
          y: 1.4,
          w: tw,
          h: 0.6,
          fontSize: 15,
          color: MUTED,
        });
      }
      break;
    }
  }
}

/** PPTX 16:9, тёмный фон, фото справа по подсказкам image_hint (поиск по фразе через API-шлюз). */
export async function buildGammaPptxBlob(deck: GammaDeck, authFetch: AuthFetch): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.deck_title;
  pptx.author = "AI Platform";
  pptx.subject = deck.deck_title;

  const imageUrls = await Promise.all(
    deck.slides.map((sl, i) => fetchSlideImageDataUrl(deck, sl, i, authFetch)),
  );

  const total = deck.slides.length;
  for (let i = 0; i < total; i++) {
    const slide = pptx.addSlide();
    slide.background = { color: BG };
    addAccentBar(pptx, slide);
    addSlideNumber(slide, i, total);
    addSlideBody(slide, deck.slides[i], imageUrls[i]);
  }

  const out = await pptx.write({ outputType: "blob" });
  if (!(out instanceof Blob)) {
    throw new Error("Не удалось сформировать PPTX");
  }
  return out;
}

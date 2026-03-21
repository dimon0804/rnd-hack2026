import pptxgen from "pptxgenjs";
import type { GammaDeck, GammaSlide } from "./gammaDeck";

const BG = "12121C";
const TEXT = "F5F3FF";
const MUTED = "9CA3C4";
const ACCENT = "A78BFA";
const BAR = "7C3AED";
const GREEN = "34D399";
const BULLET = "D8D4EC";

const SLIDE_H = 5.625;

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".pptx") ? filename : `${filename}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
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

function addSlideNumber(
  slide: ReturnType<InstanceType<typeof pptxgen>["addSlide"]>,
  index: number,
  total: number,
) {
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

function addSlideBody(slide: ReturnType<InstanceType<typeof pptxgen>["addSlide"]>, sl: GammaSlide): void {
  switch (sl.type) {
    case "title":
      slide.addText("ПРЕЗЕНТАЦИЯ", {
        x: 0.55,
        y: 0.85,
        w: 8.5,
        h: 0.35,
        fontSize: 11,
        color: GREEN,
        bold: true,
      });
      slide.addText(sl.title, {
        x: 0.55,
        y: 1.3,
        w: 8.9,
        h: 1.45,
        fontSize: 32,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      slide.addText(sl.subtitle, {
        x: 0.55,
        y: 2.95,
        w: 8.9,
        h: 2.1,
        fontSize: 15,
        color: MUTED,
        valign: "top",
      });
      break;
    case "section":
      slide.addText("РАЗДЕЛ", {
        x: 0.55,
        y: 1.75,
        w: 8.5,
        h: 0.35,
        fontSize: 11,
        color: ACCENT,
        bold: true,
      });
      slide.addText(sl.title, {
        x: 0.55,
        y: 2.2,
        w: 8.9,
        h: 1.35,
        fontSize: 30,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      if (sl.subtitle) {
        slide.addText(sl.subtitle, {
          x: 0.55,
          y: 3.65,
          w: 8.9,
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
        w: 8.9,
        h: 1.35,
        fontSize: 32,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      if (sl.line) {
        slide.addText(sl.line, {
          x: 0.55,
          y: 3.45,
          w: 8.9,
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
        w: 8.9,
        h: 0.9,
        fontSize: 26,
        color: TEXT,
        bold: true,
        valign: "top",
      });
      if (sl.bullets.length > 0) {
        const lines = sl.bullets.map((b) => ({
          text: b,
          options: { bullet: true as boolean, color: BULLET, fontSize: 17 },
        }));
        slide.addText(lines, {
          x: 0.55,
          y: 1.4,
          w: 8.9,
          h: 3.65,
          valign: "top",
        });
      } else {
        slide.addText("Ключевая мысль сформулирована в заголовке.", {
          x: 0.55,
          y: 1.4,
          w: 8.9,
          h: 0.6,
          fontSize: 15,
          color: MUTED,
        });
      }
      break;
    }
  }
}

/** PPTX 16:9, тёмный фон и акцентная полоса в духе Gamma. */
export async function buildGammaPptxBlob(deck: GammaDeck): Promise<Blob> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.deck_title;
  pptx.author = "AI Platform";
  pptx.subject = deck.deck_title;

  const total = deck.slides.length;
  for (let i = 0; i < total; i++) {
    const slide = pptx.addSlide();
    slide.background = { color: BG };
    addAccentBar(pptx, slide);
    addSlideNumber(slide, i, total);
    addSlideBody(slide, deck.slides[i]);
  }

  const out = await pptx.write({ outputType: "blob" });
  if (!(out instanceof Blob)) {
    throw new Error("Не удалось сформировать PPTX");
  }
  return out;
}

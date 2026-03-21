/** Слайды для HTML-презентации в духе Gamma: крупная типографика, тёмный градиент, минимум текста на слайд. */

export type GammaSlide =
  | { type: "title"; title: string; subtitle: string }
  | { type: "content"; title: string; bullets: string[] }
  | { type: "section"; title: string; subtitle?: string }
  | { type: "closing"; title: string; line?: string };

export type GammaDeck = { deck_title: string; slides: GammaSlide[] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeBullets(b: unknown): string[] {
  if (!Array.isArray(b)) return [];
  return b.map((x) => String(x).trim()).filter(Boolean).slice(0, 6);
}

/** Парсинг JSON из ответа LLM (возможны обёртки ```json). */
export function parseGammaDeckJson(raw: string): GammaDeck {
  const t = raw.trim();
  let jsonStr = t;
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) jsonStr = fence[1].trim();
  else {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) jsonStr = t.slice(start, end + 1);
  }
  const data = JSON.parse(jsonStr) as unknown;
  if (!data || typeof data !== "object") throw new Error("Некорректный JSON");
  const o = data as Record<string, unknown>;
  const deck_title = String(o.deck_title ?? "Презентация").trim() || "Презентация";
  const slidesIn = o.slides;
  if (!Array.isArray(slidesIn)) throw new Error("В JSON нет массива slides");

  const slides: GammaSlide[] = [];
  for (const item of slidesIn) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const type = String(s.type ?? "").toLowerCase();
    if (type === "title") {
      slides.push({
        type: "title",
        title: String(s.title ?? "").trim() || deck_title,
        subtitle: String(s.subtitle ?? "").trim() || " ",
      });
    } else if (type === "content") {
      slides.push({
        type: "content",
        title: String(s.title ?? "").trim() || "Слайд",
        bullets: normalizeBullets(s.bullets),
      });
    } else if (type === "section") {
      slides.push({
        type: "section",
        title: String(s.title ?? "").trim() || "Раздел",
        subtitle: s.subtitle != null ? String(s.subtitle).trim() : undefined,
      });
    } else if (type === "closing") {
      slides.push({
        type: "closing",
        title: String(s.title ?? "").trim() || "Спасибо",
        line: s.line != null ? String(s.line).trim() : undefined,
      });
    }
  }
  if (slides.length === 0) throw new Error("Не удалось разобрать слайды");
  return { deck_title, slides };
}

function slideHtml(slide: GammaSlide, index: number, total: number): string {
  const n = `<span class="slide-num">${index + 1} / ${total}</span>`;
  switch (slide.type) {
    case "title":
      return `
<section class="slide slide--title" id="s${index}">
  <div class="slide-inner">
    ${n}
    <p class="kicker">Презентация</p>
    <h1>${escapeHtml(slide.title)}</h1>
    <p class="subtitle">${escapeHtml(slide.subtitle)}</p>
  </div>
</section>`;
    case "section":
      return `
<section class="slide slide--section" id="s${index}">
  <div class="slide-inner">
    ${n}
    <p class="section-kicker">Раздел</p>
    <h2>${escapeHtml(slide.title)}</h2>
    ${slide.subtitle ? `<p class="section-sub">${escapeHtml(slide.subtitle)}</p>` : ""}
  </div>
</section>`;
    case "closing":
      return `
<section class="slide slide--closing" id="s${index}">
  <div class="slide-inner">
    ${n}
    <h2>${escapeHtml(slide.title)}</h2>
    ${slide.line ? `<p class="closing-line">${escapeHtml(slide.line)}</p>` : ""}
  </div>
</section>`;
    case "content":
    default: {
      const bullets =
        slide.bullets.length > 0
          ? `<ul class="bullets">${slide.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
          : `<p class="muted-slide">Ключевая мысль сформулирована в заголовке.</p>`;
      return `
<section class="slide slide--content" id="s${index}">
  <div class="slide-inner">
    ${n}
    <h2>${escapeHtml(slide.title)}</h2>
    ${bullets}
  </div>
</section>`;
    }
  }
}

/** Один HTML-файл: открыть в браузере, листать стрелками / колёсиком, печать в PDF. */
export function buildGammaHtmlFile(deck: GammaDeck): string {
  const title = escapeHtml(deck.deck_title);
  const total = deck.slides.length;
  const sections = deck.slides.map((s, i) => slideHtml(s, i, total)).join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg0: #0a0a0f;
  --bg1: #12121c;
  --accent: #a78bfa;
  --accent2: #34d399;
  --text: #eceaf7;
  --muted: #9ca3c4;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; scroll-behavior: smooth; }
body {
  font-family: "DM Sans", system-ui, sans-serif;
  background: var(--bg0);
  color: var(--text);
  overflow-x: hidden;
}
.deck {
  scroll-snap-type: y mandatory;
  overflow-y: auto;
  height: 100vh;
  height: 100dvh;
}
.slide {
  min-height: 100vh;
  min-height: 100dvh;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(28px, 5vw, 72px);
  position: relative;
  background: linear-gradient(155deg, #0e0e18 0%, #1a1428 42%, #0c1018 100%);
}
.slide::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.55;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, rgba(124, 58, 237, 0.35), transparent 55%),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(52, 211, 153, 0.12), transparent 50%);
}
.slide::after {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image: linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
}
.slide-inner { position: relative; z-index: 1; width: 100%; max-width: 920px; margin: 0 auto; }
.slide-num {
  display: inline-block;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 1.25rem;
  font-weight: 600;
}
.kicker, .section-kicker {
  font-size: 0.82rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent2);
  font-weight: 600;
  margin: 0 0 0.75rem;
}
.section-kicker { color: var(--accent); }
h1 {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 5.5vw, 3.75rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.08;
  background: linear-gradient(120deg, #fff 0%, #c4b5fd 45%, #6ee7b7 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.slide--title .subtitle {
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  color: var(--muted);
  line-height: 1.55;
  max-width: 36em;
  margin: 0;
}
h2 {
  margin: 0 0 1.25rem;
  font-size: clamp(1.5rem, 3.8vw, 2.35rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: #f8f6ff;
}
.section-sub { font-size: 1.15rem; color: var(--muted); margin: 0; line-height: 1.5; }
.bullets {
  margin: 0;
  padding: 0;
  list-style: none;
}
.bullets li {
  position: relative;
  padding-left: 1.35rem;
  margin-bottom: 0.85rem;
  font-size: clamp(1rem, 2vw, 1.2rem);
  line-height: 1.45;
  color: #d8d4ec;
}
.bullets li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
}
.muted-slide { color: var(--muted); font-size: 1.05rem; margin: 0; }
.closing-line { font-size: 1.2rem; color: var(--muted); margin: 0.5rem 0 0; }
.nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(transparent, rgba(8,8,12,0.92));
  pointer-events: none;
}
.nav button {
  pointer-events: auto;
  font: inherit;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: var(--text);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
}
.nav button:hover { background: rgba(255,255,255,0.12); }
.nav span { font-size: 0.8rem; color: var(--muted); }
@media print {
  .nav { display: none; }
  .slide { break-after: page; min-height: auto; }
  .deck { overflow: visible; height: auto; }
}
</style>
</head>
<body>
<div class="deck" id="deck">
${sections}
</div>
<div class="nav" id="nav">
  <button type="button" id="prev">← Назад</button>
  <span id="hint">Стрелки ← → · Space</span>
  <button type="button" id="next">Вперёд →</button>
</div>
<script>
(function () {
  var deck = document.getElementById("deck");
  var slides = deck.querySelectorAll(".slide");
  var i = 0;
  function go(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides[i].scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.getElementById("prev").onclick = function () { go(i - 1); };
  document.getElementById("next").onclick = function () { go(i + 1); };
  deck.addEventListener("scroll", function () {
    var h = window.innerHeight;
    var idx = Math.round(deck.scrollTop / h);
    if (slides[idx]) i = idx;
  }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(i + 1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(i - 1); }
    if (e.key === "Home") { e.preventDefault(); go(0); }
    if (e.key === "End") { e.preventDefault(); go(slides.length - 1); }
  });
})();
</script>
</body>
</html>`;
}

export function triggerHtmlDownload(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Элементы, для которых озвучиваем имя при фокусе и нажатии (режим для слабовидящих). */
const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="link"], [role="menuitem"], input:not([type="hidden"]), select, textarea, [role="switch"], [role="checkbox"], [role="radio"], summary';

export function closestInteractive(target: EventTarget | null): HTMLElement | null {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? (target.parentElement ?? null)
        : null;
  if (!el) return null;
  const found = el.closest(INTERACTIVE_SELECTOR);
  return found instanceof HTMLElement ? found : null;
}

function textFromIdRefs(ids: string): string {
  const parts: string[] = [];
  for (const id of ids.trim().split(/\s+/)) {
    if (!id) continue;
    const node = document.getElementById(id);
    const t = node?.textContent?.trim();
    if (t) parts.push(t);
  }
  return parts.join(". ");
}

/** Доступное имя элемента для озвучки (близко к вычисляемому accessible name). */
export function getAccessibleName(el: HTMLElement): string {
  if (el.getAttribute("data-a11y-speak") === "off") return "";

  const tag = el.tagName.toLowerCase();
  if (tag === "input") {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? "text";
    if (type === "hidden") return "";
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const fromRefs = textFromIdRefs(labelledBy);
    if (fromRefs) return fromRefs;
  }

  if (tag === "input" || tag === "select" || tag === "textarea") {
    const id = el.id;
    if (id) {
      const safe = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id;
      const lab = document.querySelector(`label[for="${safe}"]`);
      const lt = lab?.textContent?.trim();
      if (lt) return lt;
    }
    const wrap = el.closest("label");
    if (wrap) {
      const clone = wrap.cloneNode(true) as HTMLElement;
      const inner = clone.querySelector("input, select, textarea");
      inner?.remove();
      const wt = clone.textContent?.trim();
      if (wt) return wt;
    }
    if (tag === "input") {
      const inp = el as HTMLInputElement;
      const ph = inp.placeholder?.trim();
      if (ph) return ph;
      const t = inp.type?.toLowerCase();
      if (t === "password") return "Поле пароля";
      if (t === "search") return "Поиск";
      if (t === "file") return "Выбор файла";
      if (t === "checkbox") return inp.checked ? "Флажок включён" : "Флажок выключен";
      if (t === "radio") return "Переключатель";
    }
  }

  const title = el.getAttribute("title");
  if (title?.trim()) return title.trim();

  const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length > 0 && text.length <= 220) return text;

  if (text.length > 220) return `${text.slice(0, 217)}…`;

  const role = el.getAttribute("role");
  if (role === "tab") return "Вкладка";
  if (role === "button") return "Кнопка";

  return tag === "button" || tag === "summary" ? "Кнопка" : "";
}

let lastUtteranceKey = "";
let lastUtteranceAt = 0;

/** Озвучить строку (отменяет предыдущую реплику). */
export function speakA11y(text: string): void {
  const t = text.trim();
  if (!t) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "ru-RU";
  u.rate = 0.9;
  synth.speak(u);
}

/** Озвучить элемент с дедупликацией (фокус + клик по одному элементу). */
export function speakElementIfNew(el: HTMLElement): void {
  const name = getAccessibleName(el);
  if (!name) return;
  const key = `${el.tagName}:${name}`;
  const now = Date.now();
  if (key === lastUtteranceKey && now - lastUtteranceAt < 500) return;
  lastUtteranceKey = key;
  lastUtteranceAt = now;
  speakA11y(name);
}

export function cancelA11ySpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

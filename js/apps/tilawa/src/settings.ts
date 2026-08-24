/**
 * **إعداداتُ التلاوة الدنيا** — ما يخدم القراءةَ ولا يزيد: مقاسُ الخطّ، ووضعُ
 * الصفحة، وخطُّ المصحف. ولا لوحةَ تفضيلاتٍ طويلةً في تطبيقِ عبادةٍ يوميّة.
 *
 * وتُطبَّق **على الجذر** (`data-theme` و`--quran-scale` و`data-quran-font`)
 * فتقرأها هيئةُ الصفحة من الحزمة بلا وسيط، **وقبل أوّل رسمٍ** فلا يرى القارئ
 * وثبةً من وضعٍ إلى وضع.
 */
export type Theme = "light" | "dark" | "sepia";
export type QuranFont = "amiri" | "kfgqpc" | "scheherazade";

export interface Settings {
  theme: Theme;
  /** سلّمُ خطّ المصحف — يضرب مقاسَ الرسم في هيئة الصفحة */
  scale: number;
  font: QuranFont;
}

const KEY = "tilawa.settings.v1";
export const SCALES = [0.85, 0.925, 1, 1.1, 1.2, 1.35, 1.5];

/** **أوّلُ فتحةٍ تتبع الجهاز**: من كان جهازُه داكنًا فُتح له داكنًا؛ ثمّ اختيارُه
 *  هو القول. ولا يُفرض وضعٌ على قارئٍ ثمّ يُقال له بدّله. */
const systemTheme = (): Theme =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const DEFAULTS = (): Settings => ({ theme: systemTheme(), scale: 1, font: "amiri" });

let current: Settings = load();

function load(): Settings {
  const d = DEFAULTS();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: v.theme === "dark" || v.theme === "sepia" || v.theme === "light" ? v.theme : d.theme,
      scale: SCALES.includes(Number(v.scale)) ? Number(v.scale) : d.scale,
      font: v.font === "kfgqpc" || v.font === "scheherazade" || v.font === "amiri" ? v.font : d.font,
    };
  } catch {
    return d; /* الجهازُ قد يمنع التخزين — لا يُبطل القراءة */
  }
}

const listeners = new Set<() => void>();

export const getSettings = (): Settings => current;

/** يُطبَّق على الجذر — ومنه تقرأ هيئةُ الصفحة أوضاعَها */
export function applySettings(): void {
  const r = document.documentElement;
  r.dataset.theme = current.theme;
  r.dataset.quranFont = current.font;
  r.style.setProperty("--quran-scale", String(current.scale));
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    current.theme === "dark" ? "#1d1a16" : current.theme === "sepia" ? "#f7efdd" : "#fffdf9",
  );
}

export function setSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* لا يُبطل القراءة */
  }
  applySettings();
  for (const fn of listeners) fn();
}

export const subscribeSettings = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

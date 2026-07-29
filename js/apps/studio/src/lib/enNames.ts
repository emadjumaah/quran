/**
 * أسماءُ طبقات مشكاة بالإنجليزية (names-en.json): المواضيعُ وأبوابُها ومحاورُ
 * الشبكة — مولَّدةٌ بمراجعةِ عددٍ وترتيبٍ آليّة (أمر المالك 2026-07-29:
 * «نترجم محاور مواضيع وأجزاء مشكاة الأخرى»). تُجلب مرّةً عند أول حاجةٍ في
 * واجهة EN، والعربيةُ لا تمرُّ من هنا أصلًا.
 */

interface NamesEn {
  topics: Record<string, string>;
  babs: Record<string, string>;
  themes: string[];
}

let data: NamesEn | null = null;
let loading: Promise<void> | null = null;

export function loadNamesEn(): Promise<void> {
  if (data) return Promise.resolve();
  loading ??= fetch(`${import.meta.env.BASE_URL}names-en.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : { topics: {}, babs: {}, themes: [] }))
    .then((d: NamesEn) => { data = d; })
    .catch(() => { data = { topics: {}, babs: {}, themes: [] }; });
  return loading;
}

export const topicEn = (arName: string): string | null => data?.topics[arName] ?? null;
export const babEn = (arName: string): string | null => data?.babs[arName] ?? null;
export const themeEn = (idx: number): string | null => data?.themes[idx] ?? null;

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

// ─── البيانُ بالإنجليزية (bayan-en.json) والآياتُ الجامعة (kulliyat-curated-en) ──
interface BayanEn {
  cards: Record<string, { title: string; kashf: string; readings: string[] }>;
  sides: Record<string, string>;
  types: Record<string, string>;
}
let bayanEn: BayanEn | null = null;
let bayanLoading: Promise<void> | null = null;
export function loadBayanEn(): Promise<void> {
  if (bayanEn) return Promise.resolve();
  bayanLoading ??= fetch(`${import.meta.env.BASE_URL}bayan-en.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : { cards: {}, sides: {}, types: {} }))
    .then((d: BayanEn) => { bayanEn = d; })
    .catch(() => { bayanEn = { cards: {}, sides: {}, types: {} }; });
  return bayanLoading;
}
export const bayanCardEn = (id: string) => bayanEn?.cards[id] ?? null;
export const bayanSideEn = (name: string): string | null => bayanEn?.sides[name] ?? null;
export const bayanTypeEn = (key: string): string | null => bayanEn?.types[key] ?? null;

interface CuratedEn { babs: Record<string, string>; titles: Record<string, string> }
let curatedEn: CuratedEn | null = null;
let curatedLoading: Promise<void> | null = null;
export function loadCuratedEn(): Promise<void> {
  if (curatedEn) return Promise.resolve();
  curatedLoading ??= fetch(`${import.meta.env.BASE_URL}kulliyat-curated-en.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : { babs: {}, titles: {} }))
    .then((d: CuratedEn) => { curatedEn = d; })
    .catch(() => { curatedEn = { babs: {}, titles: {} }; });
  return curatedLoading;
}
export const curatedBabEn = (bab: string): string | null => curatedEn?.babs[bab] ?? null;
export const curatedTitleEn = (loc: string): string | null => curatedEn?.titles[loc] ?? null;

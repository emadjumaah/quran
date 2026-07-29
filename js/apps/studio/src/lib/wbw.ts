/**
 * كلمةً كلمةً — جسرُ القارئ غير العربيّ إلى ألفاظ التنزيل (2026-07-29):
 * لكلِّ كلمةٍ رسمُها بحروفٍ لاتينية (transliteration) ومعناها الإنجليزيّ، ملفًّا لكلِّ سورةٍ
 * (public/wbw/{s}.json) يُجلب عند أول حاجةٍ ويبقى — نمطُ الصوت نفسُه.
 * المصدر: Quran.com (بيانات QUL/مجمع الملك فهد) — منسوبٌ في «عن المشروع».
 */

export interface WbwEntry { translit: string; gloss: string }

type SuraWbw = Record<string, [string, string][]>;
const cache = new Map<number, SuraWbw>();
const loading = new Map<number, Promise<SuraWbw | null>>();

function loadSura(s: number): Promise<SuraWbw | null> {
  const hit = cache.get(s);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(s);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}wbw/${s}.json?v=${__DATA_VERSION__}`)
      .then((r) => (r.ok ? (r.json() as Promise<SuraWbw>) : null))
      .then((d) => {
        if (d) cache.set(s, d);
        return d;
      })
      .catch(() => null);
    loading.set(s, p);
  }
  return p;
}

/** رسمُ الكلمة بحروفٍ لاتينية ومعناها — من موضعها "s:a:w" */
export async function wbwOf(location: string): Promise<WbwEntry | null> {
  const [s, a, w] = location.split(":").map(Number);
  if (!s || !a || !w) return null;
  const sura = await loadSura(s);
  const row = sura?.[String(a)]?.[w - 1];
  return row ? { translit: row[0], gloss: row[1] } : null;
}

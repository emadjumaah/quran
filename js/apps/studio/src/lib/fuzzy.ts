/**
 * The ONE fuzzy matcher for on-page search. Every page filters its own visible
 * content through this: normalize away Qur'anic diacritics + letter variants,
 * then require each query token to appear somewhere in the item's text.
 *
 * تطبيعُ 2026-07-21 (أمر المالك): الناسُ تبحث بالإملاء المعتاد لا برسم المصحف،
 * وتخطئ في الهمزات كثيرًا («قارئ/قارء»، «سؤال/سوأل»، «شيء/شئ»). فنطوي ذلك على
 * الطرفين معًا — السؤالِ والنصِّ — والنصُّ المفهرَسُ عندنا إملائيٌّ أصلًا (textClean):
 *   • كلُّ صور الهمزة (أ إ آ ٱ ء ئ ؤ) ← ا  ·  ى ← ي  ·  ة ← ه
 *   • التشكيلُ والتطويلُ والألفُ الخنجريّة تُزال.
 *   • ولمن كتب «الرحمان» أو «هاذا» أو «داوود»: مفتاحُ هيكلٍ ثانٍ بلا ألفاتٍ ألبتّة.
 * الطيُّ متماثلٌ على الطرفين، فلا يجلب آيةً أجنبيّةً عن السؤال — إنما يجمع
 * صورَ الكلمة الواحدة.
 */

import { normalizeAr, stemAr } from "./arabicSearch";

/** التطبيعُ واحدٌ في المشروع كلِّه: محلِّلُ العربيّة (lib/arabicSearch). */
export const fuzzyNorm = (s: string): string => normalizeAr(s);

/**
 * true if EVERY whitespace token of `query` matches somewhere in the haystacks.
 * المطابقةُ على حدود الكلمات: الكلمةُ نفسُها أو كلمةٌ تبدأ بها أو بجذعِها — فمن
 * كتب «الصلاة» وجد «وبالصلاة»، ومن كتب «أكثرهم» وجد «فأكثرهم».
 */
export function fuzzyMatch(query: string, ...haystacks: (string | number | undefined | null)[]): boolean {
  const q = fuzzyNorm(query).trim();
  if (!q) return true;
  const words = fuzzyNorm(haystacks.filter((h) => h != null).join(" ")).split(" ");
  return q.split(/\s+/).every((tok) => {
    const st = stemAr(tok);
    return words.some((w) => w.includes(tok) || (st.length >= 3 && w.includes(st)));
  });
}

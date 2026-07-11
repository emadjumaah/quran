/**
 * The ONE fuzzy matcher for on-page search. Every page filters its own visible
 * content through this: normalize away Qur'anic diacritics + letter variants,
 * then require each query token to appear somewhere in the item's text. So the
 * reader sees a page and searches it immediately, diacritic-insensitively.
 */

// combining marks (U+064B–U+065F, U+0670, U+06D6–U+06ED) + tatweel — NOT letters
const MARKS = /[ً-ٰٟۖ-ۭـ]/g;

/** strip diacritics + unify letter shapes (أإآٱ→ا · ى→ي · ة→ه · ؤ→و · ئ→ي). */
export function fuzzyNorm(s: string): string {
  return (s || "")
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

/** true if EVERY whitespace token of `query` appears in the combined haystacks
 *  (normalized). Empty/blank query matches everything. */
export function fuzzyMatch(query: string, ...haystacks: (string | number | undefined | null)[]): boolean {
  const q = fuzzyNorm(query).trim();
  if (!q) return true;
  const hay = fuzzyNorm(haystacks.filter((h) => h != null).join(" "));
  return q.split(/\s+/).every((tok) => hay.includes(tok));
}

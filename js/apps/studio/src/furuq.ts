/**
 * فروق التنزيل v2 — the rebuilt diff engine's output (public/furuq.json, lazy).
 * Verse pairs from the full twins catalog (incl. the meaning-close tier),
 * lemma-aligned word by word: a same-lemma form change is ONE word in two
 * forms (["~", formA, formB]), not a delete+insert. Long verses are aligned
 * on their best matching window («المحاذاة الموضعية») with the rest folded
 * as context. Computed from the Qur'anic text + QAC morphology alone.
 * See findings/FURUQ.md for the engine's declared rules.
 */
import { useEffect, useState } from "react";

/** an alignment op: a shared word (string), a same-lemma form pair
 *  (["~", formA, formB]), or a word only in A (["-",w]) / only in B (["+",w]). */
export type Op = string | ["-" | "+", string] | ["~", string, string];

export interface Furq {
  a: string; // location "s:a" of the first verse
  b: string; // location "s:a" of the second verse
  tier: "exact" | "near" | "phrase" | "paraphrase";
  cat: string; // تطابق · تقديم وتأخير · اختلاف صيغة · إبدال · زيادة/نقص · فروق مركّبة · اشتمال
  eq: number; // lemma-agreement share of the aligned ops (closeness)
  morph?: 1; // فيه فرقُ صيغةٍ صرفية (نفس الـlemma أو الجذر)
  taq?: 1; // فيه لفظٌ منتقلُ الموضع (تقديمٌ وتأخير ضمن فروقٍ مركّبة)
  win?: { s: "a" | "b"; pre: number; post: number }; // windowed side + folded words
  ops: Op[];
}

export interface FuruqData {
  meta: { pairs: number; categories: Record<string, number>; engine?: string };
  furuq: Furq[];
}

/** display order + a short note for each category. */
export const CAT_INFO: Record<string, { note: string; en: string; label?: string }> = {
  "تطابق": { note: "الآيتان متطابقتان لفظًا", en: "word-identical" },
  "تقديم وتأخير": { note: "اللفظُ نفسه تقدّم في إحداهما وتأخّر في الأخرى", en: "reordering" },
  "اختلاف صيغة": { note: "الكلمةُ نفسها بصيغةٍ صرفيةٍ مختلفة", en: "same word, other form" },
  "إبدال": { note: "كلمةٌ مكان أخرى في الموضع نفسه", en: "substitution" },
  // internal id keeps its old key; shown to readers as «زيادة وإيجاز» (إيجاز, a
  // balāgha virtue — not «نقص», which is unfitting for the Qur'an).
  "زيادة/نقص": { note: "زيادةٌ في إحداهما وإيجازٌ في الأخرى", en: "addition / concision", label: "زيادة وإيجاز" },
  "فروق مركّبة": { note: "أكثرُ من نوع فرقٍ معًا في زوجٍ شديد القرب — ومنها أشهرُ أزواج كتب المتشابهات", en: "composite differences" },
  "اشتمال": { note: "الآيةُ الأطول تتضمّن الأقصر بنصّها", en: "containment" },
};
/** reader-facing label for a category id (defaults to the id itself) */
export const catLabel = (cat: string): string => CAT_INFO[cat]?.label ?? cat;
export const CAT_ORDER = ["تطابق", "تقديم وتأخير", "اختلاف صيغة", "إبدال", "زيادة/نقص", "فروق مركّبة", "اشتمال"];

let cache: FuruqData | null = null;
let loading: Promise<FuruqData> | null = null;

export function loadFuruq(): Promise<FuruqData> {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch(`${import.meta.env.BASE_URL}furuq.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`furuq: ${r.status}`))))
    .then((d: FuruqData) => (cache = d))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

export function useFuruq(): FuruqData | null {
  const [data, setData] = useState<FuruqData | null>(cache);
  useEffect(() => {
    let live = true;
    loadFuruq().then((d) => live && setData(d)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return data;
}

export interface Seg { text: string; diff: boolean; form?: boolean }
/** Reconstruct the two aligned word rows from the ops: each side's own words,
 *  with the ones unique to that side marked `diff`, and same-lemma form
 *  differences marked `form` on both sides. */
export function sides(ops: Op[]): { a: Seg[]; b: Seg[] } {
  const a: Seg[] = [];
  const b: Seg[] = [];
  for (const op of ops) {
    if (typeof op === "string") {
      a.push({ text: op, diff: false });
      b.push({ text: op, diff: false });
    } else if (op[0] === "~") {
      a.push({ text: op[1], diff: true, form: true });
      b.push({ text: op[2], diff: true, form: true });
    } else if (op[0] === "-") {
      a.push({ text: op[1], diff: true });
    } else {
      b.push({ text: op[1], diff: true });
    }
  }
  return { a, b };
}

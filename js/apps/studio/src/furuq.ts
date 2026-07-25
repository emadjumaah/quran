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

/**
 * الفروقُ الأوّليّة — تُقرأ من المحاذاة نفسِها لا من سلّةٍ مسبقة.
 *
 * كانت أكثرُ من نصف الأزواج (١٬١٢٢ من ٢٬٠١٩) تقع تحت «فروق مركّبة»، وهي ليست
 * نوعَ فرقٍ بل بقيّةُ ما زاد على نوعٍ واحد — فاسمٌ لا يخبر القارئ بشيء. فحُلَّت
 * السلّةُ إلى أنواعها: كلُّ زوجٍ يُسمّى بما فيه من فروقٍ مسمّاة («إبدالٌ
 * وزيادة»)، ويُطلب بأيِّ واحدٍ منها. الأزواجُ كما هي — التسميةُ وحدَها تغيّرت.
 */
export type Kind = "تقديم" | "صيغة" | "إبدال" | "زيادة";
export const KIND_ORDER: Kind[] = ["تقديم", "صيغة", "إبدال", "زيادة"];
export const KIND_INFO: Record<Kind, { note: string; en: string }> = {
  "تقديم": { note: "لفظٌ تقدّم في إحداهما وتأخّر في الأخرى", en: "a moved word" },
  "صيغة": { note: "الكلمةُ نفسها بصيغةٍ صرفيةٍ أخرى", en: "same word, other form" },
  "إبدال": { note: "كلمةٌ مكان أخرى في الموضع نفسه", en: "one word in another's place" },
  "زيادة": { note: "زيادةٌ في إحداهما وإيجازٌ في الأخرى", en: "addition / concision" },
};

/** الفروقُ الحاضرةُ في زوجٍ بعينه، مقروءةً من محاذاته */
export function kindsOf(f: Furq): Kind[] {
  const has = new Set<Kind>();
  if (f.taq === 1) has.add("تقديم");
  const ops = f.ops;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (typeof o === "string") continue;
    if (o[0] === "~") { has.add("صيغة"); continue; }
    if (o[0] === "-") {
      // كتلةُ حذفٍ تعقبها كتلةُ زيادةٍ = إبدالٌ بقدر الأقصر، وما فضل زيادةٌ أو إيجاز
      let d = 0;
      while (ops[i + d] && (ops[i + d] as string[])[0] === "-") d++;
      let g = 0;
      while (ops[i + d + g] && (ops[i + d + g] as string[])[0] === "+") g++;
      if (g > 0) has.add("إبدال");
      if (d !== g) has.add("زيادة");
      i += d + g - 1;
      continue;
    }
    has.add("زيادة"); // زيادةٌ لا حذفَ قبلها
  }
  return KIND_ORDER.filter((k) => has.has(k));
}

/** «إبدالٌ وزيادة» — اسمُ الزوج من فروقه، لا من سلّةٍ عامّة */
export function kindsLabel(kinds: Kind[]): string {
  if (!kinds.length) return "";
  return kinds.map((k, i) => (i < kinds.length - 1 ? `${k}ٌ` : k)).join(" و");
}

/** الاسمُ المعروضُ للزوج: البنيويّان باسمهما، وما سواهما بفروقه */
export function pairLabel(f: Furq): string {
  if (f.cat === "تطابق" || f.cat === "اشتمال") return catLabel(f.cat);
  return kindsLabel(kindsOf(f)) || catLabel(f.cat);
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

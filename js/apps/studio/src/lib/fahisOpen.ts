/**
 * المسارُ المفتوح في فاحص — من نثرٍ حرٍّ إلى بطاقة، والحسابُ في الوسط.
 *
 * ثلاثُ خطواتٍ لا تُختصر:
 *   ١) يصنّف النموذجُ الفكرةَ ويستخرج حقولَها (لفظًا وعددًا وموضعًا) — لا يعدّ.
 *   ٢) **يُشغَّل الحسابُ عندنا** بتلك الحقول: العدُّ بالصيغ، والمواضعُ، ومعدّلُ
 *      الصدفة، وما عند المراجع في الموضع أو المادّة.
 *   ٣) يُعطى النموذجُ **مخرَجَ الحساب وحدَه** فيصوغ البطاقة.
 *
 * فما في البطاقة من رقمٍ أو موضعٍ فمن حسابنا لا من ذاكرة نموذج — وهذا هو
 * الفرقُ بين فحصٍ وإجابةٍ معقولة.
 */
import { allAyahs, listWords, wordsByLemma, wordsByText } from "../db";
import { normalizeAr } from "./arabicSearch";
import { refsForAyah, refsForRoot } from "./refs";
import type { AyahDoc } from "../types";

export interface Classified {
  kind: string; word: string | null; word2: string | null;
  number: number | null; loc: string | null; why: string;
}
export interface Card { lines: string[]; verdict: string; limit: string; kind: string; evidence: string[]; why: string }

const post = async (body: unknown) => {
  const r = await fetch("/api/fahis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
};

/** عدُّ لفظٍ بصيغه، مفصَّلًا بالعدد الصرفيّ — نفسُ حساب قالب العدد */
async function countWord(raw: string) {
  const q = normalizeAr(raw).trim();
  if (!q) return null;
  const seed = await wordsByText(q).catch(() => []);
  const lemma = seed.find((w) => w.lemma)?.lemma ?? null;
  const all = lemma ? await wordsByLemma(lemma, 4000).catch(() => []) : seed;
  if (!all.length) return { q, total: 0, singular: 0, forms: [] as string[], ayat: [] as string[] };
  const forms = new Map<string, number>();
  const ayat = new Set<string>();
  let singular = 0;
  for (const w of all) {
    forms.set(w.textClean, (forms.get(w.textClean) ?? 0) + 1);
    ayat.add(`${w.surahNo}:${w.ayahNo}`);
    const n = w.segments?.find((g) => g.role === "stem")?.number;
    if (n !== "D" && n !== "P") singular++;
  }
  return {
    q, total: all.length, singular,
    forms: [...forms.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}=${n}`),
    ayat: [...ayat],
  };
}

/** كم لفظًا آخرَ في المصحف يرد بالعدد نفسِه — معدّلُ الصدفة */
let freqP: Promise<number[]> | null = null;
async function sameCount(total: number) {
  freqP ??= (async () => {
    const c = new Map<string, number>();
    for (let s = 1; s <= 114; s++) for (const w of await listWords(s).catch(() => [])) if (w.lemma) c.set(w.lemma, (c.get(w.lemma) ?? 0) + 1);
    return [...c.values()];
  })();
  const f = await freqP;
  return { same: Math.max(0, f.filter((x) => x === total).length - 1), of: f.length };
}

/** وجودُ عبارةٍ في المصحف — لقول سالبٍ شامل */
async function phraseHits(raw: string) {
  const q = normalizeAr(raw).trim();
  const rows: AyahDoc[] = await allAyahs();
  const hits = rows.filter((a) => ` ${normalizeAr(a.textClean || a.textUthmani)} `.includes(` ${q} `));
  return hits.map((h) => h.location);
}

/** يبني المعطى المحسوب ثمّ يطلب صياغةَ البطاقة */
export async function examineOpen(text: string): Promise<Card> {
  const c: Classified = await post({ mode: "classify", text });
  const ev: string[] = [];

  if (c.kind === "خارج") {
    return {
      kind: c.kind, evidence: [], why: c.why, lines: [],
      verdict: "خارجَ ما نملك أداتَه — فلا نقضي فيه",
      limit: "هذا البابُ (تاريخٌ أو فقهٌ أو عقيدة) ليس من أدوات فاحص، ولا يعني ذلك حكمًا على الفكرة لا بصحّةٍ ولا بخلافها.",
    };
  }

  if (c.word) {
    const m = await countWord(c.word);
    if (m) {
      ev.push(`اللفظ «${c.word}»: بصيغه كلِّها ${m.total} موضعًا في ${m.ayat.length} آية، والمفردُ منها ${m.singular}.`);
      if (m.forms.length) ev.push(`صيغُه بأعدادها: ${m.forms.join(" · ")}`);
      if (m.ayat.length) ev.push(`مواضعُه: ${m.ayat.slice(0, 30).join(" · ")}${m.ayat.length > 30 ? ` …و${m.ayat.length - 30} غيرُها` : ""}`);
      if (c.number !== null) ev.push(`العددُ المذكور في الفكرة: ${c.number}. والمحسوبُ عندنا: ${m.total} بالصيغ و${m.singular} للمفرد.`);
      if (m.total > 0) {
        const s = await sameCount(m.total);
        ev.push(`معدّلُ الصدفة: يشارك هذا اللفظَ في عدده ${s.same} لفظًا آخرَ من ${s.of}.`);
      }
      const lex = await refsForRoot(c.word).catch(() => []);
      for (const h of lex.slice(0, 3)) ev.push(`${h.book.label} (${h.book.author} ت${h.book.died}): ${h.texts.join(" ").slice(0, 420)}`);
    }
  }

  if (c.word2) {
    const m2 = await countWord(c.word2);
    if (m2) ev.push(`اللفظ الثاني «${c.word2}»: ${m2.total} موضعًا في ${m2.ayat.length} آية · صيغُه: ${m2.forms.slice(0, 12).join(" · ")}`);
  }

  if (c.kind === "كلية" && c.word) {
    const hits = await phraseHits(c.word);
    ev.push(hits.length
      ? `اختبارُ القول السالب: ورد «${c.word}» في ${hits.length} آية — أوّلُها ${hits[0]}. ويكفي في تقييد الكلّيّة موضعٌ واحد.`
      : `اختبارُ القول السالب: لم يرد «${c.word}» في المصحف بهذا الرسم في أيِّ موضع.`);
  }

  if (c.loc) {
    const refs = await refsForAyah(c.loc, { ranks: [1, 3, 5] }).catch(() => []);
    for (const h of refs.slice(0, 5)) ev.push(`[${c.loc}] ${h.book.label} (${h.book.author} ت${h.book.died} · الرتبة ${h.book.rank}): ${h.texts.join(" ").slice(0, 420)}`);
  }

  if (!ev.length) {
    return {
      kind: c.kind, evidence: [], why: c.why, lines: [],
      verdict: "لم يتبيّن — لم نجد في طبقاتنا ما يُبنى عليه",
      limit: "قد يكون اللفظُ مكتوبًا بصورةٍ أخرى، أو تكون الفكرةُ تحتاج صياغةً أدقَّ يُمكن اختبارُها.",
    };
  }

  const out = await post({ mode: "compose", claim: text, kind: c.kind, evidence: ev });
  return { ...out, kind: c.kind, evidence: ev, why: c.why };
}

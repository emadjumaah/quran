/**
 * مقطعُ التلاوة — بناؤه من قاعدة المصحف عندنا **لا من نصٍّ مكتوبٍ في الشيفرة**.
 *
 * قاعدةٌ حاكمة: **لا حرفَ قرآنٍ في هذا المشروع مكتوبًا بيدٍ داخل شيفرة.** كلُّ
 * ما يُعرض هنا يأتي من `words.textUthmani` في قاعدة التطبيق **حرفًا حرفًا بلا
 * تحويل** — لا تشكيلَ يُزاد ولا يُنقص، ولا رسمَ يُبدَّل. وعليه بوّابةٌ آليّةٌ
 * تفحص الوجهين: `js/scripts/check-tatabbu.mjs`.
 *
 * والمطبَّعُ (`norm`) يُحسب بمُطبِّع النصّ نفسِه الذي يمرّ به ما يخرج من
 * المحرّك — **مُطبِّعٌ واحدٌ على الطرفين**، وهو عقدُ بلاغ الحدود.
 *
 * **والاختيارُ على المصحف كلِّه** (ص-م٢ §١): بالسورة وبالجزء وبالصفحة ومن آيةٍ
 * إلى آية، وبالمصحف كلِّه للختمة. **والأداءُ شرطٌ لا زينة**: لا يُحمَّل المصحفُ
 * كلُّه في الذاكرة لأجل صفحةٍ واحدة — بل تُفتح **نافذةُ عملٍ** تُوسَّع مع تقدّم
 * القارئ (`SawtWindow`). والفهرسةُ الأولى مِن عِدّة السور لا من وثائق الآيات،
 * فلا يُقرأ من القاعدة إلّا ما يُتلى.
 */
import { listSurahs, wordsBetween } from "../../db";
import type { WordDoc } from "../../types";
import { normalizeAr } from "../arabicSearch";
import BOUNDS from "./mushaf-bounds.json";

/** كلمةٌ من المصحف في مسار التلاوة */
export interface SawtWord {
  /** موضعُها "سورة:آية:كلمة" */
  location: string;
  surahNo: number;
  ayahNo: number;
  /** رسمُها كما في قاعدتنا — لا يُمَسّ */
  text: string;
  /** صورتُها المطبَّعة — بها تقع المطابقة */
  norm: string;
  /** فهرسُ آيتها في `ayahs` */
  ayahIndex: number;
}

export interface SawtAyah {
  surahNo: number;
  ayahNo: number;
  /** فهرسُ أوّل كلماتها وآخرِها في `words` */
  from: number;
  to: number;
}

export interface SawtScript {
  id: string;
  title: string;
  /** الكلماتُ المحمَّلةُ إلى الآن — تنمو مع تقدّم القارئ */
  words: SawtWord[];
  /** الآياتُ المحمَّلةُ إلى الآن */
  ayahs: SawtAyah[];
  /** جملةُ آيات المقطع من موضع البدء إلى منتهاه (المحمَّلُ منها وما لم يُحمَّل) */
  totalAyahs: number;
}

/** إحالةُ آيةٍ — أخفُّ ما يُفهرس به المقطعُ قبل تحميل كلماته */
export interface AyahRef {
  surahNo: number;
  ayahNo: number;
  juz: number;
  page: number;
}

/**
 * تعريفُ مقطعٍ يُتلى — **المصحفُ كلُّه بأبوابه الخمسة**: سورٌ كاملة، أو صفحةٌ من
 * المصحف، أو جزء، أو مدًى من آيةٍ إلى آيةٍ في سورة، أو المصحفُ كلُّه.
 */
export type SegmentSpec =
  | { id: string; title: string; kind: "surahs"; surahs: number[] }
  | { id: string; title: string; kind: "page"; page: number }
  | { id: string; title: string; kind: "juz"; juz: number }
  | { id: string; title: string; kind: "range"; surahNo: number; from: number; to: number }
  | { id: string; title: string; kind: "mushaf" };

/**
 * **المقطعُ المختوم** لقياس المسبار (`findings/sawt/M1-MIHAKK.md` §٢) — مسمًّى
 * قبل الفحص كي لا يصير الاختيارُ بعد النتيجة انتقاءً. وفيه فخّا تشابهٍ مقصودان
 * (الكافرون والقدر) لأنّهما موضعُ انهيار نافذةِ المطابقة الساذجة.
 *
 * **ويبقى خيارًا مسمًّى «مقاطع المحكّ» ولا يُلغى** (ص-م٢ §١): فتُعاد تشغيلةُ
 * المحكّ كما خُتمت متى شئنا، ولا يصير المحكُّ المختومُ متعذَّرَ الإعادة.
 */
export const SEALED_SEGMENTS: SegmentSpec[] = [
  { id: "qisar", title: "القصار الثلاث — الكافرون والإخلاص والقدر", kind: "surahs", surahs: [109, 112, 97] },
  { id: "safha-42", title: "صفحة ٤٢ — البقرة ٢٥٣ إلى ٢٥٦", kind: "page", page: 42 },
];

/**
 * **شرطُ انتماء آيةٍ إلى مقطع — مُعرَّفٌ في موضعٍ واحدٍ لا غير.**
 *
 * وهو نفسُه الذي يُصفّي به التحميلُ الحيُّ ما يُجلب من القاعدة، **وهو نفسُه
 * الذي تُشغّله البوّابةُ** على آيات المصحف الستّ والثلاثين بعد المئتين وستّة
 * آلاف لتشهد أنّ الاختيار يبلغها كلَّها. فلا يُفحص شرطٌ غيرُ الذي يعمل.
 */
export function inSegment(spec: SegmentSpec, a: AyahRef): boolean {
  switch (spec.kind) {
    case "surahs":
      return spec.surahs.includes(a.surahNo);
    case "page":
      return a.page === spec.page;
    case "juz":
      return a.juz === spec.juz;
    case "range":
      return a.surahNo === spec.surahNo && a.ayahNo >= spec.from && a.ayahNo <= spec.to;
    case "mushaf":
      return true;
  }
}

/**
 * **خريطةُ حدود الصفحة والجزء** — أوّلُ آيةٍ من كلّ صفحةٍ ومن كلّ جزء، مولَّدةٌ
 * بخطوةِ بناءٍ حتميّةٍ (`js/scripts/build-mushaf-bounds.mjs`) ومحروسةٌ ببوّابة
 * التتبّع على الآيات كلِّها. **أرقامٌ لا نصّ** — أربعةُ آلافٍ من البايتات تُستورد
 * مع الحزمة فلا طلبَ شبكةٍ ولا انتظار.
 */
const BOUND_UNITS: Record<"page" | "juz", [number, number][]> = {
  page: BOUNDS.pages as [number, number][],
  juz: BOUNDS.juz as [number, number][],
};

/** آياتُ المصحف بترتيبه، مبنيّةً من عِدّة السور وحدَها (١١٤ صفًّا) */
async function mushafOrder(): Promise<{ surahNo: number; ayahNo: number }[]> {
  const surahs = await listSurahs();
  const out: { surahNo: number; ayahNo: number }[] = [];
  for (const s of surahs) for (let n = 1; n <= s.ayahCount; n++) out.push({ surahNo: s.surahNo, ayahNo: n });
  return out;
}

/**
 * فهرسةُ المقطع: إحالاتُ آياته بترتيب المصحف **بلا تحميل كلماتها**.
 *
 * **وكلُّها اليومَ تُفهرس من عِدّة السور** (١١٤ صفًّا) لا من وثائق الآيات — فلا
 * يُقرأ من القاعدة شيءٌ لا يُتلى. وكانت الصفحةُ والجزءُ يستدعيان آياتِهما لأنّ
 * حدَّهما ليس في عِدّة السور، **فكانا أبطأ من المصحف كلِّه** (٣٢٩ و٣٠١ مِث
 * مقابل ١٥٦ — قياسُ ص-م٢ §٥‑١)؛ فصار حدُّهما يُقرأ من الخريطة المحفوظة.
 */
export async function planSegment(spec: SegmentSpec): Promise<AyahRef[]> {
  if (spec.kind === "page" || spec.kind === "juz") {
    const n = spec.kind === "page" ? spec.page : spec.juz;
    const bounds = BOUND_UNITS[spec.kind];
    const first = bounds[n - 1];
    if (!first) return [];
    const next = bounds[n];
    const all = await mushafOrder();
    const at = (b: [number, number]) => all.findIndex((a) => a.surahNo === b[0] && a.ayahNo === b[1]);
    const from = at(first);
    if (from < 0) return [];
    const to = next ? at(next) : all.length;
    return all
      .slice(from, to < 0 ? all.length : to)
      .map((a) => ({ ...a, juz: spec.kind === "juz" ? n : 0, page: spec.kind === "page" ? n : 0 }));
  }
  const surahs = await listSurahs();
  const out: AyahRef[] = [];
  for (const s of surahs) {
    if (spec.kind === "surahs" && !spec.surahs.includes(s.surahNo)) continue;
    if (spec.kind === "range" && s.surahNo !== spec.surahNo) continue;
    for (let n = 1; n <= s.ayahCount; n++) {
      // الجزءُ والصفحةُ لا يدخلان شرطَ هذه الأنواع، فلا يُستدعيان لأجلها
      const ref: AyahRef = { surahNo: s.surahNo, ayahNo: n, juz: 0, page: 0 };
      if (inSegment(spec, ref)) out.push(ref);
    }
  }
  return out;
}

/**
 * بناءُ كلمات آيةٍ واحدة — دالّةٌ صافيةٌ يُعاد تشغيلُها في البوّابة بالحرف.
 * ولا تحويلَ على `textUthmani` البتّة: ما في القاعدة هو ما يُعرض.
 */
function pushAyah(script: SawtScript, norms: string[], ref: AyahRef, ws: WordDoc[]): void {
  const from = script.words.length;
  const ai = script.ayahs.length;
  for (const w of ws) {
    script.words.push({
      location: w.location,
      surahNo: ref.surahNo,
      ayahNo: ref.ayahNo,
      text: w.textUthmani,
      norm: normalizeAr(w.textUthmani),
      ayahIndex: ai,
    });
    norms.push(script.words[script.words.length - 1].norm);
  }
  script.ayahs.push({ surahNo: ref.surahNo, ayahNo: ref.ayahNo, from, to: script.words.length - 1 });
}

/** أطولُ مدًى متّصلٍ من سورةٍ واحدةٍ يُجلب باستدعاءٍ واحد */
const MAX_RUN_AYAHS = 60;

/**
 * **أتتّصل هذه الآيةُ بما قبلها في مدًى واحدٍ يُجلب باستدعاءٍ واحد؟**
 *
 * ولِمَ تُفرد هذه القاعدةُ باسمٍ وهي شرطٌ في حلقة؟ لأنّ استعلامَ النافذة يُقيَّد
 * **بسورةٍ واحدةٍ ومدًى من أرقام الآيات** — فلو ظُنّ الاتّصالُ عبر سورتين لجُلب
 * بعضُ المدى وسقط بعضُه، **فنقص من نصّ المقطع ما لا يُرى نقصُه**. وإفرادُها
 * يجعل البوّابةَ تُشغّل القاعدةَ الحيّةَ نفسَها لا نسخةً عنها.
 */
export function joinsRun(prev: AyahRef, next: AyahRef, taken: number): boolean {
  return next.surahNo === prev.surahNo && next.ayahNo === prev.ayahNo + 1 && taken < MAX_RUN_AYAHS;
}

/**
 * **نافذةُ العمل** — المقطعُ يُفتح من موضع البدء وينمو أمام القارئ.
 *
 * ولِمَ لا يُبنى المقطعُ كلُّه دَفعةً؟ لأنّ «المصحفَ كلَّه» صار مقطعًا مشروعًا
 * (الختمة)، وبناؤه دَفعةً يعني سبعةً وسبعين ألفَ كلمةٍ في الذاكرة لأجل صفحةٍ
 * تُقرأ — وذلك يُبطئ الإقلاعَ على الهاتف، **والأداءُ شرطٌ لا زينة**.
 *
 * والنموُّ **في مكانه**: تُدفع الكلماتُ في المصفوفة نفسِها التي يقرأ منها
 * محرّكُ المحاذاة وتُمسك بها المِسطرة — فلا تُنقض إشاراتٌ ولا يُعاد بناءُ ما
 * بُني، ولا يمسُّ ذلك عقدَ المحاذاة بحرف.
 */
export class SawtWindow {
  readonly script: SawtScript;
  /** الصورُ المطبَّعةُ بترتيب الكلمات — تنمو مع `script.words` في مكانها */
  readonly norms: string[] = [];
  private readonly refs: AyahRef[];
  private next = 0;

  constructor(id: string, title: string, refs: AyahRef[]) {
    this.refs = refs;
    this.script = { id, title, words: [], ayahs: [], totalAyahs: refs.length };
  }

  /** أبقيت آياتٌ لم تُحمَّل بعد؟ */
  get more(): boolean {
    return this.next < this.refs.length;
  }

  /**
   * وسِّع النافذةَ حتّى تبلغ الكلماتُ المحمَّلةُ هذا العدد (أو ينتهيَ المقطع).
   * وترجع `true` إن نمت — فتُعاد الصفحةُ رسمًا.
   */
  async grow(targetWords: number): Promise<boolean> {
    let grew = false;
    while (this.more && this.script.words.length < targetWords) {
      const start = this.next;
      const s = this.refs[start].surahNo;
      let end = start;
      while (end + 1 < this.refs.length && joinsRun(this.refs[end], this.refs[end + 1], end - start + 1)) {
        end++;
      }
      const ws = await wordsBetween(s, this.refs[start].ayahNo, this.refs[end].ayahNo);
      const byAyah = new Map<number, WordDoc[]>();
      for (const w of ws) {
        const arr = byAyah.get(w.ayahNo);
        if (arr) arr.push(w);
        else byAyah.set(w.ayahNo, [w]);
      }
      for (let i = start; i <= end; i++) {
        pushAyah(this.script, this.norms, this.refs[i], byAyah.get(this.refs[i].ayahNo) ?? []);
      }
      this.next = end + 1;
      grew = true;
    }
    return grew;
  }
}

/** كم كلمةً تُحمَّل قبل التلاوة، وبكم تُوسَّع النافذةُ كلّما اقترب المؤشّرُ من طرفها */
export const WINDOW_WORDS = 400;
/** إذا لم يبقَ أمام المؤشّر إلّا هذا القدرُ من الكلمات المحمَّلة، وُسّعت النافذة */
export const WINDOW_AHEAD = 200;

/* ═══════════ **نافذةُ العرض** — غيرُ نافذة التحميل (ص-م٦ §١/٢) ═══════════
   **المحمَّلُ شيءٌ والمرسومُ شيءٌ آخر.** كان المقطعُ المحمَّلُ كلُّه يُرسم دفعةً،
   فمن تلا في «المصحف كلِّه» شوطًا طويلًا نمت نافذةُ التحميل حتّى صارت آلافَ
   الكلمات، **ورُسمت كلُّها عناصرَ في شجرة العرض** — فيدفع ثمنَها في الذاكرة وفي
   زمن كلّ إطارٍ يُعاد رسمُه، وهو بلاغُ المالك ١٥ أغسطس («يستهلك ذاكرةً ووقتًا»).
   **فصار المرسومُ نافذةً حول المؤشّر** تنمو بالتمرير كما ينمو التحميل، **ولها
   سقفٌ معلَنٌ لا تتجاوزه** — تقرؤه البوّابةُ من ههنا لا من رقمٍ ثانٍ يشيخ. */

/** كم كلمةً تُرسم خلف المؤشّر في نافذة العرض */
export const RENDER_BEHIND = 300;
/** وكم تُرسم أمامه — أوسعُ خلفًا لأنّ القراءةَ إلى أمام */
export const RENDER_AHEAD = 700;
/** بكم تُوسَّع نافذةُ العرض كلّما بلغ التمريرُ طرفَها */
export const RENDER_STEP = 400;
/** **السقفُ المعلَن**: لا يُرسم في وقتٍ واحدٍ أكثرُ من هذا العدد من الكلمات */
export const RENDER_MAX_WORDS = 1600;
/** إذا اقترب المؤشّرُ من طرف المرسوم بهذا القدر، أُعيد توسيطُ النافذة عليه */
export const RENDER_EDGE = 120;

/**
 * فتحُ مقطعٍ للتلاوة من موضعٍ فيه: يُفهرس المقطعُ، ثمّ تُقصّ آياتُه إلى ما بدأ
 * منه القارئ، ثمّ تُحمَّل نافذةُ العمل الأولى وحدَها.
 */
export async function openSegment(
  spec: SegmentSpec,
  fromLocation?: string | null,
): Promise<{ win: SawtWindow; startWord: number }> {
  const refs = await planSegment(spec);
  let cut = 0;
  let wordNo = 0;
  if (fromLocation) {
    const [s, a, w] = fromLocation.split(":").map(Number);
    const at = refs.findIndex((r) => r.surahNo === s && r.ayahNo === a);
    if (at >= 0) {
      cut = at;
      wordNo = Number.isFinite(w) ? Math.max(0, w - 1) : 0;
    }
  }
  const win = new SawtWindow(spec.id, spec.title, refs.slice(cut));
  await win.grow(WINDOW_WORDS);
  const startWord = Math.min(wordNo, Math.max(0, win.script.words.length - 1));
  return { win, startWord };
}

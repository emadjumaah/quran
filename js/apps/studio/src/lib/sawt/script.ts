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
 */
import { allAyahs, listAyahs, listWords } from "../../db";
import type { AyahDoc, WordDoc } from "../../types";
import { normalizeAr } from "../arabicSearch";

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
  words: SawtWord[];
  ayahs: SawtAyah[];
}

/** تعريفُ مقطعٍ يُتلى: إمّا سورٌ كاملة، وإمّا صفحةٌ من المصحف */
export type SegmentSpec =
  | { id: string; title: string; kind: "surahs"; surahs: number[] }
  | { id: string; title: string; kind: "page"; page: number };

/**
 * **المقطعُ المختوم** لقياس المسبار (`findings/sawt/M1-MIHAKK.md` §٢) — مسمًّى
 * قبل الفحص كي لا يصير الاختيارُ بعد النتيجة انتقاءً. وفيه فخّا تشابهٍ مقصودان
 * (الكافرون والقدر) لأنّهما موضعُ انهيار نافذةِ المطابقة الساذجة.
 */
export const SEALED_SEGMENTS: SegmentSpec[] = [
  { id: "qisar", title: "القصار الثلاث — الكافرون والإخلاص والقدر", kind: "surahs", surahs: [109, 112, 97] },
  { id: "safha-42", title: "صفحة ٤٢ — البقرة ٢٥٣ إلى ٢٥٦", kind: "page", page: 42 },
];

/**
 * بناءُ المقطع من وثائق القاعدة — دالّةٌ صافيةٌ تُفحص بيدٍ وتُعاد في البوّابة
 * بالحرف. ولا تحويلَ على `textUthmani` البتّة: ما في القاعدة هو ما يُعرض.
 */
export function buildScript(
  id: string,
  title: string,
  ayahs: AyahDoc[],
  wordsByAyah: Map<string, WordDoc[]>,
): SawtScript {
  const words: SawtWord[] = [];
  const outAyahs: SawtAyah[] = [];
  ayahs.forEach((a, ai) => {
    const ws = (wordsByAyah.get(a.location) ?? []).slice().sort((x, y) => x.wordNo - y.wordNo);
    const from = words.length;
    for (const w of ws) {
      words.push({
        location: w.location,
        surahNo: a.surahNo,
        ayahNo: a.ayahNo,
        text: w.textUthmani,
        norm: normalizeAr(w.textUthmani),
        ayahIndex: ai,
      });
    }
    outAyahs.push({ surahNo: a.surahNo, ayahNo: a.ayahNo, from, to: words.length - 1 });
  });
  return { id, title, words, ayahs: outAyahs };
}

/** تحميلُ مقطعٍ من القاعدة (سورٌ كاملةٌ أو صفحةٌ من المصحف) */
export async function loadSegment(spec: SegmentSpec): Promise<SawtScript> {
  let ayahs: AyahDoc[];
  if (spec.kind === "surahs") {
    const lists = await Promise.all(spec.surahs.map((s) => listAyahs(s)));
    ayahs = lists.flat();
  } else {
    const all = await allAyahs();
    ayahs = all
      .filter((a) => a.page === spec.page)
      .sort((x, y) => x.surahNo - y.surahNo || x.ayahNo - y.ayahNo);
  }
  const surahs = [...new Set(ayahs.map((a) => a.surahNo))];
  const wordLists = await Promise.all(surahs.map((s) => listWords(s)));
  const byAyah = new Map<string, WordDoc[]>();
  for (const w of wordLists.flat()) {
    const key = `${w.surahNo}:${w.ayahNo}`;
    const arr = byAyah.get(key);
    if (arr) arr.push(w);
    else byAyah.set(key, [w]);
  }
  return buildScript(spec.id, spec.title, ayahs, byAyah);
}

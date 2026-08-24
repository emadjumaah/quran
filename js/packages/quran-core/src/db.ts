/**
 * **منفذُ نصِّ المصحف** — من أين يأخذ المسبارُ آياتِه وكلماتِه.
 *
 * شيفرةُ التتبّع لا تفتح قاعدةً ولا تعرف كيف تُخزَّن؛ إنّما تطلب ثلاثةَ أشياء:
 * آياتِ المصحف، وأسماءَ السور، وكلماتِ مدًى من آياتٍ متتالية. وكان مصدرُها في
 * مشكاة `src/db.ts` (monlite على WASM)، فلمّا صارت الشيفرةُ مشتركةً بين
 * التطبيقين (ف١) **بقي المطلوبُ كما هو وتبدّل مَن يسدّه**: كلُّ تطبيقٍ يُسجّل
 * قاعدتَه مرّةً عند إقلاعه، والمسبارُ يستدعي الدوالَّ نفسَها بأسمائها لا يتبدّل
 * فيه حرف.
 *
 * ولو استُدعي قبل التسجيل صاح ولم يُرجع فراغًا — فالصمتُ ههنا يُري القارئَ
 * مصحفًا ناقصًا ولا يُخبره.
 */
import type { AyahDoc, SurahDoc, WordDoc } from "./types";

/** ما يلزم المسبارَ من قاعدة التطبيق — لا أكثر */
export interface QuranTextSource {
  /** آياتُ المصحف كلُّها بترتيبه */
  allAyahs(): Promise<AyahDoc[]>;
  /** سورُ المصحف بترتيبها */
  listSurahs(): Promise<SurahDoc[]>;
  /** مفرداتُ آياتٍ متتاليةٍ من سورةٍ واحدة — نافذةُ التحميل لا السورةُ كلُّها */
  wordsBetween(surahNo: number, fromAyah: number, toAyah: number): Promise<WordDoc[]>;
}

let source: QuranTextSource | null = null;

/** يُسجّله التطبيقُ المستهلكُ مرّةً واحدةً عند إقلاعه */
export function provideQuranText(s: QuranTextSource): void {
  source = s;
}

const need = (): QuranTextSource => {
  if (!source) {
    throw new Error(
      "منفذُ نصِّ المصحف لم يُسجَّل — على التطبيق أن يستدعي provideQuranText قبل التتبّع",
    );
  }
  return source;
};

export const allAyahs = (): Promise<AyahDoc[]> => need().allAyahs();

export const listSurahs = (): Promise<SurahDoc[]> => need().listSurahs();

export const wordsBetween = (
  surahNo: number,
  fromAyah: number,
  toAyah: number,
): Promise<WordDoc[]> => need().wordsBetween(surahNo, fromAyah, toAyah);

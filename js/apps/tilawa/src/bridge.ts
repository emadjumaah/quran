/**
 * **الجسرُ بين التطبيقين** — بابٌ يُدخل منه وبابٌ يُخرج منه (خارطةُ المخرج §الجسر).
 *
 * «كلٌّ يحيل على الآخر عند حدِّه، ولا يبتلع أحدُهما الآخر»: فمن بلغ في التلاوة
 * آيةً وأراد أن يتدبّرها ويبحث فيها ذهب إلى مشكاة **عند تلك الآية بعينها**، ومن
 * كان في مشكاة وأراد أن يتلوَ جاء إلى التلاوة عند موضعه. ولا يُنقل بين
 * التطبيقين شيءٌ غيرُ **الموضع**: لا حالٌ ولا سجلٌّ ولا أثرُ قارئ.
 *
 * ## الحارس
 * **ولا يُعرض زرٌّ ميّت**: النطاقان يُعلَنان ههنا بعلمَي بيئةٍ يُقلبان عند
 * الإطلاق، فما لم يقم نطاقُه لم يُعرض بابُه أصلًا. ونطاقُ مشكاة **قائمٌ حيًّا**
 * (`quran.mishkat.qa`) فعلمُه مرفوعٌ بالافتراض، ويُطوى بـ`VITE_MISHKAT_LIVE=0`.
 */
import { AYAH_COUNTS, globalIdOf } from "@mishkat/quran-core";

/** مشكاةُ القرآن — المرجعُ الحاسوبيُّ للمصحف على نطاقه المقرَّر */
export const MISHKAT_BASE = "https://quran.mishkat.qa";

/** أقائمٌ نطاقُ مشكاة؟ — مرفوعٌ بالافتراض، ويُطوى بعلم بيئةٍ عند الحاجة */
export const MISHKAT_LIVE = import.meta.env.VITE_MISHKAT_LIVE !== "0";

/** رابطُ آيةٍ بعينها في مشكاة — `quran.mishkat.qa/#/read/{سورة}/{آية}` */
export const mishkatAyah = (surahNo: number, ayahNo: number): string =>
  `${MISHKAT_BASE}/#/read/${surahNo}/${ayahNo}`;

/**
 * **البابُ الداخل** — `tilawa.mishkat.qa/#/{سورة}/{آية}`: يُقرأ مرّةً عند
 * الفتح فيُفتح المصحفُ عليه، **ثمّ يُمحى من شريط العنوان**. وعلّةُ محوه أنّه
 * **بابٌ لا حال**: من دخل منه ثمّ قرأ ساعةً فأنعش الصفحةَ لم يُرمَ به إلى حيث
 * دخل، بل إلى حيث انتهى. (وميثاقُ الوجه §١/١٢: لا عنوانَ مسارٍ ظاهرًا للقارئ.)
 *
 * ويُقبل `#/{سورة}` وحدَها فيُفتح على مطلعها. وما خرج عن حدود المصحف يُهمَل.
 */
export function readDeepLink(): number | null {
  const m = /^#\/(\d{1,3})(?:\/(\d{1,3}))?\/?$/.exec(location.hash);
  if (!m) return null;
  const surahNo = Number(m[1]);
  const ayahNo = m[2] ? Number(m[2]) : 1;
  if (surahNo < 1 || surahNo > 114) return null;
  if (ayahNo < 1 || ayahNo > AYAH_COUNTS[surahNo - 1]) return null;
  return globalIdOf(surahNo, ayahNo);
}

/** يُمحى الهاشُ بعد أن يُعمل به — ولا يُقيَّد في التاريخ فيرجع إليه زرُّ الرجوع */
export function clearDeepLink(): void {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

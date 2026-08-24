/**
 * **علامةُ الانقطاع** — كي لا يُترك القارئُ مع صمتٍ بلا اسم (ص٤ §٣).
 *
 * بلاغُ المالك من هاتفه: «لم يصل صوت»، ومعه شاشةُ سفاري «A problem repeatedly
 * occurred». وهما — بحسب الظاهر — **واحدٌ**: المتصفّحُ يقتل صفحةً ضاقت ذاكرتُها
 * بالمحرّك المحلّيّ ثمّ يعيد تحميلها، **فيموت السمعُ مع الصفحة** ويقف القارئُ
 * أمام سطرٍ يقول له «أطفئ قياسَ الزمن» — **وهو دواءٌ لعلّةٍ أخرى**.
 *
 * فتُكتب ههنا علامةٌ **حين تذهب الصفحةُ ونحن نتتبّع** (`pagehide` غيرُ مقصود)
 * أو حين يعطب عاملُ التعرّف، **ثمّ تُقرأ في التحميل التالي** فيقول السطرُ سببَه
 * المقيس. وقيودُها ثلاثة:
 *
 *   • **في `sessionStorage` لا في القرص** — أثرُ جلسةٍ لا سجلَّ يبقى على الجهاز؛
 *   • **ولها عمرٌ معلَن** — فما بعُد لا يُحتجّ به على صمتٍ اليومَ؛
 *   • **ولا يُدَّعى ما لم يُقَس**: العلامةُ تقول *أنّ الجلسة انقطعت* لا *أنّ
 *     الذاكرة هي السبب قطعًا* — والنصُّ المعروض يُصاغ على ذلك.
 */

const CUT_KEY = "sawt.cut.v1";

/** كم يبقى أثرُ الانقطاع صالحًا للاحتجاج به (مِث) — خمسُ دقائق */
export const CUT_FRESH_MS = 5 * 60 * 1000;

/** أين وقع الانقطاع: ذهبت الصفحةُ ونحن نتتبّع · أو عطِب عاملُ التعرّف */
export type CutWhy = "page" | "worker";

export interface Cut {
  why: CutWhy;
  /** طابعُ الزمن حين وقع */
  at: number;
  /** أيُّ محرّكٍ كان يعمل حينئذٍ — فالعلاجُ يتبع المحرّك */
  engine: string | null;
}

export function noteCut(why: CutWhy, engine: string | null): void {
  try {
    sessionStorage.setItem(CUT_KEY, JSON.stringify({ why, at: Date.now(), engine }));
  } catch {
    /* قد يمنع الجهازُ التخزين — ولا يُبطل ذلك شيئًا */
  }
}

/** يُقرأ ما كُتب إن كان قريبًا — وما تقادم يُمحى ولا يُحتجّ به */
export function readCut(): Cut | null {
  try {
    const raw = sessionStorage.getItem(CUT_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cut;
    if (typeof c?.at !== "number" || Date.now() - c.at > CUT_FRESH_MS) {
      sessionStorage.removeItem(CUT_KEY);
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

export function clearCut(): void {
  try {
    sessionStorage.removeItem(CUT_KEY);
  } catch {
    /* لا شيء */
  }
}

/**
 * **أأُعيد تحميلُ الصفحة أم فُتحت فتحًا؟** — يُقرأ من المنصّة ولا يُخمَّن.
 * (والقديمُ `performance.navigation` مهجورٌ، وهذا نظيرُه القائم.)
 */
export function pageWasReloaded(): boolean {
  try {
    const e = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return e?.type === "reload";
  } catch {
    return false;
  }
}

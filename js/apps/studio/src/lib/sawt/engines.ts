/**
 * **المحرّكان** — وصفٌ واحدٌ لكلٍّ، ومنه تُكتب كلُّ كلمةٍ تُعرض للقارئ.
 *
 * القاعدةُ التي بُني عليها هذا الملفّ: **سطرُ الصدق يُكتب مع المحرّك لا مع
 * الصفحة**. فعبارةُ «صوتُك لا يغادر جهازك» لا تصحّ إلّا للمحرّك الذي يعمل على
 * الجهاز؛ ولو كُتبت في الصفحة عامّةً لصارت كذبًا في نصف الأحوال. فههنا لكلّ
 * محرّكٍ سطرُه، والصفحةُ تعرض سطرَ المحرّك المختار لا غير — **وبوّابةُ التتبّع
 * تحرس ذلك بضبطٍ سالب**: تُزرع العبارةُ في وصف المحرّك الشبكيّ فتُصطاد.
 *
 * ولا لغةَ أدواتٍ في شيءٍ ممّا يُعرض: لا اسمَ نموذجٍ ولا مزوّدٍ ولا مكتبة.
 */

export type EngineId = "browser-speech" | "on-device";

export interface EngineDescriptor {
  id: EngineId;
  /** اسمُه كما يُعرض — بلسان القارئ */
  label: string;
  /** أيقعُ التعرّفُ على الجهاز وحدَه؟ */
  onDevice: boolean;
  /** **سطرُ الصدق** — يُعرض قبل الميكروفون، ولا يُكتب مثلُه في الصفحة */
  privacyLine: string;
  /** ما يجيء به من نفعٍ — سطرٌ واحد */
  benefit: string;
  /** ما يكلّفه — سطرٌ واحد، ولا يُخفى */
  cost: string;
  /** تنزيلٌ أوّلَ مرّةٍ (م.ب على السلك) — صفرٌ إن لم يكن */
  downloadMb: number;
  /** أيصلح لوضع الصلاة؟ (لا يصحّ إلّا لمن لا يُخرج الصوت) */
  fitsSalat: boolean;
}

/**
 * **الأحجامُ مقيسةٌ لا مقدَّرة** (ص-م٣ §٣): ملفّا النموذج ٩١٫٣٤ م.ب على القرص،
 * و**٨٣٫٤١ م.ب على السلك** بضغط brotli — وهو الرقمُ الذي يُعرض للقارئ لأنّه ما
 * ينزل في شبكته. ويُنزَّل **مرّةً واحدةً ويبقى**.
 */
export const ON_DEVICE_WIRE_MB = 83;

export const ENGINES: EngineDescriptor[] = [
  {
    id: "on-device",
    label: "على جهازك",
    privacyLine: "صوتُك لا يغادر جهازك — التعرّفُ يقع على جهازك وحدَه، ويعمل بلا إنترنت.",
    benefit: "يعمل بلا اتّصال، ويُفتح به وضعُ الصلاة",
    cost: `يُنزَّل مرّةً واحدةً (${ON_DEVICE_WIRE_MB} م.ب) ثمّ يبقى · والمؤشّرُ يتأخّر ثوانيَ يسيرةً عن صوتك`,
    onDevice: true,
    downloadMb: ON_DEVICE_WIRE_MB,
    fitsSalat: true,
  },
  {
    id: "browser-speech",
    label: "عبر خدمة المتصفّح",
    privacyLine: "يرسل صوتَك إلى خادم صانع المتصفّح ليتعرّف عليه — فهو يخرج من جهازك.",
    benefit: "جاهزٌ في الحال بلا تنزيل، والمؤشّرُ أسرعُ لحاقًا",
    cost: "يحتاج اتّصالًا، ولا يُفتح به وضعُ الصلاة",
    onDevice: false,
    downloadMb: 0,
    fitsSalat: false,
  },
];

export const findEngine = (id: string): EngineDescriptor =>
  ENGINES.find((e) => e.id === id) ?? ENGINES[1];

const ENGINE_KEY = "sawt.engine.v1";

/**
 * **لا افتراضَ خفيّ.** لا يُختار عن القارئ محرّكٌ يُخرج صوتَه ولا محرّكٌ يُنزّل
 * ٨٣ م.ب من شبكته — بل **يُسأل مرّةً واحدةً ويُحفظ جوابُه** (بند البرومبت §٤-٢).
 * فما دام لم يجب، هذه الدالّةُ تُرجع `null` والصفحةُ تسأل.
 */
export function readEngineChoice(): EngineId | null {
  try {
    const raw = localStorage.getItem(ENGINE_KEY);
    return ENGINES.some((e) => e.id === raw) ? (raw as EngineId) : null;
  } catch {
    return null;
  }
}

export function saveEngineChoice(id: EngineId): void {
  try {
    localStorage.setItem(ENGINE_KEY, id);
  } catch {
    /* الجهازُ قد يمنع التخزين */
  }
}

export function clearEngineChoice(): void {
  try {
    localStorage.removeItem(ENGINE_KEY);
  } catch {
    /* لا شيء */
  }
}

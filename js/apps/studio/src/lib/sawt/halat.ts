/**
 * **الحالاتُ** — سمّاها المالكُ بهذا الاسم (ص-م٢ §٢).
 *
 * بدل مفاتيحَ متقاطعةٍ يجمعها القارئُ بنفسه، **حالٌ واحدةٌ تُختار باسمها فتضبط
 * ما تحتها**: أيظهر النصُّ أم ينكشف بالتلاوة؟ وأيكون بعد الختام شيءٌ أم صمت؟
 * ومن أين يبدأ؟ وبأيِّ خطٍّ يُقرأ؟
 *
 * **وتُعرض كلُّ ما عندنا وإن زادت على أربع — بما فيها الموقوفُ باسمه وسببِ
 * وقفه** (أمرُ المالك)، فلا يُظنّ نسيانًا ولا يُوهَم أنّه ليس في الحسبان.
 * والسببُ يُكتب **بلسان القارئ لا بلغة الأدوات**: لا اسمَ خدمةٍ ولا مزوّدٍ ولا
 * مسارَ ملفٍّ ولا اسمَ جلسة.
 *
 * ووقفُ «التلقين» **على رفع التلاوة لا على قرارها** — فالمستودعُ محسومٌ بأمر
 * المالك، وإنّما لم تُرفع التلاوةُ بعد.
 */

export type HalId = "salat" | "murajaa" | "tathbit" | "khatma" | "ard" | "talqin";

export interface Hal {
  id: HalId;
  /** اسمُها الذي تُختار به */
  name: string;
  /** ما تضبطه — يُعرض عند اختيارها لا دائمًا */
  what: string;
  /** النصُّ: ظاهرٌ كلُّه، أو محجوبٌ ينكشف بالتلاوة */
  text: "shown" | "veiled";
  /** ما بعد الختام: صمتٌ تامّ · مواضعُ للنظر · موضعٌ بلغتَه */
  after: "silent" | "places" | "mark";
  /** تبدأ من آخر موضعٍ محفوظٍ من تلقائها */
  resumes?: boolean;
  /** خطٌّ أكبر يُقرأ من بُعد */
  bigger?: boolean;
  /** سببُ الوقف — فإن كان فالحالُ موقوفةٌ معلنةٌ لا مخفيّة */
  suspended?: string;
}

export const HALAT: Hal[] = [
  {
    id: "salat",
    name: "الصلاة",
    what: "النصُّ ظاهر · وصمتٌ تامّ: لا تصحيحَ ولا أرقامَ ولا شيءَ بعد الختام · خطٌّ أكبر · الشاشةُ تبقى مضاءة · ولا تمريرَ مفاجئ",
    text: "shown",
    after: "silent",
    bigger: true,
  },
  {
    id: "murajaa",
    name: "المراجعة",
    what: "النصُّ ظاهر · وبعد الختام مواضعُ للنظر",
    text: "shown",
    after: "places",
  },
  {
    id: "tathbit",
    name: "التثبيت",
    what: "النصُّ محجوبٌ ينكشف بالتلاوة، وما بعده يبقى محجوبًا · وبعد الختام مواضعُ للنظر",
    text: "veiled",
    after: "places",
  },
  {
    id: "khatma",
    name: "الختمة",
    what: "النصُّ ظاهر · يستأنف من آخر موضعٍ بلغتَه تلقائيًّا، ويسجّل ما بلغتَه — سجلُّ موضعٍ لا غير: لا سلاسلَ ولا نقاطٍ ولا شارات",
    text: "shown",
    after: "mark",
    resumes: true,
  },
  {
    id: "ard",
    name: "العَرْض",
    what: "التجويد: أن يُعرض على الآلة مقدارُ المدّ والغنّة",
    text: "shown",
    after: "places",
    suspended: "مقاديرُ المدّ تنتظر ثبوتَ رخصة مرجعها وعرضَها على مختصٍّ في التجويد",
  },
  {
    id: "talqin",
    name: "التلقين",
    what: "أن تتابع تلاوةَ قارئٍ محقَّق",
    text: "shown",
    after: "places",
    suspended: "تنتظر رفعَ التلاوة — والوقفُ على رفعها لا على قرارها",
  },
];

export const findHal = (id: string): Hal => HALAT.find((h) => h.id === id) ?? HALAT[1];
/** الحالاتُ التي تُتلى بها اليوم */
export const liveHalat = (): Hal[] => HALAT.filter((h) => !h.suspended);

const HAL_KEY = "sawt.hal.v1";
const CONSENT_KEY = "sawt.consent.v1";
const DECLARED_KEY = "sawt.declared.v1";

/** والاختيارُ يُحفظ فتُفتح الصفحةُ على آخر حالٍ استُعملت */
export function readHal(): HalId {
  try {
    const raw = localStorage.getItem(HAL_KEY);
    const h = HALAT.find((x) => x.id === raw);
    if (h && !h.suspended) return h.id;
  } catch {
    /* الجهازُ قد يمنع التخزين */
  }
  return "murajaa";
}

export function saveHal(id: HalId): void {
  try {
    localStorage.setItem(HAL_KEY, id);
  } catch {
    /* لا شيء */
  }
}

/**
 * **الموافقةُ على أنّ الصوتَ يخرج من الجهاز.**
 *
 * محرّكُ اليوم هو محرّكُ المتصفّح، **وهو يرسل الصوتَ إلى خادم صانعه**. وقد صار
 * البابُ مرئيًّا لكلّ زائرٍ في الرأس — فلا يُشغَّل ميكروفونٌ حتّى يُعلَن هذا
 * إعلانًا ظاهرًا ويُؤذَن به إذنًا صريحًا **مرّةً واحدةً تُحفظ في الجهاز
 * ويمكن سحبُها من الصفحة نفسِها**.
 */
export interface SawtConsent {
  at: string;
  /** المحرّكُ الذي أُذن له — فإن بُدّل المحرّكُ لم يُورَث الإذنُ له */
  engine: string;
}

/**
 * **والإذنُ لمحرّكٍ بعينه لا للصفحة.** صار عندنا محرّكان يختلف حالُ الصوت
 * فيهما اختلافًا جوهريًّا، فمن أذِن لمحرّكٍ يُخرج صوتَه **لا يُورَّث إذنُه**
 * لغيره ولا العكس — يُسأل لكلٍّ مرّةً واحدة.
 */
export function readConsent(engine: string): SawtConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as SawtConsent;
    return c && c.engine === engine ? c : null;
  } catch {
    return null;
  }
}

export function saveConsent(engine: string): void {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ at: new Date().toISOString(), engine } satisfies SawtConsent),
    );
  } catch {
    /* لا شيء */
  }
}

export function clearConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(DECLARED_KEY);
  } catch {
    /* لا شيء */
  }
}

/**
 * **والإعلانُ يُعاد في كلِّ حال.** الموافقةُ مرّةٌ واحدة، أمّا الإعلانُ فيُعرض
 * قبل أوّل تشغيلٍ للميكروفون **في كلِّ حالٍ على حدة** — فمن أذِن وهو يراجع لم
 * يُذكَّر بأنّ صوتَه يخرج من الجهاز وهو يدخل «الصلاة»، وهناك أحوجُ ما يكون
 * إلى العلم به.
 */
export function declaredIn(): HalId[] {
  try {
    const raw = localStorage.getItem(DECLARED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return arr.filter((x): x is HalId => HALAT.some((h) => h.id === x));
  } catch {
    return [];
  }
}

export function noteDeclared(id: HalId): void {
  try {
    localStorage.setItem(DECLARED_KEY, JSON.stringify([...new Set([...declaredIn(), id])]));
  } catch {
    /* لا شيء */
  }
}

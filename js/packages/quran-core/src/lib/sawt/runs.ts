/**
 * دفترُ المسبار في الجهاز: **مصفوفةُ الأحوال** و**علامةُ آخر موضع**.
 *
 * ١) **مصفوفةُ الأحوال** (`findings/sawt/M1-MULHAQ-IDARA.md` §٢): سأل المالك:
 *    أيصلح هذا لقراءةٍ عاديّةٍ من شخصٍ عاديّ لا تلاوةٍ منضبطة؟ وللصلاة أو
 *    للقراءة جهرًا؟ — ولا يجيبه إلّا القياسُ خانةً خانة. فتُحفظ نتيجةُ كلِّ
 *    تشغيلةٍ هنا لتُقرأ جدولًا واحدًا في مجلسٍ واحد. **وحكمُ العبور على حال
 *    الأساس وحدَها**؛ وما سواها يُقيَّد حدًّا للباب لا إسقاطًا للمحكّ.
 *
 * ٢) **علامةُ آخر موضع** (§٤): موضعٌ وتاريخُه **لا غير** — بذرةُ «الختمة
 *    بالصوت»: يعرف المصحفُ أين بلغتَ بلا علامةٍ يدويّة. **سجلُّ موضعٍ لا لعبةَ
 *    مواظبة**: لا سلاسلَ ولا نقاطٍ ولا شاراتٍ ولا عددَ أيّام — فتلك تُنتج
 *    مواظبةً لا رسوخًا (`SAWT-PLAN.md` §٤).
 *
 * ولا يخرج شيءٌ من هذا الجهاز: تخزينٌ محلّيٌّ لا غير.
 */
import type { SawtReport } from "./metrics";

const RUNS_KEY = "sawt.runs.v1";
const MARK_KEY = "sawt.mark.v1";

/** خاناتُ مصفوفة الأحوال — الأساسُ أوّلًا، ثمّ ما زادته الإدارة */
export const CONDITIONS: { id: string; name: string; note: string; priority?: boolean }[] = [
  { id: "asas", name: "حالُ الأساس", note: "قراءتُك المعتادة · جهرًا بيّنًا · الهاتفُ قريب · محيطٌ هادئ — وعليها وحدَها حكمُ العبور" },
  { id: "aadiya", name: "قراءةٌ عاديّة", note: "بلا ضبطِ تجويد — كما يقرأ عامّةُ الناس", priority: true },
  { id: "khafid", name: "صوتٌ خافض", note: "كصوت المصلّي، لا جهرَ بيّن", priority: true },
  { id: "hadr", name: "حَدْرٌ سريع", note: "إسراعٌ في القراءة" },
  { id: "lahn", name: "لحنٌ عاديّ", note: "كإبدال الضاد ظاءً ونحوِه" },
  { id: "hams", name: "همسٌ ومخافتة", note: "أخفضُ من صوت المصلّي" },
  { id: "buud", name: "الهاتفُ على الأرض", note: "أمام المصلّي، على نحو ٥٠ إلى ٨٠ سنتمترًا" },
];

export interface SawtRunRow {
  at: string;
  conditionId: string;
  conditionName: string;
  segmentId: string;
  segmentTitle: string;
  words: number;
  hitPct: number;
  falseJumps: number;
  device: string;
  standalone: boolean;
}

/** الجهازُ يُقاس بحدة: حكمُ الهاتف لا يُعوَّض بنجاح الحاسوب */
export const deviceName = (): string =>
  /iPad|iPhone|iPod|Android|Mobile/.test(navigator.userAgent) ? "هاتف" : "حاسوب";

/** أمن التطبيق المثبَّت؟ فهناك يقع خطرُ iOS الحقيقيّ، وهناك يُقرأ في الصلاة */
export const isStandalone = (): boolean => {
  const nav = navigator as unknown as { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function listRuns(): SawtRunRow[] {
  return readJson<SawtRunRow[]>(RUNS_KEY, []);
}

export function saveRun(r: SawtReport, conditionId: string, conditionName: string): void {
  const row: SawtRunRow = {
    at: r.startedAtISO,
    conditionId,
    conditionName,
    segmentId: r.segmentId,
    segmentTitle: r.segmentTitle,
    words: r.span.words,
    hitPct: Math.round(r.hits.rate * 1000) / 10,
    falseJumps: r.falseJumps,
    device: deviceName(),
    standalone: isStandalone(),
  };
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify([...listRuns(), row].slice(-200)));
  } catch {
    /* الجهازُ قد يمنع التخزين — لا يُبطل الجلسة */
  }
}

export function clearRuns(): void {
  try {
    localStorage.removeItem(RUNS_KEY);
  } catch {
    /* لا شيء */
  }
}

export interface SawtMark {
  /** "سورة:آية:كلمة" */
  location: string;
  at: string;
}

export function readMark(): SawtMark | null {
  return readJson<SawtMark | null>(MARK_KEY, null);
}

export function saveMark(location: string): void {
  try {
    localStorage.setItem(MARK_KEY, JSON.stringify({ location, at: new Date().toISOString() }));
  } catch {
    /* لا شيء */
  }
}

/**
 * **ومحوُ الموضع بيد القارئ** (رصدُ المالك ١٤ أغسطس: «يُجبرني على المكان الذي
 * وصلتُ إليه… ولا يُصفَّر»). فالعودةُ إلى الموضع نعمةٌ ما دامت باختياره،
 * **وتصير قيدًا إن لم يكن له منها مخرج** — فالمخرجُ صريحٌ لا يُخبَّأ.
 */
export function clearMark(): void {
  try {
    localStorage.removeItem(MARK_KEY);
  } catch {
    /* لا شيء */
  }
}

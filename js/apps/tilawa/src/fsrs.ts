/**
 * **جدولُ المباعدة — FSRS كما هو، لا بديلَ يُخترع له.**
 *
 * متى تُعاد المسألةُ على الحافظ مسألةٌ **محسومةٌ خارجَ هذا المشروع**: خوارزميّةُ
 * `FSRS` (Free Spaced Repetition Scheduler) مفتوحةٌ منشورةٌ مُعايَرةٌ على ملايين
 * المراجعات، وابتكارُ جدولٍ بإزائها عبثٌ يُضيّع على الحافظ وقتَه. **فتُؤخذ
 * بصيغها وأوزانها كما نُشرت** ولا يُمَسّ منها حرف.
 *
 * **المأخذُ المعلن**: `FSRS-6` بأوزانها الافتراضيّة كما في المُجدوِل المرجعيّ
 * `open-spaced-repetition/fsrs4anki` (`fsrs4anki_scheduler.js`، النسخة 6.1.1).
 * والصيغُ الستُّ أدناه منقولةٌ عنه صيغةً صيغة: منحنى النسيان · مُدّةُ الأجل ·
 * الثباتُ الابتدائيّ · العسرُ الابتدائيُّ وتحديثُه · الثباتُ بعد التذكّر · والثباتُ
 * بعد الغفلة. **ولا معاملَ من عندنا ولا عتبة.**
 *
 * **وما عندنا من عندنا شيءٌ واحد**: أنّ الوحدةَ المجدولةَ **زوجٌ لا آية** (ح١
 * §٢/د) — فالضعفُ ههنا في **العلاقة** بين موضعين لا في أحدهما، وذاك مبنيٌّ في
 * `tathbit.ts` لا ههنا. وهذا الملفُّ حسابٌ صافٍ: لا تخزينَ ولا واجهة.
 */

/** الأوزانُ الافتراضيّةُ المنشورة (٢١ وزنًا — FSRS-6) — تُنقل ولا تُعدَّل */
export const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835,
  0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

/** أُسُّ منحنى النسيان ومعاملُه — يُشتقّان من الوزن الأخير كما في المرجع */
const DECAY = -W[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

/** **الاستبقاءُ المطلوب** — الافتراضُ المنشور نفسُه: تُعاد المسألةُ حين يُتوقَّع
 *  أن يذكرها الحافظُ بتسعةٍ من عشرة، فلا تُعاد وهي راسخةٌ ولا بعد ذهابها. */
export const RETENTION = 0.9;

/**
 * **الدرجات** — أربعٌ في المرجع، **ونستعمل منها اثنتين**: `AGAIN` و`GOOD`.
 * فالسؤالُ ههنا **وجهان لا سُلَّم**: إمّا أن يقع على المفرق وإمّا أن يزلّ عنه؛
 * وسؤالُ الحافظ «أهو يسيرٌ أم عسير؟» بعد جوابه **حكمٌ على نفسه** لا يُطلب منه
 * في بابِ عبادة. والصيغُ تقبل الأربعَ كما هي فلا يُمَسّ منها شيء.
 */
export const AGAIN = 1;
export const GOOD = 3;

/** حالُ مسألةٍ في الجدول */
export interface Card {
  /** الثبات — بالأيّام */
  s: number;
  /** العسر — من ١ إلى ١٠ */
  d: number;
  /** موعدُ الإعادة (ISO) */
  due: string;
  /** آخرُ عرض (ISO) */
  last: string;
  reps: number;
  /** كم مرّةً زلّ عنها بعد أن رسخت — **وهو سجلُّ الخلط بالزوج** */
  lapses: number;
}

const clampD = (d: number): number => Math.min(Math.max(+d.toFixed(2), 1), 10);

/** الثباتُ الابتدائيّ — وزنُ الدرجة نفسُه، ولا يقلّ عن عُشر يوم */
const initStability = (rating: number): number => Math.max(W[rating - 1], 0.1);

/** العسرُ الابتدائيّ */
const initDifficulty = (rating: number): number => clampD(W[4] - Math.exp(W[5] * (rating - 1)) + 1);

/** **منحنى النسيان**: ما احتمالُ أن يذكرها بعد `t` يومًا وثباتُها `s`؟ */
export const retrievability = (t: number, s: number): number =>
  Math.pow(1 + (FACTOR * Math.max(0, t)) / s, DECAY);

/** **مُدّةُ الأجل** — من الثبات إلى أيّامٍ، ثمّ يومٌ على الأقلّ */
export const interval = (s: number): number =>
  Math.max(1, Math.round((s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1)));

/** تحديثُ العسر: فرقٌ مخمَّدٌ خطّيًّا، ثمّ ارتدادٌ إلى الوسط */
function nextDifficulty(d: number, rating: number): number {
  const delta = -W[6] * (rating - 3);
  const nd = d + (delta * (10 - d)) / 9;
  return clampD(W[7] * initDifficulty(4) + (1 - W[7]) * nd);
}

/** الثباتُ بعد تذكّرٍ */
function stabilityRecall(d: number, s: number, r: number, rating: number): number {
  const hard = rating === 2 ? W[15] : 1;
  const easy = rating === 4 ? W[16] : 1;
  return (
    s *
    (1 +
      Math.exp(W[8]) *
        (11 - d) *
        Math.pow(s, -W[9]) *
        (Math.exp((1 - r) * W[10]) - 1) *
        hard *
        easy)
  );
}

/** الثباتُ بعد غفلةٍ — ولا يعلو على سقفِ المرجع */
function stabilityForget(d: number, s: number, r: number): number {
  const ceiling = s / Math.exp(W[17] * W[18]);
  return Math.min(
    W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]),
    ceiling,
  );
}

/** الثباتُ حين تُعاد في يومها (دون أجلٍ يومًا) */
function stabilityShort(s: number, rating: number): number {
  let sinc = Math.exp(W[17] * (rating - 3 + W[18])) * Math.pow(s, -W[19]);
  if (rating >= 3) sinc = Math.max(sinc, 1);
  return s * sinc;
}

/** يومٌ بالميلّي — به تُقاس الآجال */
const DAY = 86400000;

/**
 * **مراجعةٌ واحدة** — تُبنى منها الحالُ الجديدة. و`prev` معدومةٌ في أوّل عرض.
 *
 * والزمنُ يُمرَّر (`nowMs`) ولا يُقرأ ههنا من الساعة — فيُفحص الجدولُ بأيّامٍ
 * مصنوعةٍ في البوّابة، ولا يُنتظر مرورُ يومٍ حقيقيٍّ ليُعلم أصوابٌ هو.
 */
export function review(prev: Card | null, rating: number, nowMs: number): Card {
  const now = new Date(nowMs).toISOString();
  if (!prev) {
    const s = initStability(rating);
    const d = initDifficulty(rating);
    return { s, d, due: new Date(nowMs + interval(s) * DAY).toISOString(), last: now, reps: 1, lapses: 0 };
  }
  const elapsed = (nowMs - Date.parse(prev.last)) / DAY;
  const r = retrievability(elapsed, prev.s);
  const d = nextDifficulty(prev.d, rating);
  const s =
    elapsed < 1
      ? stabilityShort(prev.s, rating)
      : rating === AGAIN
        ? stabilityForget(prev.d, prev.s, r)
        : stabilityRecall(prev.d, prev.s, r, rating);
  return {
    s,
    d,
    due: new Date(nowMs + interval(s) * DAY).toISOString(),
    last: now,
    reps: prev.reps + 1,
    lapses: prev.lapses + (rating === AGAIN ? 1 : 0),
  };
}

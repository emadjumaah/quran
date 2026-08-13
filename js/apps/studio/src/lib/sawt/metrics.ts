/**
 * شهادةُ الصفحة على نفسها — حسابُ أرقام المحكّ المختوم في أثناء التلاوة.
 *
 * **لِمَ تحسب الصفحةُ أرقامَها بنفسها؟** لأنّ التلاوةَ متّصلةٌ والنصُّ معلوم،
 * فالمسارُ الصحيحُ للمؤشّر معلومٌ سلفًا: مرورٌ مطّردٌ على كلمات المقطع بترتيبها.
 * فكلُّ انحرافٍ عن هذا المسار **مقيسٌ آليًّا** بلا تحكيمٍ بشريّ ولا تقديرٍ بعد
 * حين. والتعريفاتُ ههنا هي نصُّ `findings/sawt/M1-MIHAKK.md` §٤ بحروفها.
 *
 * **وحدُّ ما تقوله**: أرقامٌ عن **الآلة** لا حكمٌ على التلاوة. فالموضعُ الذي لم
 * يُطابَق قد يكون مِن سوء سمعِ المحرّك لا من القارئ — ولذلك لغةُ العرض «موضعٌ
 * للنظر» و«لم يتبيّن لنا»، **والآلةُ لا تُجيز**.
 */
import type { AlignStep } from "./align";
import { bridgeGaps } from "./align";
import type { SawtScript } from "./script";

/** فجوةٌ تُجسر بالجوار (كلمات) — تعريفُ «التقدّم المُقَرّ» */
const MAX_BRIDGE = 2;
/** ما يتجاوزه التخطّي في خطوةٍ واحدةٍ يُعدّ قفزةً مرشَّحةً للكذب */
const BIG_SKIP = 5;

export interface LossEvent {
  /** موضعُ المؤشّر حين انقطعت المطابقة */
  atIndex: number;
  /** موضعُ عودته إن عاد */
  relockedAt: number | null;
  /** مسافةُ الاسترداد بالكلمات (من موضع الفقد إلى موضع العودة) */
  distance: number | null;
}

export interface LatencyStats {
  median: number | null;
  p90: number | null;
  count: number;
}

export interface SawtReport {
  segmentId: string;
  segmentTitle: string;
  /** حالُ القراءة المقيسة — خانةٌ من مصفوفة الأحوال، أو حالُ الأساس */
  condition: string;
  startedAtISO: string;
  durationMs: number;
  engineLabel: string;
  restarts: number;
  /** مرّاتُ «التجاوز» باليد — رخصةُ §٥ كي لا يَحبِس المسبارُ قارئًا مصيبًا */
  manualSkips: number;
  /** مرّاتُ المضيِّ عند الشكّ: مضى المؤشّرُ من تلقائه لئلّا يَحبِس قارئًا مصيبًا */
  autoAdvances: number;
  /** مدى ما تُلي: أوّلُ كلمةٍ بلغها المؤشّرُ وآخرُها */
  span: { from: number; to: number; words: number };
  hits: { direct: number; bridged: number; missed: number; rate: number };
  losses: { count: number; distances: number[]; worst: number | null; unresolved: number };
  falseJumps: number;
  /** زمنُ الوقف — مقيسٌ بالكاشف الصوتيّ، أو معلَنٌ أنّه غير مقيس */
  waqf: LatencyStats & { measured: boolean };
  /** زمنُ محرّكنا وحدَه: من وصول النتيجة إلى تحرّك المؤشّر */
  engine: LatencyStats;
  longestSilenceMs: number | null;
  /**
   * مواضعُ للنظر — **بلغةِ شكٍّ لا حكم، ولا تدخل إحصاءً** (حدُّ الإدارة §٣).
   * تُجمع المواضعُ المتجاورةُ في موضعٍ واحد، ولا يُذكر عددٌ ولا نسبة: هذه دعوةٌ
   * إلى النظر لا تقريرُ خطأ.
   */
  places: { from: string; to: string; note: string }[];
  /** حكمُ المحكّ شرطًا شرطًا (ما لم يُقَس يبقى null) */
  verdict: {
    hitRate: boolean;
    recovery: boolean;
    falseJumps: boolean;
    latency: boolean | null;
    passed: boolean | null;
  };
}

const quantile = (xs: number[], q: number): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
  return Math.round(s[i]);
};

const stats = (xs: number[]): LatencyStats => ({
  median: quantile(xs, 0.5),
  p90: quantile(xs, 0.9),
  count: xs.length,
});

/**
 * المِسطرة. تُغذّى بخطوات المحاذاة **المختومة وحدَها** (لا الجزئيّة): النتائجُ
 * الجزئيّةُ تُراجَع وتنمو، فلو حُسبت لتضاعفت الكلمةُ الواحدةُ مرارًا. أمّا
 * المؤشّرُ المعروضُ فيتقدّم بالجزئيّة — لأنّ العينَ تريد الآنَ لا المختوم.
 */
export class SawtMeter {
  private matched = new Set<number>();
  private first: number | null = null;
  private last = 0;
  private losses: LossEvent[] = [];
  private openLoss: LossEvent | null = null;
  /** رموزٌ لم تُطابَق منذ انفتاح الفقد — تُضاف إلى مسافة الاسترداد حين يعود */
  private pendingUnmatched = 0;
  private bigSkips: { at: number; cursorBefore: number }[] = [];
  private confirmedFalseJumps = 0;
  private waqfMs: number[] = [];
  private engineMs: number[] = [];
  private startedAt = performance.now();
  private startedISO = new Date().toISOString();

  // حقلٌ صريحٌ لا خاصّيّةَ معاملٍ مختصرة — كي تُحمَّل هذه الوحدةُ في العقد
  // بتجريد الأنواع وحدَه، فتُفحص المحاذاةُ والمِسطرةُ آليًّا قبل أن يتلوَ أحد.
  private script: SawtScript;

  constructor(script: SawtScript) {
    this.script = script;
  }

  /** خطوةُ محاذاةٍ مختومة */
  commit(step: AlignStep, cursorBefore: number) {
    if (this.first == null && (step.matched.length || step.cursor > cursorBefore)) {
      this.first = step.matched.length ? Math.min(...step.matched) : cursorBefore;
    }
    for (const i of step.matched) this.matched.add(i);
    if (step.cursor > this.last) this.last = step.cursor - 1;

    if (step.skipped.length > BIG_SKIP) {
      this.bigSkips.push({ at: step.skipped[0], cursorBefore });
    }

    for (const rl of step.relocks) {
      // رجوعُ المؤشّر إلى الوراء لا يقع إلّا باستردادٍ واسع — فهو إقرارٌ بأنّه
      // كان **أمام** القارئ. وكلُّ قفزةٍ كبيرةٍ سبقت هذا الموضعَ تُثبَّت كاذبة.
      if (rl.to < rl.fromCursor) {
        this.confirmedFalseJumps++;
        this.bigSkips = this.bigSkips.filter((b) => b.cursorBefore <= rl.to);
      }
      // حادثةُ فقدٍ عادت — سواءٌ انفتحت في خطوةٍ سابقةٍ أم وقعت وعادت في هذه
      // الخطوة نفسِها. **والثانيةُ لا تُهمَل**: انقطاعٌ عاد في الحال انقطاعٌ
      // وقع، ومسافتُه هي التي يُقاس بها شرطُ الاسترداد.
      if (this.openLoss) {
        this.openLoss.relockedAt = rl.to;
        this.openLoss.distance = this.pendingUnmatched + rl.after;
        this.openLoss = null;
        this.pendingUnmatched = 0;
      } else {
        this.losses.push({ atIndex: rl.fromCursor, relockedAt: rl.to, distance: rl.after });
      }
    }

    if (this.openLoss) {
      this.pendingUnmatched += step.unmatched;
    } else if (step.longestUnmatchedRun >= 3 && step.relocks.length === 0) {
      this.openLoss = { atIndex: cursorBefore, relockedAt: null, distance: null };
      this.pendingUnmatched = step.longestUnmatchedRun;
      this.losses.push(this.openLoss);
    }
  }

  /** تحرَّك المؤشّرُ على الشاشة — يُسجَّل زمنُ محرّكنا وحدَه */
  noteEngineLatency(ms: number) {
    this.engineMs.push(Math.round(ms));
  }

  /** استقرّ المؤشّرُ بعد وقفٍ طبيعيّ — زمنُ الوقف بتعريف المحكّ */
  noteWaqfLatency(ms: number) {
    if (ms >= 0) this.waqfMs.push(Math.round(ms));
  }

  finish(opts: {
    condition: string;
    engineLabel: string;
    restarts: number;
    manualSkips: number;
    autoAdvances: number;
    waqfMeasured: boolean;
    longestSilenceMs: number | null;
  }): SawtReport {
    const from = this.first ?? 0;
    const to = Math.max(from, this.last);
    const span = to - from + 1;
    const bridged = bridgeGaps(this.matched, from, to, MAX_BRIDGE);
    const direct = [...this.matched].filter((i) => i >= from && i <= to).length;
    const missed = Math.max(0, span - direct - bridged.size);
    const rate = span > 0 ? (direct + bridged.size) / span : 0;

    const distances = this.losses
      .map((l) => l.distance)
      .filter((d): d is number => d != null);
    const unresolved = this.losses.filter((l) => l.distance == null).length;
    const worst = distances.length ? Math.max(...distances) : null;

    // المواضعُ المتجاورةُ تُجمع في موضعٍ واحد: «موضعٌ للنظر» دعوةٌ إلى النظر
    // لا تقريرُ خطأ، فلا تُفتَّت الكلماتُ ولا يُذكر لها عددٌ ولا نسبة.
    const places: SawtReport["places"] = [];
    let runStart: number | null = null;
    for (let i = from; i <= to + 1; i++) {
      const unheard = i <= to && !this.matched.has(i) && !bridged.has(i);
      if (unheard && runStart == null) runStart = i;
      if (!unheard && runStart != null) {
        const a = this.script.words[runStart];
        const b = this.script.words[i - 1];
        if (a && b) {
          places.push({
            from: a.location,
            to: b.location,
            note: "لم يتبيّن لنا هذا الموضع",
          });
        }
        runStart = null;
      }
    }
    for (const l of this.losses) {
      const w = this.script.words[Math.min(l.atIndex, this.script.words.length - 1)];
      if (!w) continue;
      places.push({
        from: w.location,
        to: w.location,
        note: l.distance == null ? "ههنا انقطع التتبّعُ ولم يعُد" : "ههنا انقطع التتبّعُ ثمّ عاد",
      });
    }

    const waqf = { ...stats(this.waqfMs), measured: opts.waqfMeasured && this.waqfMs.length > 0 };
    const latencyVerdict =
      waqf.measured && waqf.median != null && waqf.p90 != null
        ? waqf.median <= 700 && waqf.p90 <= 1200
        : null;
    const hitRate = rate >= 0.9;
    const recovery = unresolved === 0 && (worst == null || worst <= 3);
    const falseJumps = this.confirmedFalseJumps <= 1;

    return {
      segmentId: this.script.id,
      segmentTitle: this.script.title,
      condition: opts.condition,
      startedAtISO: this.startedISO,
      durationMs: Math.round(performance.now() - this.startedAt),
      engineLabel: opts.engineLabel,
      restarts: opts.restarts,
      manualSkips: opts.manualSkips,
      autoAdvances: opts.autoAdvances,
      span: { from, to, words: span },
      hits: { direct, bridged: bridged.size, missed, rate },
      losses: { count: this.losses.length, distances, worst, unresolved },
      falseJumps: this.confirmedFalseJumps,
      waqf,
      engine: stats(this.engineMs),
      longestSilenceMs: opts.longestSilenceMs,
      places,
      verdict: {
        hitRate,
        recovery,
        falseJumps,
        latency: latencyVerdict,
        // ما لم يُقَس لا يُحكم فيه: يبقى الحكمُ معلّقًا (null) ولا يُكتب نجاحًا
        passed:
          latencyVerdict == null
            ? null
            : hitRate && recovery && falseJumps && latencyVerdict,
      },
    };
  }
}

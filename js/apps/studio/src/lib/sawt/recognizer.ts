/**
 * واجهةُ المحرّك — خطوتان، وما بينهما مقفل.
 *
 * `RecognizerPort` واجهةٌ واحدةٌ (يبدأ · يتوقّف · يبثّ نصًّا جزئيًّا) لها تنفيذان:
 *
 *   ١) **`WebSpeechRecognizer`** — محرّكُ المتصفّح، وهو تنفيذُ هذا المسبار.
 *      **وقيدُه المُعلَن**: يرسل الصوتَ إلى **خادم صانع المتصفّح** (غوغل في
 *      كروم، آبل في سفاري) — فهو معلَنٌ في الصفحة نفسِها بعبارةٍ ظاهرةٍ **قبل
 *      تشغيل الميكروفون**، ولا يُكتفى بالتوثيق. ولا يصلح لوضع الصلاة ولا للنشر
 *      العامّ: **مسبارٌ لا غير**.
 *
 *   ٢) **`VoskRecognizer`** — نموذجٌ صغيرٌ على الجهاز (WASM) بلا شبكة، **ولم
 *      يُبنَ في هذه الجلسة**. والواجهةُ تقبله كما هي: يكفيه أن يبثّ نصًّا
 *      جزئيًّا بالعربيّة، ولا يعلم شيئًا عن المحاذاة ولا عن الصفحة. وهو وحدَه
 *      ما يصلح لوضع الصلاة وللنشر العامّ.
 *
 * ولا تعلم الواجهةُ شيئًا عن المصحف: مخرجُها نصٌّ خام، والمحاذاةُ في `align.ts`.
 */

export type RecognizerState =
  | "idle"
  | "starting"
  | "listening"
  | "restarting"
  | "stopped"
  | "denied"
  | "unsupported"
  | "error";

export interface RecognizerResult {
  /** نصُّ الجملة الجارية كما بلغت الآن (ينمو ثمّ يُختم) */
  text: string;
  /** خُتمت الجملةُ فلا تنمو بعدُ */
  isFinal: boolean;
  /** طابعُ الزمن عند وصول النتيجة (performance.now) */
  at: number;
}

export interface RecognizerPort {
  /** اسمٌ للعرض — بلا لغةِ أدوات */
  readonly label: string;
  /** أيرسل الصوتَ إلى خادمٍ خارج الجهاز؟ (يُعلَن للقارئ قبل الميكروفون) */
  readonly sendsAudioOffDevice: boolean;
  start(): void;
  stop(): void;
  onResult(cb: (r: RecognizerResult) => void): void;
  onState(cb: (s: RecognizerState, detail?: string) => void): void;
  /** كم مرّةً انقطع المحرّكُ من تلقائه فأُعيد تشغيلُه (مقياسُ ثبات) */
  readonly restarts: number;
}

/* ═══════════ تصريحاتُ واجهة المتصفّح (ليست في مكتبة الأنواع القياسيّة) ═══════════ */

interface SpeechAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechResult {
  readonly length: number;
  isFinal: boolean;
  [i: number]: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [i: number]: SpeechResult;
}
interface SpeechEvent extends Event {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechErrorEvent extends Event {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as SpeechCtor) ?? (w.webkitSpeechRecognition as SpeechCtor) ?? null;
}

/** أمتاحٌ محرّكُ المتصفّح على هذا الجهاز؟ (يُسأل قبل عرض زرّ البدء) */
export const webSpeechAvailable = (): boolean => speechCtor() != null;

/* ═══════════ محرّكُ المتصفّح ═══════════ */

export class WebSpeechRecognizer implements RecognizerPort {
  readonly label = "محرّك المتصفّح";
  readonly sendsAudioOffDevice = true;

  private rec: SpeechRecognitionLike | null = null;
  private running = false;
  private resultCb: ((r: RecognizerResult) => void) | null = null;
  private stateCb: ((s: RecognizerState, detail?: string) => void) | null = null;
  /** أوّلُ نتيجةٍ لم تُختم بعدُ — بها تُبنى «الجملةُ الجارية» */
  private openFrom = 0;
  private restartTimer: number | null = null;
  private startedAt = 0;
  private backoff = 250;
  restarts = 0;

  private lang: string;

  constructor(lang = "ar-SA") {
    this.lang = lang;
  }

  onResult(cb: (r: RecognizerResult) => void) {
    this.resultCb = cb;
  }
  onState(cb: (s: RecognizerState, detail?: string) => void) {
    this.stateCb = cb;
  }

  private emitState(s: RecognizerState, detail?: string) {
    this.stateCb?.(s, detail);
  }

  start() {
    const Ctor = speechCtor();
    if (!Ctor) {
      this.emitState("unsupported");
      return;
    }
    this.running = true;
    this.openFrom = 0;
    this.emitState("starting");
    this.spawn(Ctor);
  }

  private spawn(Ctor: SpeechCtor) {
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.startedAt = performance.now();
      this.emitState("listening");
    };

    rec.onresult = (e: SpeechEvent) => {
      // الجملةُ الجارية = ما بعد آخر جملةٍ خُتمت. ونبثُّها كاملةً في كلِّ مرّة
      // لا زيادتَها وحدَها: النتائجُ الجزئيّةُ تُراجَع وتُبدَّل وهي تنمو، فبثُّ
      // الجملة كاملةً يجعل المحاذاةَ حتميّةً لا تتأثّر بعدد المرّات.
      let text = "";
      let allFinal = true;
      for (let i = this.openFrom; i < e.results.length; i++) {
        const r = e.results[i];
        text += (text ? " " : "") + (r[0]?.transcript ?? "");
        if (!r.isFinal) allFinal = false;
      }
      if (!text.trim()) return;
      this.resultCb?.({ text, isFinal: allFinal, at: performance.now() });
      if (allFinal) this.openFrom = e.results.length;
    };

    rec.onerror = (e: SpeechErrorEvent) => {
      // «لا كلام» و«الإجهاض» عارضان مألوفان في التلاوة المتّصلة (وقفٌ طويل،
      // إعادةُ تشغيل) — يُتجاوزان بلا إزعاجٍ للقارئ. وما عداهما يُعلَن.
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.running = false;
        this.emitState("denied", e.error);
        return;
      }
      this.emitState("error", e.error);
    };

    rec.onend = () => {
      if (!this.running) {
        this.emitState("stopped");
        return;
      }
      // محرّكُ المتصفّح يقطع من تلقائه عند السكوت ولو كان `continuous` — فيُعاد
      // تشغيلُه. وهذا **مقياسُ ثباتٍ يُنشر** لا عيبٌ يُخفى: كثرةُ الانقطاع
      // بنفسها نتيجةٌ عن صلاحيّة المحرّك.
      this.restarts++;
      this.emitState("restarting");
      // تراجعٌ متدرّج: إن كان المحرّكُ ينقطع فورَ تشغيله (منعٌ خفيّ أو عطبٌ في
      // الجهاز) فإعادتُه أربعَ مرّاتٍ في الثانية تستنزف البطّاريّةَ ولا تُصلح
      // شيئًا — فتُمدّ المهلةُ إلى ثانيتين. وإن كان يعمل ثمّ يقطع عند السكوت
      // (وهو المألوف) بقيت المهلةُ قصيرةً فلا يفوت القارئَ شيء.
      const lived = performance.now() - this.startedAt;
      this.backoff = lived < 500 ? Math.min(this.backoff * 2, 2000) : 250;
      this.restartTimer = window.setTimeout(() => {
        if (!this.running) return;
        try {
          rec.start();
        } catch {
          const Ctor2 = speechCtor();
          if (Ctor2) this.spawn(Ctor2);
        }
      }, this.backoff);
    };

    try {
      rec.start();
    } catch (err) {
      this.emitState("error", String(err));
    }
  }

  stop() {
    this.running = false;
    if (this.restartTimer != null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    try {
      this.rec?.stop();
    } catch {
      /* المحرّكُ قد يكون منقطعًا أصلًا */
    }
    this.emitState("stopped");
  }
}

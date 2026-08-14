/**
 * **المحرّكُ الحرُّ على الجهاز** — تنفيذٌ ثانٍ لـ`RecognizerPort`، والواجهةُ
 * بينه وبين المحاذاة **لم تُمَسّ**: يبثّ نصًّا كما يبثّه محرّكُ المتصفّح، ولا
 * يعلم شيئًا عن المصحف ولا عن الصفحة.
 *
 * **وقاعدةُ البابِ محفوظةٌ ههنا حرفًا: لا يُمسَك صوت.** لا `MediaRecorder` ولا
 * `Blob` ولا `createObjectURL` ولا كتابةَ في خزانةٍ ولا تخزينٍ محلّيّ — إنّما
 * **نافذةٌ ساريةٌ في الذاكرة** طولُها ثوانٍ معدودة، تُرسَل إلى العامل ثمّ
 * **تُقصّ من أوّلها فتُنسى**. وحارسٌ آليٌّ في بوّابة التتبّع يشهد بذلك بضبطٍ
 * سالب، فلا تبقى القاعدةُ موعودةً بالقول.
 *
 * **وحدُّه المقيس** (ص-م٣): النموذجُ يستغرق ٢٫٧–٣٫٨ ثانيةٍ للنافذة على حاسوبٍ
 * متوسّط، فالمؤشّرُ **يتأخّر ثوانيَ يسيرةً** عن صوت القارئ — وهو أبطأُ لحاقًا
 * من محرّك المتصفّح ولو ساواه في الإصابة. وهذا يُعلَن للقارئ ولا يُكتم.
 */

import type { RecognizerPort, RecognizerResult, RecognizerState } from "./recognizer";

/**
 * **النموذجُ المختار** — بالأرقام لا بالرغبة (ص-م٣ §٣):
 * تلاوةٌ محقَّقةٌ على المادّة الثابتة ⇒ إصابة **١٠٠٪** في القصار و**٨٩٫٨٪** في
 * صفحةٍ متّصلة، **وصفرُ قفزٍ كاذب** في المقطعين. وأصلُه `openai/whisper-tiny`
 * مضبوطًا على تلاوة القرآن (Apache-2.0)، وصورتُه ONNX بأربع بتّاتٍ ٨٣ م.ب على
 * السلك. والمرشّحُ العامُّ غيرُ المضبوط على التلاوة لم يبلغ إلّا **٥٠٪** —
 * فالضبطُ على المادّة هو الفارق، لا كِبَرُ النموذج.
 */
export const MODEL_ID = "omartariq612/tarteel-ai-whisper-tiny-ar-quran-onnx";
export const MODEL_DTYPE = "q4";

/** طولُ النافذة وما يُبقى منها للتي تليها — بالثواني */
const WINDOW_S = 6;
const OVERLAP_S = 1.2;
/** أقصى ما يُمسَك من صوتٍ في الذاكرة إن أبطأ الجهازُ — ثمّ يُقصُّ أقدمُه */
const MAX_HELD_S = 24;
const RATE = 16000;

/** أمتاحٌ هذا المحرّكُ على هذا الجهاز؟ (يُسأل قبل عرضه خيارًا) */
export const onDeviceAvailable = (): boolean =>
  typeof Worker !== "undefined" &&
  typeof WebAssembly !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

/** إعادةُ تقديرٍ خطّيّةٌ إلى ١٦ك — فبعضُ الأجهزة لا يعطي المعدّلَ المطلوب */
function toSixteenK(input: Float32Array, from: number): Float32Array {
  if (from === RATE) return input;
  const ratio = from / RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const at = i * ratio;
    const i0 = Math.floor(at);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = at - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

export class OnDeviceRecognizer implements RecognizerPort {
  readonly label = "على جهازك";
  readonly sendsAudioOffDevice = false;
  restarts = 0;

  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private resultCb: ((r: RecognizerResult) => void) | null = null;
  private stateCb: ((s: RecognizerState, detail?: string) => void) | null = null;
  /** النافذةُ الساريةُ — ذاكرةٌ لا خزانة، وتُقصُّ كلَّما أُرسلت */
  private buf: Float32Array[] = [];
  private bufLen = 0;
  private busy = false;
  private seq = 0;
  private running = false;
  private ready = false;

  onResult(cb: (r: RecognizerResult) => void) {
    this.resultCb = cb;
  }
  onState(cb: (s: RecognizerState, detail?: string) => void) {
    this.stateCb = cb;
  }
  private emit(s: RecognizerState, detail?: string) {
    this.stateCb?.(s, detail);
  }

  start() {
    if (!onDeviceAvailable()) {
      this.emit("unsupported");
      return;
    }
    this.running = true;
    this.emit("starting", "يُهيَّأ المحرّكُ على جهازك");
    void this.spawn();
  }

  private async spawn() {
    // العاملُ أوّلًا: تحميلُ النموذج أطولُ ما في البدء، ويجري والميكروفونُ يُطلب
    this.worker = new Worker(new URL("./asrWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<{ type: string; text?: string; pct?: number; detail?: string }>) => {
      const m = e.data;
      if (m.type === "progress") {
        this.emit("starting", `يُنزَّل مرّةً واحدة… ${m.pct ?? 0}٪`);
        return;
      }
      if (m.type === "ready") {
        this.ready = true;
        if (this.running) this.emit("listening");
        return;
      }
      if (m.type === "text") {
        this.busy = false;
        const text = (m.text ?? "").trim();
        if (text) this.resultCb?.({ text, isFinal: true, at: performance.now() });
        return;
      }
      if (m.type === "error") {
        this.busy = false;
        this.emit("error", m.detail);
      }
    };
    this.worker.onerror = (e) => this.emit("error", e.message);
    this.worker.postMessage({ type: "load", model: MODEL_ID, dtype: MODEL_DTYPE });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      this.running = false;
      const name = (err as DOMException)?.name ?? "";
      this.emit(name === "NotAllowedError" ? "denied" : "error", String(name || err));
      return;
    }
    if (!this.running) {
      this.stopTracks();
      return;
    }

    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // `ScriptProcessor` مهجورٌ في المواصفة وباقٍ في كلّ متصفّحٍ عمليًّا، واخترناه
    // على `AudioWorklet` لأنّه لا يحتاج ملفًّا خارجيًّا يُجلب — فيعمل بلا اتّصال
    // من غير حيلة، والحسابُ الثقيلُ في العامل لا ههنا.
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    const rate = this.ctx.sampleRate;
    this.node.onaudioprocess = (ev) => {
      if (!this.running) return;
      const raw = ev.inputBuffer.getChannelData(0);
      this.push(toSixteenK(new Float32Array(raw), rate));
    };
    this.source.connect(this.node);
    // مخرَجٌ صامت: بعضُ المتصفّحات لا تُشغّل المعالجَ ما لم يتّصل بالمخرَج
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    this.node.connect(silent);
    silent.connect(this.ctx.destination);
    if (this.ready) this.emit("listening");
  }

  private push(chunk: Float32Array) {
    this.buf.push(chunk);
    this.bufLen += chunk.length;
    // **سقفٌ لا يُتجاوز**: إن كان الجهازُ أبطأَ من الزمن الحقيقيّ تراكم الصوتُ ما
    // دام المحرّكُ مشغولًا — فيُقصُّ أقدمُه فلا تنتفخ الذاكرةُ ولا يزداد التأخّرُ
    // بلا حدّ، **ولا يُمسَك من الصوت أكثرُ ممّا يُقرأ**. والفائتُ يُفقد ولا
    // يُدَّعى: تأخّرُ المؤشّر خيرٌ من مؤشّرٍ يجري في ماضٍ بعيد.
    if (this.bufLen > MAX_HELD_S * RATE) {
      const drop = this.bufLen - MAX_HELD_S * RATE;
      let dropped = 0;
      while (dropped < drop && this.buf.length) {
        const head = this.buf[0];
        if (head.length <= drop - dropped) {
          dropped += head.length;
          this.buf.shift();
        } else {
          this.buf[0] = head.subarray(drop - dropped);
          dropped = drop;
        }
      }
      this.bufLen -= dropped;
    }
    if (this.bufLen < WINDOW_S * RATE || this.busy || !this.ready) return;
    const window = new Float32Array(this.bufLen);
    let at = 0;
    for (const c of this.buf) {
      window.set(c, at);
      at += c.length;
    }
    // **يُقصُّ ما مضى**: لا يبقى في الذاكرة إلّا ذيلٌ يسيرٌ يصل النافذتين، فلا
    // يُجمع صوتُ مجلسٍ في متغيّرٍ ولو لم يُكتب في قرص.
    const keep = Math.floor(OVERLAP_S * RATE);
    const tail = window.slice(Math.max(0, window.length - keep));
    this.buf = [tail];
    this.bufLen = tail.length;
    this.busy = true;
    this.worker?.postMessage({ type: "audio", id: ++this.seq, pcm: window }, [window.buffer]);
  }

  private stopTracks() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  stop() {
    this.running = false;
    this.ready = false;
    try {
      this.node?.disconnect();
      this.source?.disconnect();
    } catch {
      /* قد يكون مقطوعًا أصلًا */
    }
    if (this.node) this.node.onaudioprocess = null;
    this.stopTracks();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.worker?.terminate();
    this.worker = null;
    this.buf = [];
    this.bufLen = 0;
    this.emit("stopped");
  }
}

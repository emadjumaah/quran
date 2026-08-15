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

/**
 * **مهلةُ المجرى الصامت — مقياسٌ لا تخمين** (ص-م٥ §٢).
 *
 * أشدُّ إخفاقٍ في هذا المحرّك هو الذي **لا يُخبِر عن نفسه**: يُفتح الميكروفونُ
 * ويُنشأ السياقُ الصوتيُّ ثمّ **لا يصل إلى المعالج إطارٌ واحد** — فيقف القارئُ
 * أمام شاشةٍ حيّةٍ لا تسمع، ولا يعلم أخُذل هو أم الآلة. فيُعدّ ما يصل من
 * الإطارات، **فإن لم يصل شيءٌ خلال هذه المهلة أُعلن الإخفاقُ باسمه** ولم
 * يُترك صمتًا.
 */
const NO_INPUT_MS = 8000;

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
  /** كم إطارَ صوتٍ وصل من الميكروفون فعلًا — **عدٌّ لا ظنّ** */
  private frames = 0;
  private inputTimer: number | null = null;
  /**
   * **أثرُ الإقلاع — يُقرأ خلف باب «للفحص» وحدَه** (لا في سطح القارئ): مراحلُ
   * البدء بأسمائها وحالُ السياق الصوتيّ وأوّلُ عطبٍ بنصّه. وبه يُشخَّص جهازٌ
   * ليس بين أيدينا: يفتح صاحبُه البابَ وينسخ الأثرَ ويُرسله.
   */
  readonly diagnostics: string[] = [];

  private note(line: string) {
    this.diagnostics.push(`${Math.round(performance.now())} — ${line}`);
    if (this.diagnostics.length > 40) this.diagnostics.shift();
  }

  /**
   * **قياسُ الجهاز نفسِه — أربعةُ أسئلةٍ تُقاس ولا تُفترض** (ص-م٥ §٢).
   *
   * خانةُ الهاتف في المحكّ المختوم «لم تُقَس»، وأوّلُ قياسٍ لها جاء بالإخفاق.
   * **والجهازُ ليس بين أيدينا** — فيُسأل الجهازُ عن نفسه ويُقيَّد جوابُه:
   *   **التخزين** — أيسع الخزّانُ نموذجًا ٨٣ م.ب أم يمنعه حدُّ مساحة؟
   *   **الإقلاع** — أفيه `WebAssembly` وعاملٌ أصلًا؟
   *   **الخيوط** — أمتاحةٌ العوازلُ التي يشترطها تعدُّدُ الخيوط؟
   *   **الذاكرة** — ما تقوله المنصّةُ عنها إن قالت (وكثيرٌ منها لا يقول).
   * وما لا تجيب عنه المنصّةُ يُكتب «لا تقوله المنصّة» — **ولا يُخمَّن رقم**.
   */
  private async probeDevice() {
    const parts: string[] = [];
    parts.push(`عاملٌ ${typeof Worker !== "undefined" ? "متاح" : "غائب"}`);
    parts.push(`wasm ${typeof WebAssembly !== "undefined" ? "متاح" : "غائب"}`);
    const iso = (globalThis as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated;
    parts.push(`عزلُ الأصل ${iso === undefined ? "لا تقوله المنصّة" : iso ? "قائم" : "غيرُ قائم"}`);
    parts.push(`ذاكرةٌ مشتركة ${typeof SharedArrayBuffer !== "undefined" ? "متاحة" : "غيرُ متاحة"}`);
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
    parts.push(`ذاكرةُ الجهاز ${mem == null ? "لا تقوله المنصّة" : `${mem} ج.ب`}`);
    this.note(`الجهاز: ${parts.join(" · ")}`);
    try {
      const est = await navigator.storage?.estimate?.();
      if (!est) this.note("الخزّان: لا تقوله المنصّة");
      else {
        const mb = (n?: number) => (n == null ? "—" : `${Math.round(n / 1048576)} م.ب`);
        const free = est.quota != null && est.usage != null ? est.quota - est.usage : undefined;
        this.note(`الخزّان: سقفٌ ${mb(est.quota)} · مشغولٌ ${mb(est.usage)} · متبقٍّ ${mb(free)}`);
      }
    } catch (e) {
      this.note(`الخزّان: تعذّر قياسُه (${String((e as Error)?.name ?? e)})`);
    }
  }

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
      this.note("المحرّكُ غيرُ متاحٍ على هذا الجهاز");
      this.emit("unsupported");
      return;
    }
    this.running = true;
    this.emit("starting", "يُهيَّأ المحرّكُ على جهازك");
    /**
     * **السياقُ الصوتيُّ يُنشأ ههنا وحدَه — في نبضة الإيماءة نفسِها** (ص-م٥ §٢).
     *
     * كان يُنشأ بعد انتظار الميكروفون، **وأجهزةُ آبل تُنشئه موقوفًا** إن أُنشئ
     * خارجَ إيماءةِ المستخدم، فلا يُنادى `onaudioprocess` ألبتّة: يُفتح
     * الميكروفونُ، ويُنزَّل النموذجُ، **ولا يصل إلى المحرّك صوتٌ واحد** — وهو
     * إخفاقٌ صامتٌ لا يُفرَّق بحسّ القارئ عن محرّكٍ لا يعمل. فصار يُنشأ في
     * الخطوة الأولى من البدء، **ويُستأنف صراحةً**، وحالُه تُقيَّد في الأثر.
     */
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        this.note("لا سياقَ صوتيٍّ في هذا المتصفّح");
      } else {
        this.ctx = new Ctx();
        this.note(`سياقُ الصوت أُنشئ — حالُه ${this.ctx.state}`);
        void this.ctx
          .resume()
          .then(() => this.note(`استُؤنف السياقُ — حالُه ${this.ctx?.state}`))
          .catch((e) => this.note(`تعذّر استئنافُ السياق: ${String((e as Error)?.name ?? e)}`));
      }
    } catch (e) {
      this.ctx = null;
      this.note(`تعذّر إنشاءُ السياق الصوتيّ: ${String((e as Error)?.name ?? e)}`);
    }
    void this.probeDevice();
    void this.spawn();
  }

  private async spawn() {
    // العاملُ أوّلًا: تحميلُ النموذج أطولُ ما في البدء، ويجري والميكروفونُ يُطلب
    this.note("يُنشأ عاملُ التعرّف");
    this.worker = new Worker(new URL("./asrWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<{ type: string; text?: string; pct?: number; detail?: string }>) => {
      const m = e.data;
      if (m.type === "progress") {
        this.emit("starting", `يُنزَّل مرّةً واحدة… ${m.pct ?? 0}٪`);
        return;
      }
      if (m.type === "ready") {
        this.ready = true;
        this.note("النموذجُ جاهز");
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
        this.note(`عطبٌ في التعرّف: ${m.detail ?? "—"}`);
        this.emit("error", "تعثّر محرّكُ جهازك أثناء التعرّف");
      }
    };
    this.worker.onerror = (e) => {
      this.note(`عطبٌ في عامل التعرّف: ${e.message}`);
      this.emit("error", "تعثّر محرّكُ جهازك أثناء التهيئة");
    };
    this.worker.postMessage({ type: "load", model: MODEL_ID, dtype: MODEL_DTYPE });

    try {
      this.note("يُطلب الميكروفون");
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      this.note("فُتح الميكروفون");
    } catch (err) {
      this.running = false;
      const name = (err as DOMException)?.name ?? "";
      this.note(`تعذّر الميكروفون: ${String(name || err)}`);
      // **ولا يبقى تنزيلٌ يجري بعد إخفاقٍ معلن**: كان العاملُ يُترك يُنزّل ٨٣ م.ب
      // من شبكة القارئ وقد بطَل البدءُ أصلًا — فيُطوى معه.
      this.worker?.terminate();
      this.worker = null;
      this.emit(
        name === "NotAllowedError" ? "denied" : "error",
        name === "NotAllowedError"
          ? "لم يُؤذَن للصفحة بالميكروفون"
          : "لم يُفتح الميكروفونُ في هذا الجهاز",
      );
      return;
    }
    if (!this.running) {
      this.stopTracks();
      return;
    }

    /**
     * **واستئنافٌ ثانٍ بعد الميكروفون — والموضعان لازمان لا أحدُهما** (ص-م٥ §٢).
     *
     * **قِيس ههنا** (لا افتُرض): سياقٌ يُنشأ قبل الميكروفون يبقى `suspended` في
     * متصفّحٍ يُسيَّر بلا إيماءةٍ حقيقيّة، **فلا يصل إطارُ صوتٍ واحد**؛ وسياقٌ
     * يُنشأ بعد الميكروفون يعمل ثَمَّ **ويخفق على أجهزة آبل** لخروجه من نبضة
     * الإيماءة. ⇒ **يُنشأ مبكّرًا لأجل آبل، ويُستأنف ثانيةً بعد أن يُؤذَن
     * بالميكروفون لأجل غيرها** — فيصحّ الأمران، ولا يُشترى أحدُهما بالآخر.
     * **والانتظارُ موقوت**: بعضُ المتصفّحات تُعلّق وعدَ الاستئناف بلا نهايةٍ
     * حتّى تقع إيماءة، فلا يُنتظر أبدًا.
     */
    if (this.ctx && this.ctx.state !== "running") {
      await Promise.race([this.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
      this.note(`استئنافٌ بعد الميكروفون — حالُه ${this.ctx.state}`);
    }

    if (!this.ctx) {
      this.note("لا سياقَ صوتيًّا — لا يمكن الالتقاط");
      this.running = false;
      this.stopTracks();
      this.worker?.terminate();
      this.worker = null;
      this.emit("error", "لم يعمل مجرى الصوت في هذا الجهاز");
      return;
    }
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // `ScriptProcessor` مهجورٌ في المواصفة وباقٍ في كلّ متصفّحٍ عمليًّا، واخترناه
    // على `AudioWorklet` لأنّه لا يحتاج ملفًّا خارجيًّا يُجلب — فيعمل بلا اتّصال
    // من غير حيلة، والحسابُ الثقيلُ في العامل لا ههنا.
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    const rate = this.ctx.sampleRate;
    this.node.onaudioprocess = (ev) => {
      if (!this.running) return;
      this.frames++;
      const raw = ev.inputBuffer.getChannelData(0);
      this.push(toSixteenK(new Float32Array(raw), rate));
    };
    this.source.connect(this.node);
    // مخرَجٌ صامت: بعضُ المتصفّحات لا تُشغّل المعالجَ ما لم يتّصل بالمخرَج
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    this.node.connect(silent);
    silent.connect(this.ctx.destination);
    this.note(`وُصل المجرى — معدّلُ السياق ${rate} وحالُه ${this.ctx.state}`);
    // **حارسُ المجرى الصامت**: لو بقي السياقُ موقوفًا (وهو حالُ أجهزة آبل حين
    // يُنشأ خارجَ الإيماءة) لم يصل إطارٌ واحد — فيُعلَن الإخفاقُ باسمه بدل
    // شاشةٍ حيّةٍ لا تسمع.
    this.armSilenceGuard(true);
    if (this.ready) this.emit("listening");
  }

  /**
   * **حارسُ المجرى الصامت — ومحاولةٌ أخيرةٌ قبل الحكم.**
   *
   * إن لم يصل إطارٌ خلال المهلة **جُرّب استئنافُ السياق مرّةً أخيرة** ثمّ أُعيدت
   * المهلةُ مرّةً واحدة — فبعضُ المتصفّحات تستأنف متأخّرةً بعد أن يستقرّ الإذن.
   * فإن مضت الثانيةُ ولم يصل شيءٌ **أُعلن الإخفاقُ باسمه** ولم يُترك صمتًا.
   */
  private armSilenceGuard(retry: boolean) {
    if (this.inputTimer != null) clearTimeout(this.inputTimer);
    this.inputTimer = window.setTimeout(() => {
      if (!this.running || this.frames > 0) return;
      this.note(`لم يصل إطارُ صوتٍ في ${NO_INPUT_MS} مِث — حالُ السياق ${this.ctx?.state ?? "—"}`);
      if (retry && this.ctx && this.ctx.state !== "running") {
        void this.ctx.resume().catch(() => {});
        this.note("محاولةٌ أخيرةٌ لاستئناف السياق");
        this.armSilenceGuard(false);
        return;
      }
      this.emit("error", "لم يصل إلى المحرّك صوتٌ من الميكروفون");
    }, NO_INPUT_MS);
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
    if (this.inputTimer != null) {
      clearTimeout(this.inputTimer);
      this.inputTimer = null;
    }
    this.note(`أُوقف — إطاراتُ صوتٍ وصلت: ${this.frames}`);
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

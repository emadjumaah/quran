/**
 * **عاملُ التعرّف** — النموذجُ يعمل ههنا، بعيدًا عن الخيط الرئيس.
 *
 * وعلّتُه ليست تنظيمًا: استدلالُ النموذج يشغل الخيطَ ثلاثَ ثوانٍ أو أربعًا، فلو
 * جرى في الخيط الرئيس **لتجمّد المؤشّرُ والتمريرُ والنصّ** كلَّ نافذة — وفي صفحةٍ
 * يُتلى فيها القرآنُ لا يُحتمل ذلك. فالصوتُ يُلتقط هناك، والتعرّفُ ههنا، ولا
 * يعبُر بينهما إلّا **عيّنةٌ عابرةٌ تُستهلك ثمّ تُترك للجامع** — لا تُكتب في
 * قرصٍ ولا في خزانة.
 *
 * **ولا يخرج من هذا العامل طلبُ شبكةٍ في أثناء السمع**: النموذجُ يُنزَّل مرّةً
 * عند أوّل تحميلٍ ويُخزَّن في خزانة المتصفّح، ثمّ يُقرأ منها.
 */

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

const wasm = env.backends.onnx.wasm;
if (wasm) {
  /** خيطٌ واحد: تعدُّدُ الخيوط يشترط ترويسات عزلٍ لا نملكها في استضافةٍ ساكنة */
  wasm.numThreads = 1;
}
env.allowLocalModels = false;
env.useBrowserCache = true;

/* ═══ **أثرُ الإقلاع من داخل العامل** (ص-م٦ §٢/١) ═══
   كان الأثرُ يقف عند حدّ العامل: «يُنشأ عاملُ التعرّف» ثمّ «النموذجُ جاهز» —
   وبينهما **كلُّ ما يُخفق على هاتفٍ ليس بين أيدينا**: جلبُ عُدّة التشغيل،
   وتنزيلُ النموذج، وإنشاءُ خطّ التعرّف، وأوّلُ استدلال. فصار لكلّ مرحلةٍ سطرٌ
   بطابعها الزمنيّ وحالِ نجاحها، **يُرفع إلى الخيط الرئيس فيُقرأ في أثر «للفحص»**. */
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
const stage = (line: string) => post({ type: "stage", line });
const ms = (t0: number) => `${Math.round(performance.now() - t0)} مِث`;
const errName = (e: unknown) => String((e as Error)?.name ?? "") || String((e as Error)?.message ?? e);

/**
 * **ما يقوله العاملُ عن نفسه قبل أن يُنزَّل بايت** — قياسٌ على الجهاز لا تقدير:
 *
 * - **SIMD**: عُدّةُ التشغيل المشحونةُ اليومَ `ort-wasm-simd-threaded` **ولا
 *   نظيرَ لها بلا SIMD** — فمن لم يكن في متصفّحه SIMD لم يُقلع محرّكُنا الحرّ
 *   ألبتّة، ويكون هذا سببَه المسمّى.
 * - **مصدرُ عُدّة التشغيل**: `transformers.js` يضع لها مسارًا **من شبكة طرفٍ
 *   ثالث** (jsdelivr) ما لم يُحدَّد غيرُه — فيُقيَّد أصلُه بنصّه، إذ تعذُّرُ
 *   جلبِه عطبٌ لا يظهر في تنزيل النموذج ولا في الميكروفون.
 * - **الخزانة والخيوط والعتاد**: أقائمةٌ خزانةُ المتصفّح (وبها يُحفظ النموذجُ
 *   وعُدّةُ التشغيل فيعمل الباب بلا اتّصال)؟ وأمتاحةٌ الذاكرةُ المشتركة؟ وأفيه
 *   `navigator.gpu` أصلًا (وهو غيرُ مشروطٍ عندنا، إذ الافتراضُ `wasm`)؟
 */
function probeRuntime() {
  const parts: string[] = [];
  const simd = new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
  ]);
  let hasSimd = false;
  try {
    hasSimd = WebAssembly.validate(simd);
  } catch {
    hasSimd = false;
  }
  parts.push(`SIMD ${hasSimd ? "متاح" : "غيرُ متاح — ولا تعمل عُدّةُ التشغيل بدونه"}`);
  parts.push(`ذاكرةٌ مشتركة ${typeof SharedArrayBuffer !== "undefined" ? "متاحة" : "غيرُ متاحة"}`);
  const iso = (globalThis as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated;
  parts.push(`عزلُ الأصل ${iso === undefined ? "لا تقوله المنصّة" : iso ? "قائم" : "غيرُ قائم"}`);
  parts.push(`خزانةُ المتصفّح ${typeof caches !== "undefined" ? "قائمة" : "غيرُ قائمة"}`);
  parts.push(`navigator.gpu ${"gpu" in navigator ? "موجود" : "غيرُ موجود"} (غيرُ مشروطٍ عندنا)`);
  stage(`عُدّةُ التشغيل: ${parts.join(" · ")}`);
  try {
    const paths = (wasm as unknown as { wasmPaths?: string | { wasm?: string; mjs?: string } })?.wasmPaths;
    const url = typeof paths === "string" ? paths : (paths?.wasm ?? "—");
    stage(`مصدرُ عُدّة التشغيل: ${String(url).replace(/^(https?:\/\/[^/]+).*$/, "$1") || "أصلُنا"}`);
  } catch {
    stage("مصدرُ عُدّة التشغيل: لا يُقرأ");
  }
}

type LoadMsg = { type: "load"; model: string; dtype: string };
type AudioMsg = { type: "audio"; id: number; pcm: Float32Array };
type InMsg = LoadMsg | AudioMsg;

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

/** أوّلُ استدلالٍ يُقيَّد بعينه: قبله قد يُقلع كلُّ شيءٍ ثمّ يُخفق ههنا */
let firstInferenceDone = false;

async function load(msg: LoadMsg) {
  if (!loading) {
    probeRuntime();
    const t0 = performance.now();
    stage(`النموذج: يُطلب — ${msg.model} · بصورة ${msg.dtype} · على wasm (الافتراض، ولا يُطلب webgpu)`);
    const files = new Set<string>();
    loading = pipeline("automatic-speech-recognition", msg.model, {
      dtype: msg.dtype as "q4",
      progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          post({ type: "progress", pct: Math.round(p.progress) });
          return;
        }
        // **أيُّ ملفٍّ وقف عنده**: تنزيلُ ثمانين ميغابايت ملفّاتٌ لا ملفّ
        if ((p.status === "done" || p.status === "ready") && p.file && !files.has(p.file)) {
          files.add(p.file);
          stage(`مُلِف: ${p.file} (${p.status}) — ${ms(t0)}`);
        }
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
    loading.catch((err) => stage(`أخفق إنشاءُ خطّ التعرّف بعد ${ms(t0)}: ${errName(err)}`));
    asr = await loading;
    stage(`أُنشئ خطُّ التعرّف — ${ms(t0)}`);
  } else {
    asr = await loading;
  }
  post({ type: "ready" });
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load(msg);
      return;
    }
    if (msg.type === "audio") {
      if (!asr) return;
      const t0 = performance.now();
      if (!firstInferenceDone) stage(`أوّلُ استدلالٍ: بدأ (${msg.pcm.length} عيّنة)`);
      const out = await asr(msg.pcm, { language: "ar", task: "transcribe" });
      const text = Array.isArray(out) ? (out[0]?.text ?? "") : (out.text ?? "");
      if (!firstInferenceDone) {
        firstInferenceDone = true;
        stage(`أوّلُ استدلالٍ: تمّ في ${ms(t0)} — ${text ? "بنصٍّ" : "بلا نصّ"}`);
      }
      post({ type: "text", id: msg.id, text });
    }
  } catch (err) {
    if (msg.type === "audio" && !firstInferenceDone) stage(`أوّلُ استدلالٍ: أخفق — ${errName(err)}`);
    post({ type: "error", detail: String((err as Error)?.message ?? err) });
  }
};

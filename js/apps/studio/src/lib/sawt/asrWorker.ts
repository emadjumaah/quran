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
  /**
   * **ولا يُحدَّد مسارٌ خارجيٌّ لعُدّة التشغيل**: تُبنى معنا فتُخدَم من أصلنا
   * نفسِه، فلا يتعلّق البابُ بشبكةِ طرفٍ ثالثٍ ولا بعمر رابطه. وعاملُ الخدمة
   * يخزّنها عند أوّل استعمال (`sawt-runtime`) فتعمل بعدها بلا اتّصال.
   */
  /** خيطٌ واحد: تعدُّدُ الخيوط يشترط ترويسات عزلٍ لا نملكها في استضافةٍ ساكنة */
  wasm.numThreads = 1;
}
env.allowLocalModels = false;
env.useBrowserCache = true;

type LoadMsg = { type: "load"; model: string; dtype: string };
type AudioMsg = { type: "audio"; id: number; pcm: Float32Array };
type InMsg = LoadMsg | AudioMsg;

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

async function load(msg: LoadMsg) {
  if (!loading) {
    loading = pipeline("automatic-speech-recognition", msg.model, {
      dtype: msg.dtype as "q4",
      progress_callback: (p: { status?: string; progress?: number }) => {
        if (p.status === "progress" && typeof p.progress === "number") {
          post({ type: "progress", pct: Math.round(p.progress) });
        }
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
  }
  asr = await loading;
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
      const out = await asr(msg.pcm, { language: "ar", task: "transcribe" });
      const text = Array.isArray(out) ? (out[0]?.text ?? "") : (out.text ?? "");
      post({ type: "text", id: msg.id, text });
    }
  } catch (err) {
    post({ type: "error", detail: String((err as Error)?.message ?? err) });
  }
};

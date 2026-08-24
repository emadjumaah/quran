/**
 * **مِسطرةُ النموذج** — تشغيلةُ قياسٍ واحدةٌ لصورةِ نموذجٍ واحدةٍ على مقطعٍ من
 * المادّة الثابتة، **بمحرّك المحاذاة الحيِّ نفسِه** (`align.ts` و`metrics.ts`)
 * لا بحسابٍ ثانٍ — وهو شرطُ المحكّ المختوم (`M3-MIHAKK.md` §٤‑١).
 *
 * **ولِمَ أُعيد بناؤها؟** لأنّ مِسطرةَ ص-م٣ **لم تُودَع في المستودع**، فذهبت
 * بذهاب جلستها؛ فبقيت أرقامُها منشورةً ولا سبيلَ إلى إعادة تشغيلها. فبُنيت
 * ههنا **وأُودعت** كي لا تُفقد مرّةً ثانية (ص٦ §١أ‑٣).
 *
 * **والحدُّ المعلَن**: هذه تشغيلةٌ **حتميّة** — تُغذّى النافذةُ من الملفّ بمقادير
 * المحرّك المشحون نفسِها (`WINDOW_S` و`OVERLAP_S`) خطوةً خطوة، فيرى كلُّ مرشَّحٍ
 * تسلسلَ النوافذ عينَه. وهي **لا تقيس التأخّرَ الحيّ** (ذاك يقتضي ميكروفونًا
 * ومجرًى زمنيًّا)، بل **الإصابةَ والقفزَ الكاذبَ وزمنَ الاستدلال** — وهي التي
 * يفترق فيها التصديرُ عن التصدير.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { alignUtterance, speechTokens, DEFAULT_ALIGN } from "@mishkat/quran-core/lib/sawt/align";
import { SawtMeter } from "@mishkat/quran-core/lib/sawt/metrics";
import { planSegment, SawtWindow, type SegmentSpec } from "@mishkat/quran-core/lib/sawt/script";
import { loadMushaf } from "../src/mushaf";

/** مقاديرُ المحرّك المشحون بحروفها — لا مقاديرَ للفحص وحدَه */
const RATE = 16000;
const WINDOW_S = 6;
const OVERLAP_S = 1.2;

/**
 * مقاطعُ المادّة الثابتة (`M3-BENCH-MANIFEST.md`) — تُسمّى ولا تُنتقى.
 *
 * **والترتيبُ ترتيبُ التلاوة لا ترتيبُ المصحف**: المانيفستُ يصل الآياتِ في
 * الملفّ «الكافرون · الإخلاص · القدر»، **و`planSegment` يردُّ ترتيبَ المصحف**
 * (القدر أوّلًا) — فلو بُني النصُّ بترتيبه لَقِيسَ صوتٌ على غير نصّه. فيُبنى
 * المقطعُ **قِطَعًا بترتيب الملفّ**، والمحاذاةُ والمِسطرةُ كما هما بحرفهما.
 */
const CLIPS: Record<string, { title: string; parts: SegmentSpec[] }> = {
  qisar: {
    title: "القصار الثلاث",
    parts: [
      { id: "k", title: "الكافرون", kind: "surahs", surahs: [109] },
      { id: "i", title: "الإخلاص", kind: "surahs", surahs: [112] },
      { id: "q", title: "القدر", kind: "surahs", surahs: [97] },
    ],
  },
  safha42: { title: "صفحة ٤٢", parts: [{ id: "p42", title: "صفحة ٤٢", kind: "page", page: 42 }] },
};

/** عُدّةُ التشغيل من أصلنا وبخيطٍ واحد — كما يُشحن، لا كما يُسهِّل الفحص */
const wasm = env.backends.onnx.wasm;
if (wasm) {
  wasm.numThreads = 1;
  wasm.wasmPaths = "/ort/";
}
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.localModelPath = "/models/";
env.useBrowserCache = false;

async function readWav(url: string): Promise<Float32Array> {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  const n = (dv.getUint32(40, true) / 2) | 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = dv.getInt16(44 + i * 2, true) / 32768;
  return out;
}

export interface BenchRow {
  model: string;
  dtype: unknown;
  clip: string;
  words: number;
  windows: number;
  /** الإصابةُ بتعريف المحكّ: المطابَقُ مباشرةً والمجسورُ من كلمات المدى */
  hitRate: number;
  hits: { direct: number; bridged: number; missed: number };
  falseJumps: number;
  losses: { count: number; worst: number | null; unresolved: number };
  span: { from: number; to: number; words: number };
  /** زمنُ أوّل استدلال (مِث) — أوّلُ نافذةٍ بعد جاهزيّة النموذج */
  firstInferenceMs: number;
  /** وسيطُ زمن الاستدلال لسائر النوافذ (مِث) */
  medianInferenceMs: number;
  /** زمنُ إنشاء خطّ التعرّف — من الطلب إلى الجاهزيّة (مِث) */
  loadMs: number;
  /** نسبةُ زمن الاستدلال إلى زمن الصوت */
  rtf: number;
  /** كلُّ ما نطق به المحرّك — يُحفظ كي يُراجَع الرقمُ ولا يُصدَّق على علّاته */
  transcript: string[];
}

async function run(model: string, dtype: unknown, clip: string): Promise<BenchRow> {
  await loadMushaf(); // يُسجّل منفذَ نصّ المصحف
  const c = CLIPS[clip];
  if (!c) throw new Error(`مقطعٌ مجهول: ${clip}`);
  const refs = (await Promise.all(c.parts.map((p) => planSegment(p)))).flat();
  const win = new SawtWindow(clip, c.title, refs);
  await win.grow(Number.MAX_SAFE_INTEGER);

  const t0 = performance.now();
  const asr = (await pipeline("automatic-speech-recognition", model, {
    dtype: dtype as "q4",
  })) as AutomaticSpeechRecognitionPipeline;
  const loadMs = Math.round(performance.now() - t0);

  const pcm = await readWav(`/audio/${clip}.wav`);
  const meter = new SawtMeter(win.script);
  const step = Math.round((WINDOW_S - OVERLAP_S) * RATE);
  const size = WINDOW_S * RATE;
  const times: number[] = [];
  const transcript: string[] = [];
  let anchor = 0;
  let windows = 0;

  for (let at = 0; at + size <= pcm.length; at += step) {
    const t = performance.now();
    const out = await asr(pcm.slice(at, at + size), { language: "ar", task: "transcribe" });
    times.push(performance.now() - t);
    windows++;
    const text = (Array.isArray(out) ? (out[0]?.text ?? "") : (out.text ?? "")).trim();
    transcript.push(text);
    const tokens = speechTokens(text);
    if (!tokens.length) continue;
    const before = anchor;
    const s = alignUtterance(win.norms, tokens, before, DEFAULT_ALIGN);
    meter.commit(s, before);
    if (s.cursor > before) anchor = s.cursor;
  }

  const rep = meter.finish({
    condition: "المادّةُ الثابتة",
    engineLabel: `${model} · ${JSON.stringify(dtype)}`,
    restarts: 0,
    manualSkips: 0,
    autoAdvances: 0,
    waqfMeasured: false,
    longestSilenceMs: null,
  });
  const sorted = [...times.slice(1)].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  return {
    model,
    dtype,
    clip,
    words: win.script.words.length,
    windows,
    hitRate: rep.hits.rate,
    hits: { direct: rep.hits.direct, bridged: rep.hits.bridged, missed: rep.hits.missed },
    falseJumps: rep.falseJumps,
    losses: { count: rep.losses.count, worst: rep.losses.worst, unresolved: rep.losses.unresolved },
    span: rep.span,
    firstInferenceMs: Math.round(times[0] ?? 0),
    medianInferenceMs: Math.round(median),
    loadMs,
    rtf: +(times.reduce((a, b) => a + b, 0) / 1000 / (windows * (WINDOW_S - OVERLAP_S))).toFixed(3),
    transcript,
  };
}

(window as unknown as { __bench: typeof run }).__bench = run;
(window as unknown as { __benchReady: boolean }).__benchReady = true;

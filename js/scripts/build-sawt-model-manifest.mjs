/**
 * **مانيفستُ النموذج المشحون** — ما يُنزَّل إلى جهاز القارئ فعلًا، بأسمائه
 * وبايتاته وتجزئاته، **مقيسًا لا مقدَّرًا**.
 *
 * ولِمَ يُودَع مانيفستٌ والنموذجُ ليس في شجرتنا؟ لأنّ **البوّابةَ لا تفتح الشبكةَ**
 * (ولا يصحّ أن تفتحها: فحصٌ يتعطّل بانقطاع الشبكة ليس حارسًا). فيُقيَّد ما رُفع
 * ههنا مرّةً بيدٍ تقيس، ثمّ **تحرسه البوّابةُ في كلّ تشغيلة**: ألا يتجاوز مجموعُه
 * السقفَ المعلَن، وأن يكون مصدرُه مستودعَنا.
 *
 * **وجردُ الملفّات ليس ظنًّا**: يُقارَن بما **جلبه المحرّكُ فعلًا** في تشغيلة
 * المِسطرة (`--from`)، فإن اختلفا صاح — فلا يُكتب في المانيفست ملفٌّ لا يُطلب،
 * ولا يسقط منه ملفٌّ يُطلب.
 *
 * التشغيل:
 *   node js/scripts/build-sawt-model-manifest.mjs --dir <مجلَّدُ النموذج> \
 *     --repo <معرّفُ المستودع> --dtype <الصورة> --cap <سقفُ الميغابايت> \
 *     [--from <ناتجُ المِسطرة>] [--revision <المراجعة>]
 *   node js/scripts/build-sawt-model-manifest.mjs --verify   ← يقابل المانيفستَ بما على HF
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** **موضعُه في الحزمة لا في `js/data`** — لأنّ الشيفرةَ نفسَها تقرؤه: منه
 *  `MODEL_ID` و`MODEL_DTYPE` والرقمُ المعروضُ للقارئ. **مصدرٌ واحدٌ لا اثنان
 *  يتباعدان**، والبوّابةُ تحرس الملفَّ الذي يُشحن منه فعلًا. */
const OUT = join(ROOT, "js", "packages", "quran-core", "src", "lib", "sawt", "model.json");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const has = (n) => process.argv.includes(`--${n}`);

/** لواحقُ الصور كما يسمّيها `transformers.js` (`utils/dtypes.js`) */
const SUFFIX = {
  fp32: "", fp16: "_fp16", int8: "_int8", uint8: "_uint8", q8: "_quantized",
  q4: "_q4", q4f16: "_q4f16", bnb4: "_bnb4",
};
/** ما يُنزَّل لخطّ التعرّف الصوتيّ من whisper — الوحدتان وعُدّةُ الترميز */
const CONFIGS = [
  "config.json", "generation_config.json", "preprocessor_config.json",
  "tokenizer.json", "tokenizer_config.json",
];

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

if (has("verify")) {
  const man = JSON.parse(readFileSync(OUT, "utf8"));
  const api = await (await fetch(`https://huggingface.co/api/models/${man.repo}?blobs=true`)).json();
  const sizes = new Map((api.siblings ?? []).map((s) => [s.rfilename, s.size]));
  let bad = 0;
  for (const f of man.files) {
    const there = sizes.get(f.path);
    if (there !== f.bytes) {
      bad++;
      console.log(`✗ ${f.path}: عندنا ${f.bytes} وعلى المستودع ${there ?? "غائب"}`);
    }
  }
  console.log(bad ? `✗ اختلف ${bad} ملفًّا` : `✓ ${man.files.length} ملفًّا مطابقةً لما على ${man.repo}`);
  process.exit(bad ? 1 : 0);
}

const DIR = arg("dir");
const REPO = arg("repo");
const DTYPE = arg("dtype", "q4");
const CAP = Number(arg("cap", "45"));
const REV = arg("revision", "main");
const FROM = arg("from");
/** اسمُ المجلَّد المحلّيّ في تشغيلة المِسطرة — قد يخالف اسمَ المستودع قبل الرفع */
const LOCAL = arg("localname", (REPO ?? "").split("/").pop());
if (!DIR || !REPO) {
  console.error("يلزم --dir و--repo");
  process.exit(1);
}
const sfx = SUFFIX[DTYPE];
if (sfx === undefined) {
  console.error(`صورةٌ لا يعرفها transformers.js: ${DTYPE}`);
  process.exit(1);
}

const paths = [
  ...CONFIGS,
  `onnx/encoder_model${sfx}.onnx`,
  `onnx/decoder_model_merged${sfx}.onnx`,
];
const files = [];
for (const p of paths) {
  const abs = join(DIR, p);
  if (!existsSync(abs)) {
    console.error(`✗ ملفٌّ لازمٌ غائب: ${p}`);
    process.exit(1);
  }
  files.push({ path: p, bytes: statSync(abs).size, sha256: sha256(abs) });
}
const totalBytes = files.reduce((a, f) => a + f.bytes, 0);

/** ومقابلةُ الجرد بما جلبه المحرّكُ فعلًا — فالمانيفستُ يتبع القياس */
let observed = null;
if (FROM) {
  const row = JSON.parse(readFileSync(FROM, "utf8"));
  const got = new Set(
    (row.files ?? [])
      .map((f) => (f.url.split(`/${LOCAL}/`)[1] ?? "").replace(/^\/+/, ""))
      .filter(Boolean),
  );
  const want = new Set(paths);
  const missing = [...want].filter((p) => !got.has(p));
  const extra = [...got].filter((p) => !want.has(p));
  observed = { from: FROM.split("/").pop(), fetched: [...got].sort(), missing, extra };
  if (missing.length || extra.length) {
    console.log(`⚠ جردُ المانيفست لا يطابق ما جُلب — ناقصٌ: ${missing.join(" ") || "—"} · زائدٌ: ${extra.join(" ") || "—"}`);
  } else {
    console.log(`✓ الجردُ يطابق ما جلبه المحرّكُ فعلًا (${got.size} ملفًّا)`);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      note: "ما يُنزَّل إلى جهاز القارئ لأوّل تشغيل — مقيسٌ بالبايت، وتحرسه بوّابةُ المحرّك",
      repo: REPO,
      revision: REV,
      dtype: DTYPE,
      capMB: CAP,
      totalBytes,
      totalMB: +(totalBytes / 1e6).toFixed(2),
      files,
      observed,
    },
    null,
    2,
  )}\n`,
);
console.log(`${relative(ROOT, OUT)}: ${files.length} ملفًّا · ${(totalBytes / 1e6).toFixed(2)} م.ب · السقفُ ${CAP} م.ب`);

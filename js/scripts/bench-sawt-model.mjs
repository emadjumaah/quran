/**
 * **مِسطرةُ صورةِ النموذج** — تُشغَّل صورةٌ واحدةٌ على مقطعٍ من المادّة الثابتة،
 * فتخرج بالإصابة والقفزِ الكاذب وزمنِ الاستدلال. **والمِسطرةُ هي محرّكُ المحاذاة
 * الحيُّ نفسُه** (`lib/sawt/align.ts` و`metrics.ts`) — شرطُ `M3-MIHAKK.md` §٤‑١.
 *
 * **ولِمَ أُودعت؟** لأنّ مِسطرةَ ص-م٣ لم تُودَع، فذهبت بذهاب جلستها وبقيت
 * أرقامُها لا تُعاد. **فالمقياسُ يُودَع كما تُودَع البوّابة.**
 *
 * التشغيل:
 *   node js/scripts/bench-sawt-model.mjs \
 *      --model <معرّفٌ على HF أو اسمُ مجلَّدٍ محلّيّ> \
 *      --dtype q4|int8|'{"encoder_model":"fp16","decoder_model_merged":"q4"}' \
 *      --clip qisar|safha42 --audio <مجلَّدُ الأصوات> [--models <مجلَّدُ النماذج المحلّيّة>]
 *
 * **وحدُّه المعلَن**: تشغيلةٌ **حتميّة** تُغذّى النافذةُ فيها من الملفّ بمقادير
 * المحرّك المشحون (٦ ثوانٍ بتداخلِ ١٫٢)، فيرى كلُّ مرشَّحٍ تسلسلَ النوافذ عينَه.
 * **ولا تقيس التأخّرَ الحيّ** — ذاك يقتضي ميكروفونًا ومجرًى زمنيًّا، وهو محفوظٌ
 * لهاتف المالك.
 */
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const MODEL = arg("model");
const DTYPE_RAW = arg("dtype", "q4");
const CLIP = arg("clip", "qisar");
const AUDIO = arg("audio");
const MODELS = arg("models", "");
const OUT = arg("out", "");
const PORT = Number(arg("port", "8173"));
const CDP = Number(arg("cdp", "9373"));

if (!MODEL || !AUDIO) {
  console.error("يلزم --model و--audio");
  process.exit(1);
}
const DTYPE = DTYPE_RAW.trim().startsWith("{") ? JSON.parse(DTYPE_RAW) : DTYPE_RAW;

/* ── ١ — تُحزَم المِسطرة: نقطةُ الدخول في التطبيق، والمحرّكُ من رزمة القلب ── */
const BENCH = join(ROOT, "js", "apps", "tilawa", "bench");
const WORK = join(BENCH, ".out");
mkdirSync(WORK, { recursive: true });
const ESBUILD = join(
  ROOT, "js", "node_modules", ".pnpm", "@esbuild+darwin-x64@0.25.12",
  "node_modules", "@esbuild", "darwin-x64", "bin", "esbuild",
);
const TRANSFORMERS = join(
  ROOT, "js", "packages", "quran-core", "node_modules", "@huggingface", "transformers",
  "dist", "transformers.web.js",
);
execFileSync(ESBUILD, [
  join(BENCH, "bench-entry.ts"), "--bundle", "--format=esm", "--target=es2022",
  `--outfile=${join(WORK, "bench.js")}`, `--define:import.meta.env={"BASE_URL":"/"}`,
  `--alias:@huggingface/transformers=${TRANSFORMERS}`,
], { stdio: "inherit" });

/* ── ٢ — خادمٌ ساكنٌ يجمع ما تحتاجه الصفحة من مواضعه الحقيقيّة ── */
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".wav": "audio/wav",
  ".txt": "text/plain", ".mjs": "text/javascript",
};
const ROUTES = [
  [/^\/$/, () => join(BENCH, "bench.html")],
  [/^\/bench\.js$/, () => join(WORK, "bench.js")],
  [/^\/mushaf-text\.json$/, () => join(ROOT, "js", "packages", "quran-assets", "assets", "mushaf-text.json")],
  [/^\/ort\/(.+)$/, (m) => join(ROOT, "js", "apps", "tilawa", "public", "ort", m[1])],
  [/^\/audio\/(.+)$/, (m) => join(AUDIO, m[1])],
  [/^\/models\/(.+)$/, (m) => (MODELS ? join(MODELS, m[1]) : null)],
];
const srv = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let file = null;
  for (const [re, to] of ROUTES) {
    const m = p.match(re);
    if (m) { file = to(m); break; }
  }
  if (!file || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}).listen(PORT);

/* ── ٣ — متصفّحٌ حقيقيٌّ: **موضعُ العمل هو موضعُ القياس** ── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  `--remote-debugging-port=${CDP}`, "--headless=new", "--no-first-run", "--disable-gpu",
  `--user-data-dir=/tmp/cdp-profile-sawt-bench`, "about:blank",
], { stdio: "ignore", detached: true });
proc.unref();

let target = null;
for (let i = 0; i < 80 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page");
  } catch { /* بعدُ لم يُقلع */ }
  if (!target) await sleep(300);
}
if (!target) { console.error("لم يُقلع المتصفّح"); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const fetched = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  // **ما نُزّل فعلًا يُعدُّ بالبايت** — فالحجمُ مقيسٌ لا منقولٌ عن ترويسة
  if (m.method === "Network.loadingFinished") {
    const u = fetched.get(m.params.requestId);
    if (u) fetched.set(m.params.requestId, { ...u, bytes: m.params.encodedDataLength });
  }
  if (m.method === "Runtime.exceptionThrown") {
    console.error("✗ عطبٌ في الصفحة:", JSON.stringify(m.params.exceptionDetails).slice(0, 700));
  }
  if (m.method === "Runtime.consoleAPICalled") {
    console.error("·", m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 400));
  }
  if (m.method === "Network.requestWillBeSent") {
    fetched.set(m.params.requestId, { url: m.params.request.url, bytes: 0 });
  }
});
const send = (method, params = {}, ms = 60000) => new Promise((r) => {
  const i = ++id;
  const t = setTimeout(() => { pending.delete(i); r({ timedOut: true }); }, ms);
  pending.set(i, (m) => { clearTimeout(t); r(m); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression, ms) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, ms);
  if (r.timedOut) throw new Error("انقضت المهلةُ ولم يعُد جواب");
  if (r.result?.exceptionDetails) {
    throw new Error(String(r.result.exceptionDetails.exception?.description ?? "").slice(0, 800));
  }
  return r.result?.result?.value;
};
await new Promise((r) => ws.addEventListener("open", r));
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
let ready = false;
for (let i = 0; i < 80 && !ready; i++) {
  ready = await evaluate("window.__benchReady === true");
  if (!ready) await sleep(300);
}
if (!ready) { console.error("لم تُقلع المِسطرةُ في الصفحة"); process.exit(1); }

const t0 = Date.now();
const row = await evaluate(
  `window.__bench(${JSON.stringify(MODEL)}, ${JSON.stringify(DTYPE)}, ${JSON.stringify(CLIP)})`,
  3600000,
);
row.wallMs = Date.now() - t0;
/** مجموعُ ما نُزِّل من ملفّات النموذج بالضغط الذي يُخدَم به — «على السلك» */
row.wireBytes = [...fetched.values()]
  .filter((f) => /\.onnx$|tokenizer\.json$|_config\.json$|^.*\/config\.json$|normalizer\.json$|special_tokens_map\.json$|added_tokens\.json$/.test(f.url))
  .reduce((a, f) => a + (f.bytes || 0), 0);
row.files = [...fetched.values()]
  .filter((f) => f.bytes > 0 && !/bench\.js|mushaf-text|\/ort\/|\/audio\//.test(f.url))
  .map((f) => ({ url: f.url, bytes: f.bytes }));

const text = JSON.stringify(row, null, 2);
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, `${text}\n`); }
console.log(text);
await send("Browser.close");
srv.close();
process.exit(0);

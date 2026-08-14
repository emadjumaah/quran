/**
 * **الفحصُ الحيُّ للمحرّك الحرّ: يعمل والشبكةُ مقطوعة.**
 *
 * تشغيلتان في متصفّحٍ حقيقيٍّ على `dist`، وميكروفونُهما **تلاوةٌ منشورةٌ
 * مرخَّصة** تُغذّى ملفًّا إلى جهاز التقاطٍ صوريّ (`--use-file-for-fake-audio-capture`)
 * — فلا يُسجَّل صوتُ أحدٍ ولا يُطلب:
 *
 *   ١) **تشغيلةُ التخزين**: تُفتح الصفحةُ، ويُختار «على جهازك»، ويُنزَّل النموذجُ
 *      مرّةً ويُخزَّن. ويُقاس زمنُ التنزيل وزمنُ الجاهزيّة.
 *   ٢) **تشغيلةُ الانقطاع**: الشبكةُ تُقطع من أصلها (CDP)، ثمّ تُفتح الصفحةُ
 *      نفسُها فتُقرأ من الخزانة. **والشرط**: أن يسمع المحرّكُ وأن **يتقدّم
 *      المؤشّرُ على كلمات المصحف** — وأن يكون **عددُ طلبات الشبكة في أثناء
 *      السمع صفرًا**.
 *
 * وضبطُه السالب في التشغيلة الثانية نفسِها: الشبكةُ مقطوعةٌ حقًّا — فلو كان
 * المحرّكُ يستنجد بخادمٍ لَما تقدّم مؤشّرٌ ولَظهر الإخفاق.
 *
 * التشغيل: node js/scripts/check-sawt-offline.mjs <path-to-wav>
 *   (الملفُّ: تلاوةٌ ١٦ك أحاديّة. يُبنى `dist` قبله بـ`pnpm build`.)
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIST = join(ROOT, "js", "apps", "studio", "dist");
const OUT = join(ROOT, "js", "data", "gates", "SAWT-OFFLINE.json");
const WAV = process.argv[2];
const PORT = 8102, CDP = 9338;
const PROFILE = "/tmp/cdp-profile-sawt-offline";

if (!existsSync(DIST)) {
  console.error("لا وجودَ لـ dist — يُبنى أوّلًا بـ pnpm build في js/apps/studio");
  process.exit(1);
}
if (!WAV || !existsSync(WAV)) {
  console.error("يلزم ملفُّ تلاوةٍ (wav ١٦ك أحاديّ) وسيطًا أوّل");
  process.exit(1);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  let file = join(DIST, p === "/" ? "index.html" : p);
  let body = null;
  try {
    body = readFileSync(file);
  } catch {
    try {
      body = readFileSync(join(DIST, "index.html"));
      file = "index.html";
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(body);
}).listen(PORT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session({ offline, label }) {
  const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    [`--remote-debugging-port=${CDP}`, "--headless=new", "--no-first-run", "--disable-gpu",
     "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
     `--use-file-for-fake-audio-capture=${WAV}`,
     `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore", detached: true });
  proc.unref();

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* بعدُ لم يُقلع */ }
    if (!target) await sleep(300);
  }
  if (!target) throw new Error("لم يُقلع المتصفّح");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const requests = [];
  let listeningAt = null;
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Network.requestWillBeSent") {
      requests.push({ url: m.params.request.url, at: Date.now(), afterListening: listeningAt != null });
    }
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };
  await new Promise((r) => ws.addEventListener("open", r));
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Browser.grantPermissions", { permissions: ["audioCapture"], origin: `http://127.0.0.1:${PORT}` });
  if (offline) await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/#/tatabbu` });

  /** لا يُنقر زرٌّ معطَّل: يُنتظر ظهورُه عاملًا ثمّ يُنقر — وإلّا فالفحصُ يقيس نقرةً ضائعة */
  const clickWhen = async (sel, waitMs = 60000) => {
    for (let i = 0; i < waitMs / 500; i++) {
      const ok = await evaluate(`(() => { const e = document.querySelector('${sel}'); return !!e && !e.disabled; })()`);
      if (ok) {
        await evaluate(`document.querySelector('${sel}').click()`);
        return true;
      }
      await sleep(500);
    }
    return false;
  };

  // اختيارُ المحرّك ثمّ الإذن — بالنقر على الصفحة نفسِها لا بحقن حال
  const clicks = {
    begin: await clickWhen('[data-sawt="begin"]'),
    engine: await clickWhen('[data-sawt="engine-on-device"]', 8000),
    agree: await clickWhen('[data-sawt="agree"]', 8000),
  };

  const t0 = Date.now();
  let ready = false;
  for (let i = 0; i < 400; i++) {
    const state = await evaluate(`document.querySelector('.sawt-dot')?.className ?? ""`);
    if (typeof state === "string" && state.includes("sawt-dot-listening")) { ready = true; listeningAt = Date.now(); break; }
    await sleep(1000);
  }
  const readyMs = ready ? Date.now() - t0 : null;

  // يُترك يسمع، ثمّ يُقاس تقدّمُ المؤشّر على كلمات المصحف
  let advanced = 0;
  if (ready) {
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      advanced = (await evaluate(`document.querySelectorAll('.sawt-past').length`)) ?? 0;
      if (advanced >= 8) break;
    }
  }
  const duringListening = requests.filter((r) => r.afterListening && !r.url.startsWith("data:"));
  await send("Browser.close").catch(() => {});
  await sleep(800);
  return { label, offline, clicks, ready, readyMs, advanced, requestsTotal: requests.length, duringListening: duringListening.map((r) => r.url).slice(0, 10), duringListeningCount: duringListening.length };
}

const warm = await session({ offline: false, label: "تشغيلةُ التخزين" });
const cold = await session({ offline: true, label: "تشغيلةُ الانقطاع" });
srv.close();

const ok = warm.ready && cold.ready && cold.advanced >= 8 && cold.duringListeningCount === 0;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ gate: "sawt-offline", ok, warm, cold }, null, 2)}\n`);

console.log(`فحصُ المحرّك الحرّ والشبكةُ مقطوعة: ${ok ? "أخضر" : "أحمر"}`);
for (const r of [warm, cold]) {
  console.log(`  ${r.label}${r.offline ? " (الشبكةُ مقطوعة)" : ""}: جاهزيّة ${r.ready ? `${(r.readyMs / 1000).toFixed(1)} ث` : "لم تقع"} · كلماتٌ مضت ${r.advanced} · طلباتُ شبكةٍ أثناء السمع ${r.duringListeningCount}`);
}
if (!ok && cold.duringListening.length) console.log(`  طلباتٌ في أثناء السمع: ${cold.duringListening.join(" · ")}`);
process.exit(ok ? 0 : 1);

/**
 * **أيقونةُ التلاوة نقطيّةً — بأحجام المانيفست كلِّها** (م٣ §١).
 *
 * الأصلُ الوحيدُ للرسم `icons/icon.svg` ونظيرتُها المربّعةُ `icons/icon-maskable.svg`
 * — **مكتوبتان بأيدينا في الملفّين**، وهذا السكربتُ لا يرسم شيئًا ولا يبتكر: يفتح
 * المتصفّحَ على الملفّ نفسِه بمقاسٍ بعينه ويلتقطه. فإن بُدّل الرسمُ بُدّلت
 * المشتقّاتُ كلُّها من مصدرٍ واحد، ولا تنحرف أيقونةٌ عن أختها.
 *
 * **ولِمَ نقطيّةٌ أصلًا والأصلُ SVG؟** لأنّ ما يُثبَّت على الأجهزة يقرؤه نظامُها
 * لا متصفّحُنا: أندرويدُ يطلب ١٩٢ و٥١٢ ومقنَّعةً، وآبلُ لا تعرف SVG في
 * `apple-touch-icon` ألبتّة. فالـSVG لأيقونة اللسان، والنقطيّاتُ للتثبيت.
 *
 * **وشفافيّةُ الأركان مقصودة**: `icon.svg` مستديرةٌ فأركانُها شفّافةٌ تُلتقط
 * شفّافةً؛ و`icon-maskable.svg` **مربّعةٌ ملأى** فتُلتقط بلا شفافيّةٍ ألبتّة —
 * وآبلُ تُسوِّد الشفّافَ، فأيقونتُها من المربّعة لا من المستديرة.
 *
 * التشغيل: node js/scripts/make-tilawa-icons.mjs
 *   → js/apps/tilawa/icons/{pwa-192,pwa-512,pwa-maskable-512,apple-touch-icon}.png
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ICONS = join(ROOT, "js", "apps", "tilawa", "icons");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9357;

/** ما يُشتقّ، وعن أيّ أصل — **والمقنَّعةُ أصلُ ما يُشتقّ لآبل** */
const WANTED = [
  { from: "icon.svg", out: "pwa-192.png", size: 192 },
  { from: "icon.svg", out: "pwa-512.png", size: 512 },
  { from: "icon-maskable.svg", out: "pwa-maskable-512.png", size: 512 },
  { from: "icon-maskable.svg", out: "apple-touch-icon.png", size: 180 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(CHROME)) {
  console.error("لا متصفّحَ كرومٍ على هذا الجهاز — ولا تُشتقّ الأيقونةُ بغيره");
  process.exit(1);
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/cdp-icons-${process.pid}`,
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(300);
  try {
    target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === "page");
  } catch {
    /* لم يقم بعد */
  }
}
if (!target) {
  chrome.kill();
  console.error("لم يقم المتصفّحُ على منفذ الأدوات");
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  const w = waiting.get(m.id);
  if (w) {
    waiting.delete(m.id);
    m.error ? w.reject(new Error(JSON.stringify(m.error))) : w.resolve(m.result);
  }
});
const send = (method, params = {}) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`لم يُجَب ${method}`)), 20000);
    waiting.set(id, {
      resolve: (v) => (clearTimeout(t), res(v)),
      reject: (e) => (clearTimeout(t), rej(e)),
    });
  });
};

await send("Page.enable");
/* **الأرضيّةُ شفّافةٌ عمدًا** — فما شفَّ في الرسم شفَّ في اللقطة، ولا يُدسّ بياضٌ */
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

const rows = [];
for (const w of WANTED) {
  const svg = readFileSync(join(ICONS, w.from), "utf8");
  await send("Emulation.setDeviceMetricsOverride", {
    width: w.size,
    height: w.size,
    deviceScaleFactor: 1,
    mobile: false,
  });
  /* الملفُّ نفسُه في صفحةٍ بمقاسه — و`viewBox` تكفّل بالتحجيم بلا تشويه */
  await send("Page.navigate", { url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` });
  await sleep(450);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const bytes = Buffer.from(shot.data, "base64");
  writeFileSync(join(ICONS, w.out), bytes);
  rows.push(`${w.out} ${w.size}×${w.size} ⇐ ${w.from} (${(bytes.length / 1024).toFixed(1)} ك.ب)`);
}

ws.close();
chrome.kill();
for (const r of rows) console.log(`  ✓ ${r}`);

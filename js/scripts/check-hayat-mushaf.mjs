/**
 * بوّابةُ هيئة المصحف — ج٥ (`findings/SESSION-J5-HAYAT-MUSHAF-PROMPT.md` §٢ و§٤).
 *
 * غايتُها أن يصير «لا باهتًا» **شرطًا يُقاس** لا ذوقًا يُتنازع فيه، وأن يُشهَد
 * **في متصفّحٍ حيّ** أنّ خطَّ المصحف المشحونَ هو الذي يرسم النصَّ فعلًا — لا أن
 * يُكتفى بإعلان `font-family` في ورقة الأنماط.
 *
 *   ١ — **الخطُّ حيًّا**: العائلةُ التي رسمت حروفَ `.mushaf-page .quran` **فعلًا**
 *       (من `CSS.getPlatformFontsForNode` — شهادةُ المحرّك لا شهادةُ الأنماط)
 *       هي المشحونةُ عندنا، **وملفُّها طُلب وحُمِّل** (٢٠٠ لا ٤٠٤)، **ولا يرسم
 *       حرفًا خطُّ نظامٍ عامّ**.
 *   ٢ — **التباين**: نصُّ المصحف مع ورقه **≥ ٧:١**، وعلاماتُه (رقمُ الآية ·
 *       لوحةُ السورة · رقمُ الصفحة · ۞) **≥ ٤٫٥:١** — في الأوضاع الثلاثة.
 *   ٣ — **وزنُ الحبر وأوسعُ فجوة**: يُقاسان ويُنشران (لا يُحمِّران) — فيُعرف أنّ
 *       الصفحةَ صارت أغنى وأنّ المطَّ زال **لا أنّه ظُنّ**.
 *
 * **والضبطُ السالب شرطُ صحّة** (قاعدةُ الإدارة 2026-08-13): يُعطَّل الشحنُ فتُصطاد
 * السقطةُ إلى خطّ النظام؛ ويُخفَّت لونُ العلامات فيُصطاد نقصُ التباين؛ ويُمطّ
 * السطرُ فتُصطاد الفجوة. **وزرعٌ لا أثرَ له ليس ضبطًا.**
 *
 * التشغيل: node js/scripts/check-hayat-mushaf.mjs [--shots <dir>]
 *          → js/data/gates/HAYAT-MUSHAF.json
 * (يبني السكربتُ خادمَ المعاينة على `dist/`؛ فإن لم يكن موجودًا أعلن ذلك.)
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STUDIO = join(ROOT, "js", "apps", "studio");
const SRC = join(STUDIO, "src");
const DIST = join(STUDIO, "dist");
const OUT = join(ROOT, "js", "data", "gates", "HAYAT-MUSHAF.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4187;
const CDP_PORT = 9349;

/** الحدودُ المعلَنة — البرومبت §٢ */
const MIN_TEXT_CONTRAST = 7;
const MIN_MARK_CONTRAST = 4.5;

/**
 * **أسماءُ خطوطنا كما يراها المحرّكُ نفسُه** — لا كما نسمّيها في `@font-face`.
 * (فاسمُنا «Scheherazade Q» يراه كرومٌ «Scheherazade New» من جدول اسم الملفّ.)
 * ولا يُكتفى بالاسم: **المدارُ على `isCustomFont`** — أي أنّ المحرّك رسم الحرفَ
 * من خطٍّ شحنّاه نحن لا من خطوط الجهاز. والاسمُ يُشترط فوق ذلك كي لا يمرّ
 * إبدالٌ صامتٌ لخطٍّ بخطّ.
 */
const SHIPPED_FACES = ["KFGQPC HAFS Uthmanic Script", "Scheherazade New", "Amiri Quran"];
/** والعائلةُ المنتظَرةُ افتراضًا — تُقرأ من `settings.ts` فلا يُكتب الافتراضُ مرّتين */
const FACE_OF = { kfgqpc: "KFGQPC HAFS Uthmanic Script", scheherazade: "Scheherazade New", amiri: "Amiri Quran" };

const shotsArg = process.argv.indexOf("--shots");
const SHOTS = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const failures = [];
const missing = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/* ═══════════════ ساكنًا: ما يُقرأ من الشيفرة قبل المتصفّح ═══════════════ */

/** كلُّ خطٍّ أُعلن بـ`@font-face` في `theme.css` ومصدرُه */
function declaredFaces() {
  const css = readFileSync(join(SRC, "theme.css"), "utf8");
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => ({
    family: (/font-family:\s*"([^"]+)"/.exec(m[1]) ?? [])[1],
    src: (/url\("([^"]+)"\)/.exec(m[1]) ?? [])[1],
    display: (/font-display:\s*([a-z-]+)/.exec(m[1]) ?? [])[1],
  }));
}

/** افتراضُ خطّ المصحف كما هو في `settings.ts` — يُقرأ ولا يُكرَّر */
function defaultQuranFont() {
  const s = readFileSync(join(SRC, "settings.ts"), "utf8");
  return (/quranFont:\s*"([a-z]+)"/.exec(s.slice(s.indexOf("DEFAULTS"))) ?? [])[1] ?? null;
}

function staticChecks() {
  const css = readFileSync(join(SRC, "theme.css"), "utf8");
  const faces = declaredFaces();
  for (const f of faces) {
    if (!f.src?.startsWith("/fonts/")) continue;
    const disk = join(STUDIO, "public", f.src);
    if (!existsSync(disk)) fail("خطٌّ معلَنٌ بلا ملفّ", `${f.family} ← ${f.src}`);
  }
  /* **الافتراضُ يُشحن**: `--font-quran` في `:root` لا يبدأ بعائلةٍ لا نشحنها —
     وهي عينُ السقطة التي فُتحت لها هذه الجلسة. */
  const rootVar = /:root\s*\{[^}]*--font-quran:\s*([^;]+);/s.exec(css);
  if (!rootVar) {
    fail("افتراضُ خطّ المصحف", "لا `--font-quran` في `:root`");
  } else {
    const firstFamily = rootVar[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
    const shipped = faces.some((f) => f.family === firstFamily) || firstFamily === "Amiri Quran";
    if (!shipped) fail("افتراضُ خطّ المصحف", `أوّلُ عائلةٍ في `+"`--font-quran`"+` هي «${firstFamily}» ولا نشحنها`);
    else notes.push(`افتراضُ خطّ المصحف عائلةٌ مشحونةٌ عندنا: «${firstFamily}»`);
  }
  /* ورخصةُ كلِّ خطٍّ مشحونٍ مكتوبةٌ في CREDITS.md — ولو بأنّها لم تثبت */
  const credits = readFileSync(join(ROOT, "CREDITS.md"), "utf8");
  for (const f of faces) {
    if (!f.src?.startsWith("/fonts/")) continue;
    const base = f.src.split("/").pop();
    if (!credits.includes(base)) fail("رخصةُ خطٍّ مشحونٍ غيرُ مقيَّدة", `${base} — لا ذِكرَ له في CREDITS.md`);
  }
  if (!failures.length) notes.push(`رخصةُ كلِّ خطٍّ مشحونٍ مقيَّدةٌ في CREDITS.md (${faces.filter((f) => f.src?.startsWith("/fonts/")).length} خطًّا)`);
}

/* ═══════════════ حيًّا في المتصفّح ═══════════════ */

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.waiting = new Map(); this.on = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method) { (this.on.get(m.method) ?? []).forEach((cb) => cb(m.params)); return; }
      const w = this.waiting.get(m.id);
      if (w) { this.waiting.delete(m.id); m.error ? w.reject(new Error(JSON.stringify(m.error))) : w.resolve(m.result); }
    });
  }
  listen(method, cb) { this.on.set(method, [...(this.on.get(method) ?? []), cb]); }
  /** **ولا نداءَ بلا توقيت** (درسُ ص-م٣): ما لم يُجَب يُقيَّد سقوطًا ولا يُنتظر أبدًا */
  send(method, params = {}, ms = 45000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.waiting.delete(id);
        rej(new Error(`لم يُجَب نداءُ ${method} في ${ms} مِث — انقطع الهدف`));
      }, ms);
      this.waiting.set(id, {
        resolve: (v) => { clearTimeout(t); res(v); },
        reject: (e) => { clearTimeout(t); rej(e); },
      });
    });
  }
  async ev(expr) {
    const r = await this.send("Runtime.evaluate", { expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "خطأٌ في الصفحة");
    return r.result.value;
  }
  async evAsync(expr) {
    const r = await this.send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "خطأٌ في الصفحة");
    return r.result.value;
  }
  async until(expr, ms = 60000, every = 250) {
    const t0 = Date.now();
    for (;;) {
      let v = false;
      try { v = await this.ev(`return !!(${expr});`); } catch { /* أثناء الانتقال */ }
      if (v) return true;
      if (Date.now() - t0 > ms) return false;
      await sleep(every);
    }
  }
  /**
   * العائلاتُ التي رسمت الحروفَ **فعلًا** — شهادةُ المحرّك لا شهادةُ الأنماط.
   *
   * **وحدُّ الأداة يُقال**: `CSS.getPlatformFontsForNode` يخبر عن **نصّ العقدة
   * نفسِها** لا عن شجرتها كلِّها؛ فلو سُئل عن وعاء المتن لم يُجب إلّا عن بضعة
   * حروفٍ من الفراغات بينه وبين أبنائه. **فتُسأل الكلماتُ أنفسُها** (`.w`)
   * عيّنةً واسعة، ويُجمع جوابُها — فتصير الشهادةُ عن مئات الحروف لا عن أربعة.
   */
  async platformFonts(selector, sample = 60) {
    const { root } = await this.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeIds } = await this.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
    if (!nodeIds?.length) return null;
    const agg = new Map();
    for (const nodeId of nodeIds.slice(0, sample)) {
      let fonts = [];
      try { ({ fonts } = await this.send("CSS.getPlatformFontsForNode", { nodeId })); } catch { continue; }
      for (const f of fonts) {
        const prev = agg.get(f.familyName) ?? { glyphs: 0, custom: f.isCustomFont, nodes: 0 };
        agg.set(f.familyName, { glyphs: prev.glyphs + f.glyphCount, custom: prev.custom && f.isCustomFont, nodes: prev.nodes + 1 });
      }
    }
    return [...agg.entries()].map(([family, v]) => ({ family, ...v })).sort((a, b) => b.glyphs - a.glyphs);
  }
}

/** يُقاس في الصفحة: الألوانُ والفجواتُ وحدُّ كتلة النصّ */
const MEASURE = `
const page = document.querySelector('.mushaf-page');
const q = page && page.querySelector('.mp-text');
if (!q) return null;
const cs = (el) => getComputedStyle(el);
/** لونُ الورق الفعليّ: أوّلُ سلفٍ خلفيّتُه غيرُ شفّافة */
const paperOf = (el) => {
  for (let n = el; n; n = n.parentElement) {
    const b = cs(n).backgroundColor;
    if (b && !/rgba?\\([^)]*,\\s*0\\)$/.test(b) && b !== 'transparent') return b;
  }
  return cs(document.body).backgroundColor;
};
const pick = (sel) => { const el = page.querySelector(sel); return el ? { color: cs(el).color, paper: paperOf(el), fontSize: cs(el).fontSize, fontWeight: cs(el).fontWeight, family: cs(el).fontFamily } : null; };

/* ── الفجواتُ بين الكلمات: مقياسُ المطّ ──
   **يُقاس ما بين كلمتين متجاورتين في ترتيب الشيفرة، من آيةٍ واحدة، على سطرٍ
   واحد** — فلا تُحسب علامةُ الآية فجوةً (وهي بينهما فتنفخ الرقمَ نفخًا)، ولا
   يُحسب انتقالُ سطرٍ فراغًا. والاتّجاهُ من اليمين إلى اليسار: التاليةُ في
   الشيفرة تقع يسارَ سابقتها، فالفجوةُ = يسارُ السابقة − يمينُ التالية.
   **وآخرُ سطرٍ يُطرح** فهو متوسّطٌ لا مُسوّى. */
const words = [...q.querySelectorAll('.w')];
const gaps = [];
const lineOf = new Map();
for (const w of words) {
  const r = w.getBoundingClientRect();
  if (r.width < 1) continue;
  lineOf.set(w, r);
}
const bottom = Math.max(...[...lineOf.values()].map((r) => r.top));
for (let i = 0; i + 1 < words.length; i++) {
  const a = lineOf.get(words[i]), b = lineOf.get(words[i + 1]);
  if (!a || !b) continue;
  if (words[i].closest('.mp-ayah') !== words[i + 1].closest('.mp-ayah')) continue; /* بينهما علامةُ آية */
  if (Math.abs(a.top - b.top) > 2) continue;            /* سطران لا سطر */
  if (Math.abs(a.top - bottom) < 2) continue;           /* آخرُ سطرٍ لا يُسوّى */
  const g = a.left - b.right;                            /* من اليمين إلى اليسار */
  if (g > -3 && g < 200) gaps.push(g);
}
const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
const sd = gaps.length ? Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length) : 0;
const sorted = [...gaps].sort((a, b) => a - b);
const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
const lineTops = [...new Set([...lineOf.values()].map((r) => Math.round(r.top)))];

const qr = q.getBoundingClientRect();
return {
  text: pick('.mp-text'),
  marker: pick('.ayah-marker'),
  surahName: pick('.mp-surah-name'),
  folio: pick('.page-no'),
  rub: pick('.mp-rub span'),
  margin: pick('.mp-margin span'),
  jamia: pick('.ayah-marker.jamia'),
  basmala: pick('.mp-basmala'),
  gaps: { n: gaps.length, lines: lineTops.length, max: gaps.length ? Math.max(...gaps) : 0, mean, sd, median },
  clip: { x: qr.left + window.scrollX, y: qr.top + window.scrollY, w: qr.width, h: Math.min(qr.height, 520) },
  quranBox: { w: qr.width, h: qr.height, words: words.length },
  align: { textAlign: cs(q).textAlign, lastLine: cs(q).textAlignLast, lineHeight: cs(q).lineHeight, wordSpacing: cs(q).wordSpacing },
};
`;

/** وزنُ الحبر: نسبةُ البكسلات الداكنة وكثافتُها المتوسّطة في لقطةٍ للمقطع نفسِه.
 *  تُفكّ اللقطةُ داخلَ الصفحة نفسِها على لوحٍ (`canvas`) — فلا تبعيّةَ خارجيّة. */
const INK = (b64) => `
const img = new Image();
await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,${b64}'; });
const c = document.createElement('canvas');
c.width = img.width; c.height = img.height;
const ctx = c.getContext('2d');
ctx.drawImage(img, 0, 0);
const d = ctx.getImageData(0, 0, c.width, c.height).data;
const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
/* لونُ الورق: المنوالُ — أكثرُ درجةٍ تكرارًا (الورقُ أغلبُ الصفحة) */
const hist = new Uint32Array(256);
for (let i = 0; i < d.length; i += 4) hist[Math.round(lum(i))]++;
let paper = 0; for (let v = 1; v < 256; v++) if (hist[v] > hist[paper]) paper = v;
let dark = 0, sum = 0, n = 0;
for (let i = 0; i < d.length; i += 4) {
  const L = lum(i);
  const ink = paper > 0 ? Math.max(0, (paper - L) / paper) : 0;   /* ورقٌ = ٠ · حبرٌ تامٌّ = ١ */
  sum += ink; n++;
  if (ink >= 0.5) dark++;
}
return { paperLum: paper, darkRatio: dark / n, meanInk: sum / n, px: n, w: c.width, h: c.height };
`;

/* ── حسابُ التباين (WCAG 2.1) من ألوانٍ محسوبةٍ في المتصفّح ── */
/** يُقرأ ما يخرجه كرومٌ فعلًا: `rgb()` و`rgba()` **و`color(srgb …)`** —
 *  وهذه الأخيرةُ مخرَجُ `color-mix(in srgb, …)` وعليها بُني طقمُ المصحف كلُّه،
 *  فلو أُهملت لقُرئ كلُّ تباينٍ صفرًا وهو غيرُ صفر. */
const parse = (c) => {
  if (!c) return null;
  const srgb = /color\(\s*srgb\s+([^)]+)\)/.exec(c);
  if (srgb) {
    const p = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
    return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 };
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
};
const relLum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (fg, bg) => {
  const a = parse(fg), b = parse(bg);
  if (!a || !b) return null;
  /* لونُ نصٍّ شبهُ شفّافٍ يُمزج بورقه أوّلًا */
  const mix = a.a < 1 ? { r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a) } : a;
  const L1 = relLum(mix), L2 = relLum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

const PRELUDE = (theme) => `
try {
  localStorage.setItem('quran-studio:reader-mode', 'pages');
  localStorage.setItem('mishkat:welcomed-v1', '1');
  const k = 'quran-studio:settings';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.theme = ${JSON.stringify(theme)};
  localStorage.setItem(k, JSON.stringify(s));
} catch (e) {}
`;

const THEMES = [
  { id: "فاتح", key: "light" },
  { id: "ورقيّ", key: "sepia" },
  { id: "داكن", key: "dark" },
];

/** المواضعُ التي تُقاس وتُصوَّر */
const PLACES = [
  { id: "صفحةٌ متّصلة", route: "/read/2", file: "m-baqara" },
  { id: "صفحةٌ تبدأ فيها سورة", route: "/read/67", file: "m-mulk" },
  { id: "الفاتحة", route: "/read/1", file: "m-fatiha" },
  { id: "آيةٌ معلَّمة", route: "/read/2/5", file: "m-target" },
];

let preview = null, chrome = null, ws = null;
const measures = { };

async function live() {
  if (!existsSync(join(DIST, "index.html"))) { missing.push("لا بناءَ في dist — تُشغَّل البوّابةُ بعد pnpm build"); return; }
  if (!existsSync(CHROME)) { missing.push("لا متصفّحَ كرومٍ على هذا الجهاز — لا تُقاس شجرةُ العرض بغيره"); return; }

  preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: STUDIO, stdio: "ignore" });
  chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/cdp-hayat-${process.pid}`, "--no-first-run", "--disable-gpu", "about:blank",
  ], { stdio: "ignore" });

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(500);
    try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === "page"); } catch { /* لم يقم */ }
  }
  if (!target) { missing.push("لم يقم المتصفّحُ على منفذ الأدوات"); return; }

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  await cdp.send("Network.enable");

  /* كلُّ طلبِ خطٍّ ونتيجتُه — فلا يُقال «حُمِّل» ولم يُطلب، ولا يُسكَت عن ٤٠٤ */
  const fontReq = new Map();
  cdp.listen("Network.responseReceived", (p) => {
    if (p.type === "Font" || /\.(woff2?|ttf|otf)(\?|$)/.test(p.response.url)) {
      fontReq.set(p.response.url, { status: p.response.status, mime: p.response.mimeType });
    }
  });
  cdp.listen("Network.loadingFailed", (p) => {
    if (p.type === "Font") fontReq.set(`(أخفق ${p.requestId})`, { status: 0, error: p.errorText });
  });

  const run = [];
  for (const th of THEMES) {
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE(th.key) });
    for (const pl of PLACES) {
      /* الجوالُ (٣٩٠) أوّلًا ثمّ الحاسوب — والقياسُ كلُّه على الجوال، والحاسوبُ لقطةً */
      for (const vp of [{ w: 390, h: 844, dsf: 2, mobile: true, tag: "m" }, { w: 1440, h: 900, dsf: 1, mobile: false, tag: "d" }]) {
        if (vp.tag === "d" && th.key !== "light") continue;   /* الحاسوبُ لقطةً في الفاتح وحدَه */
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: vp.dsf, mobile: vp.mobile });
        await cdp.send("Page.navigate", { url: "about:blank" });
        await sleep(150);
        await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#${pl.route}` });
        const ok = await cdp.until(`!document.querySelector('.boot') && document.querySelector('.mushaf-page .mp-text .w')`);
        if (!ok) { missing.push(`لم يظهر «${pl.id}» (${th.id})`); continue; }
        await cdp.ev(`await document.fonts.ready; return true;`).catch(() => {});
        await sleep(900);

        if (vp.tag === "m") {
          const m = await cdp.ev(MEASURE);
          if (!m) { missing.push(`لم يُقَس «${pl.id}» (${th.id})`); continue; }
          const fonts = await cdp.platformFonts(".mushaf-page .mp-text .w");
          /* وزنُ الحبر: لقطةٌ لكتلة النصّ وحدَها ثمّ عدُّ بكسلاتها */
          let ink = null;
          try {
            const clip = { x: m.clip.x, y: m.clip.y, width: m.clip.w, height: m.clip.h, scale: 1 };
            const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
            ink = await cdp.evAsync(INK(shot.data));
          } catch (e) { ink = { error: String(e.message ?? e) }; }
          run.push({ theme: th.id, place: pl.id, fonts, ink, ...m });
        }

        if (SHOTS) {
          const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(SHOTS, `${vp.tag}-${pl.file}-${th.key}.png`), Buffer.from(shot.data, "base64"));
        }
      }
    }
  }
  measures.run = run;
  measures.fonts = [...fontReq.entries()].map(([url, v]) => ({ url: url.replace(/^https?:\/\/[^/]+/, ""), ...v }));

  /* ═══ ١ — الخطُّ حيًّا ═══ */
  const seen = new Map();
  for (const r of run) for (const f of r.fonts ?? []) {
    const prev = seen.get(f.family) ?? { glyphs: 0, custom: f.custom };
    seen.set(f.family, { glyphs: prev.glyphs + f.glyphs, custom: prev.custom && f.custom });
  }
  measures.platformFonts = [...seen.entries()].map(([family, v]) => ({ family, ...v })).sort((a, b) => b.glyphs - a.glyphs);
  const strangers = measures.platformFonts.filter((f) => !f.custom || !SHIPPED_FACES.includes(f.family));
  const allGlyphs = measures.platformFonts.reduce((a, f) => a + f.glyphs, 0);
  const want = FACE_OF[defaultQuranFont()] ?? null;
  if (!allGlyphs) fail("خطُّ المصحف حيًّا", "لم يُبلَّغ عن عائلةٍ واحدةٍ رسمت حروفَ المصحف");
  else if (strangers.length) {
    fail("خطُّ المصحف حيًّا — رسمَ حروفَ المصحف خطٌّ لا نشحنه",
      strangers.map((f) => `${f.family}: ${f.glyphs} حرفًا (مشحونٌ عندنا: ${f.custom ? "نعم" : "لا"})`).join(" · "));
  } else {
    notes.push(`خطُّ المصحف حيًّا (شهادةُ المحرّك): ${measures.platformFonts.map((f) => `«${f.family}» ${f.glyphs} حرفًا`).join(" · ")} — كلُّها من خطوطنا المشحونة (isCustomFont)`);
  }
  /* ولا يمرُّ إبدالٌ صامت: العائلةُ الغالبةُ هي عينُ افتراض `settings.ts` */
  if (want && measures.platformFonts.length && measures.platformFonts[0].family !== want) {
    fail("خطُّ المصحف حيًّا — غيرُ الافتراض المعلَن",
      `افتراضُ settings.ts «${defaultQuranFont()}» ⇒ «${want}»، والذي رسم فعلًا «${measures.platformFonts[0].family}»`);
  } else if (want) {
    notes.push(`والعائلةُ الغالبةُ عينُ افتراض settings.ts: «${defaultQuranFont()}» ⇒ «${want}»`);
  }
  const loaded = measures.fonts.filter((f) => /\/fonts\//.test(f.url) || /woff2?$/.test(f.url));
  const bad = loaded.filter((f) => f.status !== 200);
  if (!loaded.length) fail("ملفُّ الخطّ", "لم يُطلب ملفُّ خطٍّ واحدٍ — فالرسمُ من خطوط الجهاز");
  else if (bad.length) fail("ملفُّ الخطّ", bad.map((f) => `${f.url} → ${f.status}${f.error ? " " + f.error : ""}`).join(" · "));
  else notes.push(`ملفّاتُ الخطوط طُلبت وحُمِّلت: ${loaded.map((f) => `${f.url.split("/").pop()} → ${f.status}`).join(" · ")}`);

  /* ═══ ٢ — التباين ═══ */
  const table = [];
  for (const r of run) {
    const row = { theme: r.theme, place: r.place };
    row["نصّ"] = round(contrast(r.text?.color, r.text?.paper) ?? 0);
    row["علامةُ الآية"] = r.marker ? round(contrast(r.marker.color, r.marker.paper) ?? 0) : null;
    row["اسمُ السورة"] = r.surahName ? round(contrast(r.surahName.color, r.surahName.paper) ?? 0) : null;
    row["رقمُ الصفحة"] = r.folio ? round(contrast(r.folio.color, r.folio.paper) ?? 0) : null;
    row["۞"] = r.rub ? round(contrast(r.rub.color, r.rub.paper) ?? 0) : null;
    row["علامةُ الكلّيّة"] = r.jamia ? round(contrast(r.jamia.color, r.jamia.paper) ?? 0) : null;
    row["البسملة"] = r.basmala ? round(contrast(r.basmala.color, r.basmala.paper) ?? 0) : null;
    table.push(row);
  }
  measures.contrast = table;
  const lowText = table.filter((r) => r["نصّ"] < MIN_TEXT_CONTRAST);
  if (lowText.length) fail(`تباينُ نصّ المصحف < ${MIN_TEXT_CONTRAST}:١`, lowText.map((r) => `${r.place} (${r.theme}): ${r["نصّ"]}`).join(" · "));
  else notes.push(`تباينُ نصّ المصحف ≥ ${MIN_TEXT_CONTRAST}:١ في ${table.length} حالةً — أدناه ${round(Math.min(...table.map((r) => r["نصّ"])))}`);

  const MARKS = ["علامةُ الآية", "اسمُ السورة", "رقمُ الصفحة", "۞", "علامةُ الكلّيّة", "البسملة"];
  const lowMark = [];
  for (const r of table) for (const k of MARKS) if (r[k] != null && r[k] < MIN_MARK_CONTRAST) lowMark.push(`${k} — ${r.place} (${r.theme}): ${r[k]}`);
  if (lowMark.length) fail(`تباينُ علاماتِ المصحف < ${MIN_MARK_CONTRAST}:١`, lowMark.join(" · "));
  else {
    const all = table.flatMap((r) => MARKS.map((k) => r[k]).filter((v) => v != null));
    notes.push(`تباينُ العلامات ≥ ${MIN_MARK_CONTRAST}:١ في ${all.length} قياسًا — أدناه ${round(Math.min(...all))}`);
  }

  /* ═══ ٣ — وزنُ الحبر وأوسعُ فجوة: يُنشران ولا يُحمِّران ═══ */
  measures.ink = run.map((r) => ({
    theme: r.theme, place: r.place,
    darkRatio: r.ink?.darkRatio != null ? round(r.ink.darkRatio, 4) : null,
    meanInk: r.ink?.meanInk != null ? round(r.ink.meanInk, 4) : null,
    paperLum: r.ink?.paperLum ?? null,
  }));
  measures.gaps = run.map((r) => ({
    theme: r.theme, place: r.place,
    n: r.gaps.n, lines: r.gaps.lines, max: round(r.gaps.max, 1), mean: round(r.gaps.mean, 2),
    sd: round(r.gaps.sd, 2), median: round(r.gaps.median, 2), align: r.align,
  }));
  const worst = measures.gaps.filter((g) => g.n > 0).sort((a, b) => b.max - a.max)[0];
  if (worst) notes.push(`أوسعُ فجوةٍ بين كلمتين: ${worst.max}px (${worst.place} · ${worst.theme}) · وسيطُها ${worst.median} · متوسّطُها ${worst.mean} · تفاوتُها (انحرافٌ معياريّ) ${worst.sd}`);
  const inkLight = measures.ink.find((i) => i.theme === "فاتح" && i.place === "صفحةٌ متّصلة");
  if (inkLight) notes.push(`وزنُ الحبر (صفحةٌ متّصلة · فاتح): بكسلاتٌ داكنة ${round(inkLight.darkRatio * 100, 2)}٪ · كثافةٌ متوسّطة ${round(inkLight.meanInk * 100, 2)}٪`);

  /* ═══ الضبطُ السالب: زرعٌ **له أثر** ═══ */
  await negatives(cdp);
}

/**
 * الضبطُ السالب — ثلاثةُ زروعٍ في الصفحة الحيّة، كلٌّ يُصطاد ثمّ يُزال فتعود
 * القياساتُ إلى ما كانت. **وزرعٌ لا أثرَ له ليس ضبطًا** (قاعدةُ الإدارة).
 */
async function negatives(cdp) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Page.navigate", { url: "about:blank" });
  await sleep(150);
  await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
  const ok = await cdp.until(`!document.querySelector('.boot') && document.querySelector('.mushaf-page .mp-text .w')`);
  if (!ok) { missing.push("لم يظهر سطحُ الضبط السالب"); return; }
  await cdp.ev(`await document.fonts.ready; return true;`).catch(() => {});
  await sleep(600);

  /** **الوضعُ الفاتحُ صريحًا**: القياسُ التالي يُقارن ألوانًا، فلا يُترك للوضع
   *  المحفوظِ من تشغيلةٍ سابقة — ولون «خافتٍ» على ورقٍ فاتحٍ يصير عاليَ التباين
   *  على ورقٍ داكن، فينقلب الضبطُ السالبُ على نفسه. */
  await cdp.ev(`document.documentElement.dataset.theme = 'light'; return true;`);
  await sleep(250);

  /**
   * **وزرعٌ لا أثرَ له ليس ضبطًا** (قاعدةُ الإدارة 2026-08-13، ودرسُ ج٣ حين زُرع
   * خارجَ المرأى فلم يُصطَد): فلا يُكتفى بإلحاق ورقةِ الزرع — **يُتحقَّق أنّ
   * القيمةَ المحسوبةَ تغيّرت فعلًا** على العنصر المقصود، وإلّا حُمِّرت البوّابةُ
   * على الزرع نفسِه لا على المفحوص.
   */
  const plant = async (css, witness, prop) => {
    const before = await cdp.ev(`return getComputedStyle(document.querySelector(${JSON.stringify(witness)}))[${JSON.stringify(prop)}];`);
    await cdp.ev(`
      const s = document.createElement('style'); s.id = 'j5-plant'; s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s); return true;`);
    await sleep(350);
    const after = await cdp.ev(`return getComputedStyle(document.querySelector(${JSON.stringify(witness)}))[${JSON.stringify(prop)}];`);
    if (before === after) fail("ضبطٌ سالب", `زُرع «${css.slice(0, 48)}…» فلم يتغيّر ${prop} على «${witness}» — زرعٌ لا أثرَ له`);
    return { before, after };
  };
  const unplant = async () => { await cdp.ev(`document.getElementById('j5-plant')?.remove(); return true;`); await sleep(300); };

  const done = [];

  /* ١) يُعطَّل الشحنُ: يُفرض `serif` النظام — فتُصطاد السقطة */
  await plant(`.mushaf-page .mp-text, .mushaf-page .mp-text * { font-family: "Times New Roman", serif !important; }`,
    ".mushaf-page .mp-text .w", "fontFamily");
  let f = await cdp.platformFonts(".mushaf-page .mp-text .w");
  let strangers = (f ?? []).filter((x) => !x.custom || !SHIPPED_FACES.includes(x.family));
  if (!strangers.length) fail("ضبطٌ سالب", "عُطِّل الشحنُ فلم تُصطَد السقطةُ إلى خطّ النظام");
  else done.push(`عُطِّل الشحنُ فاصطيدت السقطة (${strangers.map((x) => x.family).join(" · ")})`);
  await unplant();
  f = await cdp.platformFonts(".mushaf-page .mp-text .w");
  if ((f ?? []).some((x) => !x.custom || !SHIPPED_FACES.includes(x.family))) fail("ضبطٌ سالب", "أُزيل الزرعُ ولم يعُد الخطُّ المشحون — قياسٌ غيرُ مستقرّ");
  else done.push("وأُزيل الزرعُ فعاد الخطُّ المشحون — قياسٌ مستقرّ");

  /* ٢) يُخفَّت لونُ العلامات — فيُصطاد نقصُ التباين */
  await plant(`.mushaf-page .ayah-marker { color: #cbbfa6 !important; }`, ".mushaf-page .ayah-marker", "color");
  let m = await cdp.ev(MEASURE);
  let c = contrast(m.marker.color, m.marker.paper);
  if (c >= MIN_MARK_CONTRAST) fail("ضبطٌ سالب", `خُفِّت لونُ العلامة فلم يُصطَد (${round(c)})`);
  else done.push(`خُفِّت لونُ العلامة فاصطيد نقصُ التباين (${round(c)} < ${MIN_MARK_CONTRAST})`);
  await unplant();
  m = await cdp.ev(MEASURE);
  c = contrast(m.marker.color, m.marker.paper);
  if (c < MIN_MARK_CONTRAST) fail("ضبطٌ سالب", "أُزيل الزرعُ ولم يعُد التباين");
  else done.push(`وعاد بعد الإزالة (${round(c)})`);

  /* ٣) يُمطُّ السطرُ — فتُصطاد الفجوة (فحصُ المقياس نفسِه لا الصفحة) */
  const base = (await cdp.ev(MEASURE)).gaps;
  await plant(`.mushaf-page .mp-text { word-spacing: 14px !important; }`, ".mushaf-page .mp-text", "wordSpacing");
  const wide = (await cdp.ev(MEASURE)).gaps;
  if (!(wide.max > base.max + 6)) fail("ضبطٌ سالب", `مُطَّ السطرُ فلم يرصد المقياسُ اتّساعًا (${round(base.max, 1)} → ${round(wide.max, 1)})`);
  else done.push(`مُطَّ السطرُ فرصد المقياسُ الاتّساع (أوسعُ فجوةٍ ${round(base.max, 1)} → ${round(wide.max, 1)}px)`);
  await unplant();
  const back = (await cdp.ev(MEASURE)).gaps;
  if (Math.abs(back.max - base.max) > 3) fail("ضبطٌ سالب", `أُزيل الزرعُ ولم تعُد الفجوةُ (${round(base.max, 1)} ← ${round(back.max, 1)})`);
  else done.push(`وعادت بعد الإزالة (${round(back.max, 1)}px)`);

  /* ٤) وبريءٌ لا يُصطاد: خطُّ الواجهة في القشرة ليس خطَّ المصحف */
  await plant(`.mp-margin { font-family: "Times New Roman", serif !important; }`, ".mp-margin", "fontFamily");
  const f2 = await cdp.platformFonts(".mushaf-page .mp-text .w");
  if ((f2 ?? []).some((x) => !x.custom || !SHIPPED_FACES.includes(x.family))) fail("ضبطٌ سالب", "اصطاد الفحصُ بريئًا: خطُّ هامشٍ ليس خطَّ المصحف");
  else done.push("وبريءٌ لم يُصطَد: خطٌّ غريبٌ في هامش الصفحة لا يمسّ نصَّ المصحف");
  await unplant();

  notes.push("ضبطٌ سالبٌ حيّ: " + done.join(" · "));
}

/* ═══════════════ التشغيل ═══════════════ */

try {
  staticChecks();
  await live();
} catch (e) {
  fail("تشغيلُ البوّابة", String(e?.message ?? e));
} finally {
  try { ws?.close(); } catch { /* مغلقٌ سلفًا */ }
  chrome?.kill();
  preview?.kill();
}

const ok = failures.length === 0 && missing.length === 0;
const report = {
  gate: "هيئةُ المصحف — الخطُّ والتباينُ ووزنُ الحبر (ج٥)",
  ok, at: new Date().toISOString(),
  limits: { textContrast: MIN_TEXT_CONTRAST, markContrast: MIN_MARK_CONTRAST },
  notes, failures, missing,
  platformFonts: measures.platformFonts ?? [],
  fontFiles: measures.fonts ?? [],
  contrast: measures.contrast ?? [],
  ink: measures.ink ?? [],
  gaps: measures.gaps ?? [],
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

for (const n of notes) console.log("✓ " + n);
for (const m of missing) console.log("… " + m);
for (const f of failures) console.log(`✗ ${f.check} — ${f.detail}`);
console.log(ok ? "\nبوّابةُ هيئة المصحف: خضراء" : "\nبوّابةُ هيئة المصحف: حمراء");
process.exit(ok ? 0 : 1);

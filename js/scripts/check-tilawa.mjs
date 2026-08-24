/**
 * **بوّابةُ «التلاوة» الحيّة** — أوّلُ حارسٍ حيٍّ للتطبيق الجديد (بندُ ف٣ §٥).
 *
 * قبلها كان الفحصُ الساكنُ وحدَه يشمل التلاوة (`check-wajh` — ف٢ §٥)، **والحكمُ
 * الذي فُصلت التلاوةُ لأجله لا يُفحص في الشيفرة**: أن يجري المؤشّرُ على **كلمات
 * صفحة المصحف بأعيانها** لا على سطح نصٍّ ثانٍ يُرسم فوقها. فهذا لا يُشهد إلّا في
 * شجرة عرضٍ حيّة، على البناء المنشور، بعرض ٣٩٠.
 *
 * وخمسةُ أبوابٍ ههنا، ولكلٍّ ضبطُه السالب:
 *
 *   ١ — **الإقلاع**: مصحفٌ بترويساته يظهر، **وصفرُ تسريبٍ أفقيّ**.
 *   ٢ — **الهيئةُ حرفًا بعد تقسيم الكلمات**: تُقاس صناديقُ سطور كلِّ آيةٍ
 *       مرسومةً كلماتٍ، ثمّ تُلحَم الكلماتُ في الشجرة نصًّا واحدًا وتُقاس ثانيةً
 *       **على البناء نفسِه** — فإن تبدّل صندوقٌ أو حرفٌ حمُرت البوّابة. **وضبطُه**:
 *       تُزاد حشوةٌ على الكلمات فيُصطاد الانزياحُ باسمه.
 *   ٣ — **لمسةُ الميكروفون تقلب الصفحةَ حالًا في مكانها**: لا انتقالَ مسارٍ ولا
 *       شاشةَ بدء؛ **والإعلانُ يسبق الميكروفون** (يُسأل عن المحرّك، ثمّ يُقرأ سطرُ
 *       صدقه، ثمّ يُؤذَن) — بجواسيسَ تعُدّ ما وقع لا ما يُظنّ. **والبدءُ من أوّل
 *       آيةٍ مرئيّةٍ لا من الموضع المحفوظ** (يُزرع محفوظٌ بعيدٌ فلا يُقفز إليه).
 *   ٤ — **المؤشّرُ على كلمات الصفحة**: يُطعَم المحرّكُ الساكنُ كلماتِ الصفحة
 *       نفسِها، فيمضي المؤشّرُ عليها **وهي عناصرُ `.mushaf-page`**، والقشرةُ
 *       منسحبةٌ والنصُّ ساكنٌ بالبكسل. **وضبطُه**: يُزرع سطحُ نصٍّ ثانٍ فوق
 *       المصحف فيُصطاد، ثمّ يُزال فتخضرّ.
 *   ٥ — **ميثاقٌ مصغَّر**: لمسٌ ≥٤٤ · نصٌّ ≥١٥ · **لا حوارات** (تُنصب جواسيسُ
 *       على `alert/confirm/prompt` فتُعدّ) · وأرضيّةُ الأوراق معتمة. **وضبطُه**:
 *       يُصغَّر هدفُ لمسٍ ويُشفَّف ظهرُ الورقة فيُصطادان، ثمّ يُزالان فتخضرّ.
 *
 * **ومحرّكُ التعرّف يُستبدل بساكنٍ لا يسمع شيئًا** — فالمفحوصُ شجرةُ العرض وسلوكُ
 * الإذن، لا جودةُ السمع؛ والاستبدالُ عند حدِّ `RecognizerPort` الذي بُني ليُبدَّل،
 * فلا يُمَسّ من شيفرتنا حرف. **ولا يُختار المحرّكُ الحرُّ ههنا** كي لا تُنزَّل
 * ٨٣ م.ب في بوّابة.
 *
 * التشغيل: node js/scripts/check-tilawa.mjs [--shots <dir>]
 *          → js/data/gates/TILAWA.json
 * (يبني السكربتُ خادمَ المعاينة بنفسه على `dist/`؛ فإن لم يكن موجودًا أعلن ذلك
 *  ولم يمرّ صامتًا.)
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = join(ROOT, "js", "apps", "tilawa");
const DIST = join(APP, "dist");
const OUT = join(ROOT, "js", "data", "gates", "TILAWA.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4187;
const CDP_PORT = 9351;
const URL = `http://localhost:${PORT}/`;

/** حدّا ميثاق الوجه §١ — هما هما في التطبيقين */
const MIN_TAP = 44;
const MIN_TEXT = 15;

/** لقطاتٌ تُحفظ إن طُلبت — `--shots <dir>` */
const shotsAt = process.argv.includes("--shots")
  ? process.argv[process.argv.indexOf("--shots") + 1]
  : null;

const failures = [];
const missing = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════ عُدّةُ التسيير ═══════════════ */

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.waiting = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      const w = this.waiting.get(m.id);
      if (w) {
        this.waiting.delete(m.id);
        m.error ? w.reject(new Error(JSON.stringify(m.error))) : w.resolve(m.result);
      }
    });
  }
  /** **ولا نداءَ بلا توقيت** — هدفٌ منقطعٌ يعلّق الفحصَ صامتًا (درسُ check-wajh) */
  send(method, params = {}, ms = 45000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.waiting.delete(id);
        rej(new Error(`لم يُجَب نداءُ ${method} في ${ms} مِث — انقطع الهدف`));
      }, ms);
      this.waiting.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          res(v);
        },
        reject: (e) => {
          clearTimeout(t);
          rej(e);
        },
      });
    });
  }
  async ev(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(() => { ${expr} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "خطأٌ في الصفحة");
    return r.result.value;
  }
  async until(expr, ms = 45000, every = 250) {
    const t0 = Date.now();
    for (;;) {
      let v = false;
      try {
        v = await this.ev(`return !!(${expr});`);
      } catch {
        /* أثناء الانتقال */
      }
      if (v) return true;
      if (Date.now() - t0 > ms) return false;
      await sleep(every);
    }
  }
  async shot(name) {
    if (!shotsAt) return;
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(shotsAt, { recursive: true });
    writeFileSync(join(shotsAt, `${name}.png`), Buffer.from(r.data, "base64"));
    notes.push(`لقطةٌ محفوظة: ${name}.png (٣٩٠)`);
  }
}

/**
 * ما يُحقن قبل تحميل الصفحة:
 *  • **محرّكٌ ساكنٌ** مكانَ محرّك المتصفّح، وجواسيسُ على بابَي الصوت؛
 *  • **وجواسيسُ على حوارات المتصفّح** — فالميثاقُ يمنعها، وعدُّها أصدقُ من قراءة
 *    الشيفرة (وقد تُستدعى من رزمةٍ لا من ملفّاتنا)؛
 *  • **وموضعٌ محفوظٌ بعيدٌ يُزرع** لحال المراجعة (البقرة ٢٥٥) — فيُشهد أنّ البدء
 *    من **المرئيّ** لا من المحفوظ (درسُ ج٩ §٣).
 */
const PRELUDE = `
window.__spy = { recognizers: 0, starts: 0, getUserMedia: 0, dialogs: [] };
class StubRecognition {
  constructor() { window.__spy.recognizers++; this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null; }
  start() { window.__spy.starts++; window.__rec = this; if (this.onstart) setTimeout(() => this.onstart(), 0); }
  stop() { if (this.onend) setTimeout(() => this.onend(), 0); }
  abort() {}
}
Object.defineProperty(window, 'SpeechRecognition', { value: StubRecognition, writable: true, configurable: true });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: StubRecognition, writable: true, configurable: true });
if (navigator.mediaDevices) {
  const real = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function (...a) {
    window.__spy.getUserMedia++;
    return real ? real(...a) : Promise.reject(new Error('no media'));
  };
}
for (const k of ['alert', 'confirm', 'prompt']) {
  const f = function () { window.__spy.dialogs.push(k); return k === 'confirm' ? true : ''; };
  Object.defineProperty(window, k, { value: f, writable: true, configurable: true });
}
try {
  for (const k of ['sawt.consent.v1','sawt.hal.v1','sawt.engine.v1','sawt.declared.v1','sawt.mark.v1','tilawa.settings.v1','quran-studio:last-read','quran-studio:mawdi:mushaf']) localStorage.removeItem(k);
  localStorage.setItem('quran-studio:mawdi:murajaa', JSON.stringify({ location: '2:255', at: '2026-08-01T00:00:00.000Z' }));
  localStorage.setItem('quran-studio:mawdi:khatma', JSON.stringify({ location: '18:1', at: '2026-08-01T00:00:00.000Z' }));
} catch (e) {}
`;

const click = (sel) => `
const el = document.querySelector('${sel}');
if (!el) return false;
el.click();
return true;
`;

/** كلماتُ الصفحة المرسومةُ عناصرَ، وموضعُ المؤشّر منها */
const WORDS = `
const spans = [...document.querySelectorAll('[data-w]')];
const at = spans.findIndex((s) => s.classList.contains('tw-cursor'));
const cur = at >= 0 ? spans[at] : null;
return {
  n: spans.length,
  at,
  loc: cur ? cur.dataset.w : null,
  /** **الشاهدُ الأكبر**: أهي عنصرٌ من عناصر صفحة المصحف أم من سطحٍ ثانٍ؟ */
  inPage: cur ? !!cur.closest('.mushaf-page .mp-text') : null,
  /** كلُّ ما وُسم كلمةً — أكلُّه من صفحة المصحف؟ */
  strays: spans.filter((s) => !s.closest('.mushaf-page .mp-text')).length,
  say: cur ? cur.textContent : null,
};
`;

/** ما يُلمس وما يُقرأ **ظاهرًا** — ميثاقٌ مصغَّر (§٥/٣) */
const CHARTER = `
const vis = (el) => {
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
  return { r, st };
};
const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
const small = [], tiny = [];
for (const el of document.querySelectorAll('button, a[href], select, summary, [role="button"], input')) {
  const v = vis(el); if (!v) continue;
  const w = Math.round(v.r.width), h = Math.round(v.r.height);
  if (w >= ${MIN_TAP} && h >= ${MIN_TAP}) continue;
  small.push({ what: name(el), w, h, cls: el.className.toString().slice(0, 40) });
}
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const seen = new Set();
for (let n = walker.nextNode(); n; n = walker.nextNode()) {
  const s = (n.textContent || '').trim();
  if (s.length < 2) continue;
  const el = n.parentElement; if (!el || seen.has(el)) continue;
  seen.add(el);
  const v = vis(el); if (!v) continue;
  const fs = parseFloat(v.st.fontSize);
  if (fs < ${MIN_TEXT}) tiny.push({ text: s.slice(0, 22), px: Math.round(fs * 10) / 10, cls: el.className.toString().slice(0, 40) });
}
return { small, tiny, taps: document.querySelectorAll('button, select').length };
`;

/** أرضيّةُ الورقة: **أوّلُ سلفٍ خلفيّتُه معتمةٌ تمامًا** — أمن الورقة هو أم من الصفحة تحتها؟ */
const SHEET_GROUND = `
const sh = document.querySelector('.tw-sheet');
if (!sh) return { error: 'لا ورقةَ مفتوحة' };
const alpha = (v) => { const p = (v.match(/[\\d.]+/g) ?? []).map(Number); return p.length < 4 ? (p.length ? 1 : 0) : p[3]; };
const host = (el) => { for (let n = el; n; n = n.parentElement) { if (alpha(getComputedStyle(n).backgroundColor) >= 0.999) return n; } return null; };
const rows = [...sh.querySelectorAll('button, p, h2, span')].filter((el) => el.getBoundingClientRect().height > 1).slice(0, 14).map((el) => {
  const h = host(el);
  return { what: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 16), host: h ? (h.className || h.tagName).toString().slice(0, 24) : null, grounded: !!h && sh.contains(h) };
});
const r = sh.getBoundingClientRect();
const q = document.querySelector('.mushaf-page');
const qr = q ? q.getBoundingClientRect() : null;
const overQuran = !!qr && !(r.right <= qr.left || r.left >= qr.right || r.bottom <= qr.top || r.top >= qr.bottom);
return { n: rows.length, rows, overQuran };
`;

/**
 * **الهيئةُ حرفًا** (§٥/٢): تُقاس صناديقُ **سطور** كلِّ آيةٍ — لا صندوقُها الجامع
 * وحدَه — فتُشهد التسويةُ وقَطعُ السطر بالبكسل. ثمّ تُلحَم الكلماتُ نصًّا واحدًا
 * (كما كانت الصفحةُ قبل التقسيم) وتُقاس ثانيةً.
 */
const SHAPE = `
const out = [];
for (const ay of document.querySelectorAll('.mushaf-page .mp-ayah')) {
  const lines = [...ay.getClientRects()].map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]);
  out.push({ id: ay.dataset.ayah, lines, text: ay.textContent });
}
const pages = [...document.querySelectorAll('.mushaf-page')].map((p) => Math.round(p.getBoundingClientRect().height));
return { ayat: out, pages, scroll: Math.round(document.querySelector('.tw-read').scrollTop) };
`;

/** اللحمُ: تُجمع الكلماتُ نصًّا واحدًا **وتبقى ميداليّةُ الرقم عنصرًا** كما هي */
const WELD = `
let n = 0;
for (const ay of document.querySelectorAll('.mushaf-page .mp-ayah')) {
  const marker = ay.querySelector('.ayah-marker');
  if (!marker) continue;
  let text = '';
  for (const node of [...ay.childNodes]) {
    if (node === marker) break;
    text += node.textContent;
    node.remove();
  }
  ay.insertBefore(document.createTextNode(text), marker);
  n++;
}
return n;
`;

/* ═══════════════ التسيير ═══════════════ */

let preview = null;
let chrome = null;

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    missing.push("لا بناءَ في js/apps/tilawa/dist — تُشغَّل البوّابةُ بعد pnpm build");
    return;
  }
  if (!existsSync(CHROME)) {
    missing.push("لا متصفّحَ كرومٍ على هذا الجهاز — لا تُفحص شجرةُ العرض بغيره");
    return;
  }

  preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: APP,
    stdio: "ignore",
  });
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=/tmp/cdp-tilawa-${process.pid}`,
      "--no-first-run",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(500);
    try {
      target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === "page");
    } catch {
      /* لم يقم بعد */
    }
  }
  if (!target) {
    missing.push("لم يقم المتصفّحُ على منفذ الأدوات");
    return;
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE });
  await cdp.send("Page.navigate", { url: URL });

  /* ═══ ١ — الإقلاع: مصحفٌ بترويساته، وصفرُ تسريبٍ أفقيّ ═══ */
  const booted = await cdp.until(`document.querySelector('.mushaf-page .mp-text .mp-w')`, 60000);
  if (!booted) {
    missing.push("لم يُقلع المصحفُ في المتصفّح");
    return;
  }
  await sleep(900);
  const boot = await cdp.ev(`
const pages = document.querySelectorAll('.mushaf-page').length;
const heads = document.querySelectorAll('.mp-head .mp-head-folio').length;
const el = document.documentElement;
const read = document.querySelector('.tw-read');
const wide = [];
for (const n of document.querySelectorAll('body *')) {
  const r = n.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) continue;
  if (r.right > innerWidth + 1 || r.left < -1) wide.push((n.className || n.tagName).toString().slice(0, 30));
}
return {
  pages, heads,
  docLeak: el.scrollWidth - el.clientWidth,
  readLeak: read ? read.scrollWidth - read.clientWidth : null,
  wide: [...new Set(wide)].slice(0, 6),
  words: document.querySelectorAll('[data-w]').length,
  folio: (document.querySelector('.mp-head-folio') || {}).textContent,
  folioPx: document.querySelector('.mp-head-folio') ? getComputedStyle(document.querySelector('.mp-head-folio')).fontSize : null,
};
`);
  if (!boot.pages || !boot.heads) {
    fail("الإقلاع", `لم تظهر صفحةُ مصحفٍ بترويستها: ${JSON.stringify(boot)}`);
  } else if (boot.docLeak > 0 || boot.readLeak > 0 || boot.wide.length) {
    fail(
      "صفرُ تسريبٍ أفقيّ",
      `تسريبٌ أفقيّ: مستند ${boot.docLeak} · سطحُ القراءة ${boot.readLeak} · عناصرُ خارجَ العرض: ${boot.wide.join(" · ")}`,
    );
  } else {
    notes.push(
      `الإقلاع على ٣٩٠: ${boot.pages} صفحاتٍ بترويساتها (رقمُ الصفحة ${boot.folio} بمقاس ${boot.folioPx}) · ${boot.words} كلمةً مرسومةً عناصرَ · صفرُ تسريبٍ أفقيّ`,
    );
  }
  await cdp.shot("tilawa-mushaf-390");

  /* ═══ ٢ — الهيئةُ حرفًا بعد تقسيم الكلمات ═══
     **قياسُ قبلٍ وبعدٍ على البناء نفسِه**: كلماتٌ مقسومةٌ ⇐ ملحومةٌ نصًّا واحدًا. */
  const split = await cdp.ev(SHAPE);

  /* **وضبطُه السالبُ أوّلًا** — والكلماتُ عناصرُ بعدُ: تُزاد حشوةٌ عليها فيُصطاد
     انزياحُ السطور. (ولو أُخِّر إلى ما بعد اللحم لم يبقَ في الشجرة ما يُزرع فيه
     — وهو ما اصطادته تسييرةُ البوّابة على نفسها.) */
  await cdp.ev(`
const st = document.createElement('style');
st.id = '__plantPad';
st.textContent = '.mp-w { padding-inline: 2px; }';
document.head.appendChild(st);
return true;
`);
  await sleep(250);
  const nudged = await cdp.ev(SHAPE);
  const caughtPad = !!compareShape(split, nudged).boxDiff;
  await cdp.ev(`document.getElementById('__plantPad')?.remove(); return true;`);
  await sleep(250);
  const backShape = await cdp.ev(SHAPE);
  if (!caughtPad) fail("ضبطُ الهيئة", "زُرعت حشوةٌ على الكلمات فلم يُصطَد انزياحٌ — والقياسُ لا يقيس");
  else if (compareShape(split, backShape).boxDiff) fail("ضبطُ الهيئة", "بقي أثرُ الزرع بعد محوه");
  else notes.push("ضبطٌ سالب: زُرعت حشوةُ ٢px على الكلمات فاصطاد القياسُ انزياحَ السطور، ثمّ أُزيلت فعاد الرسمُ كما كان");

  const welded = await cdp.ev(WELD);
  await sleep(250);
  const joined = await cdp.ev(SHAPE);
  const shape = compareShape(split, joined);
  if (welded < 1) {
    missing.push("لم تُلحَم آيةٌ واحدة — فلم يُقَس «الهيئةُ حرفًا»");
  } else if (shape.textDiff) {
    fail("الهيئةُ حرفًا", `تبدّل نصُّ الآية بالتقسيم: ${shape.textDiff}`);
  } else if (shape.boxDiff) {
    fail("الهيئةُ حرفًا", `تبدّل صندوقُ سطرٍ بالتقسيم: ${shape.boxDiff}`);
  } else {
    notes.push(
      `الهيئةُ حرفًا: ${shape.ayat} آيةً في ${shape.pages} صفحاتٍ · ${shape.lines} صندوقَ سطرٍ — **مقسومةً وملحومةً سواءً بسواء** (صفرُ فرقٍ في الإحداثيّات وفي الحروف)`,
    );
  }

  /* الشجرةُ ملحومةٌ الآن — تُعاد الصفحةُ إلى بنائها قبل ما بعدَه */
  await cdp.send("Page.navigate", { url: URL });
  await cdp.until(`document.querySelector('.mushaf-page .mp-text .mp-w')`, 60000);
  await sleep(900);

  /* ═══ ٣ — لمسةُ الميكروفون: حالٌ في مكانها، والإعلانُ قبل الميكروفون ═══ */
  const before = await cdp.ev(`
const first = [...document.querySelectorAll('.mp-ayah[data-ayah]')].find((el) => el.getBoundingClientRect().bottom > 60);
return {
  spy: window.__spy,
  href: location.href,
  page: (document.querySelector('.mushaf-page') || {}).dataset?.page ?? null,
  firstAyah: first ? Number(first.dataset.ayah) : null,
  bar: !!document.querySelector('[data-track="bar"]'),
};
`);
  if (before.spy.recognizers || before.spy.getUserMedia) {
    fail("الإعلانُ يسبق الميكروفون", `فُتح بابُ صوتٍ قبل أن يُلمس شيء: ${JSON.stringify(before.spy)}`);
  }
  if (before.bar) fail("لا شريطَ قبل اللمسة", "شريطُ التتبّع ظاهرٌ والقارئُ لم يطلبه");

  await cdp.ev(click('[data-track="mic"]'));
  await sleep(700);
  const askedEngine = await cdp.ev(`
return {
  sheet: !!document.querySelector('[data-track="engine-choice"]'),
  spy: window.__spy,
  lines: [...document.querySelectorAll('[data-track="engine-choice"] .tw-engine')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 70)),
  href: location.href,
};
`);
  if (!askedEngine.sheet) fail("المحرّكُ يُسأل عنه", "لُمس الميكروفونُ فلم يُسأل عن المحرّك");
  if (askedEngine.spy.recognizers || askedEngine.spy.getUserMedia) {
    fail("المحرّكُ يُسأل عنه", "فُتح بابُ صوتٍ قبل اختيار المحرّك");
  }
  if (askedEngine.lines.length < 2) {
    fail("سطورُ الصدق", `ورقةُ المحرّك لا تعرض المحرّكين بسطورهما: ${JSON.stringify(askedEngine.lines)}`);
  } else {
    notes.push(`ورقةُ اختيار المحرّك بسطور الحزمة نصًّا: «${askedEngine.lines[0]}»`);
  }
  await cdp.shot("tilawa-engine-390");

  /* أرضيّةُ الورقة معتمة — والضبطُ: يُشفَّف ظهرُها فتصير أرضيّتُها المصحفَ تحتها */
  const ground = await cdp.ev(SHEET_GROUND);
  if (ground.error) missing.push(`أرضيّةُ الورقة: ${ground.error}`);
  else if (ground.rows.some((r) => !r.grounded)) {
    fail(
      "أرضيّةُ الأوراق معتمة",
      `خلفَ عناصرها نصُّ المصحف: ${ground.rows.filter((r) => !r.grounded).map((r) => `«${r.what}» (حاملُها ${r.host ?? "لا شيء"})`).join(" · ")}`,
    );
  } else {
    notes.push(
      `ورقةُ المحرّك على ٣٩٠: ${ground.n} عنصرًا خلفَ كلٍّ منها أرضيّةٌ معتمةٌ من الورقة نفسِها${ground.overQuran ? " — وهي واقعةٌ فوق نصّ المصحف" : ""}`,
    );
  }
  await cdp.ev(`
const st = document.createElement('style');
st.id = '__plantBare';
st.textContent = '.tw-sheet, .tw-sheet * { background: transparent !important; }';
document.head.appendChild(st);
return true;
`);
  await sleep(250);
  const bare = await cdp.ev(SHEET_GROUND);
  await cdp.ev(`document.getElementById('__plantBare')?.remove(); return true;`);
  await sleep(200);
  const backGround = await cdp.ev(SHEET_GROUND);
  if (!bare.rows?.some((r) => !r.grounded)) {
    fail("ضبطُ أرضيّة الورقة", "شُفِّف ظهرُ الورقة فلم يُصطَد — والفحصُ لا يفحص");
  } else if (backGround.rows?.some((r) => !r.grounded)) {
    fail("ضبطُ أرضيّة الورقة", "بقي أثرُ الزرع بعد محوه");
  } else {
    notes.push("ضبطٌ سالب: شُفِّف ظهرُ الورقة فصار حاملُ الأرضيّة خارجَها فاصطيدت، ثمّ أُعيد فخضرّت");
  }

  /* الشبكيُّ عمدًا — والحرُّ ينزّل ٨٣ م.ب فلا يُحمَّل ذلك بوّابةً */
  await cdp.ev(click('[data-track="engine-browser-speech"]'));
  await sleep(700);
  const atConsent = await cdp.ev(`
return {
  consent: !!document.querySelector('[data-track="consent"]'),
  say: (document.querySelector('[data-track="consent"]') || {}).innerText?.replace(/\\s+/g, ' ').trim().slice(0, 120) ?? null,
  spy: window.__spy,
};
`);
  if (!atConsent.consent) fail("الإعلانُ يسبق الميكروفون", "اختير المحرّكُ فلم يُعرض إعلانُه");
  if (atConsent.spy.recognizers || atConsent.spy.starts || atConsent.spy.getUserMedia) {
    fail("الإعلانُ يسبق الميكروفون", `بُدئ الالتقاطُ قبل الموافقة: ${JSON.stringify(atConsent.spy)}`);
  } else {
    notes.push(`قبل الموافقة: صفرُ محرّكاتٍ وصفرُ مجرًى صوتيّ — والإعلانُ «${atConsent.say}»`);
  }

  await cdp.ev(click('[data-track="agree"]'));
  const started = await cdp.until(`window.__spy.recognizers > 0 && document.querySelector('.tw-cursor')`, 30000);
  await sleep(600);
  const inPlace = await cdp.ev(`
const head = document.querySelector('.tw-top');
return {
  spy: window.__spy,
  href: location.href,
  page: (document.querySelector('.mushaf-page') || {}).dataset?.page ?? null,
  bar: !!document.querySelector('[data-track="bar"]'),
  shell: getComputedStyle(document.documentElement).getPropertyValue('--shell-p').trim(),
  headTop: head ? Math.round(head.getBoundingClientRect().bottom) : null,
  sheets: document.querySelectorAll('.tw-sheet').length,
};
`);
  const cursor0 = await cdp.ev(WORDS);
  if (!started) {
    fail("لمسةُ الميكروفون", "أُذن ولم يبدأ الالتقاطُ ولم يظهر مؤشّر");
  } else if (inPlace.href !== before.href || inPlace.page !== before.page) {
    fail("حالٌ في مكانها", `انتقل المسارُ أو تبدّلت الصفحة: ${before.href}/${before.page} ⇐ ${inPlace.href}/${inPlace.page}`);
  } else if (!inPlace.bar || inPlace.sheets) {
    fail("حالٌ في مكانها", `لم يبقَ إلّا الشريط: شريطٌ ${inPlace.bar} · أوراقٌ مفتوحةٌ ${inPlace.sheets}`);
  } else {
    notes.push(
      `لمسةُ الميكروفون قلبت الصفحةَ حالًا **في مكانها**: المسارُ كما هو (${inPlace.href.replace(/^https?:\/\//, "")}) وصفحةُ المصحف ${inPlace.page} · شريطٌ واحدٌ ولا ورقة · والقشرةُ منسحبةٌ (--shell-p ${inPlace.shell}، أسفلُ الرأس عند ${inPlace.headTop}px)`,
    );
  }
  if (inPlace.shell !== "1") fail("القشرةُ تنسحب في التلاوة", `--shell-p = ${inPlace.shell || "لا شيء"}`);

  /* **والبدءُ من المرئيّ لا من المحفوظ** (زُرع محفوظٌ بعيدٌ: البقرة ٢٥٥) */
  if (!cursor0.loc) {
    fail("المؤشّرُ يظهر", "بدأ التتبّعُ ولم تُظلَّل كلمة");
  } else if (cursor0.loc.startsWith("2:255")) {
    fail("المرئيُّ مقدَّمٌ على المحفوظ", `فُتح على الموضع المحفوظ (${cursor0.loc}) لا على ما أمام القارئ`);
  } else {
    notes.push(
      `البدءُ من المرئيّ: المؤشّرُ على ${cursor0.loc} «${cursor0.say}» — والمحفوظُ لحال المراجعة ٢:٢٥٥ لم يُقفز إليه`,
    );
  }

  /* ═══ ٤ — المؤشّرُ يجري على كلمات الصفحة عينِها ═══ */
  if (cursor0.inPage === false || cursor0.strays) {
    fail(
      "المؤشّرُ على كلمات الصفحة",
      `الكلمةُ المظلَّلةُ ليست من صفحة المصحف (أو ثَمَّ ${cursor0.strays} كلمةً خارجَها)`,
    );
  }

  /** يُطعَم المحرّكُ الساكنُ **كلماتِ الصفحة نفسِها**، فيُشهد جريانُ المؤشّر عليها */
  const still0 = await cdp.ev(`
const el = document.querySelector('.tw-read');
const ay = document.querySelector('.mushaf-page .mp-ayah');
return { scroll: Math.round(el.scrollTop), top: Math.round(ay.getBoundingClientRect().top) };
`);
  const fed = await cdp.ev(`
const spans = [...document.querySelectorAll('[data-w]')];
const at = spans.findIndex((s) => s.classList.contains('tw-cursor'));
if (at < 0) return { error: 'لا مؤشّر' };
const say = spans.slice(at, at + 6).map((s) => s.textContent).join(' ');
const want = spans[at + 6] ? spans[at + 6].dataset.w : null;
window.__rec.onresult({ resultIndex: 0, results: { length: 1, 0: { length: 1, isFinal: true, 0: { transcript: say, confidence: 1 } } } });
return { say, want, from: spans[at].dataset.w };
`);
  await sleep(900);
  const cursor1 = await cdp.ev(WORDS);
  const still1 = await cdp.ev(`
const el = document.querySelector('.tw-read');
const ay = document.querySelector('.mushaf-page .mp-ayah');
return { scroll: Math.round(el.scrollTop), top: Math.round(ay.getBoundingClientRect().top) };
`);
  if (fed.error) {
    missing.push(`لم يُطعَم المحرّكُ: ${fed.error}`);
  } else if (cursor1.at <= cursor0.at) {
    fail(
      "المؤشّرُ يجري مع الصوت",
      `تُليت ٦ كلماتٍ من «${fed.from}» فلم يتقدّم المؤشّر (${cursor0.loc} ⇐ ${cursor1.loc})`,
    );
  } else if (!cursor1.inPage) {
    fail("المؤشّرُ على كلمات الصفحة", `المؤشّرُ بعد التقدّم ليس عنصرًا من صفحة المصحف (${cursor1.loc})`);
  } else {
    notes.push(
      `المؤشّرُ جرى على كلمات الصفحة: «${fed.say.slice(0, 48)}…» ⇒ من ${fed.from} إلى ${cursor1.loc}` +
        `${fed.want ? ` (والمنتظَرُ ${fed.want})` : ""} — **والكلمةُ المظلَّلةُ عنصرٌ من صفحة المصحف نفسِها**، ولا كلمةَ مرسومةً خارجَها`,
    );
  }
  /* **والنصُّ يسكن**: ما دامت الكلمةُ في حزام القراءة لا يتحرّك شيء (درسُ ص٤) */
  if (Math.abs(still1.top - still0.top) > 1 || still1.scroll !== still0.scroll) {
    fail(
      "النصُّ يسكن",
      `تحرّك النصُّ والمؤشّرُ في الحزام: موضعُ الآية ${still0.top} ⇐ ${still1.top} · التمرير ${still0.scroll} ⇐ ${still1.scroll}`,
    );
  } else {
    notes.push(`النصُّ ساكنٌ بالبكسل في أثناء التتبّع: الآيةُ عند ${still1.top}px والتمريرُ ${still1.scroll} لم يتبدّلا`);
  }
  await cdp.shot("tilawa-tatabbu-390");

  /* **ضبطُ سطح النصّ الثاني**: يُزرع فوق المصحف فيُصطاد، ثمّ يُزال فتخضرّ */
  await cdp.ev(`
const q = document.querySelector('.mushaf-page').getBoundingClientRect();
const d = document.createElement('div');
d.id = '__plantSurface';
d.style.cssText = 'position:fixed;z-index:20;left:' + q.left + 'px;top:200px;width:' + q.width + 'px;background:#fff';
const s = document.createElement('span');
s.className = 'mp-w tw-cursor';
s.dataset.w = '1:1:1';
s.textContent = 'سطحٌ ثانٍ مزروع';
d.appendChild(s);
document.body.appendChild(d);
return true;
`);
  await sleep(250);
  const planted = await cdp.ev(WORDS);
  await cdp.ev(`document.getElementById('__plantSurface')?.remove(); return true;`);
  await sleep(250);
  const cleaned = await cdp.ev(WORDS);
  if (!planted.strays) {
    fail("ضبطُ سطح النصّ الثاني", "زُرع سطحُ نصٍّ ثانٍ بكلمةٍ مظلَّلةٍ فلم يُصطَد — والفحصُ لا يفحص");
  } else if (cleaned.strays) {
    fail("ضبطُ سطح النصّ الثاني", "بقي أثرُ الزرع بعد محوه");
  } else {
    notes.push(
      `ضبطٌ سالب: زُرع سطحُ نصٍّ ثانٍ فوق المصحف بكلمةٍ مظلَّلة فاصطادته البوّابةُ (${planted.strays} كلمةً خارجَ الصفحة)، ثمّ أُزيل فخضرّت`,
    );
  }

  /* ═══ ٥ — الميثاقُ المصغَّر في أثناء التلاوة ═══ */
  const charter = await cdp.ev(CHARTER);
  const dialogs = await cdp.ev("return window.__spy.dialogs;");
  if (charter.small.length) {
    fail(
      "لمسٌ ≥٤٤",
      charter.small.map((s) => `«${s.what}» ${s.w}×${s.h} (${s.cls})`).join(" · "),
    );
  }
  if (charter.tiny.length) {
    fail(
      "نصٌّ ≥١٥",
      charter.tiny.map((t) => `«${t.text}» ${t.px}px (${t.cls})`).join(" · "),
    );
  }
  if (dialogs.length) fail("لا حوارات", `استُدعيت حواراتُ متصفّحٍ: ${dialogs.join(" · ")}`);
  if (!charter.small.length && !charter.tiny.length && !dialogs.length) {
    notes.push(
      `الميثاقُ المصغَّر في أثناء التلاوة: لا هدفَ لمسٍ دون ${MIN_TAP} ولا نصَّ دون ${MIN_TEXT}px، ولا حوارَ متصفّحٍ استُدعي قطُّ في التسييرة كلِّها`,
    );
  }

  /* وضبطُه: يُصغَّر هدفُ لمسٍ فيُصطاد، ثمّ يُردّ فتخضرّ */
  await cdp.ev(`
const b = document.querySelector('[data-track="close"]');
b.dataset.h = b.style.cssText;
b.style.cssText = 'min-width:20px;width:20px;height:20px';
return true;
`);
  await sleep(200);
  const shrunk = await cdp.ev(CHARTER);
  await cdp.ev(`
const b = document.querySelector('[data-track="close"]');
b.style.cssText = b.dataset.h || '';
return true;
`);
  await sleep(200);
  const restored = await cdp.ev(CHARTER);
  if (!shrunk.small.length) fail("ضبطُ اللمس", "صُغِّر هدفُ لمسٍ فلم يُصطَد — والفحصُ لا يفحص");
  else if (restored.small.length) fail("ضبطُ اللمس", "بقي أثرُ الزرع بعد ردّه");
  else notes.push("ضبطٌ سالب: صُغِّر زرُّ الإغلاق إلى ٢٠×٢٠ فاصطيد، ثمّ رُدّ فخضرّت");

  /* ═══ ٦ — الختامُ والمواضع: **لكلّ حالٍ مفتاحُها** (§٢) ═══
     يُنهي القارئُ، فيُكتب موضعُ **هذه الحال** بطبقة المواضع في الحزمة، **ولا
     يُمَسّ موضعُ حالٍ أخرى** — وهي العلّةُ التي بُنيت لها الطبقةُ (علامةٌ واحدةٌ
     كانت تكتب على الأخرى). ثمّ تُبدَّل الحالُ إلى «الختمة» فيُعرض سطرُ
     «تتابع من موضعك؟» — **سطرٌ يُهمَل بلا أثر، ومن لمسه نُقل موضعُه**. */
  const atEnd = await cdp.ev(WORDS);
  await cdp.ev(click('[data-track="end"]'));
  const ended = await cdp.until(`document.querySelector('[data-track="after"]')`, 10000);
  await sleep(400);
  const after = await cdp.ev(`
const box = document.querySelector('[data-track="after"]');
return {
  say: box ? box.innerText.replace(/\s+/g, ' ').trim().slice(0, 110) : null,
  murajaa: localStorage.getItem('quran-studio:mawdi:murajaa'),
  khatma: localStorage.getItem('quran-studio:mawdi:khatma'),
};
`);
  const wroteHere = after.murajaa && !after.murajaa.includes('"2:255"') && after.murajaa.includes(String(atEnd.loc).split(":")[0] + ":");
  if (!ended) {
    fail("الختام", "ضُغط «أنهيت» فلم يظهر خبرُ الختام");
  } else if (!wroteHere) {
    fail("لكلّ حالٍ موضعُها", `لم يُكتب موضعُ المراجعة عند ما بلغه المؤشّر (${atEnd.loc}): ${after.murajaa}`);
  } else if (!after.khatma || !after.khatma.includes('"18:1"')) {
    fail("لكلّ حالٍ موضعُها", `مُسّ موضعُ حالٍ أخرى عند الختام: الختمةُ ${after.khatma}`);
  } else {
    notes.push(
      `الختامُ: «${after.say}» — وكُتب موضعُ **المراجعة** ${after.murajaa} عند ما بلغه المؤشّر، **وموضعُ الختمة ١٨:١ لم يُمَسّ**`,
    );
  }

  /* تُطوى ورقةُ الختام ويبقى الشريط، فتُبدَّل الحالُ إلى الختمة */
  await cdp.ev(click(".tw-backdrop"));
  await sleep(400);
  await cdp.ev(`
const el = document.querySelector('[data-track="hal"]');
if (!el) return false;
const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
set.call(el, 'khatma');
el.dispatchEvent(new Event('change', { bubbles: true }));
return true;
`);
  await sleep(500);
  const offer = await cdp.ev(`
const b = document.querySelector('[data-track="resume"]');
return { there: !!b, say: b ? b.innerText.replace(/\s+/g, ' ').trim() : null, tap: b ? Math.round(b.getBoundingClientRect().height) : 0 };
`);
  if (!offer.there) {
    fail("سطرُ «تتابع من موضعك؟»", "بُدّلت الحالُ إلى الختمة ومحفوظُها بعيدٌ فلم يُعرض سطرُ الخيار");
  } else {
    notes.push(`سطرُ الختمة: «${offer.say}» (هدفُ لمسٍ ${offer.tap}px) — خيارٌ يُهمَل، لا قفزةٌ صامتة`);
    await cdp.ev(click('[data-track="resume"]'));
    await sleep(500);
    // **والإعلانُ يُعاد في كلِّ حالٍ على حدة** — فحالُ الختمة لم يُعلَن فيها بعد
    const askedAgain = await cdp.ev(`return !!document.querySelector('[data-track="consent"]');`);
    if (askedAgain) {
      await cdp.ev(click('[data-track="agree"]'));
      notes.push("والإعلانُ أُعيد في «الختمة» وإن أُذن في «المراجعة» — إذنٌ لكلّ حالٍ على حدة");
    }
    const moved = await cdp.until(`document.querySelector('.tw-cursor')?.dataset.w?.startsWith('18:')`, 20000);
    const there = await cdp.ev(`
const c = document.querySelector('.tw-cursor');
const p = c ? c.closest('.mushaf-page') : null;
return { loc: c ? c.dataset.w : null, page: p ? p.dataset.page : null, inPage: !!(c && c.closest('.mushaf-page .mp-text')) };
`);
    if (!moved || !there.inPage) {
      fail("النقلُ إلى الموضع المحفوظ", `لُمس سطرُ الخيار فلم يُنقل المؤشّرُ إلى ١٨:١ (${JSON.stringify(there)})`);
    } else {
      notes.push(
        `لُمس السطرُ فنُقل الموضعُ في مكانه: المؤشّرُ ${there.loc} في صفحة المصحف ${there.page} — **وهو من عناصر الصفحة كذلك**`,
      );
    }
  }

  ws.close();
}

/**
 * **صناديقُ السطور سواءٌ بسواء** — عددًا وموضعًا. **وهامشُ البكسل الواحد
 * معلَنٌ ولا يُخبَّأ**: صندوقُ عنصرٍ سطريٍّ مقسومٍ إلى أبناءَ يُدوَّر عرضُه
 * الجامعُ تدويرًا قد يخالف المُلحَمَ ببكسلٍ واحد — **وهو تدويرُ قياسٍ لا انزياحُ
 * تنضيد**: الموضعُ وقَطعُ السطر وعددُ الصناديق سواء. وما جاوز البكسلَ يُصطاد
 * (وضبطُه السالبُ يشهد: حشوةُ ٢px على الكلمات تُصطاد في الحال).
 */
const sameLines = (a, b) =>
  a.length === b.length && a.every((r, i) => r.every((v, k) => Math.abs(v - b[i][k]) <= 1));

/** يقابل قياسَين للشكل — إحداثيّاتِ سطورٍ وحروفًا */
function compareShape(a, b) {
  const n = Math.min(a.ayat.length, b.ayat.length);
  let lines = 0;
  let textDiff = null;
  let boxDiff = null;
  for (let i = 0; i < n; i++) {
    const x = a.ayat[i];
    const y = b.ayat[i];
    lines += x.lines.length;
    if (!textDiff && x.text !== y.text) {
      textDiff = `الآية ${x.id}: «${x.text.slice(0, 30)}» ⇐ «${y.text.slice(0, 30)}»`;
    }
    if (!boxDiff && !sameLines(x.lines, y.lines)) {
      boxDiff = `الآية ${x.id}: ${JSON.stringify(x.lines).slice(0, 90)} ⇐ ${JSON.stringify(y.lines).slice(0, 90)}`;
    }
  }
  if (!boxDiff && JSON.stringify(a.pages) !== JSON.stringify(b.pages)) {
    boxDiff = `ارتفاعاتُ الصفحات: ${JSON.stringify(a.pages)} ⇐ ${JSON.stringify(b.pages)}`;
  }
  if (!boxDiff && a.ayat.length !== b.ayat.length) {
    boxDiff = `عددُ الآيات المرسومة: ${a.ayat.length} ⇐ ${b.ayat.length}`;
  }
  return { ayat: n, pages: a.pages.length, lines, textDiff, boxDiff };
}

try {
  await main();
} catch (e) {
  missing.push(`تعثّر التسيير: ${e.message}`);
  if (process.env.TILAWA_TRACE) console.error(e.stack);
} finally {
  chrome?.kill();
  preview?.kill();
}

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0 && missing.length === 0;
writeFileSync(
  OUT,
  `${JSON.stringify({ gate: "tilawa", ok, checkedAt: null, notes, failures, missing }, null, 2)}\n`,
);
console.log(`بوّابةُ التلاوة الحيّة: ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
if (!ok) process.exitCode = 1;

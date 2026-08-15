/**
 * البوّابةُ الحيّةُ لصفحة «التتبّع» — **ما لا يُفحص إلّا في شجرة العرض.**
 *
 * ثلاثةُ أحكامٍ في برومبت ص-م٢ لا تُفحص بقراءة الشيفرة، لأنّها أحكامٌ على **ما
 * يراه القارئُ فعلًا** لا على ما كُتب: فتُفحص في متصفّحٍ حقيقيّ يُسيَّر ببروتوكول
 * الأدوات على البناء المنشور:
 *
 *   ١ — **الإعلانُ يسبق الميكروفون**: بجهازٍ لم يُؤذَن فيه قطُّ، تُضغط «ابدأ»
 *       فلا يُنشأ محرّكُ تعرّفٍ ولا يُطلب مجرًى صوتيٌّ **البتّة** — بل يظهر
 *       الإعلان. ثمّ بالإذن الصريح يبدأ الالتقاط. والشاهدُ عليه **جواسيسُ**
 *       تُنصب على `SpeechRecognition` و`getUserMedia` قبل تحميل الصفحة، فتعُدّ
 *       ما وقع لا ما يُظنّ.
 *   ٢ — **تجريدُ الجوال**: بعرض ٣٩٠ وفي أثناء التلاوة، ليس في الصفحة إلّا ثلاثة
 *       — النصُّ، وقائمةُ اختيار الحال، وزرُّ الإغلاق. فتُحصى عناصرُ التحكّم
 *       **الظاهرةُ** في شجرة العرض؛ والزيادةُ تُحمِّر البوّابة. **وضبطُها
 *       السالبُ معها**: يُزرع عنصرٌ رابعٌ فيُصطاد، ثمّ يُزال فتعود خضراء.
 *   ٣ — **صمتُ «الصلاة»**: في أثناء التلاوة وبعد الختام، **صفرُ عنصرِ تصحيحٍ**
 *       في شجرة العرض — لا جدولَ قياسٍ ولا مواضعَ للنظر ولا تنبيهًا ولا رقمًا
 *       واحدًا بعد الختام.
 *   ٤ — **وسطحُ القارئ خالٍ من عُدّة القياس** وهي باقيةٌ خلف بابها (ص-م٤ §٠).
 *   ٥ — **ولا يُحبَس قارئٌ في خيارٍ لا يعمل** (ص-م٥، على بلاغ المالك): حالُ
 *       المحرّك معروضةٌ في الشريط · والتبديلُ من موضعين (عُدّةُ التهيئة والشريطُ
 *       ههنا، والإعداداتُ في صفحةٍ أخرى تُزار) · **ويُزرع عطبٌ في الميكروفون
 *       فيُشهد الرجوعُ التلقائيُّ وخبرُه وتبدُّلُ الاسم** · **ولا يُرجَع في
 *       «الصلاة» إلى محرّكٍ يُخرج الصوت بحال** · وضبطُه السالب: تشغيلةٌ سليمةٌ
 *       لا خبرَ رجوعٍ فيها — **فخبرٌ يظهر دائمًا ليس خبرًا**.
 *
 * **ومحرّكُ التعرّف يُستبدل بساكنٍ لا يسمع شيئًا** — لأنّ المفحوصَ ههنا شجرةُ
 * العرض وسلوكُ الإذن، لا جودةُ السمع. والاستبدالُ عند حدِّ `RecognizerPort`
 * نفسِه الذي بُني ليُبدَّل، فلا يُمَسّ من شيفرتنا حرف.
 *
 * التشغيل: node js/scripts/check-tatabbu-live.mjs → js/data/gates/TATABBU-LIVE.json
 * (يبني السكربتُ خادمَ المعاينة بنفسه على `dist/`؛ فإن لم يكن `dist` موجودًا
 *  أعلن ذلك ولم يمرّ صامتًا.)
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STUDIO = join(ROOT, "js", "apps", "studio");
const DIST = join(STUDIO, "dist");
const OUT = join(ROOT, "js", "data", "gates", "TATABBU-LIVE.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4179;
const CDP_PORT = 9333;
const URL = `http://localhost:${PORT}/#/tatabbu`;

const failures = [];
const missing = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════ عُدّةُ التسيير ═══════════ */

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
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.waiting.set(id, { resolve, reject }));
  }
  /** تقييمُ تعبيرٍ في الصفحة وإرجاعُ قيمته */
  async ev(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(() => { ${expr} })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "خطأٌ في الصفحة");
    return r.result.value;
  }
  /** انتظارُ شرطٍ في الصفحة */
  async until(expr, ms = 45000, every = 250) {
    const t0 = Date.now();
    for (;;) {
      if (await this.ev(`return !!(${expr});`)) return true;
      if (Date.now() - t0 > ms) return false;
      await sleep(every);
    }
  }
}

/**
 * ما يُحقن قبل تحميل الصفحة: جواسيسُ على بابَي الصوت، ومحرّكٌ ساكنٌ مكانَ محرّك
 * المتصفّح. ولا يُمَسّ من شيفرة التطبيق شيء.
 */
const PRELUDE = `
window.__sawtSpy = { recognizers: 0, starts: 0, getUserMedia: 0 };
class StubRecognition {
  constructor() { window.__sawtSpy.recognizers++; this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null; }
  start() { window.__sawtSpy.starts++; if (this.onstart) setTimeout(() => this.onstart(), 0); }
  stop() { if (this.onend) setTimeout(() => this.onend(), 0); }
  abort() {}
}
Object.defineProperty(window, 'SpeechRecognition', { value: StubRecognition, writable: true, configurable: true });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: StubRecognition, writable: true, configurable: true });
/* **إخفاقٌ يُزرع بأمرٍ لا بالبيئة** (ص-م٥): حين يُرفع \`__sawtFail\` يُردّ
   الميكروفونُ بعطبٍ **ليس منعَ إذن** — فمنعُ الإذن لا يُبدَّل له محرّك بنصّ
   التصميم، والمفحوصُ ههنا رجوعُ المحرّك لا حكمُ الإذن. */
window.__sawtFail = null;
if (navigator.mediaDevices) {
  const real = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function (...a) {
    window.__sawtSpy.getUserMedia++;
    if (window.__sawtFail === 'gum') {
      const err = new Error('عطبٌ مزروع');
      err.name = 'NotReadableError';
      return Promise.reject(err);
    }
    return real ? real(...a) : Promise.reject(new Error('no media'));
  };
}
/* وعاملٌ بديلٌ ما دام الإخفاقُ مزروعًا — كي لا تُنزَّل ٨٣ م.ب في بوّابة */
(function () {
  const RealWorker = window.Worker;
  window.__sawtWorkers = 0;
  function StubWorker() { window.__sawtWorkers++; this.onmessage = null; this.onerror = null; }
  StubWorker.prototype.postMessage = function () {};
  StubWorker.prototype.terminate = function () {};
  function Shim(u, o) { return window.__sawtFail ? new StubWorker() : new RealWorker(u, o); }
  Object.defineProperty(window, 'Worker', { value: Shim, writable: true, configurable: true });
})();
try { localStorage.removeItem('sawt.consent.v1'); localStorage.removeItem('sawt.hal.v1'); localStorage.removeItem('sawt.mark.v1'); localStorage.removeItem('sawt.engine.v1'); localStorage.removeItem('sawt.declared.v1'); } catch (e) {}
`;

/** عناصرُ التحكّم الظاهرةُ في شجرة العرض داخلَ جذر الصفحة */
const VISIBLE_CONTROLS = `
const root = document.querySelector('[data-sawt="root"]');
if (!root) return { error: 'لا جذرَ للصفحة' };
const sel = 'button, select, input, textarea, summary, a[href], [role="button"], [contenteditable]';
const seen = [];
for (const el of root.querySelectorAll(sel)) {
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) continue;
  seen.push({ tag: el.tagName.toLowerCase(), what: el.dataset.sawt || null, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) });
}
const text = root.querySelector('[data-sawt="text"]');
return { controls: seen, text: !!(text && text.getBoundingClientRect().height > 1) };
`;

/** عناصرُ التصحيح — كلُّ ما يقول للقارئ شيئًا عن تلاوته أو عن قياسها */
const TASHIH = `
const root = document.querySelector('[data-sawt="root"]');
if (!root) return { error: 'لا جذرَ للصفحة' };
const bad = [];
for (const s of ['.sawt-table', '.sawt-places', '.sawt-place-ref', '.sawt-card', '.sawt-felt', '.sawt-hint', '.sawt-warn', '.sawt-skip', '.sawt-copy']) {
  for (const el of root.querySelectorAll(s)) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    bad.push(s);
  }
}
const after = root.querySelector('[data-sawt="after"]');
const digits = after ? (after.innerText.match(/[0-9\\u0660-\\u0669\\u06F0-\\u06F9]/g) || []) : [];
return { bad, digits: digits.length, after: after ? after.innerText.replace(/\\s+/g, ' ').trim().slice(0, 80) : null };
`;

/** **عُدّةُ القياس** — كلُّ ما يقيس المحرّكَ ولا يعني القارئ (ص-م٤ §٠) */
const MEASURE_KIT = `
const root = document.querySelector('[data-sawt="root"]');
if (!root) return { error: 'لا جذرَ للصفحة' };
const seen = [];
for (const s of ['.sawt-table', '[data-sawt="measure"]', '[data-sawt="fahs"]', '.sawt-felt']) {
  for (const el of root.querySelectorAll(s)) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.getBoundingClientRect().height < 1) continue;
    seen.push(s);
  }
}
/* وألفاظُ العُدّة في الأزرار الظاهرة — «مقاطع المحكّ» و«انسخ…» */
const words = [];
for (const el of root.querySelectorAll('button')) {
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden') continue;
  if (el.getBoundingClientRect().height < 1) continue;
  const t = (el.textContent || '').trim();
  if (t.includes('المحكّ') || t.startsWith('انسخ')) words.push(t.slice(0, 20));
}
const digits = (root.innerText.match(/[0-9\\u0660-\\u0669\\u06F0-\\u06F9]/g) || []).length;
return { seen: [...new Set(seen)], words: [...new Set(words)], digits };
`;

/** اختيارُ قيمةٍ في قائمةٍ بحيث تسمعها ريأكت */
const setSelect = (sel, value) => `
const el = document.querySelector('${sel}');
if (!el) return false;
const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
set.call(el, '${value}');
el.dispatchEvent(new Event('change', { bubbles: true }));
return true;
`;

const click = (sel) => `
const el = document.querySelector('${sel}');
if (!el) return false;
el.click();
return true;
`;

/* ═══════════ التسيير ═══════════ */

let preview = null;
let chrome = null;

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    missing.push("لا بناءَ في dist — تُشغَّل البوّابةُ بعد pnpm build");
    return;
  }
  if (!existsSync(CHROME)) {
    missing.push("لا متصفّحَ كرومٍ على هذا الجهاز — لا تُفحص شجرةُ العرض بغيره");
    return;
  }

  preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: STUDIO,
    stdio: "ignore",
  });
  chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/cdp-tatabbu-${process.pid}`,
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ], { stdio: "ignore" });

  // انتظارُ الخادم والمتصفّح
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const list = await res.json();
      target = list.find((t) => t.type === "page");
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

  const booted = await cdp.until(`!document.querySelector('.boot') && document.querySelector('[data-sawt="root"]')`);
  if (!booted) {
    missing.push("لم تُقلع الصفحةُ في المتصفّح");
    return;
  }
  await cdp.until(`document.querySelector('[data-sawt="begin"]') && !document.querySelector('[data-sawt="begin"]').disabled`);

  /* ═══ ٤ — سطحُ القارئ خالٍ من عُدّة القياس (ص-م٤ §٠) ═══
     الصفحةُ وُلدت مسبارًا فبقيت لغةُ المسبار في سطحها. **والحكمُ فصلٌ لا حذف**:
     تُنقل العُدّةُ خلف بابٍ واحدٍ مسمًّى. فيُشهد ههنا الأمران معًا:
       (أ) أنّ **عُدّةَ التهيئة** التي يفتحها القارئُ خاليةٌ منها؛
       (ب) وأنّها **باقيةٌ خلف الباب** إذا طُلبت — فلم تُحذف بحجّة التنظيف. */
  await cdp.ev(click(".sawt-m-more"));
  await sleep(600);
  const kitClosed = await cdp.ev(MEASURE_KIT);
  if (kitClosed.error) missing.push(kitClosed.error);
  else if (kitClosed.seen.length || kitClosed.words.length) {
    fail(
      "عُدّةُ القياس في سطح القارئ",
      `ظهر في عُدّة التهيئة: ${[...kitClosed.seen, ...kitClosed.words].join(" · ")}`,
    );
  } else notes.push("عُدّةُ التهيئة خاليةٌ من عُدّة القياس: لا جدولَ ولا مصفوفةَ ولا «مقاطع المحكّ» ولا نسخَ أرقام");

  /* ضبطُه السالب: يُزرع جدولُ قياسٍ في سطح القارئ فيُصطاد، ثمّ يُزال فتعود خضراء */
  await cdp.ev(`
    const root = document.querySelector('[data-sawt="root"]');
    const t = document.createElement('table');
    t.id = '__plantKit'; t.className = 'sawt-table';
    t.innerHTML = '<tbody><tr><td>الإصابة</td><td>٩٩٪</td></tr></tbody>';
    root.appendChild(t);
    return true;
  `);
  await sleep(300);
  const kitPlanted = await cdp.ev(MEASURE_KIT);
  await cdp.ev(`document.getElementById('__plantKit')?.remove(); return true;`);
  await sleep(300);
  const kitBack = await cdp.ev(MEASURE_KIT);
  if (!kitPlanted.seen.length) fail("ضبطُ عُدّة القياس", "زُرع جدولُ قياسٍ في سطح القارئ فلم يُصطَد — والفحصُ لا يفحص");
  else if (kitBack.seen.length) fail("ضبطُ عُدّة القياس", "بقي أثرُ الزرع بعد محوه");
  else notes.push("ضبطٌ سالب: زُرع جدولُ قياسٍ في سطح القارئ فاصطيد، ثمّ أُزيل فعادت خضراء");

  /* وبإزائه: العُدّةُ **باقيةٌ** خلف بابها — تُفتح فتظهر، ثمّ تُغلق */
  await cdp.ev(click('[data-sawt="fahs-door"]'));
  await sleep(600);
  const kitOpen = await cdp.ev(MEASURE_KIT);
  if (!kitOpen.seen.includes('[data-sawt="fahs"]') || !kitOpen.words.some((w) => w.includes("المحكّ"))) {
    fail(
      "عُدّةُ القياس خلف بابها",
      `فُتح البابُ فلم تظهر العُدّة: ${JSON.stringify({ seen: kitOpen.seen, words: kitOpen.words })}`,
    );
  } else {
    notes.push(
      `فُتح البابُ فظهرت العُدّة: ${kitOpen.seen.join(" · ")} · ${kitOpen.words.join(" · ")} — فلم تُحذف، وإنّما نُقلت`,
    );
  }
  await cdp.ev(click('[data-sawt="fahs-door"]'));
  await sleep(300);
  await cdp.ev(click(".sawt-m-more"));
  await sleep(300);

  /* ═══ ١ — الإعلانُ يسبق الميكروفون ═══ */
  const before = await cdp.ev("return window.__sawtSpy;");
  if (before.recognizers !== 0 || before.getUserMedia !== 0) {
    fail("الإعلانُ يسبق الميكروفون", `فُتح بابُ صوتٍ قبل أن يُضغط شيء: ${JSON.stringify(before)}`);
  }
  await cdp.ev(click('[data-sawt="begin"]'));
  await sleep(700);
  // **والمحرّكُ يُسأل عنه قبل الإعلان** (ص-م٣ §٤): لا يُختار عن القارئ محرّكٌ
  // يُخرج صوتَه ولا محرّكٌ ينزّل من شبكته — ولا ميكروفونَ قبل جوابه.
  const engineAsked = await cdp.ev(`return !!document.querySelector('[data-sawt="engine-choice"]');`);
  const atEngineAsk = await cdp.ev("return window.__sawtSpy;");
  if (!engineAsked) fail("المحرّكُ يُسأل عنه", "ضُغط «ابدأ» ولم يُسأل عن المحرّك");
  if (atEngineAsk.recognizers !== 0 || atEngineAsk.getUserMedia !== 0) {
    fail("المحرّكُ يُسأل عنه", "فُتح بابُ صوتٍ قبل اختيار المحرّك");
  }
  if (engineAsked) notes.push("السؤالُ عن المحرّك يسبق الإعلانَ والميكروفونَ معًا");
  // ويُختار الشبكيُّ ههنا عمدًا: الحرُّ ينزّل نموذجًا ٨٣ م.ب فلا يُحمَّل ذلك بوّابةً
  await cdp.ev(click('[data-sawt="engine-browser-speech"]'));
  await sleep(700);
  const atAsk = await cdp.ev("return window.__sawtSpy;");
  const consentShown = await cdp.ev(`return !!document.querySelector('[data-sawt="consent"]');`);
  if (atAsk.recognizers !== 0 || atAsk.starts !== 0 || atAsk.getUserMedia !== 0) {
    fail(
      "الإعلانُ يسبق الميكروفون",
      `بُدئ الالتقاطُ قبل الموافقة: محرّكات ${atAsk.recognizers} · تشغيل ${atAsk.starts} · مجرًى ${atAsk.getUserMedia}`,
    );
  }
  if (!consentShown) fail("الإعلانُ يسبق الميكروفون", "لم يظهر الإعلانُ عند طلب البدء");
  notes.push(`قبل الموافقة: محرّكات ${atAsk.recognizers} · مجرًى صوتيّ ${atAsk.getUserMedia}`);

  await cdp.ev(click('[data-sawt="agree"]'));
  const running = await cdp.until(`window.__sawtSpy.recognizers > 0`, 8000);
  const afterAgree = await cdp.ev("return window.__sawtSpy;");
  if (!running) fail("الإعلانُ يسبق الميكروفون", "أُذن ولم يبدأ الالتقاط");
  notes.push(`بعد الموافقة: محرّكات ${afterAgree.recognizers} · تشغيل ${afterAgree.starts}`);

  /* **وفهرسُ الالتقاط الشامل يُبنى في الجهاز — يُقاس ولا يُقدَّر** (ص-م٤ §٢/٦):
     لا وزنَ له على السلك ألبتّة (لا أصلَ يُنزَّل — يُبنى من قاعدة المصحف التي
     في الجهاز)، وإنّما وزنُه **زمنُ بنائه**، ويُقرأ من الصفحة بعد أوّل بدء. */
  const ixMs = await cdp.until(`document.querySelector('[data-sawt="root"]').dataset.sawtIltiqat`, 25000)
    ? await cdp.ev(`return document.querySelector('[data-sawt="root"]').dataset.sawtIltiqat;`)
    : null;
  if (!ixMs) missing.push("لم يُبنَ فهرسُ الالتقاط الشامل في الصفحة — أو لم يُقَس زمنُه");
  else notes.push(`فهرسُ الالتقاط الشامل بُني في الجهاز في ${ixMs} مِث — **ولا بايتَ له على السلك**: مبنيٌّ من قاعدة المصحف التي عنده`);

  /* ═══ ٢ — تجريدُ الجوال: ثلاثةٌ لا رابعَ لها ═══ */
  await sleep(500);
  const shot = await cdp.ev(VISIBLE_CONTROLS);
  const allowed = ["close", "hal"];
  const got = (shot.controls ?? []).map((c) => c.what);
  const extra = (shot.controls ?? []).filter((c) => !allowed.includes(c.what));
  if (shot.error) fail("تجريدُ الجوال", shot.error);
  else if (extra.length) {
    fail(
      "تجريدُ الجوال",
      `عناصرُ تحكّمٍ زائدةٌ في أثناء التلاوة: ${extra.map((e) => `${e.tag}«${e.label}»`).join(" · ")}`,
    );
  } else if (!allowed.every((a) => got.includes(a))) {
    fail("تجريدُ الجوال", `نقصَ من الثلاثة: ${allowed.filter((a) => !got.includes(a)).join("، ")}`);
  } else if (!shot.text) {
    fail("تجريدُ الجوال", "لم يظهر النصُّ القرآنيّ في أثناء التلاوة");
  } else {
    notes.push("الجوالُ في أثناء التلاوة: ثلاثةٌ — النصُّ · قائمةُ الحال · ✕");
  }

  /* ضبطُه السالب: عنصرٌ رابعٌ مزروعٌ يُصطاد ثمّ يُزال */
  await cdp.ev(`
    const root = document.querySelector('[data-sawt="root"]');
    const b = document.createElement('button');
    b.id = '__plant'; b.textContent = 'زرعٌ للاختبار';
    root.appendChild(b);
    return true;
  `);
  const planted = await cdp.ev(VISIBLE_CONTROLS);
  const caught = (planted.controls ?? []).some((c) => !allowed.includes(c.what));
  await cdp.ev(`document.getElementById('__plant')?.remove(); return true;`);
  const cleaned = await cdp.ev(VISIBLE_CONTROLS);
  const backGreen = !(cleaned.controls ?? []).some((c) => !allowed.includes(c.what));
  if (!caught) fail("ضبطُ تجريد الجوال", "زُرع عنصرٌ رابعٌ فلم يُصطَد — والفحصُ لا يفحص");
  else notes.push("ضبطٌ سالب: زُرع عنصرٌ رابعٌ فاصطادته البوّابةُ، ثمّ أُزيل فعادت خضراء");
  if (!backGreen) fail("ضبطُ تجريد الجوال", "بقي أثرُ الزرع بعد محوه");

  /* ═══ ٣ — صمتُ «الصلاة» ═══ */
  await cdp.ev(click('[data-sawt="close"]')); // إنهاءُ التشغيلة الجارية
  await sleep(400);
  await cdp.ev(click('.sawt-start')); // عودةٌ إلى التهيئة
  await sleep(400);
  const chose = await cdp.ev(setSelect('[data-sawt="hal"]', "salat"));
  if (!chose) missing.push("لم تُوجد قائمةُ اختيار الحال");
  await sleep(300);
  await cdp.ev(`document.querySelector('[data-sawt="text"]')?.click(); return true;`);
  await sleep(300);
  // **والإعلانُ في كلِّ حالٍ على حدة**: أُذن في «المراجعة» قبلُ، فلا يُورَث الإذنُ
  // صمتًا لـ«الصلاة» — بل يُعاد الإعلانُ ولا يُشغَّل ميكروفونٌ قبله.
  const beforeSalat = await cdp.ev("return window.__sawtSpy;");
  await cdp.ev(click('[data-sawt="begin"]'));
  await sleep(700);
  // **والصلاةُ لا تُفتح بمحرّكٍ يُخرج الصوت** (ص-م٣ §٤-٣): والمختارُ إلى الآن
  // هو الشبكيّ — فيلزم أن يُردَّ إلى السؤال، وأن تكون بطاقتُه معطَّلةً فيه.
  const salatBlocked = await cdp.ev(`return !!document.querySelector('[data-sawt="engine-choice"]');`);
  const netCardOff = await cdp.ev(
    `const b = document.querySelector('[data-sawt="engine-browser-speech"]'); return !!b && b.disabled;`,
  );
  if (!salatBlocked) fail("الصلاةُ بالحرّ وحدَه", "دخلت «الصلاة» بالمحرّك الشبكيّ ولم تُردَّ إلى اختيار المحرّك");
  else if (!netCardOff) fail("الصلاةُ بالحرّ وحدَه", "بطاقةُ المحرّك الشبكيّ ليست معطَّلةً في «الصلاة»");
  else notes.push("«الصلاة» بالمحرّك الشبكيّ: تُردّ إلى السؤال وبطاقتُه معطَّلةٌ فيه");
  const atSalatBlock = await cdp.ev("return window.__sawtSpy;");
  if (atSalatBlock.getUserMedia !== beforeSalat.getUserMedia) {
    fail("الصلاةُ بالحرّ وحدَه", "فُتح مجرًى صوتيٌّ في «الصلاة» قبل اختيار محرّكٍ يصلح لها");
  }
  // ثمّ يُختار الحرُّ فيُعاد الإعلانُ له — والإذنُ لا يُورَّث بين محرّكين
  await cdp.ev(click('[data-sawt="engine-on-device"]'));
  await sleep(700);
  const atSalatAsk = await cdp.ev("return window.__sawtSpy;");
  const salatDeclared = await cdp.ev(`return !!document.querySelector('[data-sawt="consent"]');`);
  if (!salatDeclared) {
    fail("الإعلانُ يسبق الميكروفون", "دخلت «الصلاة» ولم يُعَد إعلانُها — الإذنُ لا يُورَث بين الأحوال");
  }
  if (atSalatAsk.recognizers !== beforeSalat.recognizers) {
    fail("الإعلانُ يسبق الميكروفون", "بُدئ الالتقاطُ في «الصلاة» قبل إعلانها");
  }
  if (salatDeclared) notes.push("الإعلانُ أُعيد في «الصلاة» ولو أُذن في «المراجعة» — ولا التقاطَ قبله");
  await cdp.ev(click('[data-sawt="agree"]'));
  const inSalat = await cdp.until(`document.querySelector('[data-sawt="text"]')`, 8000);
  await sleep(600);
  const duringSalat = await cdp.ev(TASHIH);
  if (duringSalat.bad?.length) {
    fail("صمتُ الصلاة", `عنصرُ تصحيحٍ في أثناء التلاوة: ${[...new Set(duringSalat.bad)].join(" · ")}`);
  }
  if (!inSalat) missing.push("لم تُفتح شاشةُ التلاوة في حال الصلاة");

  await cdp.ev(click('[data-sawt="close"]')); // ✕ في أثناء التلاوة = أنهيت
  await cdp.until(`document.querySelector('[data-sawt="after"]')`, 8000);
  await sleep(400);
  const afterSalat = await cdp.ev(TASHIH);
  if (afterSalat.bad?.length) {
    fail("صمتُ الصلاة", `عنصرُ تصحيحٍ بعد الختام: ${[...new Set(afterSalat.bad)].join(" · ")}`);
  }
  if (afterSalat.digits > 0) {
    fail("صمتُ الصلاة", `رقمٌ بعد الختام في حال الصلاة: ${afterSalat.digits} رقمًا`);
  }
  if (afterSalat.after == null) fail("صمتُ الصلاة", "لم تظهر شاشةُ ما بعد الختام");
  else notes.push(`بعد ختام الصلاة: «${afterSalat.after}» — صفرُ عنصرِ تصحيحٍ وصفرُ رقم`);

  /* ضبطُه السالب: **صمتٌ لا يُقاس بصامتٍ.** فتُعاد التشغيلةُ نفسُها في
     «المراجعة» — فإن لم ير الفاحصُ فيها عنصرَ تصحيحٍ ولا رقمًا فليس صمتُ
     الصلاة صمتًا، بل الفاحصُ أعمى. */
  await cdp.ev(click(".sawt-start")); // عودة
  await sleep(400);
  await cdp.ev(setSelect('[data-sawt="hal"]', "murajaa"));
  await sleep(300);
  await cdp.ev(`document.querySelector('[data-sawt="text"]')?.click(); return true;`);
  await sleep(300);
  await cdp.ev(click('[data-sawt="begin"]'));
  // صار المحرّكُ «على الجهاز» بعد الصلاة، والإعلانُ يُعاد لكلّ حالٍ على حدة
  await sleep(700);
  if (await cdp.ev(`return !!document.querySelector('[data-sawt="agree"]');`)) {
    await cdp.ev(click('[data-sawt="agree"]'));
  }
  await cdp.until(`!document.querySelector('[data-sawt="begin"]')`, 8000);
  await sleep(500);
  await cdp.ev(click('[data-sawt="close"]'));
  await cdp.until(`document.querySelector('[data-sawt="after"]')`, 8000);
  await sleep(400);
  const afterMuraja = await cdp.ev(TASHIH);
  if (!afterMuraja.bad?.length || afterMuraja.digits === 0) {
    fail(
      "ضبطُ صمت الصلاة",
      `«المراجعة» بعد الختام خلت من التصحيح والأرقام — فالفاحصُ لا يرى (عناصر ${afterMuraja.bad?.length ?? 0} · أرقام ${afterMuraja.digits})`,
    );
  } else {
    notes.push(
      `ضبطٌ سالب: «المراجعة» بعد الختام فيها ${[...new Set(afterMuraja.bad)].length} صنفَ عنصرٍ و${afterMuraja.digits} رقمًا — فالفاحصُ يرى، وصمتُ الصلاة صمتٌ مقيس`,
    );
  }

  /* **والأرقامُ الخمسةُ خلفَ الباب نفسِه** (ص-م٤ §٠): يُشهد أنّ سطحَ ما بعد
     الختام في «المراجعة» **قليلُ الأرقام** ما دام البابُ مغلقًا، وأنّها
     **تنهال إذا فُتح** — فلم تُحذف عُدّةُ القياس، وإنّما صارت بطلب. */
  const doorThere = await cdp.ev(`return !!document.querySelector('[data-sawt="fahs-door"]');`);
  if (!doorThere) fail("الأرقامُ خلف بابها", "لا بابَ للفحص بعد الختام");
  else {
    await cdp.ev(click('[data-sawt="fahs-door"]'));
    await sleep(600);
    const opened = await cdp.ev(TASHIH);
    const kitOut = await cdp.ev(MEASURE_KIT);
    if (opened.digits <= afterMuraja.digits || !kitOut.seen.includes('[data-sawt="measure"]')) {
      fail(
        "الأرقامُ خلف بابها",
        `فُتح البابُ فلم تظهر الأرقام (قبل ${afterMuraja.digits} · بعد ${opened.digits} · ${kitOut.seen.join(" · ")})`,
      );
    } else {
      notes.push(
        `الأرقامُ خلف بابها: بعد الختام ${afterMuraja.digits} رقمًا والبابُ مغلق، و${opened.digits} رقمًا إذا فُتح — نُقلت ولم تُحذف`,
      );
    }
  }

  /* ═══════════ ٥ — **لا يُحبَس قارئٌ في خيارٍ لا يعمل** (ص-م٥) ═══════════
     بلاغُ المالك في فحصٍ حيٍّ على هاتفه: اختار المحرّكَ الحرَّ فلم يعمل،
     **ولم يجد سبيلًا إلى التبديل**. **وهذا عيبُ تصميمٍ لا عيبُ محرّك** — يبقى
     قائمًا ولو عمل المحرّكان. فيُشهد ههنا في شجرة العرض:
       (أ) **حالُ المحرّك معروضةٌ دائمًا**، وفي التهيئة **زرٌّ يُبدّل**؛
       (ب) **والتبديلُ من موضعين**: عُدّةُ التهيئة والشريطُ ههنا، والإعداداتُ
           في آخر هذه البوّابة (وهي خارجَ الصفحة فتُزار بنفسها)؛
       (ج) **ورجوعٌ تلقائيٌّ عند الإخفاق يُخبَر به** — يُزرع عطبٌ في الميكروفون
           فيُشهد الرجوعُ والخبرُ وتبدُّلُ الاسم في الشريط؛
       (د) **وضبطُه السالب**: تشغيلةٌ سليمةٌ لا يظهر فيها خبرُ رجوعٍ ألبتّة —
           **فخبرٌ يظهر دائمًا ليس خبرًا**. */

  await cdp.ev(click(".sawt-start")); // «تلاوةٌ أخرى» — عودةٌ إلى التهيئة
  await cdp.until(`document.querySelector('[data-sawt="begin"]')`, 8000);
  await sleep(400);

  /** قراءةُ شريط حال المحرّك: أموجودٌ؟ وما هو؟ وأزرٌّ هو أم خبر؟ */
  const CHIP = `
const el = document.querySelector('[data-sawt="engine-now"]');
if (!el) return { there: false };
const st = getComputedStyle(el);
const r = el.getBoundingClientRect();
return {
  there: true, tag: el.tagName.toLowerCase(),
  text: ((el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '')).replace(/\s+/g, ' ').trim().slice(0, 90),
  h: Math.round(r.height),
  vis: st.display !== 'none' && st.visibility !== 'hidden' && r.height > 1,
};
`;
  const chipIdle = await cdp.ev(CHIP);
  if (!chipIdle.there || !chipIdle.vis) {
    fail("حالُ المحرّك معروضة", "لا شريطَ لحال المحرّك في التهيئة — فالقارئُ يحزر أيُّهما يعمل");
  } else if (chipIdle.tag !== "button") {
    fail("التبديلُ من الشريط", `شريطُ حال المحرّك في التهيئة ليس زرًّا (${chipIdle.tag}) — فلا يُبدَّل منه`);
  } else if (chipIdle.h < 44) {
    fail("التبديلُ من الشريط", `هدفُ لمسٍ دون ٤٤: ${chipIdle.h}px`);
  } else {
    notes.push(`حالُ المحرّك معروضةٌ في التهيئة وهي زرُّ تبديل (${chipIdle.h}px): «${chipIdle.text}»`);
  }

  /* (ب‑١) **الموضعُ الأوّل: عُدّةُ التهيئة** — يُفتح ⋯ فيُوجد زرُّ التبديل */
  await cdp.ev(click(".sawt-m-more"));
  await sleep(500);
  const swapInKit = await cdp.ev(`
const el = document.querySelector('[data-sawt="engine-swap"]');
if (!el) return { there: false };
const r = el.getBoundingClientRect();
return { there: true, h: Math.round(r.height), vis: getComputedStyle(el).display !== 'none' && r.height > 1 };
`);
  if (!swapInKit.there || !swapInKit.vis) {
    fail("التبديلُ من عُدّة التهيئة", "لا زرَّ تبديلٍ في عُدّة التهيئة — ومن أخطأ الاختيارَ حُبس");
  } else if (swapInKit.h < 44) {
    fail("التبديلُ من عُدّة التهيئة", `هدفُ لمسٍ دون ٤٤: ${swapInKit.h}px`);
  } else {
    await cdp.ev(click('[data-sawt="engine-swap"]'));
    await sleep(500);
    const opened = await cdp.ev(`return !!document.querySelector('[data-sawt="engine-choice"]');`);
    const spied = await cdp.ev("return window.__sawtSpy;");
    if (!opened) fail("التبديلُ من عُدّة التهيئة", "ضُغط زرُّ التبديل فلم يُفتح اختيارُ المحرّك");
    else notes.push(`التبديلُ من عُدّة التهيئة: زرٌّ ظاهرٌ (${swapInKit.h}px) يفتح اختيارَ المحرّك بلا إعادةِ تثبيتٍ ولا محوِ بيانات`);
    // **ولا يُشغَّل ميكروفونٌ بمجرّد فتح باب التبديل**
    if (spied.getUserMedia !== (await cdp.ev("return window.__sawtSpy.getUserMedia;"))) {
      fail("التبديلُ من عُدّة التهيئة", "فُتح بابُ صوتٍ عند فتح اختيار المحرّك");
    }
    await cdp.ev(click('[data-sawt="engine-later"]'));
    await sleep(300);
  }
  await cdp.ev(click(".sawt-m-more")); // إغلاقُ عُدّة التهيئة
  await sleep(300);

  /* (ب‑٢) **ومن الشريط نفسِه** — ثمّ يُختار الشبكيُّ ليكون له إذنٌ محفوظ */
  await cdp.ev(click('[data-sawt="engine-now"]'));
  await sleep(500);
  if (!(await cdp.ev(`return !!document.querySelector('[data-sawt="engine-choice"]');`))) {
    fail("التبديلُ من الشريط", "ضُغط شريطُ حال المحرّك فلم يُفتح اختيارُ المحرّك");
  } else {
    notes.push("التبديلُ من الشريط: يُفتح اختيارُ المحرّك بلمسةٍ واحدةٍ في أثناء التهيئة");
  }
  await cdp.ev(click('[data-sawt="engine-browser-speech"]'));
  await sleep(400);
  // **والتبديلُ المقصودُ لا يُشغّل ميكروفونًا من تلقائه** — يُحفظ ويُغلق اللوح
  const afterDeliberate = await cdp.ev(`
return {
  choice: !!document.querySelector('[data-sawt="engine-choice"]'),
  consent: !!document.querySelector('[data-sawt="consent"]'),
  begin: !!document.querySelector('[data-sawt="begin"]'),
};
`);
  if (afterDeliberate.choice || afterDeliberate.consent || !afterDeliberate.begin) {
    fail("التبديلُ المقصود", `بُدّل المحرّكُ فلم يعُد إلى التهيئة: ${JSON.stringify(afterDeliberate)}`);
  } else {
    notes.push("التبديلُ المقصود يُحفظ ويعود إلى التهيئة — ولا يُشغَّل ميكروفونٌ من تلقائه");
  }

  /* تشغيلةٌ سليمةٌ بالشبكيّ: بها يُحفظ إذنُه، **وبها يُضبط الفحصُ سالبًا**
     (لا خبرَ رجوعٍ في تشغيلةٍ لم يُخفق فيها شيء) */
  await cdp.ev(click('[data-sawt="begin"]'));
  await sleep(600);
  if (await cdp.ev(`return !!document.querySelector('[data-sawt="agree"]');`)) {
    await cdp.ev(click('[data-sawt="agree"]'));
  }
  await cdp.until(`!document.querySelector('[data-sawt="begin"]')`, 8000);
  await sleep(600);
  const healthy = await cdp.ev(`
const el = document.querySelector('[data-sawt="engine-fell"]');
return { fell: !!el, chip: (document.querySelector('[data-sawt="engine-now"]')?.getAttribute('aria-label') || '') };
`);
  if (healthy.fell) {
    fail("ضبطُ خبر الرجوع", "ظهر خبرُ رجوعٍ في تشغيلةٍ سليمة — فالخبرُ يظهر دائمًا ولا يشهد بشيء");
  } else {
    notes.push(`ضبطٌ سالب: تشغيلةٌ سليمةٌ بالشبكيّ — لا خبرَ رجوعٍ ألبتّة، وحالُ المحرّك في الشريط «${healthy.chip}»`);
  }
  await cdp.ev(click('[data-sawt="close"]')); // إنهاء
  await cdp.until(`document.querySelector('[data-sawt="after"]')`, 8000);
  await cdp.ev(click(".sawt-start"));
  await cdp.until(`document.querySelector('[data-sawt="begin"]')`, 8000);
  await sleep(400);

  /* (ج) **الرجوعُ التلقائيُّ عند الإخفاق** — يُزرع العطبُ ثمّ يُختار الحرّ */
  await cdp.ev(`window.__sawtFail = 'gum'; return true;`);
  await cdp.ev(click('[data-sawt="engine-now"]'));
  await sleep(400);
  await cdp.ev(click('[data-sawt="engine-on-device"]'));
  await sleep(400);
  const spyBeforeFall = await cdp.ev("return window.__sawtSpy;");
  await cdp.ev(click('[data-sawt="begin"]'));
  await sleep(600);
  // الإذنُ لا يُورَّث: يُعاد الإعلانُ للمحرّك الحرّ قبل ميكروفونه
  if (await cdp.ev(`return !!document.querySelector('[data-sawt="agree"]');`)) {
    await cdp.ev(click('[data-sawt="agree"]'));
  }
  const fellShown = await cdp.until(`document.querySelector('[data-sawt="engine-fell"]')`, 15000);
  await sleep(800);
  const fallen = await cdp.ev(`
const el = document.querySelector('[data-sawt="engine-fell"]');
const chip = document.querySelector('[data-sawt="engine-now"]');
return {
  fell: !!el,
  say: el ? el.innerText.replace(/\s+/g, ' ').trim().slice(0, 140) : null,
  chip: chip ? ((chip.getAttribute('aria-label') || '') + ' ' + (chip.innerText || '')).replace(/\s+/g, ' ').trim().slice(0, 90) : null,
  running: !document.querySelector('[data-sawt="begin"]'),
  consentPanel: !!document.querySelector('[data-sawt="consent"]'),
};
`);
  const spyAfterFall = await cdp.ev("return window.__sawtSpy;");
  if (!fellShown || !fallen.fell) {
    fail("الرجوعُ عند الإخفاق", "أخفق المحرّكُ الحرُّ فلم يظهر خبرٌ ألبتّة — وهذا هو الحبسُ بعينه");
  } else if (!fallen.chip || !fallen.chip.includes("خدمة المتصفّح")) {
    fail("الرجوعُ عند الإخفاق", `وقع الخبرُ ولم يتبدّل اسمُ المحرّك في الشريط: «${fallen.chip}»`);
  } else if (!fallen.running || spyAfterFall.recognizers <= spyBeforeFall.recognizers) {
    fail(
      "الرجوعُ عند الإخفاق",
      `أُخبر القارئُ ولم يُرجَع فعلًا (تلاوةٌ جارية: ${fallen.running} · محرّكات ${spyBeforeFall.recognizers}←${spyAfterFall.recognizers})`,
    );
  } else {
    notes.push(
      `الرجوعُ عند الإخفاق: زُرع عطبٌ في الميكروفون ⇒ أُخبر القارئُ «${fallen.say}» ثمّ رُجع إلى الشبكيّ فعلًا (محرّكات ${spyBeforeFall.recognizers}←${spyAfterFall.recognizers}) وتبدّل الاسمُ في الشريط`,
    );
  }
  await cdp.ev(`window.__sawtFail = null; return true;`);

  /* (ج‑٢) **ولا يُرجَع في الصلاة إلى الشبكيّ بحال** — يُوقَف ويُقال ما وقع */
  await cdp.ev(click('[data-sawt="close"]'));
  await cdp.until(`document.querySelector('[data-sawt="after"]')`, 8000);
  await cdp.ev(click(".sawt-start"));
  await cdp.until(`document.querySelector('[data-sawt="begin"]')`, 8000);
  await sleep(400);
  await cdp.ev(setSelect('[data-sawt="hal"]', "salat"));
  await sleep(300);
  await cdp.ev(click('[data-sawt="engine-now"]'));
  await sleep(400);
  await cdp.ev(click('[data-sawt="engine-on-device"]'));
  await sleep(400);
  await cdp.ev(`window.__sawtFail = 'gum'; return true;`);
  const spyBeforeSalatFall = await cdp.ev("return window.__sawtSpy;");
  await cdp.ev(click('[data-sawt="begin"]'));
  await sleep(600);
  if (await cdp.ev(`return !!document.querySelector('[data-sawt="agree"]');`)) {
    await cdp.ev(click('[data-sawt="agree"]'));
  }
  const salatFellShown = await cdp.until(`document.querySelector('[data-sawt="engine-fell"]')`, 15000);
  await sleep(800);
  const salatFall = await cdp.ev(`
const el = document.querySelector('[data-sawt="engine-fell"]');
const chip = document.querySelector('[data-sawt="engine-now"]');
return {
  fell: !!el,
  say: el ? el.innerText.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
  chip: chip ? ((chip.getAttribute('aria-label') || '') + ' ' + (chip.innerText || '')).replace(/\s+/g, ' ').trim().slice(0, 90) : null,
  idle: !!document.querySelector('[data-sawt="begin"]'),
};
`);
  const spyAfterSalatFall = await cdp.ev("return window.__sawtSpy;");
  if (!salatFellShown || !salatFall.fell) {
    fail("الصلاةُ لا يُرجَع فيها إلى الشبكيّ", "أخفق المحرّكُ في «الصلاة» فلم يُخبَر القارئُ بشيء");
  } else if (salatFall.chip && salatFall.chip.includes("خدمة المتصفّح")) {
    fail("الصلاةُ لا يُرجَع فيها إلى الشبكيّ", `رُجع في «الصلاة» إلى محرّكٍ يُخرج الصوت: «${salatFall.chip}»`);
  } else if (spyAfterSalatFall.recognizers !== spyBeforeSalatFall.recognizers) {
    fail("الصلاةُ لا يُرجَع فيها إلى الشبكيّ", "أُنشئ محرّكٌ شبكيٌّ بعد إخفاق الحرّ في «الصلاة»");
  } else if (!salatFall.idle) {
    fail("الصلاةُ لا يُرجَع فيها إلى الشبكيّ", "بقيت التلاوةُ جاريةً بلا محرّكٍ يسمع");
  } else {
    notes.push(`الصلاةُ: أخفق الحرُّ فأُخبر القارئُ «${salatFall.say}» — **ولم يُرجَع إلى الشبكيّ** ولم يُنشأ محرّكٌ يُخرج الصوت`);
  }
  await cdp.ev(`window.__sawtFail = null; return true;`);

  /* (ب‑٣) **الموضعُ الثاني: الإعدادات** — وهي خارجَ صفحة التتبّع فتُزار بنفسها */
  await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
  const readBooted = await cdp.until(`!document.querySelector('.boot') && document.querySelector('.set-wrap button')`, 45000);
  if (!readBooted) {
    missing.push("لم تُقلع صفحةُ المصحف — فلم يُفحص موضعُ التبديل الثاني (الإعدادات)");
  } else {
    await cdp.ev(click(".set-wrap > button"));
    await sleep(700);
    const inSettings = await cdp.ev(`
const line = document.querySelector('[data-sawt-set="engine-line"]');
if (!line) return { there: false };
const sec = line.closest('.set-sec');
const btns = sec ? [...sec.querySelectorAll('.set-seg button')] : [];
return {
  there: true,
  vis: line.getBoundingClientRect().height > 1,
  line: line.innerText.replace(/\s+/g, ' ').trim().slice(0, 90),
  names: btns.map((b) => (b.textContent || '').trim()).filter(Boolean),
  tap: Math.min(...btns.map((b) => Math.round(b.getBoundingClientRect().height)), 999),
};
`);
    if (!inSettings.there || !inSettings.vis) {
      fail("التبديلُ من الإعدادات", "لا قسمَ لمحرّك التتبّع في الإعدادات — فالتبديلُ من موضعٍ واحد");
    } else if (inSettings.names.length < 2) {
      fail("التبديلُ من الإعدادات", `قسمُ المحرّك لا يعرض المحرّكين: ${JSON.stringify(inSettings.names)}`);
    } else {
      notes.push(
        `التبديلُ من الإعدادات: ${inSettings.names.join(" · ")} — وسطرُ صدق المختار معه «${inSettings.line}» (أصغرُ هدفِ لمسٍ ${inSettings.tap}px)`,
      );
    }
  }

  ws.close();
}

try {
  await main();
} catch (e) {
  missing.push(`تعثّر التسيير: ${e.message}`);
} finally {
  chrome?.kill();
  preview?.kill();
}

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0 && missing.length === 0;
writeFileSync(
  OUT,
  `${JSON.stringify({ gate: "tatabbu-live", ok, checkedAt: null, notes, failures, missing }, null, 2)}\n`,
);
console.log(`البوّابةُ الحيّةُ للتتبّع: ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
if (!ok) process.exitCode = 1;

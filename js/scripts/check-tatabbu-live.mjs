/**
 * البوّابةُ الحيّةُ لسطح «التتبّع» — **ما لا يُفحص إلّا في شجرة العرض.**
 *
 * ═══ **وقد أُعيدت وجهتُها إلى تطبيق التلاوة** (ف٤ §٣ — ٢٤ آب ٢٠٢٦) ═══
 * خرج سطحُ التتبّع من مشكاة (ف٤ §١)، **والأحكامُ لا تخرج معه**: هي هي، ويتبعها
 * القياسُ حيث صار المفحوس. فتُسيَّر ههنا على معاينة `apps/tilawa` — الوسومُ
 * `data-track="…"` بدل `data-sawt="…"`، والسطحُ صفحةُ مصحفٍ وشريطٌ بدل صفحةٍ
 * قائمةٍ بنفسها، **والحكمُ في كلٍّ هو الحكم**.
 *
 * **وحكمان لم ينتقلا فسقطا ههنا بإعلان** — لا صمتًا:
 *   • **«عُدّةُ القياس باقيةٌ خلف بابها»** (ص-م٤ §٠): كان لمشكاة بابٌ يُفتح فتظهر
 *     خلفَه جداولُ المحكّ. **ولا عُدّةَ قياسٍ في تطبيق العبادة أصلًا** — فبقي من
 *     الحكم شطرُه القائم: **سطحُ القارئ خالٍ منها**، ويُفحص أدناه بضبطه السالب.
 *   • **«التبديلُ من موضعين»** (ص-م٥): الموضعُ الثاني كان إعداداتِ مشكاة وقد
 *     خرج قسمُها؛ وفي التلاوة **شريطُ الحال نفسُه زرُّ تبديلٍ حاضرٌ في كلّ
 *     تهيئة** — فيُفحص الموضعُ القائم، ويُرفع سقوطُ الثاني قيدًا إلى الإدارة.
 *
 * والأبوابُ المقيسةُ ههنا — **وثلاثةٌ منها لا حارسَ لها حيًّا سواها**
 * (`check-tilawa` تحرس الإقلاعَ والهيئةَ والمؤشّرَ والميثاقَ ولا تبلغ هذه):
 *
 *   ١ — **الإعلانُ يسبق الميكروفون**: بجهازٍ لم يُؤذَن فيه قطُّ، تُلمس أيقونةُ
 *       الميكروفون فلا يُنشأ محرّكُ تعرّفٍ ولا يُطلب مجرًى صوتيٌّ **البتّة** —
 *       بل يُسأل عن المحرّك، ثمّ يُعرض إعلانُه، ثمّ يبدأ الالتقاطُ بالإذن
 *       الصريح. والشاهدُ **جواسيسُ** على `SpeechRecognition` و`getUserMedia`
 *       تُنصب قبل تحميل الصفحة، فتعُدّ ما وقع لا ما يُظنّ.
 *   ٢ — **تجريدُ الجوال**: بعرض ٣٩٠ وفي أثناء التلاوة، **كلُّ عنصر تحكّمٍ ظاهرٍ
 *       في الشاشة من شريط التتبّع** — لا من قشرةٍ انسحبت ولا من سطحٍ ثانٍ —
 *       وليس فيه إلّا «أنهيت» و«✕». **وضبطُه السالبُ معه**: يُزرع عنصرٌ ثالثٌ
 *       فيُصطاد، ثمّ يُزال فتعود خضراء.
 *   ٣ — **صمتُ «الصلاة»**: في أثنائها **صفرُ عنصرِ تصحيح**، وعند الختام **لا
 *       تُفتح ورقةُ ما بعد الختام أصلًا**. **وضبطُه السالبُ عينُ الواقعة**:
 *       تُعاد التشغيلةُ في «المراجعة» فتُفتح الورقةُ — **فصمتٌ لا يُقاس بصامتٍ
 *       ليس صمتًا، بل الفاحصُ أعمى**.
 *   ٤ — **وسطحُ القارئ خالٍ من عُدّة القياس** — بضبطه السالب.
 *   ٥ — **ولا يُحبَس قارئٌ في خيارٍ لا يعمل** (ص-م٥، على بلاغ المالك): حالُ
 *       المحرّك معروضةٌ في الشريط **وهي زرُّ تبديلٍ** بهدف لمسٍ مقيس ·
 *       **ويُزرع عطبٌ في الميكروفون فيُشهد الرجوعُ التلقائيُّ وخبرُه وتبدُّلُ
 *       الاسم** · **ولا يُرجَع في «الصلاة» إلى محرّكٍ يُخرج الصوت بحال** ·
 *       وضبطُه السالب: تشغيلةٌ سليمةٌ لا خبرَ رجوعٍ فيها — **فخبرٌ يظهر دائمًا
 *       ليس خبرًا**.
 *
 * **ومحرّكُ التعرّف يُستبدل بساكنٍ لا يسمع شيئًا** — لأنّ المفحوصَ ههنا شجرةُ
 * العرض وسلوكُ الإذن، لا جودةُ السمع. والاستبدالُ عند حدِّ `RecognizerPort`
 * نفسِه الذي بُني ليُبدَّل، فلا يُمَسّ من شيفرتنا حرف. **والعاملُ مستبدَلٌ في
 * كلّ حال** كي لا يُنزَّل نموذجُ ٨٣ م.ب في بوّابة.
 *
 * التشغيل: node js/scripts/check-tatabbu-live.mjs → js/data/gates/TATABBU-LIVE.json
 * (يبني السكربتُ خادمَ المعاينة بنفسه على `apps/tilawa/dist`؛ فإن لم يكن
 *  موجودًا أعلن ذلك ولم يمرّ صامتًا.)
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = join(ROOT, "js", "apps", "tilawa");
const DIST = join(APP, "dist");
const OUT = join(ROOT, "js", "data", "gates", "TATABBU-LIVE.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4179;
const CDP_PORT = 9333;
const URL = `http://localhost:${PORT}/`;
/** الحدُّ الأدنى المعلَن لهدف اللمس — ميثاقُ الوجه §١ */
const MIN_TAP = 44;

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
/* **وعاملٌ بديلٌ في كلّ حال** — والمحرّكُ الحرُّ يُختار ههنا في «الصلاة» (ولا
   تُفتح بغيره)، فلولا الاستبدالُ لَنُزِّل نموذجُ ٨٣ م.ب في بوّابة. والمفحوصُ
   شجرةُ العرض وسلوكُ الإذن لا سمعُ المحرّك. */
(function () {
  window.__sawtWorkers = 0;
  function StubWorker() { window.__sawtWorkers++; this.onmessage = null; this.onerror = null; }
  StubWorker.prototype.postMessage = function () {};
  StubWorker.prototype.terminate = function () {};
  StubWorker.prototype.addEventListener = function () {};
  StubWorker.prototype.removeEventListener = function () {};
  Object.defineProperty(window, 'Worker', { value: StubWorker, writable: true, configurable: true });
})();
try {
  for (const k of ['sawt.consent.v1','sawt.hal.v1','sawt.mark.v1','sawt.engine.v1','sawt.declared.v1','tilawa.settings.v1','quran-studio:mawdi:mushaf','quran-studio:mawdi:murajaa','quran-studio:mawdi:salat']) localStorage.removeItem(k);
} catch (e) {}
`;

/** عناصرُ التحكّم الظاهرةُ في الشاشة، وأيُّها من شريط التتبّع */
const VISIBLE_CONTROLS = `
const bar = document.querySelector('[data-track="bar"]');
if (!bar) return { error: 'لا شريطَ للتتبّع في الشجرة' };
const sel = 'button, select, input, textarea, summary, a[href], [role="button"], [contenteditable]';
const seen = [];
for (const el of document.querySelectorAll(sel)) {
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) continue;
  /* **والقشرةُ المنسحبةُ ليست ظاهرة**: تُدفع بـ\`transform\` فتبقى في الشجرة
     خارجَ الشاشة — فما وقع خارجَ حدود النافذة لا يُعَدّ معروضًا. */
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
  seen.push({
    tag: el.tagName.toLowerCase(),
    what: el.dataset.track || null,
    inBar: bar.contains(el),
    label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24),
  });
}
const w = document.querySelector('.mushaf-page .mp-text .mp-w');
return { controls: seen, text: !!(w && w.getBoundingClientRect().height > 1) };
`;

/** عناصرُ التصحيح — كلُّ ما يقول للقارئ شيئًا عن تلاوته أو عن قياسها */
const TASHIH = `
const bad = [];
for (const s of ['[data-track="after"]', '[data-track="places"]', '[data-track="slips"]', '[data-track="bayan"]', '.tw-places', '.tw-slips', '.tw-reached']) {
  for (const el of document.querySelectorAll(s)) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    bad.push(s);
  }
}
const after = document.querySelector('[data-track="after"]');
const digits = after ? (after.innerText.match(/[0-9\\u0660-\\u0669\\u06F0-\\u06F9]/g) || []) : [];
return { bad: [...new Set(bad)], digits: digits.length, after: after ? after.innerText.replace(/\\s+/g, ' ').trim().slice(0, 80) : null };
`;

/**
 * **عُدّةُ القياس** — كلُّ ما يقيس المحرّكَ ولا يعني القارئ (ص-م٤ §٠).
 * ولا عُدّةَ في تطبيق العبادة أصلًا؛ **والفحصُ يشهد بخلوّه لا بنقلها**.
 */
const MEASURE_KIT = `
const seen = [];
for (const s of ['table', '[data-track="measure"]', '[data-track="fahs"]', '.tw-table', '.tw-felt']) {
  for (const el of document.querySelectorAll(s)) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (el.getBoundingClientRect().height < 1) continue;
    seen.push(s);
  }
}
/* وألفاظُ العُدّة في الأزرار الظاهرة — «مقاطع المحكّ» و«انسخ…» */
const words = [];
for (const el of document.querySelectorAll('button')) {
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden') continue;
  if (el.getBoundingClientRect().height < 1) continue;
  const t = (el.textContent || '').trim();
  if (t.includes('المحكّ') || t.startsWith('انسخ')) words.push(t.slice(0, 20));
}
return { seen: [...new Set(seen)], words: [...new Set(words)] };
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

/**
 * **العودةُ إلى التهيئة** — وهي طيُّ ورقة الختام لا «تلاوةٌ أخرى»: تلك تبدأ
 * تشغيلةً في الحال (فتصير الحالُ خبرًا لا قائمةً تُختار)، وهذه تردّ الشريطَ
 * قابلًا للتهيئة (`dismissReport` ⇐ `armed`). ولمسُ الأرضيّة يطويها كما يطويها
 * القارئُ بإصبعه. **وفي «الصلاة» لا ورقةَ أصلًا** فلا شيءَ يُطوى.
 */
const TO_IDLE = `
const back = document.querySelector('.tw-backdrop');
if (back) back.click();
return !!back;
`;

/* ═══════════ التسيير ═══════════ */

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
  for (let i = 0; i < 80 && !target; i++) {
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

  const booted = await cdp.until(
    `document.querySelector('.mushaf-page .mp-text .mp-w') && document.querySelector('[data-track="mic"]')`,
    90000,
  );
  if (!booted) {
    missing.push("لم يُقلع التطبيقُ في المتصفّح");
    return;
  }
  await sleep(700);

  /* ═══ ١ — الإعلانُ يسبق الميكروفون ═══ */
  const before = await cdp.ev("return window.__sawtSpy;");
  if (before.recognizers !== 0 || before.getUserMedia !== 0) {
    fail("الإعلانُ يسبق الميكروفون", `فُتح بابُ صوتٍ قبل أن يُلمس شيء: ${JSON.stringify(before)}`);
  }
  await cdp.ev(click('[data-track="mic"]'));
  await sleep(800);
  // **والمحرّكُ يُسأل عنه قبل الإعلان** (ص-م٣ §٤): لا يُختار عن القارئ محرّكٌ
  // يُخرج صوتَه ولا محرّكٌ ينزّل من شبكته — ولا ميكروفونَ قبل جوابه.
  const engineAsked = await cdp.ev(`return !!document.querySelector('[data-track="engine-choice"]');`);
  const atEngineAsk = await cdp.ev("return window.__sawtSpy;");
  if (!engineAsked) fail("المحرّكُ يُسأل عنه", "لُمس الميكروفونُ ولم يُسأل عن المحرّك");
  if (atEngineAsk.recognizers !== 0 || atEngineAsk.getUserMedia !== 0) {
    fail("المحرّكُ يُسأل عنه", "فُتح بابُ صوتٍ قبل اختيار المحرّك");
  }
  if (engineAsked) notes.push("السؤالُ عن المحرّك يسبق الإعلانَ والميكروفونَ معًا");
  // ويُختار الشبكيُّ ههنا عمدًا: هو الافتراضُ العمليُّ لعامّة الأجهزة
  await cdp.ev(click('[data-track="engine-browser-speech"]'));
  await sleep(800);
  const atAsk = await cdp.ev("return window.__sawtSpy;");
  const consentShown = await cdp.ev(`return !!document.querySelector('[data-track="consent"]');`);
  if (atAsk.recognizers !== 0 || atAsk.starts !== 0 || atAsk.getUserMedia !== 0) {
    fail(
      "الإعلانُ يسبق الميكروفون",
      `بُدئ الالتقاطُ قبل الموافقة: محرّكات ${atAsk.recognizers} · تشغيل ${atAsk.starts} · مجرًى ${atAsk.getUserMedia}`,
    );
  }
  if (!consentShown) fail("الإعلانُ يسبق الميكروفون", "لم يظهر الإعلانُ عند طلب البدء");
  notes.push(`قبل الموافقة: محرّكات ${atAsk.recognizers} · مجرًى صوتيّ ${atAsk.getUserMedia}`);

  await cdp.ev(click('[data-track="agree"]'));
  const running = await cdp.until(`window.__sawtSpy.recognizers > 0`, 10000);
  const afterAgree = await cdp.ev("return window.__sawtSpy;");
  if (!running) fail("الإعلانُ يسبق الميكروفون", "أُذن ولم يبدأ الالتقاط");
  notes.push(`بعد الموافقة: محرّكات ${afterAgree.recognizers} · تشغيل ${afterAgree.starts}`);

  /* ═══ ٢ — تجريدُ الجوال: أثناءَ التلاوة لا يظهر إلّا ما يخصّها ═══ */
  await sleep(900);
  const shot = await cdp.ev(VISIBLE_CONTROLS);
  const allowed = ["end", "close"];
  if (shot.error) {
    fail("تجريدُ الجوال", shot.error);
  } else {
    const got = (shot.controls ?? []).map((c) => c.what);
    const extra = (shot.controls ?? []).filter((c) => !c.inBar || !allowed.includes(c.what));
    if (extra.length) {
      fail(
        "تجريدُ الجوال",
        `عناصرُ تحكّمٍ زائدةٌ في أثناء التلاوة: ${extra.map((e) => `${e.tag}«${e.label}»`).join(" · ")}`,
      );
    } else if (!allowed.every((a) => got.includes(a))) {
      fail("تجريدُ الجوال", `نقصَ من الاثنين: ${allowed.filter((a) => !got.includes(a)).join("، ")}`);
    } else if (!shot.text) {
      fail("تجريدُ الجوال", "لم يظهر النصُّ القرآنيّ في أثناء التلاوة");
    } else {
      notes.push("الجوالُ في أثناء التلاوة: النصُّ ثمّ شريطٌ فيه «أنهيت» و«✕» — ولا ثالثَ ظاهرٌ في الشاشة");
    }
  }

  /* ضبطُه السالب: عنصرٌ ثالثٌ مزروعٌ يُصطاد ثمّ يُزال */
  await cdp.ev(`
    const bar = document.querySelector('[data-track="bar"]');
    const b = document.createElement('button');
    b.id = '__plant'; b.textContent = 'زرعٌ للاختبار';
    bar.appendChild(b);
    return true;
  `);
  await sleep(250);
  const planted = await cdp.ev(VISIBLE_CONTROLS);
  const caught = (planted.controls ?? []).some((c) => !c.inBar || !allowed.includes(c.what));
  await cdp.ev(`document.getElementById('__plant')?.remove(); return true;`);
  await sleep(250);
  const cleaned = await cdp.ev(VISIBLE_CONTROLS);
  const backGreen = !(cleaned.controls ?? []).some((c) => !c.inBar || !allowed.includes(c.what));
  if (!caught) fail("ضبطُ تجريد الجوال", "زُرع عنصرٌ ثالثٌ فلم يُصطَد — والفحصُ لا يفحص");
  else notes.push("ضبطٌ سالب: زُرع عنصرٌ ثالثٌ في الشريط فاصطادته البوّابةُ، ثمّ أُزيل فعادت خضراء");
  if (!backGreen) fail("ضبطُ تجريد الجوال", "بقي أثرُ الزرع بعد محوه");

  /* ═══ ٤ — سطحُ القارئ خالٍ من عُدّة القياس (ص-م٤ §٠) ═══ */
  const kit = await cdp.ev(MEASURE_KIT);
  if (kit.seen.length || kit.words.length) {
    fail("عُدّةُ القياس في سطح القارئ", `ظهر في السطح: ${[...kit.seen, ...kit.words].join(" · ")}`);
  } else {
    notes.push("سطحُ القارئ خالٍ من عُدّة القياس: لا جدولَ ولا مصفوفةَ ولا «مقاطع المحكّ» ولا نسخَ أرقام");
  }
  /* ضبطُه السالب: يُزرع جدولُ قياسٍ في السطح فيُصطاد، ثمّ يُزال فتعود خضراء */
  await cdp.ev(`
    const t = document.createElement('table');
    t.id = '__plantKit';
    t.innerHTML = '<tbody><tr><td>الإصابة</td><td>٩٩٪</td></tr></tbody>';
    document.body.appendChild(t);
    return true;
  `);
  await sleep(250);
  const kitPlanted = await cdp.ev(MEASURE_KIT);
  await cdp.ev(`document.getElementById('__plantKit')?.remove(); return true;`);
  await sleep(250);
  const kitBack = await cdp.ev(MEASURE_KIT);
  if (!kitPlanted.seen.length) fail("ضبطُ عُدّة القياس", "زُرع جدولُ قياسٍ في السطح فلم يُصطَد — والفحصُ لا يفحص");
  else if (kitBack.seen.length) fail("ضبطُ عُدّة القياس", "بقي أثرُ الزرع بعد محوه");
  else notes.push("ضبطٌ سالب: زُرع جدولُ قياسٍ في السطح فاصطيد، ثمّ أُزيل فعادت خضراء");

  /* ═══ ٣ — صمتُ «الصلاة» ═══ */
  await cdp.ev(click('[data-track="end"]')); // إنهاءُ تشغيلة المراجعة الجارية
  await cdp.until(`document.querySelector('[data-track="after"]')`, 10000);
  await sleep(400);
  /* **وهذه بعينها ضبطُ صمت الصلاة**: تشغيلةٌ في حالٍ ناطقةٍ تُفتح لها ورقةُ ما
     بعد الختام — فإن لم يرها الفاحصُ فليس صمتُ الصلاة صمتًا، بل الفاحصُ أعمى. */
  const afterMuraja = await cdp.ev(TASHIH);
  if (!afterMuraja.bad.length) {
    fail(
      "ضبطُ صمت الصلاة",
      "«المراجعة» بعد الختام خلت من ورقة الختام وعناصرها — فالفاحصُ لا يرى",
    );
  } else {
    notes.push(
      `ضبطٌ سالب: «المراجعة» بعد الختام فيها ${afterMuraja.bad.length} صنفَ عنصرٍ و${afterMuraja.digits} رقمًا — فالفاحصُ يرى، وصمتُ الصلاة صمتٌ مقيس`,
    );
  }

  await cdp.ev(TO_IDLE); // تُطوى ورقةُ الختام فيعود الشريطُ إلى التهيئة
  await cdp.until(`document.querySelector('[data-track="hal"]')`, 10000);
  await sleep(400);
  const chose = await cdp.ev(setSelect('[data-track="hal"]', "salat"));
  if (!chose) missing.push("لم تُوجد قائمةُ اختيار الحال");
  await sleep(400);

  /* **والصلاةُ لا تُفتح بمحرّكٍ يُخرج الصوت** (ص-م٣ §٤-٣): والمختارُ إلى الآن
     هو الشبكيّ — فيلزم أن يُردَّ إلى السؤال، وأن تكون بطاقتُه معطَّلةً فيه. */
  const beforeSalat = await cdp.ev("return window.__sawtSpy;");
  await cdp.ev(click('[data-track="begin"]'));
  await sleep(800);
  const salatBlocked = await cdp.ev(`return !!document.querySelector('[data-track="engine-choice"]');`);
  const netCardOff = await cdp.ev(
    `const b = document.querySelector('[data-track="engine-browser-speech"]'); return !!b && b.disabled;`,
  );
  if (!salatBlocked) fail("الصلاةُ بالحرّ وحدَه", "دخلت «الصلاة» بالمحرّك الشبكيّ ولم تُردَّ إلى اختيار المحرّك");
  else if (!netCardOff) fail("الصلاةُ بالحرّ وحدَه", "بطاقةُ المحرّك الشبكيّ ليست معطَّلةً في «الصلاة»");
  else notes.push("«الصلاة» بالمحرّك الشبكيّ: تُردّ إلى السؤال وبطاقتُه معطَّلةٌ فيه");
  const atSalatBlock = await cdp.ev("return window.__sawtSpy;");
  if (atSalatBlock.getUserMedia !== beforeSalat.getUserMedia) {
    fail("الصلاةُ بالحرّ وحدَه", "فُتح مجرًى صوتيٌّ في «الصلاة» قبل اختيار محرّكٍ يصلح لها");
  }
  // ثمّ يُختار الحرُّ فيُعاد الإعلانُ له — والإذنُ لا يُورَّث بين محرّكين
  await cdp.ev(click('[data-track="engine-on-device"]'));
  await sleep(800);
  const atSalatAsk = await cdp.ev("return window.__sawtSpy;");
  const salatDeclared = await cdp.ev(`return !!document.querySelector('[data-track="consent"]');`);
  if (!salatDeclared) {
    fail("الإعلانُ يسبق الميكروفون", "دخلت «الصلاة» ولم يُعَد إعلانُها — الإذنُ لا يُورَث بين الأحوال");
  }
  if (atSalatAsk.recognizers !== beforeSalat.recognizers) {
    fail("الإعلانُ يسبق الميكروفون", "بُدئ الالتقاطُ في «الصلاة» قبل إعلانها");
  }
  if (salatDeclared) notes.push("الإعلانُ أُعيد في «الصلاة» ولو أُذن في «المراجعة» — ولا التقاطَ قبله");
  await cdp.ev(click('[data-track="agree"]'));
  const inSalat = await cdp.until(`document.querySelector('[data-track="bar"]') && !document.querySelector('[data-track="begin"]')`, 10000);
  await sleep(700);
  const duringSalat = await cdp.ev(TASHIH);
  if (duringSalat.bad.length) {
    fail("صمتُ الصلاة", `عنصرُ تصحيحٍ في أثناء التلاوة: ${duringSalat.bad.join(" · ")}`);
  }
  if (!inSalat) missing.push("لم تبدأ التلاوةُ في حال الصلاة");

  await cdp.ev(click('[data-track="end"]'));
  await sleep(1200);
  const afterSalat = await cdp.ev(TASHIH);
  if (afterSalat.bad.length) {
    fail("صمتُ الصلاة", `عنصرُ تصحيحٍ بعد الختام: ${afterSalat.bad.join(" · ")}`);
  } else if (afterSalat.digits > 0) {
    fail("صمتُ الصلاة", `رقمٌ بعد الختام في حال الصلاة: ${afterSalat.digits} رقمًا`);
  } else {
    notes.push("بعد ختام الصلاة: **لا تُفتح ورقةُ ما بعد الختام أصلًا** — صفرُ عنصرِ تصحيحٍ وصفرُ رقم");
  }

  /* ═══════════ ٥ — **لا يُحبَس قارئٌ في خيارٍ لا يعمل** (ص-م٥) ═══════════ */

  /** قراءةُ شريط حال المحرّك: أموجودٌ؟ وما هو؟ وأزرٌّ هو أم خبر؟ */
  const CHIP = `
const el = document.querySelector('[data-track="engine"]');
if (!el) return { there: false };
const st = getComputedStyle(el);
const r = el.getBoundingClientRect();
return {
  there: true, tag: el.tagName.toLowerCase(),
  text: ((el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '')).replace(/\\s+/g, ' ').trim().slice(0, 90),
  h: Math.round(r.height),
  vis: st.display !== 'none' && st.visibility !== 'hidden' && r.height > 1,
};
`;
  await cdp.until(`document.querySelector('[data-track="begin"]')`, 10000);
  await sleep(400);
  const chipIdle = await cdp.ev(CHIP);
  if (!chipIdle.there || !chipIdle.vis) {
    fail("حالُ المحرّك معروضة", "لا شريطَ لحال المحرّك في التهيئة — فالقارئُ يحزر أيُّهما يعمل");
  } else if (chipIdle.tag !== "button") {
    fail("التبديلُ من الشريط", `شريطُ حال المحرّك في التهيئة ليس زرًّا (${chipIdle.tag}) — فلا يُبدَّل منه`);
  } else if (chipIdle.h < MIN_TAP) {
    fail("التبديلُ من الشريط", `هدفُ لمسٍ دون ${MIN_TAP}: ${chipIdle.h}px`);
  } else {
    notes.push(`حالُ المحرّك معروضةٌ في التهيئة وهي زرُّ تبديل (${chipIdle.h}px): «${chipIdle.text}»`);
  }

  /* والتبديلُ بلمسةٍ واحدة — ولا يُشغَّل ميكروفونٌ بمجرّد فتح بابه */
  const spyBeforeSwap = await cdp.ev("return window.__sawtSpy;");
  await cdp.ev(click('[data-track="engine"]'));
  await sleep(600);
  const swapOpened = await cdp.ev(`return !!document.querySelector('[data-track="engine-choice"]');`);
  const spyAfterSwap = await cdp.ev("return window.__sawtSpy;");
  if (!swapOpened) {
    fail("التبديلُ من الشريط", "ضُغط شريطُ حال المحرّك فلم يُفتح اختيارُ المحرّك");
  } else if (spyAfterSwap.getUserMedia !== spyBeforeSwap.getUserMedia) {
    fail("التبديلُ من الشريط", "فُتح بابُ صوتٍ عند فتح اختيار المحرّك");
  } else {
    notes.push("التبديلُ من الشريط: يُفتح اختيارُ المحرّك بلمسةٍ واحدةٍ بلا إعادةِ تثبيتٍ ولا محوِ بيانات — ولا ميكروفونَ من تلقائه");
  }

  /* ═══ ٥/ج‑١ — تشغيلةٌ سليمةٌ: **ضبطٌ سالبٌ لخبر الرجوع** ═══
     نُبدّل إلى «المراجعة» ثمّ الشبكيّ، فتقع تشغيلةٌ لم يُخفق فيها شيء —
     **فخبرٌ يظهر فيها ليس خبرًا**. */
  await cdp.ev(click('[data-track="engine-browser-speech"]'));
  await sleep(500);
  await cdp.ev(setSelect('[data-track="hal"]', "murajaa"));
  await sleep(400);
  await cdp.ev(click('[data-track="begin"]'));
  await sleep(700);
  if (await cdp.ev(`return !!document.querySelector('[data-track="agree"]');`)) {
    await cdp.ev(click('[data-track="agree"]'));
  }
  await cdp.until(`!document.querySelector('[data-track="begin"]')`, 10000);
  await sleep(800);
  const healthy = await cdp.ev(`
const el = document.querySelector('[data-track="fell"]');
return { fell: !!el, chip: (document.querySelector('[data-track="engine"]')?.getAttribute('aria-label') || '') };
`);
  if (healthy.fell) {
    fail("ضبطُ خبر الرجوع", "ظهر خبرُ رجوعٍ في تشغيلةٍ سليمة — فالخبرُ يظهر دائمًا ولا يشهد بشيء");
  } else {
    notes.push(`ضبطٌ سالب: تشغيلةٌ سليمةٌ بالشبكيّ — لا خبرَ رجوعٍ ألبتّة، وحالُ المحرّك في الشريط «${healthy.chip}»`);
  }
  await cdp.ev(click('[data-track="end"]'));
  await cdp.until(`document.querySelector('[data-track="after"]')`, 10000);
  await cdp.ev(TO_IDLE);
  await cdp.until(`document.querySelector('[data-track="begin"]')`, 10000);
  await sleep(400);

  /* ═══ ٥/ج‑٢ — الرجوعُ التلقائيُّ عند الإخفاق ═══ */
  await cdp.ev(`window.__sawtFail = 'gum'; return true;`);
  await cdp.ev(click('[data-track="engine"]'));
  await sleep(500);
  await cdp.ev(click('[data-track="engine-on-device"]'));
  await sleep(500);
  const spyBeforeFall = await cdp.ev("return window.__sawtSpy;");
  if (await cdp.ev(`return !!document.querySelector('[data-track="agree"]');`)) {
    await cdp.ev(click('[data-track="agree"]'));
  } else {
    await cdp.ev(click('[data-track="begin"]'));
    await sleep(700);
    if (await cdp.ev(`return !!document.querySelector('[data-track="agree"]');`)) {
      await cdp.ev(click('[data-track="agree"]'));
    }
  }
  const fellShown = await cdp.until(`document.querySelector('[data-track="fell"]')`, 20000);
  await sleep(900);
  const fallen = await cdp.ev(`
const el = document.querySelector('[data-track="fell"]');
const chip = document.querySelector('[data-track="engine"]');
return {
  fell: !!el,
  say: el ? el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140) : null,
  chip: chip ? ((chip.getAttribute('aria-label') || '') + ' ' + (chip.innerText || '')).replace(/\\s+/g, ' ').trim().slice(0, 90) : null,
  running: !document.querySelector('[data-track="begin"]'),
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

  /* ═══ ٥/ج‑٣ — **ولا يُرجَع في الصلاة إلى الشبكيّ بحال** ═══ */
  await cdp.ev(click('[data-track="end"]'));
  await sleep(900);
  await cdp.ev(TO_IDLE);
  await cdp.until(`document.querySelector('[data-track="hal"]')`, 10000);
  await sleep(400);
  await cdp.ev(setSelect('[data-track="hal"]', "salat"));
  await sleep(400);
  await cdp.ev(click('[data-track="engine"]'));
  await sleep(500);
  await cdp.ev(click('[data-track="engine-on-device"]'));
  await sleep(500);
  const spyBeforeSalatFall = await cdp.ev("return window.__sawtSpy;");
  if (await cdp.ev(`return !!document.querySelector('[data-track="agree"]');`)) {
    await cdp.ev(click('[data-track="agree"]'));
  } else {
    await cdp.ev(click('[data-track="begin"]'));
    await sleep(700);
    if (await cdp.ev(`return !!document.querySelector('[data-track="agree"]');`)) {
      await cdp.ev(click('[data-track="agree"]'));
    }
  }
  const salatFellShown = await cdp.until(`document.querySelector('[data-track="fell"]')`, 20000);
  await sleep(900);
  const salatFall = await cdp.ev(`
const el = document.querySelector('[data-track="fell"]');
const chip = document.querySelector('[data-track="engine"]');
return {
  fell: !!el,
  say: el ? el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160) : null,
  chip: chip ? ((chip.getAttribute('aria-label') || '') + ' ' + (chip.innerText || '')).replace(/\\s+/g, ' ').trim().slice(0, 90) : null,
  idle: !!document.querySelector('[data-track="begin"]'),
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
  `${JSON.stringify({ gate: "tatabbu-live", surface: "apps/tilawa", ok, checkedAt: null, notes, failures, missing }, null, 2)}\n`,
);
console.log(`البوّابةُ الحيّةُ للتتبّع (على سطح التلاوة): ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
if (!ok) process.exitCode = 1;

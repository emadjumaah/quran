/**
 * **بوّابةُ المرساة ونافذةِ العرض** — على بلاغ المالك ١٥ أغسطس (ص-م٦ §٤).
 *
 * بلاغُه بنصّه: «إذا قرأتُ من آخر الجزء **جعل كلَّ الجزء إلى محلّ الكلمة باهتًا**
 * — يستهلك ذاكرةً ووقتًا». وهما حكمان **لا يُفحصان بقراءة شيفرة**: أحدُهما على
 * لون حرفٍ في شجرة العرض، والآخرُ على **عدد ما رُسم فيها**. فيُفحصان في متصفّحٍ
 * حقيقيٍّ على البناء المنشور، **في سيناريو البلاغ نفسِه**: يُفتح المصحفُ كلُّه،
 * ويُنمّى المحمَّلُ بالتمرير حتّى يبلغ الجزءَ، ثمّ **يُلتقط القارئُ عند آخره**.
 *
 *   ١ — **فحصُ المرساة**: بعد الالتقاط البعيد ⇒ **صفرُ كلمةٍ `sawt-past`**، إذ
 *       لم يُقرأ شيءٌ قبل موضع الالتقاط. **وضبطُه السالب**: تُزحزح المرساةُ إلى
 *       الصفر (`?sawt-fade-from-start`) فيعود البهتُ الكاذبُ **فيُصطاد**.
 *   ٢ — **فحصُ نافذة العرض**: عددُ عناصر الكلمات المرسومة **دون السقف المعلَن**
 *       (`RENDER_MAX_WORDS` — يُقرأ من `lib/sawt/script.ts` لا يُكتب ههنا فيشيخ).
 *       **وضبطُه السالب**: يُعطَّل التقييدُ (`?sawt-render-all`) **فيُصطاد
 *       الانفجار**.
 *   ٣ — **وقياسُ قبل/بعد**: عددُ الكلمات المرسومة **وزمنُ تحديث الإطار عند تقدّم
 *       المؤشّر**، على البناء نفسِه وبالسيناريو نفسِه، **والمعالجُ مخنوقٌ ×٤**.
 *       فالقبلُ والبعدُ **بابان في بناءٍ واحد** لا بناءان يُقارنان.
 *
 * **ومحرّكُ التعرّف يُستبدل بساكنٍ يُملى عليه** — فالمفحوصُ شجرةُ العرض لا سمعُ
 * المحرّك؛ والإملاءُ **من نصّ الصفحة نفسِه** فتقع المحاذاةُ حيث يقع القارئ.
 *
 * التشغيل: node js/scripts/check-sawt-view.mjs → js/data/gates/SAWT-VIEW.json
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STUDIO = join(ROOT, "js", "apps", "studio");
const DIST = join(STUDIO, "dist");
const OUT = join(ROOT, "js", "data", "gates", "SAWT-VIEW.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4181;
const CDP_PORT = 9335;

const failures = [];
const missing = [];
const notes = [];
const measures = {};
const fail = (check, detail) => failures.push({ check, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
/** أثرُ التسيير — **يُطبع وهو يجري** فلا تُقرأ الوقفةُ ظنًّا */
const log = (s) => console.error(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}ث] ${s}`);

/** **السقفُ المعلَن يُقرأ من موضع إعلانه** — فلا رقمان يفترقان في صمت */
function declaredCap() {
  const src = readFileSync(join(STUDIO, "src", "lib", "sawt", "script.ts"), "utf8");
  const m = src.match(/export const RENDER_MAX_WORDS = (\d+)/);
  return m ? Number(m[1]) : null;
}

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
  /** **ولا نداءَ بلا توقيت** (درسُ ص-م٣): نداءٌ يعلّق يُردّ خطأً فيُعرف موضعُه */
  send(method, params = {}, ms = 45000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error(`تعلّق النداءُ ${method} فوق ${ms} مِث`));
      }, ms);
      this.waiting.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
    });
  }
  async ev(expr, ms = 45000) {
    const r = await this.send(
      "Runtime.evaluate",
      {
        expression: `(async () => { ${expr} })()`,
        returnByValue: true,
        awaitPromise: true,
      },
      ms,
    );
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "خطأٌ في الصفحة");
    return r.result.value;
  }
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
 * محرّكٌ ساكنٌ **يُملى عليه**: لا يسمع شيئًا، ويبثّ ما يُمليه الفاحصُ عليه بصيغة
 * حدث المتصفّح نفسِها (`results` بجُملها المختومة) — فلا يُمَسّ من شيفرتنا حرف.
 */
const PRELUDE = `
window.__sawtSpy = { recognizers: 0, starts: 0, getUserMedia: 0 };
window.__rec = null;
class StubRecognition {
  constructor() { window.__sawtSpy.recognizers++; window.__rec = this; this.onresult = null; this.onerror = null; this.onend = null; this.onstart = null; this._n = 0; }
  start() { window.__sawtSpy.starts++; if (this.onstart) setTimeout(() => this.onstart(), 0); }
  stop() { if (this.onend) setTimeout(() => this.onend(), 0); }
  abort() {}
}
Object.defineProperty(window, 'SpeechRecognition', { value: StubRecognition, writable: true, configurable: true });
Object.defineProperty(window, 'webkitSpeechRecognition', { value: StubRecognition, writable: true, configurable: true });
/** يُملى على المحرّك نصٌّ مختوم — كما يصل من خدمة المتصفّح سواءً بسواء */
window.__sawtSay = (text) => {
  const rec = window.__rec;
  if (!rec || !rec.onresult) return false;
  const results = [];
  results.length = ++rec._n;
  results[rec._n - 1] = { 0: { transcript: text }, isFinal: true, length: 1 };
  rec.onresult({ results });
  return true;
};
if (navigator.mediaDevices) {
  const real = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function (...a) {
    window.__sawtSpy.getUserMedia++;
    return real ? real(...a) : Promise.reject(new Error('no media'));
  };
}
try { localStorage.removeItem('sawt.consent.v1'); localStorage.removeItem('sawt.hal.v1'); localStorage.removeItem('sawt.mark.v1'); localStorage.removeItem('sawt.engine.v1'); localStorage.removeItem('sawt.declared.v1'); } catch (e) {}
`;

const click = (sel) => `
const el = document.querySelector('${sel}');
if (!el) return false;
el.click();
return true;
`;

/** عدُّ ما رُسم وما بُهت — **من شجرة العرض لا من دعوى الصفحة** */
const COUNT = `
const box = document.querySelector('[data-sawt="text"]');
if (!box) return { error: 'لا نصَّ في الصفحة' };
const words = box.querySelectorAll('.sawt-w');
return {
  drawn: words.length,
  past: box.querySelectorAll('.sawt-past').length,
  now: box.querySelectorAll('.sawt-now').length,
  loaded: Number(box.dataset.sawtWords || 0),
  range: box.dataset.sawtDrawn || null,
  nodes: box.querySelectorAll('*').length,
};
`;

/**
 * **يُنمّى المحمَّلُ بالتمرير** حتّى يبلغ الجزءَ — كما يفعل قارئٌ يمرّر إلى آخره.
 * ولا يُلمس من الشيفرة شيء: تمريرٌ ثمّ انتظارُ الرقيب.
 */
const GROW = (target) => `
const box = document.querySelector('[data-sawt="text"]');
if (!box) return 0;
const sc = (function (el) {
  for (let n = el; n; n = n.parentElement) {
    const st = getComputedStyle(n);
    if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
})(box);
for (let i = 0; i < 90; i++) {
  if (Number(box.dataset.sawtWords || 0) >= ${target}) break;
  if (sc) sc.scrollTop = sc.scrollHeight;
  else window.scrollTo(0, document.body.scrollHeight);
  await new Promise((r) => setTimeout(r, 240));
}
return Number(box.dataset.sawtWords || 0);
`;

/** التلاوةُ تبدأ من كلماتٍ **بعيدةٍ في المحمَّل** — وهي صورةُ «قرأتُ من آخر الجزء» */
const SAY_FAR = (backFromEnd, count) => `
const box = document.querySelector('[data-sawt="text"]');
const ws = [...box.querySelectorAll('.sawt-w')];
if (ws.length < ${backFromEnd} + ${count}) return { error: 'لم يُرسم ما يكفي من الكلمات' };
const at = ws.length - ${backFromEnd};
const said = ws.slice(at, at + ${count}).map((w) => w.innerText.trim()).join(' ');
window.__sawtSay(said);
await new Promise((r) => setTimeout(r, 700));
return { said: said.slice(0, 60), at };
`;

/**
 * **زمنُ تحديث الإطار عند تقدّم المؤشّر** — يُملى على المحرّك ما بعد المؤشّر
 * بثلاث كلمات، ويُقاس ما بين الإملاء واستقرار إطارين — **بالمعالج مخنوقًا ×٤**.
 */
const STEP_MS = `
const box = document.querySelector('[data-sawt="text"]');
const ws = [...box.querySelectorAll('.sawt-w')];
const cur = box.querySelector('.sawt-now');
const ix = ws.indexOf(cur);
if (ix < 0 || ix + 4 >= ws.length) return null;
const said = ws.slice(ix + 1, ix + 4).map((w) => w.innerText.trim()).join(' ');
const t0 = performance.now();
window.__sawtSay(said);
let paint = false;
await Promise.race([
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => { paint = true; r(); }))),
  new Promise((r) => setTimeout(r, 4000)),
]);
return paint ? Math.round((performance.now() - t0) * 10) / 10 : null;
`;

/* ═══════════ التشغيلة الواحدة ═══════════ */

/**
 * تشغيلةٌ كاملةٌ في سيناريو البلاغ: المصحفُ كلُّه ⇒ تمريرٌ ينمّي المحمَّل ⇒ بدءٌ
 * ⇒ **التقاطٌ عند آخر المحمَّل** ⇒ عدٌّ وقياس. و`query` هو بابُ الضبط السالب.
 */
async function run(cdp, { query, label, steps = 0 }) {
  log(`تشغيلة «${label}» — يُفتح ${query || "بلا بابٍ سالب"}`);
  await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/${query}#/tatabbu` });
  const booted = await cdp.until(`!document.querySelector('.boot') && document.querySelector('[data-sawt="root"]')`);
  if (!booted) {
    missing.push(`لم تُقلع الصفحةُ في التشغيلة «${label}»`);
    return null;
  }
  log("أقلعت الصفحة");
  await cdp.until(`document.querySelector('[data-sawt="begin"]') && !document.querySelector('[data-sawt="begin"]').disabled`);

  /* المصحفُ كلُّه — وهو مقطعُ البلاغ */
  await cdp.ev(click(".sawt-m-more"));
  await sleep(400);
  const picked = await cdp.ev(`
const b = [...document.querySelectorAll('.sawt-seg')].find((x) => (x.textContent || '').includes('المصحف'));
if (!b) return false;
b.click();
return true;
`);
  if (!picked) {
    missing.push("لم يُوجد زرُّ «المصحف كلُّه» في عُدّة التهيئة");
    return null;
  }
  await cdp.until(`document.querySelector('[data-sawt="text"]') && Number(document.querySelector('[data-sawt="text"]').dataset.sawtWords) > 0`, 20000);
  await cdp.ev(click(".sawt-m-more"));
  await sleep(300);

  /* التمريرُ ينمّي المحمَّل حتّى يبلغ الجزءَ الأوّل (نحو ٣٬١٥٠ كلمة) */
  log("يُنمَّى المحمَّلُ بالتمرير");
  // **والتنميةُ تُمهَل**: بابُ الضبط السالب يرسم آلافَ العناصر فيبطئ التمريرُ
  // نفسُه — وهو من جنس ما تقيسه هذه البوّابة، فلا يُقطع عليه بمهلةٍ قصيرة.
  const loaded = await cdp.ev(GROW(3000), 240000);
  log(`المحمَّل: ${loaded} كلمة`);
  await sleep(400);

  /* البدء: المحرّكُ الشبكيُّ (ساكنٌ يُملى عليه)، والإعلانُ ثمّ التلاوة */
  await cdp.ev(click('[data-sawt="begin"]'));
  await sleep(500);
  if (await cdp.ev(`return !!document.querySelector('[data-sawt="engine-browser-speech"]');`)) {
    await cdp.ev(click('[data-sawt="engine-browser-speech"]'));
    await sleep(500);
  }
  if (await cdp.ev(`return !!document.querySelector('[data-sawt="agree"]');`)) {
    await cdp.ev(click('[data-sawt="agree"]'));
  }
  await cdp.until(`!document.querySelector('[data-sawt="begin"]')`, 8000);
  await sleep(500);

  log("بدأت التلاوة");
  const atStart = await cdp.ev(COUNT);

  /* **الالتقاطُ عند آخر ما حُمّل** — وهو «قرأتُ من آخر الجزء» بعينه */
  const said = await cdp.ev(SAY_FAR(40, 5));
  log(`الالتقاط: ${JSON.stringify(said)}`);
  await sleep(600);
  const after = await cdp.ev(COUNT);

  /* وقياسُ زمن الإطار عند تقدّم المؤشّر */
  const times = [];
  for (let i = 0; i < steps; i++) {
    const t = await cdp.ev(STEP_MS);
    log(`خطوة ${i + 1}: ${t} مِث`);
    if (typeof t === "number") times.push(t);
    await sleep(120);
  }
  await cdp.ev(click('[data-sawt="close"]'));
  await sleep(400);

  const median = times.length ? [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] : null;
  return { label, loaded, atStart, after, said, times, median };
}

/* ═══════════ التسيير ═══════════ */

let preview = null;
let chrome = null;

/** **ولا تُترك بوّابةٌ تعلّق بلا حكم**: مهلةٌ قصوى ثمّ تُردّ حمراءَ بسببها */
const WATCHDOG_MS = 7 * 60 * 1000;

async function main() {
  const cap = declaredCap();
  if (!cap) {
    missing.push("لم يُقرأ السقفُ المعلَن `RENDER_MAX_WORDS` من `lib/sawt/script.ts`");
    return;
  }
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
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=/tmp/cdp-sawt-view-${process.pid}`,
      "--no-first-run",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

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
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE });
  // **وخنقُ المعالج ×٤ كعادة القياس** — فالحكمُ على هاتفٍ لا على حاسوب
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  /* (١) البناءُ كما يُشحن: المرساةُ ونافذةُ العرض عاملتان */
  const now = await run(cdp, { query: "", label: "كما يُشحن", steps: 7 });
  /* (٢) والتقييدُ معطَّل — وهو **القبلُ** بعينه، وضبطُ نافذة العرض السالب */
  const all = await run(cdp, { query: "?sawt-render-all", label: "بلا نافذةِ عرض (القبل)", steps: 7 });
  /* (٣) والمرساةُ مزحزحةٌ إلى الصفر — ضبطُ المرساة السالب */
  const faded = await run(cdp, {
    query: "?sawt-render-all&sawt-fade-from-start",
    label: "بمرساةٍ في الصفر (القبل)",
    steps: 0,
  });

  if (!now || !all || !faded) return;

  /* ═══ ١ — فحصُ المرساة ═══ */
  if (all.after?.error || now.after?.error) {
    missing.push("تعذّر عدُّ الكلمات في شجرة العرض");
  } else if (all.after.past !== 0) {
    fail(
      "المرساة",
      `التُقط القارئُ عند آخر المحمَّل فبُهت ما قبله: ${all.after.past} كلمةً باهتةً من ${all.after.drawn} مرسومة`,
    );
  } else if (all.after.now !== 1) {
    fail("المرساة", `لم يستقرَّ المؤشّرُ على كلمةٍ واحدةٍ بعد الالتقاط (${all.after.now})`);
  } else if (all.after.drawn < 2000) {
    missing.push(
      `لم يُرسم ما يكفي ليكون للبهت مادّةٌ تُصطاد (${all.after.drawn} كلمةً مرسومة) — فالفحصُ لا يشهد`,
    );
  } else {
    notes.push(
      `المرساة: فُتح المصحفُ كلُّه ونُمّي المحمَّلُ إلى ${all.loaded} كلمة، ثمّ التُقط القارئُ عند آخره — **صفرُ كلمةٍ باهتةٍ** من ${all.after.drawn} كلمةً مرسومة`,
    );
  }

  /* وضبطُها السالب: المرساةُ في الصفر ⇒ يعود البهتُ الكاذبُ فيُصطاد */
  if (faded.after?.error) missing.push("تعذّر عدُّ الكلمات في ضبط المرساة السالب");
  else if (faded.after.past <= 0) {
    fail("ضبطُ المرساة", "زُحزحت المرساةُ إلى الصفر فلم يظهر بهتٌ كاذبٌ — والفحصُ لا يفحص");
  } else {
    notes.push(
      `ضبطٌ سالب: زُحزحت المرساةُ إلى الصفر فبُهتت ${faded.after.past} كلمةً لم تُقرأ — فاصطادها الفحص`,
    );
  }

  /* ═══ ٢ — فحصُ نافذة العرض ═══ */
  if (now.after.drawn > cap) {
    fail("نافذةُ العرض", `رُسمت ${now.after.drawn} كلمةً والسقفُ المعلَن ${cap}`);
  } else {
    notes.push(
      `نافذةُ العرض: المحمَّلُ ${now.after.loaded} كلمةً والمرسومُ ${now.after.drawn} — دون السقف المعلَن (${cap})`,
    );
  }
  if (all.after.drawn <= cap) {
    fail(
      "ضبطُ نافذة العرض",
      `عُطّل التقييدُ فلم ينفجر المرسوم (${all.after.drawn} ≤ ${cap}) — فالفحصُ لا يفحص`,
    );
  } else {
    notes.push(
      `ضبطٌ سالب: عُطّل التقييدُ فرُسم ${all.after.drawn} كلمةً — فوق السقف المعلَن، فاصطاده الفحص`,
    );
  }

  /* ═══ ٣ — قياسُ قبل/بعد (المعالجُ مخنوقٌ ×٤) ═══ */
  measures.throttle = "×٤";
  measures.scenario = "المصحفُ كلُّه · تمريرٌ ينمّي المحمَّل · التقاطٌ عند آخره";
  measures.before = { drawn: all.after.drawn, nodes: all.after.nodes, frameMs: all.median, times: all.times };
  measures.after = { drawn: now.after.drawn, nodes: now.after.nodes, frameMs: now.median, times: now.times };
  measures.loaded = { before: all.loaded, after: now.loaded };
  notes.push(
    `قياسٌ (معالجٌ مخنوقٌ ×٤): الكلماتُ المرسومة ${all.after.drawn} ⇐ ${now.after.drawn} · عناصرُ الشجرة ${all.after.nodes} ⇐ ${now.after.nodes} · وسيطُ زمن الإطار عند تقدّم المؤشّر ${all.median ?? "—"} ⇐ ${now.median ?? "—"} مِث`,
  );
}

Promise.race([
  main(),
  new Promise((_, rej) => setTimeout(() => rej(new Error(`تجاوزت المهلةَ (${WATCHDOG_MS / 60000} د)`)), WATCHDOG_MS)),
])
  .catch((e) => missing.push(`تعثّرت البوّابة: ${String(e?.message ?? e)}`))
  .finally(() => {
    try {
      chrome?.kill();
      preview?.kill();
    } catch {
      /* لا يضرّ */
    }
    const green = failures.length === 0 && missing.length === 0;
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify({ gate: "sawt-view", green, failures, missing, notes, measures }, null, 2) + "\n",
    );
    for (const n of notes) console.log(`✓ ${n}`);
    for (const m of missing) console.log(`… ${m}`);
    for (const f of failures) console.log(`✗ ${f.check}: ${f.detail}`);
    console.log(green ? "\nبوّابةُ المرساة ونافذةِ العرض: خضراء" : "\nبوّابةُ المرساة ونافذةِ العرض: حمراء");
    process.exit(green ? 0 : 1);
  });

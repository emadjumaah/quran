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
const words = [...box.querySelectorAll('.sawt-w')];
/* **وموضعُ أوّل كلمةٍ باهتةٍ هو الحكم**: البهتُ بعد موضع الالتقاط صدقٌ (تلك
   كلماتٌ تُليت فعلًا)، **وقبله كذب** — وهو بلاغُ المالك بعينه. */
let firstPast = -1;
for (let i = 0; i < words.length; i++) {
  if (words[i].classList.contains('sawt-past')) { firstPast = i; break; }
}
return {
  drawn: words.length,
  firstPast,
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
const GROW = (target, budgetMs) => `
const box = document.querySelector('[data-sawt="text"]');
if (!box) return { words: 0, ms: 0, iters: 0 };
const t0 = performance.now();
const sc = (function (el) {
  for (let n = el; n; n = n.parentElement) {
    const st = getComputedStyle(n);
    if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
})(box);
let i = 0;
for (; i < 400; i++) {
  if (Number(box.dataset.sawtWords || 0) >= ${target}) break;
  if (performance.now() - t0 > ${budgetMs}) break;
  if (sc) sc.scrollTop = sc.scrollHeight;
  else window.scrollTo(0, document.body.scrollHeight);
  await new Promise((r) => setTimeout(r, 200));
}
return { words: Number(box.dataset.sawtWords || 0), ms: Math.round(performance.now() - t0), iters: i };
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

/**
 * **قياسُ السكون** (ص٤ §١) — والحكمُ على **ما تراه العين** لا على ما كُتب.
 *
 * تُمسَك آيةٌ مرئيّةٌ مرساةً للقياس، ويُقاس **موضعُها على الشاشة** عيّنةً في كلّ
 * إطارٍ بينما يتقدّم المؤشّرُ كلماتٍ. وميزانُ القبول اثنان:
 *
 *   • **تقدُّمٌ داخل الحزام ⇒ صفرُ حركة** — لا كسرَ نقطةٍ واحدة؛
 *   • **بلوغُ الطرف ⇒ حركةٌ واحدةٌ ناعمة** — دفعةٌ واحدةٌ في اتّجاهٍ واحد،
 *     **ولا ارتداد**. والارتدادُ (لأعلى ثمّ لأسفل) هو بلاغُ المالك بحرفه، فهو
 *     المرصودُ الأوّل ههنا.
 *
 * ولا يُقاس التمريرُ نفسُه (`scrollTop`) عمدًا: تعويضُ المرساة عند انزلاق نافذة
 * الرسم **يحرّك التمريرَ ولا يحرّك النصَّ في العين** — وهو صوابٌ لا عيب. فالمقيسُ
 * موضعُ الحرف لا رقمُ الوعاء.
 */
const STILL_STEP = (words) => `
const box = document.querySelector('[data-sawt="text"]');
if (!box) return { error: 'لا نصَّ في الصفحة' };
const sc = (function (el) {
  for (let n = el; n; n = n.parentElement) {
    const st = getComputedStyle(n);
    if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
})(box);
const ws = [...box.querySelectorAll('.sawt-w')];
const cur = box.querySelector('.sawt-now');
const ix = ws.indexOf(cur);
if (ix < 0 || ix + ${words} + 1 >= ws.length) return { error: 'لم يبقَ في المرسوم ما يُتلى' };
/* مرساةُ القياس: أوّلُ آيةٍ لم تخرج من أعلى النافذة */
const edge = sc ? sc.getBoundingClientRect().top : 0;
let ref = null;
for (const el of box.querySelectorAll('[data-ayah]')) {
  if (el.getBoundingClientRect().bottom > edge) { ref = el; break; }
}
if (!ref) return { error: 'لا مرساةَ في الشاشة' };
const key = ref.dataset.ayah;
const at = () => {
  const el = box.querySelector('[data-ayah="' + key + '"]');
  return el ? el.getBoundingClientRect().top : null;
};
const b = box.getBoundingClientRect();
const band = b.height * 0.28;
const inBand = (el) => {
  const r = el.getBoundingClientRect();
  return r.top >= b.top + band && r.bottom <= b.bottom - band;
};
const bandBefore = inBand(cur);
const top0 = at();
const scroll0 = sc ? sc.scrollTop : window.scrollY;
const said = ws.slice(ix + 1, ix + 1 + ${words}).map((w) => w.innerText.trim()).join(' ');
window.__sawtSay(said);
/* عيّناتٌ في كلّ إطارٍ حتّى يسكن الموضعُ ٤٠٠ مِث أو تنقضي مهلةُ الخطوة.
   **وفي أوّل إطارٍ يُسأل: أخرج المؤشّرُ من الحزام؟** — وهو سببُ التمرير إن مرّ:
   فبه يُفرَّق **تمريرٌ لزم** من **حركةٍ لا داعيَ لها**، وذلك عينُ الحكم. */
const samples = [];
let bandFirst = null;
const t0 = performance.now();
await new Promise((done) => {
  let lastMove = performance.now();
  const tick = () => {
    const v = at();
    const n = samples.push(v);
    if (bandFirst === null) {
      const c0 = box.querySelector('.sawt-now');
      bandFirst = c0 ? inBand(c0) : null;
    }
    if (n > 1 && v != null && samples[n - 2] != null && Math.abs(v - samples[n - 2]) > 0.5) {
      lastMove = performance.now();
    }
    if (performance.now() - t0 > 2500 || performance.now() - lastMove > 400) { done(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
let travel = 0, back = 0, fwd = 0, reversals = 0, bursts = 0, dir = 0, moving = false, gaps = 0;
for (let i = 1; i < samples.length; i++) {
  const a = samples[i - 1], c = samples[i];
  if (a == null || c == null) { gaps++; continue; }
  const d = c - a;
  if (Math.abs(d) <= 0.5) { moving = false; continue; }
  if (!moving) { moving = true; bursts++; }
  travel += Math.abs(d);
  if (d < 0) fwd += -d; else back += d;
  const s = d > 0 ? 1 : -1;
  if (dir !== 0 && s !== dir && Math.abs(d) > 2) reversals++;
  dir = s;
}
const curNow = box.querySelector('.sawt-now');
const r1 = (n) => Math.round(n * 10) / 10;
return {
  said: said.slice(0, 40),
  from: ix,
  to: curNow ? ws.indexOf(curNow) : -1,
  bandBefore,
  bandFirst,
  bandAfter: curNow ? inBand(curNow) : null,
  travel: r1(travel),
  fwd: r1(fwd),
  back: r1(back),
  reversals, bursts, gaps,
  scrolled: r1((sc ? sc.scrollTop : window.scrollY) - scroll0),
  net: r1((at() ?? top0 ?? 0) - (top0 ?? 0)),
  frames: samples.length,
  ms: Math.round(performance.now() - t0),
};
`;

/* ═══════════ التشغيلة الواحدة ═══════════ */

/**
 * تشغيلةٌ كاملةٌ في سيناريو البلاغ: المصحفُ كلُّه ⇒ تمريرٌ ينمّي المحمَّل ⇒ بدءٌ
 * ⇒ **التقاطٌ عند آخر المحمَّل** ⇒ عدٌّ وقياس. و`query` هو بابُ الضبط السالب.
 */
async function run(port, { query, label, steps = 0, budget = 150000, still = 0 }) {
  const br = await openBrowser(port);
  if (!br) {
    missing.push(`لم يقم المتصفّحُ للتشغيلة «${label}»`);
    return null;
  }
  const cdp = br.cdp;
  try {
  log(`تشغيلة «${label}» — يُفتح ${query || "بلا بابٍ سالب"}`);
  // **والإقلاعُ تهيئةٌ لا قياس**: يُرفع الخنقُ حتّى تقوم الصفحةُ (وقد ردّ ×٤
  // تشغيلةً كاملةً «لم تُقلع» وهي بريئة — والآلةُ يومئذٍ مشغولةٌ أيضًا).
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/${query}#/tatabbu` });
  const booted = await cdp.until(`!document.querySelector('.boot') && document.querySelector('[data-sawt="root"]')`, 180000);
  if (!booted) {
    missing.push(`لم تُقلع الصفحةُ في التشغيلة «${label}»`);
    return null;
  }
  log("أقلعت الصفحة");
  await cdp.until(`document.querySelector('[data-sawt="begin"]') && !document.querySelector('[data-sawt="begin"]').disabled`, 180000);

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
  /* **والخنقُ للقياس لا للتهيئة** (تصويبُ تسيير — درسُ ص-م٥): تنميةُ المحمَّل
     تهيئةٌ، وخنقُها ×٤ يُطيل التشغيلةَ دقائقَ ولا يزيد الحكمَ صدقًا. فيُرفع
     الخنقُ ما دامت التهيئةُ، **ويُعاد قبل الالتقاط والقياس** — وهما موضعُ الحكم. */
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  /* **وتشغيلاتُ «القبل» لا تُنمَّى بالتمرير**: هي بطيئةٌ ببطئها هي نفسِه (قِيس:
     ١٨١ ثانيةً لتبلغ ٩٠٤ كلمة)، **والضبطُ السالبُ لا يحتاج نموًّا** — يكفيه أن
     يُلتقط القارئُ عند آخر المحمَّل الأوّل، وهو «قرأتُ من آخر الجزء» في صغره. */
  const grown = budget > 0 ? await cdp.ev(GROW(3000, budget), budget + 60000) : { words: 0, ms: 0, iters: 0 };
  const loaded = grown?.words ?? 0;
  log(`المحمَّل: ${loaded} كلمة في ${grown?.ms} مِث (${grown?.iters} تمريرة)`);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
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

  /* ═══ **تشغيلةُ السكون** (ص٤ §١) — سيناريوها غيرُ سيناريو البهت ═══
     ههنا **لا يُلتقط القارئُ بعيدًا**: يُتلى من أوّل المقطع كلماتٍ كلماتٍ كما
     يقرأ القارئُ، فيمرّ المؤشّرُ داخلَ الحزام ثمّ يبلغ طرفَه — وهما الحالان
     اللذان يُحكم عليهما. **والخنقُ يُرفع** لأنّ المقيسَ حركةُ النصّ في العين لا
     سرعةُ الجهاز، وخنقُ الإطارات يُشوّش العيّنات ولا يزيد الحكمَ صدقًا. */
  if (still > 0) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await sleep(400);
    const rows = [];
    for (let i = 0; i < still; i++) {
      const r = await cdp.ev(STILL_STEP(5), 60000);
      if (!r || r.error) {
        log(`سكون: ${r?.error ?? "لا جواب"}`);
        break;
      }
      rows.push(r);
      log(
        `سكون ${i + 1}: حزام ${r.bandFirst === false ? "خرج" : "داخل"} · حركة ${r.travel} · تمرير ${r.scrolled} · ارتداد ${r.reversals} · دفعات ${r.bursts}`,
      );
      const held = rows.filter((s) => s.travel <= 1).length;
      const moved = rows.filter((s) => s.travel > 1).length;
      if (held >= 6 && moved >= 2 && i >= 9) break;
      await sleep(150);
    }
    await cdp.ev(click('[data-sawt="close"]'));
    await sleep(300);
    return { label, loaded, still: rows };
  }

  /* **الالتقاطُ عند آخر ما حُمّل** — وهو «قرأتُ من آخر الجزء» بعينه */
  const said = await cdp.ev(SAY_FAR(40, 5));
  log(`الالتقاط: ${JSON.stringify(said)}`);
  await sleep(600);
  const after = await cdp.ev(COUNT);
  log(`العدّ: ${JSON.stringify(after)}`);

  /* وقياسُ زمن الإطار عند تقدّم المؤشّر */
  const times = [];
  for (let i = 0; i < steps; i++) {
    const t = await cdp.ev(STEP_MS, 90000);
    log(`خطوة ${i + 1}: ${t} مِث`);
    if (typeof t === "number") times.push(t);
    await sleep(120);
  }
  await cdp.ev(click('[data-sawt="close"]'));
  await sleep(400);

  const median = times.length ? [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] : null;
  return { label, loaded, growMs: grown?.ms ?? null, atStart, after, said, times, median };
  } finally {
    try {
      br.proc.kill();
    } catch {
      /* لا يضرّ */
    }
  }
}

/* ═══════════ التسيير ═══════════ */

let preview = null;
const browsers = [];

/**
 * **متصفّحٌ جديدٌ لكلّ تشغيلة** — لا لسانٌ واحدٌ يتنقّل بينها.
 *
 * وسببُه مقيسٌ لا مقدَّر: بعد تشغيلة «بلا نافذةِ عرض» (وهي التي تُثقل الشجرة)
 * **لم تعُد الصفحةُ تُقلع في اللسان نفسِه ولو أُمهلت تسعين ثانية** — مرّتين
 * متتاليتين. **فالحكمُ على تشغيلةٍ لوّثتها التي قبلها ليس حكمًا**، ولسانٌ جديدٌ
 * يكلّف ثوانيَ ويشتري يقينًا.
 */
async function openBrowser(port) {
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/cdp-sawt-view-${process.pid}-${port}`,
      "--no-first-run",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  browsers.push(proc);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* لم يقم بعد */
    }
  }
  if (!target) return null;
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE });
  return { cdp, proc };
}

/** **ولا تُترك بوّابةٌ تعلّق بلا حكم**: مهلةٌ قصوى ثمّ تُردّ حمراءَ بسببها */
const WATCHDOG_MS = 20 * 60 * 1000;

/**
 * **حكمُ السكون وضبطُه السالب** (ص٤ §١) — خطوةٌ خطوةً كما قيست، وبثلاثة قيود:
 *
 *   ١ — **حركةٌ بلا داعٍ لا تُغتفر**: خطوةٌ بقي فيها المؤشّرُ داخل الحزام
 *       (`bandFirst`، ويُسأل في أوّل إطارٍ بعد تقدّم المؤشّر — قبل أن يردَّه
 *       تمريرٌ إلى الوسط) **حقُّها صفرُ حركةٍ في العين**.
 *   ٢ — **ولا يتحرّك النصُّ أكثرَ ممّا تحرّك التمريرُ فعلًا**: المسافةُ التي
 *       يقطعها الحرفُ في العين تساوي ما مرّه الوعاءُ صافيًا، **وما زاد فليس
 *       تمريرًا مقصودًا بل مرساةٌ تنازعه** (ذهابٌ وإيابٌ يبتلع بعضُه بعضًا في
 *       الصافي ولا يبتلعه في العين). وقد قِيس في البناء الشاحن: ٢١٢/٢١٢ ·
 *       ١٨٢/١٨٢ — تساويًا تامًّا.
 *   ٣ — **ودفعةٌ واحدةٌ بلا ارتداد** حيث لزم التمرير.
 *
 * وقيدُ (٢) يحتمل حالًا واحدةً لا تقع في هذا السيناريو: أن تنزلق نافذةُ الرسم
 * في الخطوة نفسِها فتعوّضها المرساةُ **في الجهة المقابلة** — وحينئذٍ يصغر
 * الصافي ويكبر ما في العين بلا عيب. **ولا تنزلق ههنا**: التلاوةُ من أوّل
 * المقطع ولمّا يبلغ المؤشّرُ حدَّ إعادة التوسيط، وهو مقيسٌ في `range`.
 */
function stillness(now, stale) {
  const rows = now?.still ?? [];
  if (!rows.length) {
    missing.push("لم تُقَس خطوةُ سكونٍ واحدة — فلا شهادةَ على التذبذب");
    return;
  }
  /** الحكمُ على الخطوة الواحدة: ما الذي خالف فيها إن خالف */
  const flaws = (s) => {
    const bad = [];
    if (s.travel > 1 && s.bandFirst === true) bad.push("حركةٌ والمؤشّرُ داخل الحزام");
    if (s.travel > Math.abs(s.scrolled) + 2) bad.push(`حركةٌ ${s.travel} وتمريرٌ ${s.scrolled}`);
    if (s.reversals > 0) bad.push(`ارتدادٌ ${s.reversals}`);
    if (s.bursts > 1) bad.push(`دفعاتٌ ${s.bursts}`);
    return bad;
  };
  const still = rows.filter((s) => s.travel <= 1);
  const moved = rows.filter((s) => s.travel > 1);
  const broken = rows.map((s) => ({ s, bad: flaws(s) })).filter((r) => r.bad.length);
  const say = (r) => `[${r.s.from}→${r.s.to}] ${r.bad.join(" · ")}`;

  if (still.length < 3 || moved.length < 1) {
    missing.push(
      `لم يقع سيناريو القياس: خطواتٌ ساكنةٌ ${still.length} · خطواتٌ تحرّك فيها النصُّ ${moved.length} (من ${rows.length})`,
    );
  } else if (broken.length) {
    fail("سكونُ التتبّع", `${broken.length} خطوةً خالفت من ${rows.length}: ${broken.slice(0, 4).map(say).join(" · ")}`);
  } else if (still.length * 2 < rows.length) {
    fail(
      "سكونُ التتبّع",
      `أكثرُ الخطوات تحرّك فيها النصُّ (${moved.length} من ${rows.length}) — فالحزامُ لا يمسك شيئًا`,
    );
  } else {
    notes.push(
      `سكونُ التتبّع: ${still.length} خطوةً من ${rows.length} **بصفر حركةٍ في العين** والمؤشّرُ يتقدّم داخل الحزام · و${moved.length} خطوةً بلغ فيها الطرفَ فرُدّ **بدفعةٍ واحدةٍ ناعمةٍ بلا ارتداد** (${moved.map((s) => Math.round(s.travel)).join("، ")} نقطة، **وهي عينُ ما تحرّكه التمريرُ صافيًا**: ${moved.map((s) => Math.round(s.scrolled)).join("، ")})`,
    );
  }

  /* وضبطُه السالب: يُعاد صراعُ المرساة والمتابعة فيُصطاد التذبذب */
  const bad = stale?.still ?? [];
  if (!bad.length) {
    missing.push("لم تُقَس خطوةُ سكونٍ في الضبط السالب");
  } else {
    const caught = bad.map((s) => ({ s, bad: flaws(s) })).filter((r) => r.bad.length);
    if (!caught.length) {
      fail(
        "ضبطُ السكون",
        `أُعيدت المرساةُ إلى ما كانت (تعويضٌ على كلّ رسمٍ ولا تحديثَ بعد تمريرٍ مقصود) فلم يُصطَد شيءٌ في ${bad.length} خطوة — والقياسُ لا يقيس`,
      );
    } else {
      const worst = Math.max(...bad.map((s) => s.travel));
      notes.push(
        `ضبطٌ سالب: بمرساةٍ تنازع المتابعةَ (\`?sawt-keep-stale\`) اصطيدت ${caught.length} خطوةً من ${bad.length} — يتحرّك النصُّ في العين حتّى ${Math.round(worst)} نقطةً والتمريرُ الصافي ${Math.round(bad[bad.length - 1].scrolled)}، **ويتّسع مع كلّ كلمة**: ${bad.filter((s) => s.travel > 1).slice(0, 6).map((s) => Math.round(s.travel)).join(" ← ")}`,
      );
    }
  }
  measures.stillness = {
    scenario: "تلاوةٌ متتابعةٌ من أوّل المقطع · خمسُ كلماتٍ في الخطوة · بلا خنق · عرضُ ٣٩٠",
    after: rows,
    before: bad,
  };
}

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
  await sleep(2500);

  /* (١) البناءُ كما يُشحن: المرساةُ ونافذةُ العرض عاملتان */
  const now = await run(CDP_PORT, { query: "", label: "كما يُشحن", steps: 7 });
  /* (٢) والتقييدُ معطَّل — وهو **القبلُ** بعينه، وضبطُ نافذة العرض السالب */
  const all = await run(CDP_PORT + 1, { query: "?sawt-render-all", label: "بلا نافذةِ عرض (القبل)", steps: 5, budget: 0 });
  /* (٣) والمرساةُ مزحزحةٌ إلى الصفر — ضبطُ المرساة السالب */
  const faded = await run(CDP_PORT + 2, {
    query: "?sawt-render-all&sawt-fade-from-start",
    label: "بمرساةٍ في الصفر (القبل)",
    steps: 0,
    budget: 0,
  });

  /* (٤) **سكونُ التتبّع** (ص٤ §١): تلاوةٌ متتابعةٌ من أوّل المقطع، بلا نموٍّ ولا
     التقاطٍ بعيد — ثمّ (٥) **ضبطُه السالب**: يُعاد صراعُ المرساة والمتابعة كما
     كان، **فإن لم يظهر التذبذبُ فليس القياسُ قياسًا**. */
  const still = await run(CDP_PORT + 3, { query: "", label: "سكونُ التتبّع", budget: 0, still: 18 });
  const bounce = await run(CDP_PORT + 4, {
    query: "?sawt-keep-stale",
    label: "بمرساةٍ تنازع المتابعة (القبل)",
    budget: 0,
    still: 18,
  });

  stillness(still, bounce);

  if (!now || !all || !faded) return;

  /* ═══ ١ — فحصُ المرساة ═══ */
  if (all.after?.error || now.after?.error) {
    missing.push("تعذّر عدُّ الكلمات في شجرة العرض");
  } else if (all.after.firstPast >= 0 && all.after.firstPast < (all.said?.at ?? 0)) {
    fail(
      "المرساة",
      `التُقط القارئُ عند الكلمة ${all.said?.at} فبُهت ما قبلها: أوّلُ كلمةٍ باهتةٍ عند ${all.after.firstPast} (${all.after.past} كلمةً باهتة)`,
    );
  } else if (all.after.now !== 1) {
    fail("المرساة", `لم يستقرَّ المؤشّرُ على كلمةٍ واحدةٍ بعد الالتقاط (${all.after.now})`);
  } else if (all.after.drawn < 800) {
    missing.push(
      `لم يُرسم ما يكفي ليكون للبهت مادّةٌ تُصطاد (${all.after.drawn} كلمةً مرسومة) — فالفحصُ لا يشهد`,
    );
  } else {
    notes.push(
      `المرساة: التُقط القارئُ عند الكلمة ${all.said?.at} من ${all.after.drawn} مرسومة — **صفرُ كلمةٍ باهتةٍ قبل موضع الالتقاط** (أوّلُ باهتةٍ عند ${all.after.firstPast}، وهي من الكلمات الخمس التي تُليت)`,
    );
  }

  /* وضبطُها السالب: المرساةُ في الصفر ⇒ يعود البهتُ الكاذبُ فيُصطاد */
  if (faded.after?.error) missing.push("تعذّر عدُّ الكلمات في ضبط المرساة السالب");
  else if (faded.after.firstPast !== 0 || faded.after.past <= 1) {
    fail(
      "ضبطُ المرساة",
      `زُحزحت المرساةُ إلى الصفر فلم يعُد البهتُ الكاذب (أوّلُ باهتةٍ ${faded.after.firstPast} · ${faded.after.past} باهتة) — والفحصُ لا يفحص`,
    );
  } else {
    notes.push(
      `ضبطٌ سالب: زُحزحت المرساةُ إلى الصفر فبُهت المقطعُ من أوّله (أوّلُ باهتةٍ عند ٠) — ${faded.after.past} كلمةً لم تُقرأ، فاصطادها الفحص`,
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
  /* **وضبطُه السالبُ يقيس الحجبَ نفسَه**: مع التقييد **يُحجب بعضُ المحمَّل عن
     الرسم**، وبتعطيله **يُرسم المحمَّلُ كلُّه** — فإن استوى الحالان فليس ثَمَّ
     تقييدٌ يُفحص. (ولا يُشترط أن يبلغ «القبلُ» السقفَ، إذ هو أبطأُ من أن يبلغه
     في مهلةٍ معقولة — وذلك نفسُه من مادّة القياس.) */
  if (all.after.drawn !== all.after.loaded) {
    fail(
      "ضبطُ نافذة العرض",
      `عُطّل التقييدُ فلم يُرسم المحمَّلُ كلُّه (${all.after.drawn} من ${all.after.loaded}) — فالبابُ السالبُ لا يفتح`,
    );
  } else if (now.after.drawn >= now.after.loaded) {
    fail(
      "ضبطُ نافذة العرض",
      `كما يُشحن: رُسم المحمَّلُ كلُّه (${now.after.drawn} من ${now.after.loaded}) — فلا نافذةَ عرضٍ تحجب شيئًا`,
    );
  } else {
    notes.push(
      `ضبطٌ سالب: بالتقييد رُسم ${now.after.drawn} من ${now.after.loaded} محمَّلة، وبتعطيله رُسم المحمَّلُ كلُّه (${all.after.drawn} من ${all.after.loaded}) — فالحجبُ مقيسٌ لا مُدَّعًى`,
    );
  }

  /* ═══ ٣ — قياسُ قبل/بعد (المعالجُ مخنوقٌ ×٤) ═══ */
  measures.throttle = "×٤";
  measures.scenario = "المصحفُ كلُّه · تمريرٌ ينمّي المحمَّل · التقاطٌ عند آخره";
  measures.before = { drawn: all.after.drawn, nodes: all.after.nodes, frameMs: all.median, times: all.times };
  measures.after = { drawn: now.after.drawn, nodes: now.after.nodes, frameMs: now.median, times: now.times };
  measures.loaded = { before: all.loaded, after: now.loaded };
  measures.growMs = { before: all.growMs, after: now.growMs };
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
      for (const b of browsers) b.kill();
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

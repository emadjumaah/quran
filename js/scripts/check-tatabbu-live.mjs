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
if (navigator.mediaDevices) {
  const real = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function (...a) {
    window.__sawtSpy.getUserMedia++;
    return real ? real(...a) : Promise.reject(new Error('no media'));
  };
}
try { localStorage.removeItem('sawt.consent.v1'); localStorage.removeItem('sawt.hal.v1'); localStorage.removeItem('sawt.mark.v1'); } catch (e) {}
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

  /* ═══ ١ — الإعلانُ يسبق الميكروفون ═══ */
  const before = await cdp.ev("return window.__sawtSpy;");
  if (before.recognizers !== 0 || before.getUserMedia !== 0) {
    fail("الإعلانُ يسبق الميكروفون", `فُتح بابُ صوتٍ قبل أن يُضغط شيء: ${JSON.stringify(before)}`);
  }
  await cdp.ev(click('[data-sawt="begin"]'));
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

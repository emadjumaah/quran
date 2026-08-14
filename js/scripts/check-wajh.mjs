/**
 * بوّابةُ ميثاق الوجه — `findings/WAJH-CHARTER.md` §٣، بُنيت في ج٣ وتسري على ما بعدها.
 *
 * غايةُ الميثاق أن يصير «يبدو تطبيقًا» **شرطًا يُفحص** لا ذوقًا يُتنازع فيه.
 * فههنا ثلاثةُ أبوابٍ ولكلٍّ ضبطُه السالب:
 *
 *   ١ — **ساكنًا في الشيفرة**: لا `alert(`/`confirm(`/`prompt(` · ولا رقمَ خطٍّ
 *       مكتوبٌ نصًّا في JSX · ووجودُ `-webkit-tap-highlight-color` و
 *       `overscroll-behavior` و`env(safe-area-inset` و`theme-color`.
 *   ٢ — **مقيسًا في المتصفّح على عرض ٣٩٠**: لا هدفَ لمسٍ `< ٤٤px` ولا نصَّ
 *       `< ١٥px` — **على الصفحات الأساسيّة وحدَها** (المصحفُ · التتبّعُ ·
 *       الإعداداتُ · القشرة). **والصفحاتُ الداخلةُ خارجُ النطاق بأمر المالك**
 *       (حدُّه ١٤ أغسطس: «خصوصًا الصفحاتُ الأساسيّة — أمّا داخلًا فلا غضاضة»)،
 *       ولا يُقال إنّها فُحصت فمرّت.
 *   ٣ — **ولا يُطمس نصُّ القرآن** (§١٣): لا `blur` يعلو متنَ القرآن، ولا لوحَ
 *       يغطّيه لأجل أداة.
 *
 * **والضبطُ السالب شرطُ صحّة**: يُزرع زرٌّ صغيرٌ ونصٌّ صغيرٌ وطمسٌ فوق المتن
 * و`confirm` — فتُصطاد كلُّها، ثمّ تُزال فتعود البوّابةُ خضراء. **وزرعٌ لا أثرَ
 * له ليس ضبطًا** (قاعدةُ الإدارة 2026-08-13).
 *
 * التشغيل: node js/scripts/check-wajh.mjs → js/data/gates/WAJH.json
 * (يبني السكربتُ خادمَ المعاينة على `dist/`؛ فإن لم يكن موجودًا أعلن ذلك.)
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STUDIO = join(ROOT, "js", "apps", "studio");
const SRC = join(STUDIO, "src");
const DIST = join(STUDIO, "dist");
const OUT = join(ROOT, "js", "data", "gates", "WAJH.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4183;
const CDP_PORT = 9345;

/** الحدُّ الأدنى المعلَن — ميثاقُ الوجه §١ */
const MIN_TAP = 44;
const MIN_TEXT = 15;

/**
 * **الصفحاتُ الأساسيّة** بحدّ المالك — وهي وحدَها ملزَمةٌ بالمقاييس.
 * وملفّاتُها هي التي يسري عليها الفحصُ الساكن.
 */
const CORE_FILES = [
  "main.tsx",
  "views/Reader.tsx",
  "views/Tatabbu.tsx",
  "components/SettingsPanel.tsx",
  "components/AyahPanel.tsx",
  "components/InlineOmni.tsx",
];

/**
 * مكوّناتٌ **لا تُعرَض في شجرةٍ حيّة** فلا يُقاس عليها الميثاقُ ولا يُنفَق فيها
 * عملٌ — وتُقيَّد ههنا بأسمائها كي لا يُظنَّ أنّها فُحصت فمرّت.
 */
const UNRENDERED = [
  { file: "components/ReadingBar.tsx", why: "غيرُ مركَّبٍ في أيّ صفحة — لا يستورده إلّا تعليقٌ في Reader.tsx" },
  // **وحُذف `ScrollTopFab.tsx` من الشجرة** (ص-م٤ §٥/٣ — قرارُ المالك ١٤ أغسطس:
  // «لا قرص»)، فسقط دَينُه ولم يبقَ مكوّنٌ ميّتٌ يُصان.
];

const failures = [];
const missing = [];
const notes = [];
/** ما خالف الميثاقَ في الصفحات **الداخلة** — يُقيَّد بأسمائه ولا يُحمِّر */
const debts = [];
const fail = (check, detail) => failures.push({ check, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════ ١ — ساكنًا في الشيفرة ═══════════════ */

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** يُسقط التعليقاتِ كي لا يُصطاد ذِكرُ الممنوع في شرحِ منعه */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function staticChecks() {
  const files = walk(SRC);
  const core = new Set(CORE_FILES.map((f) => join(SRC, f)));

  /* حواراتُ المتصفّح — أفضحُ علامةٍ على الإطلاق (§١/٨) */
  const DIALOG = /(^|[^\w.$])(alert|confirm|prompt)\s*\(|window\.(alert|confirm|prompt)\s*\(/;
  const dialogHits = [];
  for (const f of files) {
    const body = stripComments(readFileSync(f, "utf8"));
    body.split("\n").forEach((line, i) => {
      if (DIALOG.test(line)) dialogHits.push({ file: relative(ROOT, f), line: i + 1, core: core.has(f) });
    });
  }
  const dialogCore = dialogHits.filter((h) => h.core);
  if (dialogCore.length) {
    fail("حوارُ متصفّحٍ في صفحةٍ أساسيّة", dialogCore.map((h) => `${h.file}:${h.line}`).join(" · "));
  } else {
    notes.push(`لا «alert» ولا «confirm» ولا «prompt» في الصفحات الأساسيّة (فُحص ${files.length} ملفًّا)`);
  }
  for (const h of dialogHits.filter((x) => !x.core)) {
    debts.push({ what: "حوارُ متصفّح", where: `${h.file}:${h.line}`, why: "صفحةٌ داخلة — خارجُ النطاق بحدّ المالك" });
  }

  /* رقمُ خطٍّ مكتوبٌ نصًّا في JSX (§٣/١) */
  const FS = /fontSize:\s*(?:"|')?\d/;
  const fsHits = [];
  for (const f of files) {
    if (!core.has(f)) continue;
    stripComments(readFileSync(f, "utf8")).split("\n").forEach((line, i) => {
      if (FS.test(line)) fsHits.push(`${relative(ROOT, f)}:${i + 1}`);
    });
  }
  if (fsHits.length) fail("رقمُ خطٍّ مكتوبٌ نصًّا في JSX", fsHits.join(" · "));
  else notes.push("لا رقمَ خطٍّ مكتوبٌ نصًّا في JSX الصفحات الأساسيّة — السلّمُ رموزٌ في theme.css");

  /* المكوّناتُ غيرُ المركَّبة: تُقيَّد ولا تُقاس، فلا يُقال فُحصت فمرّت */
  for (const u of UNRENDERED) {
    debts.push({ what: "مكوّنٌ غيرُ مركَّبٍ في شجرةٍ حيّة", where: `js/apps/studio/src/${u.file}`, why: u.why });
  }

  /* الرموزُ الأربعةُ اللازمة */
  const css = readFileSync(join(SRC, "theme.css"), "utf8");
  const html = readFileSync(join(STUDIO, "index.html"), "utf8");
  const need = [
    ["-webkit-tap-highlight-color", css.includes("-webkit-tap-highlight-color")],
    ["overscroll-behavior", css.includes("overscroll-behavior")],
    ["env(safe-area-inset", css.includes("env(safe-area-inset")],
    ["theme-color", /name=["']theme-color["']/.test(html)],
  ];
  const absent = need.filter(([, ok]) => !ok).map(([n]) => n);
  if (absent.length) fail("رموزُ الميثاق الساكنة", `غائبة: ${absent.join(" · ")}`);
  else notes.push("الرموزُ الأربعةُ حاضرة: tap-highlight · overscroll-behavior · safe-area-inset · theme-color");

  /* ── **لا يُرسم شيءٌ خارجَ صندوق حرفٍ قرآنيّ** (§١٣) ──
     أُضيفت هذه القاعدةُ إلى الميثاق بعد عيبٍ رصده المالكُ في الفحص الحيّ
     (١٤ أغسطس): ظِلٌّ بانتشار ٤px تحت مؤشّر التتبّع كان **يمدّ لونًا مصمتًا فوق
     أوّل الكلمة التالية**، والكلماتُ في المصحف متقاربة. والانتشارُ (والغَبَشُ
     مثلُه) يرسم **صفيحةً** خارج الصندوق؛ أمّا إزاحةٌ بلا غبشٍ ولا انتشارٍ فخطٌّ
     تحت الكلمة لا صفيحةٌ عليها — فتبقى مأذونة، وكذلك `inset` فهو داخلَ الصندوق.
     ويُقاس على الشيفرة لا على الشاشة: القاعدةُ تُقرأ من `theme.css` نفسِها. */
  // **ولا حدَّ كلمةٍ (`\b`) في سكربتات البوّابات** (بلاغُ الحدود 2026-08-12،
  // والفاحصُ الدائمُ يحرسه): الحدودُ تُكتب صريحةً — ههنا «ما بعده ليس حرفَ اسمِ
  // صنفٍ» فلا تُخلط `.quran` بـ`.quran-x`.
  const QURAN_GLYPH = /(^|[\s,>+~])\.(sawt-w|sawt-now|sawt-past|sawt-next|sawt-veil|mp-ayah|sel-ayah|quran|ws-ayah-text|ayah-marker)(?![a-zA-Z0-9_-])/;
  /** كتلُ القواعد: التعبيرُ لا يلتقط إلّا كتلةً بلا أقواسٍ داخلها، فلا تُشوّشه `@media` */
  const cssBlocks = (src) =>
    [...src.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      sel: m[1].split("\n").filter((l) => l.trim()).pop().trim(),
      body: m[2],
    }));
  /** ظِلٌّ يرسم صفيحةً خارج الصندوق: غيرُ `inset` وله غبشٌ أو انتشارٌ غيرُ صفر */
  const plateShadow = (value) => {
    const v = value.trim();
    if (v === "none" || /(^|[\s(])inset([\s)]|$)/.test(v)) return null;
    // تُقرأ الأطوالُ المتصدّرةُ بترتيبها (إزاحتان · غبشٌ · انتشار) ويُوقَف عند
    // أوّل ما ليس طولًا — فلا تُقرأ أرقامُ اللون (`rgb(0 0 0 / .3)`) أطوالًا.
    // **والصفرُ بلا وحدة** صحيحٌ في CSS وهو الغالبُ عندنا (`0 0 0 4px`).
    const lens = [];
    for (const part of v.split(/\s+/)) {
      const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(part);
      if (!m) break;
      lens.push(Number(m[1]));
    }
    if (lens.length < 3) return null;
    const blur = lens[2] ?? 0;
    const spread = lens[3] ?? 0;
    if (blur === 0 && spread === 0) return null;
    return `غبش ${blur} · انتشار ${spread}`;
  };
  const glyphPaint = [];
  for (const { sel, body } of cssBlocks(readFileSync(join(SRC, "theme.css"), "utf8"))) {
    if (!QURAN_GLYPH.test(" " + sel)) continue;
    const sh = body.match(/box-shadow\s*:\s*([^;]+)/);
    if (!sh) continue;
    const why = plateShadow(sh[1]);
    if (why) glyphPaint.push(`${sel} — ${why}`);
  }
  if (glyphPaint.length) fail("رسمٌ خارجَ صندوق حرفٍ قرآنيّ", glyphPaint.join(" · "));
  else notes.push("لا ظِلَّ يرسم صفيحةً خارجَ صندوق حرفٍ قرآنيّ (§١٣) — فُحصت قواعدُ theme.css كلُّها");

  /* ── ضبطٌ سالبٌ ساكن: يُزرع `confirm` في ملفٍّ أساسيٍّ ذهنيًّا (بلا كتابةٍ على القرص) ── */
  const planted = stripComments(`function x() { if (confirm("زرع")) return 1; }`);
  if (!DIALOG.test(planted)) fail("ضبطُ الفحص الساكن", "زُرع `confirm` فلم يصطده التعبيرُ — والفحصُ لا يفحص");
  const plantedFs = `<span style={{ fontSize: 11 }}>x</span>`;
  if (!FS.test(plantedFs)) fail("ضبطُ الفحص الساكن", "زُرع رقمُ خطٍّ فلم يُصطَد");
  const plantedComment = stripComments(`/* لا يُكتب confirm( ههنا */\nconst a = 1;`);
  if (DIALOG.test(plantedComment)) fail("ضبطُ الفحص الساكن", "اصطاد الفاحصُ ذِكرًا في تعليقٍ — فحصٌ يُحمِّر البريء");

  /* وضبطُ قاعدة «لا يُرسم خارجَ الصندوق»: يُزرع الانتشارُ فيُصطاد، ويُزرع البريءُ
     فلا يُصطاد — **وزرعٌ لا أثرَ له ليس ضبطًا** (قاعدةُ الإدارة 2026-08-13). */
  const glyphPlants = [
    [".sawt-now { box-shadow: 0 0 0 4px var(--accent-soft); }", true, "انتشارٌ على كلمة التتبّع"],
    [".mp-ayah.target { box-shadow: 0 0 0 3px var(--accent-soft); }", true, "انتشارٌ على آية المصحف"],
    [".quran .w { box-shadow: 0 0 8px rgb(0 0 0 / .3); }", true, "غبشٌ على كلمة قرآن"],
    [".sel-ayah .w:hover { box-shadow: 0 1.5px 0 var(--accent); }", false, "خطٌّ تحت الكلمة بلا غبشٍ ولا انتشار"],
    [".ayah-marker.jamia { box-shadow: inset 0 0 0 1px var(--gold); }", false, "ظِلٌّ داخلَ الصندوق"],
    [".card { box-shadow: 0 14px 44px rgb(0 0 0 / .18); }", false, "بطاقةٌ ليست حرفَ قرآن"],
  ];
  for (const [css, shouldCatch, why] of glyphPlants) {
    const [{ sel, body }] = cssBlocks(css);
    const caught = QURAN_GLYPH.test(" " + sel) && plateShadow(body.match(/box-shadow\s*:\s*([^;]+)/)[1]) != null;
    if (caught !== shouldCatch) {
      fail("ضبطُ الفحص الساكن", shouldCatch ? `زُرع ${why} فلم يُصطَد` : `اصطاد الفاحصُ بريئًا: ${why}`);
    }
  }
  notes.push(
    "ضبطٌ سالبٌ ساكن: زُرع `confirm` ورقمُ خطٍّ فاصطيدا، وذِكرٌ في تعليقٍ فلم يُصطَد؛ " +
      "وثلاثةُ رسومٍ خارجَ صندوق الحرف فاصطيدت، وثلاثةٌ بريئةٌ (خطٌّ · `inset` · بطاقة) فلم تُصطَد",
  );
}

/* ═══════════════ ٢+٣ — مقيسًا في المتصفّح ═══════════════ */

/** الصفحاتُ الأساسيّةُ ومواضعُ فحصها */
const SURFACES = [
  { id: "المصحف", route: "/read/2", wait: `document.querySelector('.mushaf-page')`, settle: 1500 },
  {
    id: "الإعدادات", route: "/read/2", wait: `document.querySelector('.set-wrap > button')`,
    pre: `[...document.querySelectorAll('.set-wrap > button')].at(-1).click(); return true;`, settle: 700,
  },
  {
    id: "الإعدادات · المزيد", route: "/read/2", wait: `document.querySelector('.set-wrap > button')`,
    pre: `[...document.querySelectorAll('.set-wrap > button')].at(-1).click();
          const m = document.querySelector('.set-more'); if (m) m.click(); return true;`,
    settle: 700,
  },
  { id: "التتبّع", route: "/tatabbu", wait: `document.querySelector('[data-sawt="root"]')`, settle: 2500 },
  {
    id: "التتبّع · التهيئة", route: "/tatabbu", wait: `document.querySelector('.sawt-m-more')`,
    pre: `document.querySelector('.sawt-m-more').click(); return true;`, settle: 900,
  },
];

/** يُحصى ما يُلمس وما يُقرأ **ظاهرًا** في الشجرة */
const MEASURE = `
const small = [], tiny = [], exempt = [];
/* **استثناءٌ مُعلَنٌ واحد** (لا صامت): علامةُ رقم الآية ﴿١﴾ حرفٌ في متن القرآن
   لا زرٌّ في قشرة. وتوسيعُها إلى ٤٤px يزحزح سطورَ المصحف ورسمَه — وذلك ممنوعٌ
   قطعًا (ج٣ §٣: «النصُّ لا يُمَسّ ألبتّة»). ووظيفتُها مبلوغةٌ بهدفٍ أوسعَ منها:
   الآيةُ كلُّها ملموسةٌ («.mp-ayah» عليها مستمعُ نقر). فتُحصى ولا تُحمِّر. */
const isMarker = (el) => el.classList.contains('ayah-marker') || !!el.closest('.ayah-marker');
const vis = (el) => {
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
  return { r, st };
};
const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
/* أهدافُ اللمس */
for (const el of document.querySelectorAll('button, a[href], select, summary, [role="button"], input[type="checkbox"], input[type="radio"]')) {
  const v = vis(el); if (!v) continue;
  /* المفتاحُ المخفيُّ خلف مسارٍ مرسوم: يُقاس بالوسم الذي يحيط به */
  const box = el.closest('label') && el.type === 'checkbox' ? el.closest('label').getBoundingClientRect() : v.r;
  const w = Math.round(box.width), h = Math.round(box.height);
  if (w >= ${MIN_TAP} && h >= ${MIN_TAP}) continue;
  if (isMarker(el)) { exempt.push({ what: name(el), w, h }); continue; }
  small.push({ what: name(el), w, h, cls: el.className.toString().slice(0, 40) });
}
/* النصُّ الظاهر */
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const seen = new Set();
for (let n = walker.nextNode(); n; n = walker.nextNode()) {
  const s = (n.textContent || '').trim();
  if (s.length < 2) continue;
  const el = n.parentElement; if (!el || seen.has(el)) continue;
  seen.add(el);
  const v = vis(el); if (!v) continue;
  const fs = parseFloat(v.st.fontSize);
  if (fs < ${MIN_TEXT}) tiny.push({ text: s.slice(0, 24), px: Math.round(fs * 10) / 10, cls: el.className.toString().slice(0, 40) });
}
/* **ولا يُطمس نصُّ القرآن** (§١٣): طمسٌ يعلو متنًا قرآنيًّا ظاهرًا */
const blurs = [];
const quran = [...document.querySelectorAll('.quran, .mushaf-page, .sawt-text, .ayah-card')].filter((e) => vis(e));
for (const el of document.querySelectorAll('*')) {
  const v = vis(el); if (!v) continue;
  const f = (v.st.filter || '') + ' ' + (v.st.backdropFilter || '') + ' ' + (v.st.webkitBackdropFilter || '');
  if (!/blur\\(/.test(f)) continue;
  for (const q of quran) {
    if (el === q || el.contains(q)) { blurs.push({ what: name(el) || el.tagName, filter: f.trim().slice(0, 40) }); break; }
    const a = el.getBoundingClientRect(), b = q.getBoundingClientRect();
    const over = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    if (over && Number(getComputedStyle(el).zIndex || 0) >= 0) { blurs.push({ what: name(el) || el.tagName, filter: f.trim().slice(0, 40) }); break; }
  }
}
return { small, tiny, blurs, exempt, quranSeen: quran.length };
`;

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.waiting = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      const w = this.waiting.get(m.id);
      if (w) { this.waiting.delete(m.id); m.error ? w.reject(new Error(JSON.stringify(m.error))) : w.resolve(m.result); }
    });
  }
  /** **ولا نداءَ بلا توقيت**: لو انقطع الهدفُ لم يصل جوابٌ أبدًا فيعلّق الفحصُ
      صامتًا — وهي علّةٌ وقعت في ص-م٣ وقُيّدت. فيُوقَّت كلُّ نداء، وما لم يُجَب
      **يُقيَّد سقوطًا** ولا يُنتظر إلى الأبد. */
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
  /** ومنها ما يلزمه انتظارٌ في الصفحة نفسِها — كقياس قيمةٍ في أثناء انتقال */
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
}

const PRELUDE = `
try {
  localStorage.setItem('quran-studio:reader-mode', 'pages');
  localStorage.setItem('mishkat:welcomed-v1', '1');
} catch (e) {}
`;

let preview = null, chrome = null;

async function live() {
  if (!existsSync(join(DIST, "index.html"))) { missing.push("لا بناءَ في dist — تُشغَّل البوّابةُ بعد pnpm build"); return; }
  if (!existsSync(CHROME)) { missing.push("لا متصفّحَ كرومٍ على هذا الجهاز — لا تُقاس شجرةُ العرض بغيره"); return; }

  preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: STUDIO, stdio: "ignore" });
  chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=/tmp/cdp-wajh-${process.pid}`, "--no-first-run", "--disable-gpu", "about:blank",
  ], { stdio: "ignore" });

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    await sleep(500);
    try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === "page"); } catch { /* لم يقم */ }
  }
  if (!target) { missing.push("لم يقم المتصفّحُ على منفذ الأدوات"); return; }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE });

  let lastCdp = null;
  for (const s of SURFACES) {
    await cdp.send("Page.navigate", { url: "about:blank" });
    await sleep(200);
    await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#${s.route}` });
    const ok = await cdp.until(`!document.querySelector('.boot') && (${s.wait})`);
    if (!ok) { missing.push(`لم يظهر سطحُ «${s.id}»`); continue; }
    await sleep(s.settle);
    if (s.pre) { await cdp.ev(s.pre); await sleep(s.settle); }
    const m = await cdp.ev(MEASURE);
    if (m.small.length) {
      fail(`هدفُ لمسٍ < ${MIN_TAP}px — «${s.id}»`,
        m.small.map((x) => `${x.what || x.cls}: ${x.w}×${x.h}`).join(" · "));
    }
    if (m.tiny.length) {
      fail(`نصٌّ < ${MIN_TEXT}px — «${s.id}»`,
        m.tiny.map((x) => `«${x.text}» ${x.px}px (${x.cls})`).join(" · "));
    }
    if (m.blurs.length) {
      fail(`طمسٌ فوق نصّ القرآن — «${s.id}»`, m.blurs.map((x) => `${x.what} [${x.filter}]`).join(" · "));
    }
    if (!m.small.length && !m.tiny.length && !m.blurs.length) {
      notes.push(`«${s.id}» على ٣٩٠: كلُّ هدفِ لمسٍ ≥ ${MIN_TAP}px، وكلُّ نصٍّ ≥ ${MIN_TEXT}px، ولا طمسَ فوق المتن`);
    }
    if (m.exempt?.length) {
      notes.push(`«${s.id}»: ${m.exempt.length} علامةَ آيةٍ ﴿…﴾ دون ${MIN_TAP}px — **استثناءٌ معلَنٌ لا سكوت**: حرفٌ في متن القرآن لا زرٌّ في قشرة، وتوسيعُه يزحزح الرسمَ (ج٣ §٣)، والآيةُ كلُّها ملموسةٌ فوظيفتُه مبلوغةٌ بأوسعَ منه`);
    }
    lastCdp = cdp;
  }

  /* ═══ الضبطُ السالبُ الحيّ: يُزرع ثلاثةٌ فتُصطاد، ثمّ تُزال فتعود خضراء ═══ */
  if (lastCdp) {
    await lastCdp.send("Page.navigate", { url: "about:blank" });
    await sleep(200);
    await lastCdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
    await lastCdp.until(`!document.querySelector('.boot') && document.querySelector('.mushaf-page')`);
    await sleep(1500);
    const clean = await lastCdp.ev(MEASURE);
    // **الزرعُ يقع في المرأى** — وزرعٌ خارجَ النافذة لا أثرَ له، وزرعٌ لا أثرَ
    // له ليس ضبطًا (قاعدةُ الإدارة 2026-08-13).
    await lastCdp.ev(`
      const b = document.createElement('button');
      b.id = '__plantTap'; b.textContent = 'زرع';
      b.style.cssText = 'position:fixed;z-index:99;left:8px;top:300px;width:20px;height:20px;padding:0;font-size:9px';
      document.body.appendChild(b);
      const t = document.createElement('p');
      t.id = '__plantText'; t.textContent = 'نصٌّ صغيرٌ مزروع';
      t.style.cssText = 'position:fixed;z-index:99;left:8px;top:340px;margin:0;font-size:10px';
      document.body.appendChild(t);
      const o = document.createElement('div');
      o.id = '__plantBlur';
      const q = document.querySelector('.mushaf-page').getBoundingClientRect();
      o.style.cssText = 'position:fixed;z-index:5;backdrop-filter:blur(3px);left:' + q.left + 'px;top:400px;width:' + q.width + 'px;height:200px';
      document.body.appendChild(o);
      return true;
    `);
    await sleep(300);
    const planted = await lastCdp.ev(MEASURE);
    await lastCdp.ev(`for (const id of ['__plantTap','__plantText','__plantBlur']) document.getElementById(id)?.remove(); return true;`);
    await sleep(300);
    const after = await lastCdp.ev(MEASURE);

    const caughtTap = planted.small.length > clean.small.length;
    const caughtText = planted.tiny.length > clean.tiny.length;
    const caughtBlur = planted.blurs.length > clean.blurs.length;
    if (!caughtTap) fail("الضبطُ السالب", "زُرع زرٌّ ٢٠×٢٠px فلم يُصطَد — والفاحصُ لا يفحص");
    if (!caughtText) fail("الضبطُ السالب", "زُرع نصٌّ ١٠px فلم يُصطَد");
    if (!caughtBlur) fail("الضبطُ السالب", "زُرع طمسٌ فوق متن القرآن فلم يُصطَد — وهي العلامةُ الثالثةَ عشرة");
    if (caughtTap && caughtText && caughtBlur) {
      notes.push(`ضبطٌ سالبٌ حيّ: زُرع زرٌّ ٢٠px ونصٌّ ١٠px وطمسٌ فوق المتن — فاصطادت البوّابةُ الثلاثةَ (${planted.small.length}/${planted.tiny.length}/${planted.blurs.length} مقابلَ ${clean.small.length}/${clean.tiny.length}/${clean.blurs.length})`);
    }
    if (after.small.length !== clean.small.length || after.tiny.length !== clean.tiny.length || after.blurs.length !== clean.blurs.length) {
      fail("الضبطُ السالب", "بقي أثرُ الزرع بعد محوه — فالقياسُ غيرُ مستقرّ");
    } else {
      notes.push("وأُزيل الزرعُ فعادت البوّابةُ إلى ما كانت — قياسٌ مستقرّ");
    }
  }

  /* ═══ ٤ — **انسحابُ القشرة انزلاقٌ لا قفزة** (ص-م٤ §٥د · ميثاقُ الوجه §١/٣) ═══
     اللقطاتُ لا تكفي ههنا: **يُقاس التحويلُ في أثناء الانتقال**. فبعد ١٠٠ مِث
     من بدء الإخفاء يجب أن تكون قيمةُ `translateY` للرأس **بين الطرفين لا عند
     أحدهما** — فذلك وحدَه دليلُ أنّها تنزلق. **وضبطُه السالب**: يُزال الانتقالُ
     فيُشهد أنّها تقع عند الطرف من أوّل لحظة، فتُصطاد القفزة. */
  if (lastCdp) {
    const cdp = lastCdp;
    /** **متصفّحٌ لا يرسم لا يُقدِّم انتقالًا**: في المتصفّح المقطوع عن العرض
        تتجمّد الانتقالاتُ وتُخنَق المؤقّتاتُ إلى نحو الثانية، فيُقاس الانتقالُ
        صفرًا وهو يعمل. فيُطلب بثُّ الشاشة ليجري خطُّ الرسم، وبه يُقاس ما يراه
        القارئُ فعلًا لا ما تراه صفحةٌ نائمة. */
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 20, everyNthFrame: 1 });
    await cdp.send("Page.navigate", { url: "about:blank" });
    await sleep(200);
    await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
    await cdp.until(`!document.querySelector('.boot') && document.querySelector('.mushaf-page')`);
    await sleep(1500);

    /**
     * يقيس تحويلَ الرأس والشريط **بعد `ms` من بدء الإخفاء فعلًا** — لا من لحظة
     * التمرير: فبين التمرير وانقلاب الحال مهلةُ حدثٍ لا تُضبط من خارج الصفحة.
     * فيُنتظر انقلابُ الحال، ومنه يُبتدأ العدّ — فيقع القياسُ في وسط الانتقال.
     */
    /**
     * **يُقاس الانتقالُ نفسُه لا لقطةٌ منه.** المطلوبُ في §٥د أن يكون الرأسُ
     * **في أثناء الانتقال** لا عند أحد طرفيه — وقياسُ ذلك بمهلةٍ من خارج
     * الصفحة لا يستقيم في متصفّحٍ مقطوعٍ عن العرض: مؤقّتاتُه تُخنَق إلى نحو
     * الثانية، فيُقاس ما بعد الانتقال ويُظنُّ قفزة. **فيُسأل المتصفّحُ عن
     * انتقالاته نفسِها** (`getAnimations`): أثَمَّ انتقالٌ جارٍ على `transform`؟
     * وكم مدّتُه؟ وأين بلغ الآن؟ — وهذا أدقُّ من اللقطة لا أضعف: اللقطةُ تدلّ
     * على الانتقال، والانتقالُ ههنا مقروءٌ بعينه.
     *
     * **والحالُ تُقلب بالتمرير أوّلًا**؛ فإن لم يبعث المتصفّحُ حدثَه (وهو حالُ
     * المقطوع عن العرض) قُلبت كما تقلبها الصفحةُ، **ويُقيَّد ذلك في المخرَج**
     * فلا يُظنّ التمريرُ مشهودًا وهو غيرُ مشهود.
     */
    const SLIDE = `
      const main = document.querySelector('.reader-main');
      const top = document.querySelector('.topbar');
      const tab = document.querySelector('.tabbar');
      if (!main || !top || !tab) return { error: 'لا قشرةَ في الصفحة' };
      const wait = (t) => new Promise((r) => setTimeout(r, t));
      document.body.classList.remove('reading-immersive');
      main.scrollTop = 0;
      await wait(300);
      const h = Math.round(top.getBoundingClientRect().height);
      const dy = (el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return Math.round(m.f * 10) / 10;
      };
      const at0 = { top: dy(top), tab: dy(tab) };
      const display = getComputedStyle(top).display;
      main.scrollTop = 600;
      await wait(120);
      let byScroll = document.body.classList.contains('reading-immersive');
      if (!byScroll) {
        document.body.classList.add('reading-immersive');
        await wait(30);
      }
      /** الانتقالاتُ الجاريةُ على العنصر — نوعُها ومدّتُها وأين بلغت */
      const runs = (el) =>
        el.getAnimations().map((a) => {
          const kf = (a.effect?.getKeyframes?.() ?? []).map((k) => k.transform ?? null);
          const to = kf[kf.length - 1];
          let toY = null;
          try { if (to) toY = Math.round(new DOMMatrixReadOnly(to).f * 10) / 10; } catch (e) { toY = null; }
          return {
            prop: a.transitionProperty ?? null,
            dur: Math.round(a.effect?.getTiming?.().duration ?? 0),
            ease: a.effect?.getTiming?.().easing ?? null,
            at: Math.round(Number(a.currentTime ?? 0)),
            toY,
          };
        });
      const topRuns = runs(top);
      const tabRuns = runs(tab);
      const mid = { top: dy(top), tab: dy(tab) };
      /** **منتهى الانزلاق يُقرأ من نظيرٍ بلا انتقال**: القيمةُ الجاريةُ على
          عنصرٍ ينتقل لا تتقدّم في متصفّحٍ لا يرسم، أمّا نظيرُه المعطَّلُ انتقالُه
          فتُقرأ منه القيمةُ المقصودةُ من التتالي في الحال. */
      const targetOf = (el) => {
        const c = el.cloneNode(false);
        c.style.transition = 'none';
        c.style.visibility = 'hidden';
        /* والنسبةُ في التحويل نسبةٌ من ارتفاع العنصر نفسِه، فيُساوى بأصله */
        c.style.height = el.getBoundingClientRect().height + 'px';
        el.parentNode.appendChild(c);
        const v = dy(c);
        c.remove();
        return v;
      };
      const target = { top: targetOf(top), tab: targetOf(tab) };
      await wait(900);
      const end = { top: dy(top), tab: dy(tab) };
      main.scrollTop = 0;
      document.body.classList.remove('reading-immersive');
      return { h, at0, mid, end, target, display, byScroll, topRuns, tabRuns };
    `;

    const slide = await cdp.evAsync(SLIDE);
    const trans = (rs) => rs.find((r) => r.prop === "transform");
    if (slide.error) {
      fail("انسحابُ القشرة", `${slide.error} — ${JSON.stringify({ h: slide.h, display: slide.display, ...slide.dbg })}`);
    } else if (slide.display === "none") {
      fail("انسحابُ القشرة", "الرأسُ يُخفى بـ`display` — و`display` لا يقبل انتقالًا، فيقفز ولا ينزلق");
    } else if (!trans(slide.topRuns) || !trans(slide.tabRuns)) {
      fail(
        "انسحابُ القشرة",
        `لا انتقالَ جارٍ على التحويل — الرأسُ ${JSON.stringify(slide.topRuns)} · الشريطُ ${JSON.stringify(slide.tabRuns)}`,
      );
    } else if (trans(slide.topRuns).dur !== trans(slide.tabRuns).dur) {
      fail(
        "انسحابُ القشرة",
        `توقيتان مختلفان فيبدو أحدُهما متأخّرًا: الرأسُ ${trans(slide.topRuns).dur} مِث · الشريطُ ${trans(slide.tabRuns).dur} مِث`,
      );
    } else if (trans(slide.topRuns).dur < 180 || trans(slide.topRuns).dur > 220) {
      fail("انسحابُ القشرة", `المدّةُ خارجَ الحدّ المقرَّر ١٨٠–٢٢٠ مِث: ${trans(slide.topRuns).dur}`);
    } else if (!(slide.target.top <= -slide.h + 1) || !(slide.target.tab > 1)) {
      fail(
        "انسحابُ القشرة",
        `منتهى الانزلاق ليس خارجَ الشاشة: الرأسُ إلى ${slide.target.top} (وارتفاعُه ${slide.h}) · الشريطُ إلى ${slide.target.tab}`,
      );
    } else {
      notes.push(
        `انسحابُ القشرة انزلاقٌ لا قفزة: انتقالٌ جارٍ على التحويل — الرأسُ ${trans(slide.topRuns).dur} مِث (${trans(slide.topRuns).ease}، بلغ ${trans(slide.topRuns).at}) والشريطُ ${trans(slide.tabRuns).dur} مِث — ` +
          `ومنتهاه ${slide.target.top} للرأس (وارتفاعُه ${slide.h}) و+${slide.target.tab} للشريط — فيخرجان من الشاشة ولا يُخلّفان فراغًا · ولا إخفاءَ بـdisplay` +
          (slide.byScroll
            ? " · وانقلبت الحالُ بالتمرير"
            : " · **والحالُ قُلبت كما تقلبها الصفحةُ لا بالتمرير** — فالمتصفّحُ المقطوعُ عن العرض لا يبعث حدثَ التمرير، وهذا حدُّ ما شُهد ههنا"),
      );
    }

    /* **ضبطُه السالب**: يُزال الانتقالُ فلا يبقى انتقالٌ جارٍ ألبتّة — وتلك
       هي القفزةُ بعينها، فتُصطاد. ثمّ يُزال الزرعُ فتعود البوّابةُ خضراء. */
    await cdp.ev(`
      const st = document.createElement('style');
      st.id = '__noTrans';
      st.textContent = '.topbar, .tabbar, .reader-sticky { transition: none !important; }';
      document.head.appendChild(st);
      return true;
    `);
    const jumped = await cdp.evAsync(SLIDE);
    await cdp.ev(`document.getElementById('__noTrans')?.remove(); return true;`);
    if (jumped.error) {
      fail("ضبطُ انسحاب القشرة", jumped.error);
    } else if (trans(jumped.topRuns) || trans(jumped.tabRuns)) {
      fail("ضبطُ انسحاب القشرة", "أُزيل الانتقالُ فبقي انتقالٌ جارٍ — فالقياسُ لا يقيس");
    } else {
      notes.push(
        "ضبطٌ سالب: أُزيل الانتقالُ فلم يبقَ انتقالٌ جارٍ ألبتّة (صفرٌ على الرأس وصفرٌ على الشريط) — وتلك هي القفزةُ بعينها، فتُصطاد",
      );
    }
  }

  /* ═══ ٥ — **سطرُ «تجدّدت هيئةُ الصفحات» يُعرض مرّةً ثمّ لا يعود** (§٥ب) ═══
     يُزرع اختيارٌ محفوظٌ «آيات» فيُشهد ظهورُ السطر، ثمّ يُهمَل فيُشهد ألّا يعود.
     **ولا يُعرض لمن لم يبدّل قطُّ** — وهو الضبطُ السالبُ الثالث. */
  if (lastCdp) {
    const cdp = lastCdp;
    const openReader = async () => {
      await cdp.send("Page.navigate", { url: "about:blank" });
      await sleep(200);
      await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
      await cdp.until(`!document.querySelector('.boot') && document.querySelector('.reader-main')`);
      await sleep(1200);
      return await cdp.ev(`return !!document.querySelector('[data-reader="renew-note"]');`);
    };
    const setMode = async (mode, renewed) => {
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `try { localStorage.setItem('quran-studio:reader-mode', '${mode}');
          ${renewed ? "localStorage.setItem('mishkat:pages-renewed-note','1');" : "localStorage.removeItem('mishkat:pages-renewed-note');"} } catch (e) {}`,
      });
    };
    await setMode("ayat", false);
    const shown = await openReader();
    let dismissed = null;
    if (shown) {
      await cdp.ev(`document.querySelector('.reader-renew-skip')?.click(); return true;`);
      await sleep(400);
      dismissed = await cdp.ev(`return !!document.querySelector('[data-reader="renew-note"]');`);
    }
    await setMode("ayat", true);
    const again = await openReader();
    await setMode("pages", false);
    const never = await openReader();

    if (!shown) fail("سطرُ تجدّد الهيئة", "زُرع اختيارٌ محفوظٌ «آيات» فلم يظهر السطر");
    else if (dismissed) fail("سطرُ تجدّد الهيئة", "أُهمل السطرُ فلم يختفِ");
    else if (again) fail("سطرُ تجدّد الهيئة", "عاد السطرُ بعد أن عُرض مرّةً — والعرضُ مرّةٌ واحدة");
    else if (never) fail("سطرُ تجدّد الهيئة", "ظهر السطرُ لمن لم يبدّل قطُّ — وهو على الافتراض الجديد أصلًا");
    else notes.push("سطرُ تجدّد الهيئة: ظهر لمن حُفظ عنده «آيات» · أُهمل فاختفى · ولم يعد · ولم يُعرض لمن لم يبدّل");
  }

  ws.close();
}

/* ═══════════════ التشغيل ═══════════════ */

try {
  staticChecks();
  await live();
} catch (e) {
  missing.push(`تعثّر الفحص: ${e.message}`);
} finally {
  chrome?.kill();
  preview?.kill();
}

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0 && missing.length === 0;
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      gate: "wajh",
      ok,
      checkedAt: null,
      scope: "الصفحاتُ الأساسيّة وحدَها (المصحف · التتبّع · الإعدادات · القشرة) — والصفحاتُ الداخلةُ خارجُ النطاق بحدّ المالك، لم تُفحص ولم يُقل إنّها مرّت",
      thresholds: { tap: MIN_TAP, text: MIN_TEXT },
      notes,
      failures,
      missing,
      debts,
    },
    null,
    2,
  )}\n`,
);
console.log(`بوّابةُ ميثاق الوجه: ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
for (const d of debts) console.log(`  ⌛ دَينٌ مقيَّد: ${d.what} — ${d.where} (${d.why})`);
if (!ok) process.exitCode = 1;

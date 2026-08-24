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
 *   ٤ — **ولوحاتُ القشرة تُفتح فتُقاس** (ج٩ §٦ — إلحاقٌ بالقائم لا بوّابةٌ ثانية):
 *       لوحةُ الإعدادات من الرأس ارتفاعُها المرئيُّ ≥ ٦٠٪ من الشاشة ومحتواها
 *       داخلَ حدودها؛ وورقةُ «⋯» خلفَ عناصرها أرضيّةٌ معتمةٌ لا نصُّ المصحف.
 *       **وضبطُهما السالبُ عينُ الواقعة**: يُزرع `transform` على حاويةِ لوحةٍ
 *       `fixed` فيُصطاد انهيارُها إلى ارتفاع الرأس، ويُشفَّف ظهرُ الورقة فيُصطاد.
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
/**
 * **ونطاقُ الفحص الساكن يشمل «التلاوة»** (ف٢ §٥ — بنصّ الإدارة: «يُوسَّع الفحصُ
 * الساكنُ في `check-wajh.mjs` ليشمل `apps/tilawa/src`: لا حوارات، لا أرقامَ خطٍّ
 * في JSX»). فالميثاقُ واحدٌ على التطبيقين، **وحراسةُ التلاوة الحيّةُ تُبنى في ف٣**
 * — وما ههنا ساكنٌ لا يفتح متصفّحًا على التلاوة، فلا يُقال إنّها قِيست حيّةً.
 */
const TILAWA_SRC = join(ROOT, "js", "apps", "tilawa", "src");
/**
 * **وهيئةُ صفحة المصحف انتقلت إلى الحزمة** (ف٢ §١)، فيتبعها فحصُ §١٣: كانت
 * قواعدُها في `theme.css` فكانت تُقرأ، ولو تُركت لخرجت من الحرس صامتةً — **وهذا
 * تتبُّعُ ملفٍّ نُقل، لا بوّابةٌ جديدة**.
 */
const MUSHAF_CSS = join(ROOT, "js", "packages", "quran-core", "src", "mushaf.css");
const OUT = join(ROOT, "js", "data", "gates", "WAJH.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 4183;
const CDP_PORT = 9345;

/** الحدُّ الأدنى المعلَن — ميثاقُ الوجه §١ */
const MIN_TAP = 44;
const MIN_TEXT = 15;
/**
 * **أرضيّةُ الأبواب** (ف٥ §٣ — شاهدُ «لا قسمَ ضاع»): عددُ مداخل دُرج «المزيد»
 * **قبلَ دفعة ف٥**، مقيسًا حيًّا على ٣٩٠ لا مقدَّرًا. المدخلُ يتغيّر والترتيبُ
 * يتغيّر — **والأبوابُ لا تنقص**؛ فمن نقص عنها فقد أسقط بابًا، ويُحمِّر.
 */
const MIN_DOORS = 23;

/**
 * **الصفحاتُ الأساسيّة** بحدّ المالك — وهي وحدَها ملزَمةٌ بالمقاييس.
 * وملفّاتُها هي التي يسري عليها الفحصُ الساكن.
 */
const CORE_FILES = [
  "main.tsx",
  "views/Reader.tsx",
  /* **الصفحةُ الأولى أساسيّةٌ بنصّ الميثاق** (§٠: «وأوّلُ ما يقع عليه بصرُ
     الفاتح») — وقد صارت في ف٥ صفحةً تُعرض لا مسارًا يُعبَر، فتُقاس بالميثاق. */
  "views/Home.tsx",
  // **وحلّت بطاقةُ العبور محلَّ `views/Tatabbu.tsx`** (ف٤ §٣): خرج سطحُ التتبّع
  // من مشكاة إلى تطبيق التلاوة، **وبقي مسارُه** بطاقةً تفتح البابَ حيث صار —
  // فتُقاس بالميثاق كما يُقاس غيرُها، ولا يخرج من الحرس مسارٌ يزوره الناس.
  "views/Ubur.tsx",
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
  /* **وملفّاتُ التلاوة كلُّها أساسيّة**: ليس فيها صفحةٌ داخلة — التطبيقُ كلُّه
     مصحفٌ يُقرأ ويُستمع إليه (خارطةُ المخرج §١)، فلا يُستثنى منه شيء. */
  const tilawa = existsSync(TILAWA_SRC) ? walk(TILAWA_SRC) : [];
  const files = [...walk(SRC), ...tilawa];
  const core = new Set([...CORE_FILES.map((f) => join(SRC, f)), ...tilawa]);

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
    notes.push(`لا «alert» ولا «confirm» ولا «prompt» في الصفحات الأساسيّة — فُحص ${files.length} ملفًّا في التطبيقين (${tilawa.length} منها للتلاوة)`);
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
  else notes.push("لا رقمَ خطٍّ مكتوبٌ نصًّا في JSX الصفحات الأساسيّة في التطبيقين — السلّمُ رموزٌ في أوراق الأنماط");

  /* ═══ **ولا يعود التتبّعُ إلى مشكاة من بابٍ خلفيّ** (ف٤ §٣) ═══
     خرج سطحُ التتبّع إلى تطبيق التلاوة، **والخروجُ يُحرَس كما تُحرَس المقاييس**:
     فسطحٌ يُعاد تركيبُه في مشكاة — استيرادًا لصفحته، أو نسقَ `sawt-*`، أو وسمَ
     `data-sawt` — يُصطاد ههنا ولا يمرّ صامتًا.

     **والمصطادُ أثرُ سطحٍ لا لفظٌ في جملة**: بطاقةُ العبور نفسُها تقول «التتبّع»
     في نصّها الفصيح — وهو خبرٌ للقارئ لا سطحَ تتبّع. فلو صِيد باللفظ لاصطيدت
     البطاقةُ التي كُتبت لأجل الخروج، **وحارسٌ يصطاد الصادقَ ليس حارسًا**.

     **ونطاقُه مشكاةُ وحدَها**: التلاوةُ سطحُها القائمُ وهو موضعُه الصحيح. */
  /* **وحدودُها صريحةٌ ولا `\\b` فيها** (عقدُ بلاغ الحدود، وهذا سكربتُ بوّابة):
     الاستيرادُ بمحدِّدَي المسار، والنسقُ بما يسبقه من مُقتبِسٍ أو فراغ، والوسمُ
     بعلامة إسنادِه. */
  const SURFACE = [
    ["استيرادُ صفحة التتبّع", /["'][^"']*\/Tatabbu["']/],
    ["نسقُ سطح التتبّع", /["'`\s]sawt-[a-z]/],
    ["وسمُ سطح التتبّع", /data-sawt[=\]"'\s]/],
  ];
  const backDoor = [];
  for (const f of walk(SRC)) {
    const body = stripComments(readFileSync(f, "utf8"));
    for (const [name, re] of SURFACE) {
      if (re.test(body)) backDoor.push(`${relative(ROOT, f)} — ${name}`);
    }
  }
  if (backDoor.length) {
    fail("سطحُ تتبّعٍ عاد إلى مشكاة", backDoor.join(" · "));
  } else {
    notes.push(
      `لا سطحَ تتبّعٍ في مشكاة: صفرُ استيرادٍ لصفحته وصفرُ نسقِ \`sawt-*\` وصفرُ وسمِ \`data-sawt\` في ${walk(SRC).length} ملفًّا — والمقيسُ أثرُ سطحٍ لا لفظٌ في جملة`,
    );
  }

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
  const styleSheets = [join(SRC, "theme.css"), MUSHAF_CSS].filter((f) => existsSync(f));
  for (const { sel, body } of styleSheets.flatMap((f) => cssBlocks(readFileSync(f, "utf8")))) {
    if (!QURAN_GLYPH.test(" " + sel)) continue;
    const sh = body.match(/box-shadow\s*:\s*([^;]+)/);
    if (!sh) continue;
    const why = plateShadow(sh[1]);
    if (why) glyphPaint.push(`${sel} — ${why}`);
  }
  if (glyphPaint.length) fail("رسمٌ خارجَ صندوق حرفٍ قرآنيّ", glyphPaint.join(" · "));
  else notes.push(`لا ظِلَّ يرسم صفيحةً خارجَ صندوق حرفٍ قرآنيّ (§١٣) — فُحصت قواعدُ ${styleSheets.length} ملفًّا: theme.css وهيئةُ صفحة المصحف في الحزمة`);

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
  /* **والصفحةُ الأولى سطحان** (ف٥ §٣): القياسُ لا يرى إلّا ما في النافذة، وهي
     أطولُ من ٨٤٤ على الجوال — فتُقاس أعلاها ثمّ تُمرَّر إلى آخرها فتُقاس بقيّتُها،
     ولا يخرج من الحرس صفٌّ لأنّه وقع تحت الطيّة. */
  { id: "الصفحةُ الأولى", route: "/", wait: `document.querySelector('[data-home="root"]')`, settle: 1000 },
  {
    id: "الصفحةُ الأولى · أسفلُها", route: "/", wait: `document.querySelector('[data-home="root"]')`,
    pre: `document.querySelector('.page.home').scrollTop = 9999; return true;`, settle: 1000,
  },
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
  /* **وبطاقةُ العبور موضعَ صفحة التتّبع** (ف٤ §٣): المسارُ هو هو، والمقيسُ ما
     صار خلفه — بطاقةٌ فيها بابٌ إلى تطبيق التلاوة وعودةٌ إلى المصحف. */
  { id: "بطاقةُ العبور", route: "/tatabbu", wait: `document.querySelector('[data-ubur="root"]')`, settle: 900 },
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
      /* **والانسحابُ صار مقترنًا بالسكرول** (ج٨ §٣): في أثناء السحب **لا انتقالَ
         بتّةً** — الإصبعُ هو المحرّك؛ **والانتقالُ زمنُ الالتقاط** عند سكونه.
         فيُمرَّر أوّلًا (فيُشهد أنّ التمرير يحرّكه)، **ثمّ تنقضي نافذةُ السحب**
         فيُقاس الانتقالُ على قلبِ الحال — وهو الانزلاقُ الموعود. */
      main.scrollTop = 600;
      await wait(400);
      const byScroll = document.body.classList.contains('reading-immersive');
      const coupled = Math.round(Number(getComputedStyle(document.body).getPropertyValue('--shell-p') || 0) * 100) / 100;
      document.body.classList.remove('shell-drag');
      document.body.classList.remove('reading-immersive');
      document.documentElement.style.setProperty('--shell-p', '0');
      await wait(300);
      document.documentElement.style.removeProperty('--shell-p');
      document.body.classList.add('reading-immersive');
      await wait(30);
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
      document.documentElement.style.removeProperty('--shell-p');
      return { h, at0, mid, end, target, display, byScroll, coupled, topRuns, tabRuns };
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
            ? ` · وانقلبت الحالُ بالتمرير (مقدارُ الاقتران بلغ ${slide.coupled})`
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

  /* ═══ ٦ — **انتظامُ الرأس وتباينُ القشرة** (ج٦٧ §٣/١ و٣/٢) ═══
     رصدُ المالك: «أيقونةُ المنيو واللوغو واسمُ مشكاة كلُّها غيرُ منتظمة · شاحبةٌ
     أيضًا». فيُقاسان معًا على ٣٩٠ في الأوضاع الثلاثة:
       • **الانتظام**: كلُّ أزرار الرأس مقاسًا واحدًا ونصفَ قطرٍ واحدًا؛
       • **التباين**: حبرُ الزرّ ≥٤٫٥:١ على خلفيّته، وحدُّه ≥٣:١ على ما وراءه.
     **وضبطُهما السالب**: يُزرع زرٌّ مخالفُ الشكل ويُبهت حدُّ الأزرار، فيُصطادان. */
  if (lastCdp) {
    const cdp = lastCdp;
    const SHELL = `
      const bar = document.querySelector('.topbar');
      if (!bar) return { error: 'لا رأسَ في الصفحة' };
      const px = (v) => Math.round(parseFloat(v) * 10) / 10;
      /** [ح، خ، ز، شفافيّة] — **والشفافيّةُ تُقرأ ولا تُهمَل**: لونٌ شفّافٌ تُقرأ
          أعدادُه الثلاثةُ وحدَها فيُحسب أسودَ، فيُظنّ عاليَ التباين وهو غيرُ مرئيّ. */
      const rgba = (v) => {
        const p = (v.match(/[\\d.]+/g) ?? []).map(Number);
        return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] === undefined ? 1 : p[3]];
      };
      /** ويُركَّب الشفّافُ على ما تحته فيُقاس ما تراه العينُ فعلًا */
      const over = (c, bg) => [0, 1, 2].map((i) => Math.round(c[i] * c[3] + bg[i] * (1 - c[3])));
      const lum = (c) => {
        const f = c.slice(0, 3).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
      };
      /** الخلفيّةُ الفعليّةُ: تُركَّب طبقاتُ الأسلاف حتّى تُصمت — فالشفّافُ يكشف ما تحته */
      const bgOf = (el) => {
        const stack = [];
        for (let n = el; n; n = n.parentElement) {
          const c = rgba(getComputedStyle(n).backgroundColor);
          if (c[3] > 0) stack.push(c);
          if (c[3] >= 0.999) break;
        }
        let out = [255, 255, 255];
        for (const c of stack.reverse()) out = over(c, out);
        return out;
      };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
      const btns = [...bar.querySelectorAll('button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !b.closest('nav');
      });
      const shapes = btns.map((b) => {
        const s = getComputedStyle(b), r = b.getBoundingClientRect();
        const self = bgOf(b);
        const behind = bgOf(b.parentElement ?? bar);
        /** **أعارٍ هو أم مؤطَّر؟** — الحدُّ إنّما يكون حدًّا بعرضٍ وأسلوبٍ ولونٍ
            غيرِ شفّافٍ تمامًا؛ فإن انتفى واحدٌ منها فلا حدَّ ألبتّة **بإعلان**،
            ولا يُقاس تباينُ ما لا يُرسم. (وهذا نمطُ الأزرار العارية — ج٨ §٢أ.) */
        const bw = parseFloat(s.borderTopWidth) || 0;
        const ba = rgba(s.borderTopColor)[3];
        const bare = !(bw > 0 && s.borderTopStyle !== 'none' && ba > 0);
        return {
          what: b.getAttribute('aria-label') || b.className || b.tagName,
          w: Math.round(r.width), h: Math.round(r.height), radius: px(s.borderTopLeftRadius),
          ink: ratio(over(rgba(s.color), self), self),
          bare,
          edge: bare ? null : ratio(over(rgba(s.borderTopColor), behind), behind),
        };
      });
      /** والفوتر: أيقونتُه وتسميتُه على خلفيّته */
      const tabs = [...(document.querySelector('.tabbar')?.querySelectorAll('.tab') ?? [])].map((t) => {
        const s = getComputedStyle(t), bg = bgOf(t);
        return { what: t.textContent.trim().slice(0, 12), ink: ratio(over(rgba(s.color), bg), bg), weight: Number(s.fontWeight) };
      });
      return { shapes, tabs };
    `;
    const MIN_INK = 4.5, MIN_EDGE = 3;
    const uniq = (xs) => [...new Set(xs)];
    const themes = ["light", "dark", "sepia"];
    const table = [];
    let clean = null;
    /* **السمةُ ملكُ التطبيق لا ملكُ القياس** (واقعةُ مراجعة ج٦٧): `applySettings`
       يعيد كتابةَ `data-theme` من مخزونه عند كلّ استدعاء، وقياسٌ يزرع السمةَ من
       خارج قناته يتسابق معه — والانتقالُ (١٢٠ مث على خلفيّات الأزرار) يجعل
       اللقطةَ هجينةً: حبرُ وضعٍ على خلفيّة وضعٍ آخرَ فتُقرأ ١٫٠٦ والألوانُ بريئة.
       فيُكتب الوضعُ في **مخزن التطبيق نفسِه** (فإن أعاد الكتابةَ أعاد الوضعَ
       عينَه — يُقطع السباقُ من جذره)، وتُجمَّد الانتقالاتُ زمنَ القياس بعُدّة
       `__noTrans` القائمةِ في ضبط الانسحاب أعلاه، ويُشترط ثباتُ السمة قبل القراءة. */
    await cdp.ev(`
      const st = document.createElement('style');
      st.id = '__noTransShell';
      st.textContent = '* { transition: none !important; }';
      document.head.appendChild(st);
      return true;
    `);
    for (const th of themes) {
      await cdp.ev(`
        localStorage.setItem('quran-studio:settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('quran-studio:settings') ?? '{}'), theme: '${th}' }));
        document.documentElement.setAttribute('data-theme', '${th}');
        return true;
      `);
      const settled = await cdp.until(`document.documentElement.dataset.theme === '${th}'`, 5000, 100);
      if (!settled) { fail(`انتظامُ الرأس — «${th}»`, "لم تثبت سمةُ الوضع — التطبيقُ يعيد كتابتها بغير ما كُتب في مخزنه"); continue; }
      await sleep(150);
      const s = await cdp.ev(SHELL);
      if (s.error) { fail("انتظامُ الرأس", s.error); break; }
      if (th === "light") clean = s;
      const sizes = uniq(s.shapes.map((b) => `${b.w}×${b.h}`));
      const radii = uniq(s.shapes.map((b) => b.radius));
      if (sizes.length > 1) fail(`انتظامُ الرأس — «${th}»`, `مقاساتٌ مختلفة: ${sizes.join(" · ")}`);
      if (radii.length > 1) fail(`انتظامُ الرأس — «${th}»`, `أنصافُ أقطارٍ مختلفة: ${radii.join(" · ")}`);
      const pale = s.shapes.filter((b) => b.ink < MIN_INK).map((b) => `${b.what}: حبرٌ ${b.ink}`);
      /* **حدٌّ ≥٣:١ أو لا حدَّ البتّةَ بإعلان** (ج٨ §٦): الزرُّ العاري لا حدَّ
         له أصلًا فلا يُطالَب بتباين حدٍّ لا يُرسم — **والحدُّ نصفُ المرئيّ هو
         المخالفة**: يُرسم فلا يُرى، فيوهم إطارًا ويعطي شحوبًا. وحبرُ الزرّ
         يبقى مقيسًا على كلّ حال، فهو الذي يُميّزه إذ لا حدَّ يُميّزه. */
      const faint = s.shapes.filter((b) => !b.bare && b.edge < MIN_EDGE).map((b) => `${b.what}: حدٌّ ${b.edge}`);
      const dimTabs = s.tabs.filter((t) => t.ink < MIN_INK).map((t) => `${t.what}: ${t.ink}`);
      if (pale.length) fail(`تباينُ حبر القشرة < ${MIN_INK}:١ — «${th}»`, pale.join(" · "));
      if (faint.length) fail(`تباينُ حدّ القشرة < ${MIN_EDGE}:١ — «${th}»`, faint.join(" · "));
      if (dimTabs.length) fail(`تباينُ الفوتر < ${MIN_INK}:١ — «${th}»`, dimTabs.join(" · "));
      const edged = s.shapes.filter((b) => !b.bare);
      table.push(
        `«${th}»: ${s.shapes.length} زرًّا بمقاسٍ واحدٍ ${sizes[0]} ونصفِ قطرٍ ${radii[0]}px — ` +
          `أدنى حبرٍ ${Math.min(...s.shapes.map((b) => b.ink))}:١ · ` +
          (edged.length ? `أدنى حدٍّ ${Math.min(...edged.map((b) => b.edge))}:١` : `وكلُّها عاريةٌ بلا حدٍّ (${s.shapes.length}/${s.shapes.length}) — فالتمييزُ بالحبر`) +
          (s.tabs.length ? ` · الفوتر أدنى حبرٍ ${Math.min(...s.tabs.map((t) => t.ink))}:١` : " · لا فوترَ في هذا القياس"),
      );
    }
    /* ويُعاد ما استُعير: يُمحى مفتاحُ الوضع من المخزن (فيعود «auto» الأصل)
       وتُرفع السمةُ إلى الفاتح ويُزال مجمِّدُ الانتقالات — فما بعد هذه الكتلة
       يقيس صفحةً كما كانت. */
    await cdp.ev(`
      const raw = JSON.parse(localStorage.getItem('quran-studio:settings') ?? '{}');
      delete raw.theme;
      localStorage.setItem('quran-studio:settings', JSON.stringify(raw));
      document.documentElement.setAttribute('data-theme', 'light');
      document.getElementById('__noTransShell')?.remove();
      return true;
    `);
    await sleep(200);
    if (table.length === themes.length) notes.push(`انتظامُ الرأس وتباينُ القشرة — ${table.join(" | ")}`);

    /* ═══ ضبطُهما السالب: زرٌّ مخالفُ الشكل، وحدٌّ مُبهَت ═══ */
    if (clean) {
      await cdp.ev(`
        const b = document.createElement('button');
        b.id = '__plantOdd'; b.setAttribute('aria-label', 'زرعٌ مخالف'); b.textContent = 'ز';
        b.style.cssText = 'width:56px;height:56px;border-radius:999px';
        document.querySelector('.topbar').appendChild(b);
        const st = document.createElement('style');
        st.id = '__plantPale';
        /* **حدٌّ نصفُ مرئيّ**: يُرسم (عرضٌ وأسلوبٌ) ولونُه شفّافٌ إلّا قليلًا —
           فهو المخالفةُ بعينها، لا الزرُّ العاري الذي لا حدَّ له بإعلان. */
        st.textContent = '.topbar > button, .topbar .menu-btn, .topbar .set-wrap > button, .topbar .sh-btn { border: 1px solid rgba(0,0,0,0.02) !important; }';
        document.head.appendChild(st);
        return true;
      `);
      await sleep(250);
      const planted = await cdp.ev(SHELL);
      await cdp.ev(`document.getElementById('__plantOdd')?.remove(); document.getElementById('__plantPale')?.remove(); return true;`);
      await sleep(250);
      const after = await cdp.ev(SHELL);

      const oddCaught = uniq(planted.shapes.map((b) => `${b.w}×${b.h}`)).length > 1 && uniq(planted.shapes.map((b) => b.radius)).length > 1;
      const paleCaught = planted.shapes.some((b) => !b.bare && b.edge < MIN_EDGE);
      if (!oddCaught) fail("ضبطُ انتظام الرأس", "زُرع زرٌّ ٥٦px مستديرٌ في الرأس فلم يُصطَد — والفاحصُ لا يفحص");
      if (!paleCaught) fail("ضبطُ تباين القشرة", "أُبهِت حدُّ الأزرار فلم يُصطَد");
      if (oddCaught && paleCaught) {
        notes.push(
          `ضبطٌ سالب: زُرع زرٌّ ٥٦×٥٦px نصفُ قطره ٩٩٩px وزُرع حدٌّ نصفُ مرئيٍّ (شفافيّة ٠٫٠٢) — فاصطادت البوّابةُ المخالفةَ في الشكل وأدنى حدٍّ ${Math.min(...planted.shapes.filter((b) => !b.bare).map((b) => b.edge))}:١`,
        );
      }
      const back =
        uniq(after.shapes.map((b) => `${b.w}×${b.h}`)).length === 1 &&
        uniq(after.shapes.map((b) => b.radius)).length === 1 &&
        after.shapes.every((b) => b.bare || b.edge >= MIN_EDGE);
      if (!back) fail("ضبطُ انتظام الرأس", "أُزيل الزرعُ فلم تعُد البوّابةُ خضراء — قياسٌ غيرُ مستقرّ");
      else notes.push("وأُزيل الزرعُ فعادت أزرارُ الرأس منتظمةً عاريةً كما كانت — قياسٌ مستقرّ");
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

  /* ═══ ٧ — **لوحاتُ القشرة تُفتح فتُقاس** (ج٩ §٦) ═══
     واقعةُ ١٦ أغسطس: `transform` على `.topbar` جعله **حاويةَ الإحداثيّات لكلّ
     `fixed` في أحفاده**، فصارت لوحةُ الإعدادات بـ`inset: 0` ملءَ الرأس (٥٥px
     مقيسةً على المنشور) لا ملءَ الشاشة — فبدت «فارغة». **والبوّابةُ كانت تفتحها
     وتقيس أهدافَ لمسها ونصَّها ولا تسأل: أهي على الشاشة أصلًا؟** فيُلحق ههنا
     ما يسأله: ارتفاعٌ مرئيٌّ ≥ ٦٠٪ ومحتوًى داخلَ الحدود. **وورقةُ «⋯»** كانت
     بلا `card` فطارت عناصرُها فوق نصّ المصحف — فيُشترط خلفَ عناصرها **أرضيّةٌ
     معتمةٌ (شفافيّة ١)** يحملها عنصرٌ من الورقة نفسِها لا من الصفحة تحتها. */
  if (lastCdp) {
    const cdp = lastCdp;
    const MIN_PANEL_SHARE = 60;
    /** **ولا يُقاس على شجرةٍ نصفِ قائمة**: أدواتُ المصحف في الرأس تنتظر جدولَ
        السور، وهو نداءٌ غيرُ نداء الآيات — فقد تقوم صفحةُ المصحف قبلها. فيُنتظر
        الزرُّ نفسُه لا الصفحةُ وحدَها، وإلّا قيل «لا زرَّ» وإنّما هو لم يقُم بعد. */
    const openMushaf = async () => {
      await cdp.send("Page.navigate", { url: "about:blank" });
      await sleep(200);
      await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
      const ok = await cdp.until(
        `!document.querySelector('.boot') && document.querySelector('.mushaf-page')
         && document.querySelector('.rd-more-btn') && document.querySelector('.set-wrap > button')`,
      );
      await sleep(1200);
      return ok;
    };

    /** تُفتح لوحةُ الإعدادات من الرأس، فيُقاس ارتفاعُها المرئيُّ وموقعُ محتواها */
    const PANEL = `
      const wait = (t) => new Promise((r) => setTimeout(r, t));
      const btns = [...document.querySelectorAll('.set-wrap > button')];
      if (!btns.length) return { error: 'لا زرَّ إعداداتٍ في الرأس' };
      if (!document.querySelector('.set-panel.set-reading')) { btns.at(-1).click(); await wait(600); }
      const p = document.querySelector('.set-panel.set-reading');
      if (!p) return { error: 'لم تُفتح لوحةُ الإعدادات' };
      const r = p.getBoundingClientRect();
      const seen = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      /* **ومحتواها يُسأل عنه بعينه**: لوحةٌ رأسُها يُرى ومحتواها مقصوصٌ تمرّ
         بقياس الارتفاع وحدَه — فيُقاس صفَّا «حجمِ الخطّ» و«السمة» داخلَ حدودها. */
      const rows = [...p.querySelectorAll('.set-row')].slice(0, 2).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          what: (el.querySelector('.set-label')?.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 20),
          top: Math.round(b.top), bottom: Math.round(b.bottom),
          inside: b.height > 0 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1 && b.bottom <= innerHeight + 1,
        };
      });
      return {
        h: Math.round(r.height), vh: innerHeight, seen: Math.round(seen),
        share: Math.round((seen / innerHeight) * 100), rows,
      };
    `;

    /** تُفتح ورقةُ «⋯»، فيُسأل عن حاملِ الأرضيّة خلفَ كلّ عنصرٍ فيها */
    const SHEET = `
      const wait = (t) => new Promise((r) => setTimeout(r, t));
      const b = document.querySelector('.rd-more-btn');
      if (!b) return { error: 'لا زرَّ «⋯» في الرأس' };
      if (!document.querySelector('.rd-sheet')) { b.click(); await wait(600); }
      const sh = document.querySelector('.rd-sheet');
      if (!sh) return { error: 'لم تُفتح ورقةُ ⋯' };
      const alpha = (v) => {
        const p = (v.match(/[\\d.]+/g) ?? []).map(Number);
        return p.length < 4 ? (p.length ? 1 : 0) : p[3];
      };
      /** **أوّلُ سلفٍ خلفيّتُه معتمةٌ تمامًا** — وهو حاملُ الأرضيّة فعلًا؛ فإن
          كان خارجَ الورقة فما خلفَ عناصرها صفحةُ المصحف لا أرضيّةٌ لها. */
      const host = (el) => {
        for (let n = el; n; n = n.parentElement) {
          if (alpha(getComputedStyle(n).backgroundColor) >= 0.999) return n;
        }
        return null;
      };
      const rows = [...sh.querySelectorAll('.rd-sheet-row, .rd-sheet-act')].map((el) => {
        const h = host(el);
        return {
          what: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 18),
          host: h ? (h.className || h.tagName).toString().slice(0, 26) : null,
          grounded: !!h && sh.contains(h),
        };
      });
      const r = sh.getBoundingClientRect();
      const q = document.querySelector('.mushaf-page');
      const qr = q ? q.getBoundingClientRect() : null;
      /* والشفافيّةُ إنّما تُرى حيث يقع تحتها متنٌ — فيُقيَّد أنّه واقعٌ تحتها */
      const overQuran = !!qr && !(r.right <= qr.left || r.left >= qr.right || r.bottom <= qr.top || r.top >= qr.bottom);
      return { rows, n: rows.length, overQuran, alpha: alpha(getComputedStyle(sh).backgroundColor) };
    `;

    /* ── ٧أ — لوحةُ الإعدادات من الرأس ── */
    let panelClean = null;
    if (await openMushaf()) {
      panelClean = await cdp.evAsync(PANEL);
      const p = panelClean;
      if (p.error) {
        fail("لوحةُ الإعدادات من الرأس", p.error);
      } else if (p.share < MIN_PANEL_SHARE) {
        fail(
          "لوحةُ الإعدادات من الرأس",
          `ارتفاعُها المرئيُّ ${p.seen}px من ${p.vh} (${p.share}٪) — والحدُّ ${MIN_PANEL_SHARE}٪. ` +
            `وهذه صورةُ اللوحة المحبوسة في رأسٍ متحوِّل: ارتفاعُها ${p.h}px`,
        );
      } else if (!p.rows.length || p.rows.some((r) => !r.inside)) {
        fail(
          "لوحةُ الإعدادات من الرأس",
          p.rows.length
            ? `عناصرُ محتواها خارجَ حدودها المرئيّة: ${p.rows.filter((r) => !r.inside).map((r) => `«${r.what}» ${r.top}–${r.bottom}`).join(" · ")}`
            : "لا صفوفَ في محتواها تُقاس — فاللوحةُ فارغةٌ فعلًا",
        );
      } else {
        notes.push(
          `لوحةُ الإعدادات من الرأس على ٣٩٠: ارتفاعُها المرئيُّ ${p.seen}px من ${p.vh} (${p.share}٪ ≥ ${MIN_PANEL_SHARE}٪)، ` +
            `وصفّا ${p.rows.map((r) => `«${r.what}»`).join(" و")} داخلَ حدودها المرئيّة`,
        );
      }

      /* **ضبطُه السالبُ عينُ الواقعة**: تُوضع اللوحةُ في حاويةٍ ذاتِ `transform`
         بارتفاع الرأس — فيصير مرجعُ `fixed` تلك الحاويةَ لا الشاشةَ وتنهار. */
      if (!p.error) {
        await cdp.ev(`
          const p = document.querySelector('.set-panel.set-reading');
          if (!p) return false;
          const box = document.createElement('div');
          box.id = '__plantXform';
          box.style.cssText = 'transform: translateY(0px); height: 55px;';
          p.parentNode.insertBefore(box, p);
          box.appendChild(p);
          return true;
        `);
        await sleep(300);
        const trapped = await cdp.evAsync(PANEL);
        await cdp.ev(`
          const box = document.getElementById('__plantXform');
          if (!box) return false;
          const p = box.firstElementChild;
          if (p) box.parentNode.insertBefore(p, box);
          box.remove();
          return true;
        `);
        await sleep(300);
        const back = await cdp.evAsync(PANEL);
        if (trapped.error) {
          fail("ضبطُ لوحة الإعدادات", `تعثّر القياسُ بعد الزرع: ${trapped.error}`);
        } else if (!(trapped.share < MIN_PANEL_SHARE)) {
          fail(
            "ضبطُ لوحة الإعدادات",
            `زُرع \`transform\` على حاويةٍ ٥٥px فلم تنهر اللوحةُ ولم تُصطَد (${trapped.share}٪) — والفاحصُ لا يفحص`,
          );
        } else if (back.error || back.share < MIN_PANEL_SHARE) {
          fail("ضبطُ لوحة الإعدادات", "أُزيل الزرعُ فلم تعُد اللوحةُ إلى الشاشة — قياسٌ غيرُ مستقرّ");
        } else {
          notes.push(
            `ضبطٌ سالب: زُرع \`transform\` على حاويةِ اللوحة بارتفاع الرأس — فانهارت إلى ${trapped.seen}px (${trapped.share}٪) فاصطيدت، ` +
              `ثمّ أُزيل الزرعُ فعادت إلى ${back.share}٪ — وهي الواقعةُ بعينها`,
          );
        }
      }
    } else {
      missing.push("لم يقم سطحُ المصحف لقياس لوحات القشرة");
    }

    /* ── ٧ب — ورقةُ «⋯» ── */
    if (!(await openMushaf())) {
      missing.push("لم تقم أدواتُ المصحف في الرأس لقياس ورقة «⋯»");
    } else {
      const s = await cdp.evAsync(SHEET);
      if (s.error) {
        fail("ورقةُ «⋯»", s.error);
      } else if (!s.n) {
        fail("ورقةُ «⋯»", "لا عناصرَ فيها تُقاس");
      } else if (s.rows.some((r) => !r.grounded)) {
        fail(
          "ورقةُ «⋯»",
          `خلفَ عناصرها نصُّ المصحف لا أرضيّةٌ معتمة: ${s.rows.filter((r) => !r.grounded).map((r) => `«${r.what}» (حاملُها ${r.host ?? "لا شيء"})`).join(" · ")}`,
        );
      } else {
        notes.push(
          `ورقةُ «⋯» على ٣٩٠: ${s.n} عنصرًا خلفَ كلٍّ منها أرضيّةٌ معتمةٌ (شفافيّة ١) من الورقة نفسِها` +
            (s.overQuran ? " — وهي واقعةٌ فوق متن المصحف، فالشفافيّةُ لو كانت لظهر النصُّ خلفها" : ""),
        );

        /* **وضبطُه**: يُشفَّف ظهرُ الورقة فتصير أرضيّتُها الصفحةَ تحتها — فتُصطاد */
        await cdp.ev(`document.querySelector('.rd-sheet').style.background = 'transparent'; return true;`);
        await sleep(300);
        const bare = await cdp.evAsync(SHEET);
        await cdp.ev(`document.querySelector('.rd-sheet').style.removeProperty('background'); return true;`);
        await sleep(300);
        const after = await cdp.evAsync(SHEET);
        if (bare.error) {
          fail("ضبطُ ورقة «⋯»", `تعثّر القياسُ بعد الزرع: ${bare.error}`);
        } else if (!bare.rows.some((r) => !r.grounded)) {
          fail("ضبطُ ورقة «⋯»", "شُفِّف ظهرُ الورقة فلم يُصطَد — والفاحصُ لا يفحص");
        } else if (after.error || after.rows.some((r) => !r.grounded)) {
          fail("ضبطُ ورقة «⋯»", "أُزيل الزرعُ فلم تعُد الورقةُ إلى أرضيّتها — قياسٌ غيرُ مستقرّ");
        } else {
          notes.push(
            `ضبطٌ سالب: شُفِّف ظهرُ ورقة «⋯» فصار حاملُ الأرضيّة خارجَها (${bare.rows.find((r) => !r.grounded)?.host ?? "—"}) فاصطيدت، ثمّ أُعيد فعادت خضراء`,
          );
        }
      }
    }
  }


  /* ═══ ٨ — **شاهدُ «لا قسمَ ضاع»** (ف٥ §٣) ═══
     المدخلُ تغيّر والترتيبُ تغيّر — **والأبوابُ لا تنقص**. فيُعدُّ ما خلف
     «المزيد» عدًّا حيًّا على ٣٩٠: يُفتح الدُّرجُ فتُحصى مداخلُه ومجموعاتُه،
     ويُقيَّد العددُ في المخرَج فيُقابَل بما قبلَ الدفعة. **وحدٌّ سالبٌ معه**:
     نقصانُ العدد عن الأرضيّة المعلَنة يُحمِّر — فلا يسقط بابٌ صامتًا. */
  if (lastCdp) {
    const cdp = lastCdp;
    await cdp.send("Page.navigate", { url: "about:blank" });
    await sleep(200);
    await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
    const up = await cdp.until(`!document.querySelector('.boot') && document.querySelector('.menu-btn')`);
    if (!up) {
      missing.push("لم يقم زرُّ القائمة لعدّ مداخل «المزيد»");
    } else {
      await sleep(600);
      const doors = await cdp.evAsync(`
        const wait = (t) => new Promise((r) => setTimeout(r, t));
        const b = document.querySelector('.menu-btn');
        if (!b) return { error: 'لا زرَّ قائمةٍ في الرأس' };
        if (!document.querySelector('.drawer-nav')) { b.click(); await wait(600); }
        const nav = document.querySelector('.drawer-nav');
        if (!nav) return { error: 'لم يُفتح الدُّرج' };
        const groups = [...nav.querySelectorAll('.drawer-group')].map((g) => ({
          name: (g.querySelector('.drawer-group-h')?.textContent || '').trim(),
          n: g.querySelectorAll('a').length,
        }));
        return {
          total: nav.querySelectorAll('a').length,
          inGroups: groups.reduce((a, g) => a + g.n, 0),
          groups,
        };
      `);
      if (doors.error) {
        fail("شاهدُ «لا قسمَ ضاع»", doors.error);
      } else if (doors.total < MIN_DOORS) {
        fail(
          "شاهدُ «لا قسمَ ضاع»",
          `مداخلُ «المزيد» ${doors.total} — دون الأرضيّة المعلَنة ${MIN_DOORS}: سقط بابٌ. ` +
            doors.groups.map((g) => `«${g.name}» ${g.n}`).join(" · "),
        );
      } else {
        notes.push(
          `شاهدُ «لا قسمَ ضاع» على ٣٩٠: ${doors.total} مدخلًا في دُرج «المزيد» ` +
            `(${doors.inGroups} منها في ${doors.groups.length} مجموعات: ${doors.groups.map((g) => `«${g.name}» ${g.n}`).join(" · ")}) — والأرضيّةُ ${MIN_DOORS}`,
        );
      }
      /* **وضبطُه السالب**: يُنزع مدخلان من الدُّرج فيُصطاد النقصان، ثمّ يُعادان */
      const bare = await cdp.ev(`
        const nav = document.querySelector('.drawer-nav');
        if (!nav) return null;
        window.__doors = [...nav.querySelectorAll('a')].slice(0, 2).map((a) => [a, a.nextSibling, a.parentNode]);
        for (const [a] of window.__doors) a.remove();
        return nav.querySelectorAll('a').length;
      `);
      /* **والإعادةُ بالعكس**: المنزوعان متجاوران، فمرجعُ «ما بعدَ الأوّل» هو
         الثاني نفسُه — فلو أُعيد الأوّلُ قبلَ الثاني أُسند إلى عقدةٍ منزوعة. */
      await cdp.ev(`
        for (const [a, next, parent] of [...(window.__doors || [])].reverse()) {
          if (next && next.parentNode === parent) parent.insertBefore(a, next);
          else parent.appendChild(a);
        }
        return true;
      `);
      const back = await cdp.ev(`return document.querySelector('.drawer-nav')?.querySelectorAll('a').length ?? 0;`);
      if (bare == null) {
        fail("ضبطُ شاهد «لا قسمَ ضاع»", "لا دُرجَ يُنزع منه — فالضبطُ لم يقع");
      } else if (!(bare < MIN_DOORS) && !(bare < doors.total)) {
        fail("ضبطُ شاهد «لا قسمَ ضاع»", `نُزع مدخلان فلم ينقص العددُ (${bare}) — والعدُّ لا يعدّ`);
      } else if (back !== doors.total) {
        fail("ضبطُ شاهد «لا قسمَ ضاع»", `أُعيد المنزوعُ فلم يعد العددُ (${back} مقابلَ ${doors.total}) — عدٌّ غيرُ مستقرّ`);
      } else {
        notes.push(`ضبطٌ سالب: نُزع مدخلان من الدُّرج فنقص العددُ إلى ${bare} فاصطيد، ثمّ أُعيدا فعاد إلى ${back}`);
      }
    }
  }


  /* ═══ ٩ — **مدخلُ الصفحة الأولى** (ف٥ §٣ — إلحاقٌ بالقائم لا بوّابةٌ ثانية) ═══
     ثلاثةُ أحكامٍ من §١ تُحرَس بأعيانها، ولكلٍّ ضبطُه السالب:
       أ — **حقلُ الصدر واحدٌ لا حقلان**: حقلان في شاشةٍ واحدةٍ هما الحيرةُ التي
           فُتحت هذه الدفعةُ لرفعها. **يُزرع حقلٌ ثانٍ فيُصطاد.**
       ب — **بطاقاتُ المهمّة ثلاثٌ بأفعالها**: ثلاثٌ لا أكثر، وعناوينُها أفعالُ
           الطالب (افهمْ · تتبّعْ · حقّقْ) لا أسماءُ أقسام. **تُزرع رابعةٌ فتُصطاد،
           ويُبدَّل فعلٌ باسمِ قسمٍ فيُصطاد.**
       ج — **ولا لوحَ يعلو المصحف** — **وهو عينُ الجذر المحسوم**: نافذةُ الاستقبال
           `wq-overlay` كانت `fixed` تملأ الشاشة فوق المتن فتبتلع الحدثَ تحتها
           (وبها شُلَّت عجلةُ الحاسوب). **والمقيسُ ما تصيبه إصبعُ القارئ**: نقاطٌ
           في متن المصحف يُسأل عن العنصر الواقع عليها — فإن كان غيرَ المصحف فثَمَّ
           لوحٌ يعترض. **يُزرع اللوحُ بعينه فيُصطاد**، ثمّ يُرفع فتعود خضراء.
     **ولا `\b` مع العربيّة** (بلاغُ الحدود): الأفعالُ تُقابَل بصدر النصّ بعد
     تجريد حركاته، لا بحدّ كلمة. */
  if (lastCdp) {
    const cdp = lastCdp;
    const openHome = async () => {
      await cdp.send("Page.navigate", { url: "about:blank" });
      await sleep(200);
      await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/` });
      const ok = await cdp.until(`!document.querySelector('.boot') && document.querySelector('[data-home="root"]')`);
      await sleep(900);
      return ok;
    };
    /** حقلُ الصدر وبطاقاتُ المهمّة — قراءةٌ واحدةٌ لهما */
    const ENTRY = `
      const root = document.querySelector('[data-home="root"]');
      if (!root) return { error: 'لا صفحةَ أولى' };
      const fields = [...root.querySelectorAll('input, textarea')].filter((el) => {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        return el.tagName === 'TEXTAREA' || ['text', 'search', 'url', 'email', 'tel', 'number'].includes(t);
      });
      const strip = (t) => t.replace(/[\\u064B-\\u0652\\u0670]/g, '').replace(/\\s+/g, ' ').trim();
      const tasks = [...root.querySelectorAll('[data-home="task"]')].map((el) => {
        const v = el.querySelector('[data-home="task-verb"]');
        return { title: v ? strip(v.textContent || '') : null };
      });
      return {
        fields: fields.map((el) => (el.getAttribute('aria-label') || el.className || el.tagName).toString().slice(0, 30)),
        tasks,
        mushaf: !!root.querySelector('[data-home="mushaf"]'),
      };
    `;
    /** الأفعالُ المعلَنة — عنوانُ البطاقة يبدأ بأحدها، وإلّا فهو اسمُ قسمٍ لا فعلُ طالب */
    const VERBS = ["افهمْ", "تتبّعْ", "حقّقْ"];
    /** **والمقابلةُ بعد تجريد الحركات من الطرفين** — فالشدّةُ في «تتبّعْ» حركةٌ
     *  لا حرف، والمقروءُ من الصفحة مجرَّدٌ منها؛ فلو قوبل بالمشكول لم يلتقيا. */
    const bare = (t) => (t ?? "").replace(/[\u064B-\u0652\u0670]/g, "");
    const verbOf = (title) => VERBS.find((v) => bare(title).startsWith(bare(v))) ?? null;

    if (!(await openHome())) {
      missing.push("لم تقم الصفحةُ الأولى لقياس مدخلها");
    } else {
      const e = await cdp.ev(ENTRY);
      if (e.error) {
        fail("مدخلُ الصفحة الأولى", e.error);
      } else {
        /* أ — حقلٌ واحدٌ لا حقلان */
        if (e.fields.length !== 1) {
          fail(
            "حقلُ الصدر واحدٌ",
            e.fields.length
              ? `${e.fields.length} حقولٍ في الصفحة الأولى: ${e.fields.join(" · ")} — والمقرَّرُ حقلٌ جامعٌ واحد`
              : "لا حقلَ في صدر الصفحة الأولى",
          );
        } else {
          notes.push(`حقلُ الصدر واحدٌ في الصفحة الأولى (${e.fields[0]}) — لا حقلان، وهو الحقلُ الجامع`);
        }
        /* ب — ثلاثُ بطاقاتٍ بأفعالها */
        const verbs = e.tasks.map((k) => verbOf(k.title));
        if (e.tasks.length !== 3) {
          fail("بطاقاتُ المهمّة", `${e.tasks.length} بطاقةً — والمقرَّرُ ثلاثٌ لا أكثر`);
        } else if (verbs.some((v) => v == null)) {
          fail(
            "بطاقاتُ المهمّة بأفعالها",
            `عنوانٌ ليس فعلَ طالبٍ: ${e.tasks.filter((k, i) => verbs[i] == null).map((k) => `«${k.title ?? "بلا عنوان"}»`).join(" · ")} — والأفعالُ المعلَنة: ${VERBS.join(" · ")}`,
          );
        } else if (new Set(verbs).size !== 3) {
          fail("بطاقاتُ المهمّة بأفعالها", `فعلٌ مكرَّرٌ في البطاقات: ${verbs.join(" · ")}`);
        } else {
          notes.push(
            `بطاقاتُ المهمّة ثلاثٌ بأفعالها: ${e.tasks.map((k) => `«${k.title}»`).join(" · ")}` +
              (e.mushaf ? " — وفوقَها بطاقةُ المصحف بموضعها" : " — **ولا بطاقةَ مصحفٍ**"),
          );
        }
        if (!e.mushaf) fail("بطاقةُ المصحف", "لا بطاقةَ للمصحف في الصفحة الأولى — والقراءةُ بابُ مشكاة الثاني");

        /* ضبطُهما السالب: حقلٌ ثانٍ، وبطاقةٌ رابعةٌ، وفعلٌ يُبدَّل باسمِ قسم */
        await cdp.ev(`
          const root = document.querySelector('[data-home="root"]');
          const inp = document.createElement('input');
          inp.id = '__plantField'; inp.type = 'search'; inp.setAttribute('aria-label', 'حقلٌ مزروع');
          root.appendChild(inp);
          const extra = document.createElement('section');
          extra.id = '__plantTask'; extra.setAttribute('data-home', 'task');
          const v = document.createElement('span');
          v.setAttribute('data-home', 'task-verb'); v.textContent = 'قسمُ المواضيع';
          extra.appendChild(v);
          root.appendChild(extra);
          const first = root.querySelector('[data-home="task-verb"]');
          window.__verbWas = first.textContent;
          first.textContent = 'الأقسامُ والأدوات';
          return true;
        `);
        await sleep(250);
        const planted = await cdp.ev(ENTRY);
        await cdp.ev(`
          document.getElementById('__plantField')?.remove();
          document.getElementById('__plantTask')?.remove();
          const first = document.querySelector('[data-home="task-verb"]');
          if (first && window.__verbWas) first.textContent = window.__verbWas;
          return true;
        `);
        await sleep(250);
        const after = await cdp.ev(ENTRY);
        const caughtField = planted.fields.length > 1;
        const caughtCount = planted.tasks.length > 3;
        const caughtVerb = planted.tasks.some((k) => verbOf(k.title) == null);
        if (!caughtField) fail("ضبطُ مدخل الصفحة الأولى", "زُرع حقلٌ ثانٍ فلم يُصطَد — والفاحصُ لا يفحص");
        if (!caughtCount) fail("ضبطُ مدخل الصفحة الأولى", "زُرعت بطاقةٌ رابعةٌ فلم تُصطَد");
        if (!caughtVerb) fail("ضبطُ مدخل الصفحة الأولى", "بُدِّل فعلُ بطاقةٍ باسمِ قسمٍ فلم يُصطَد");
        if (caughtField && caughtCount && caughtVerb) {
          notes.push(
            `ضبطٌ سالب: زُرع حقلٌ ثانٍ (فصارا ${planted.fields.length}) وبطاقةٌ رابعةٌ (فصرن ${planted.tasks.length}) وبُدِّل فعلٌ باسمِ قسمٍ — فاصطادت البوّابةُ الثلاثةَ`,
          );
        }
        if (after.fields.length !== 1 || after.tasks.length !== 3 || after.tasks.some((k) => verbOf(k.title) == null)) {
          fail("ضبطُ مدخل الصفحة الأولى", "أُزيل الزرعُ فلم تعُد الصفحةُ كما كانت — قياسٌ غيرُ مستقرّ");
        } else {
          notes.push("وأُزيل الزرعُ فعادت الصفحةُ الأولى حقلًا واحدًا وثلاثَ بطاقاتٍ بأفعالها — قياسٌ مستقرّ");
        }
      }
    }

    /* ── ج — **ولا لوحَ يعلو المصحف**: يُسأل عمّا تصيبه إصبعُ القارئ في المتن ── */
    const VEIL = `
      const q = document.querySelector('.mushaf-page');
      if (!q) return { error: 'لا صفحةَ مصحفٍ تُقاس' };
      const r = q.getBoundingClientRect();
      /* **النقاطُ في المرئيِّ من المتن**: ما خرج من النافذة لا يُسأل عنه أصلًا */
      const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
      if (bottom - top < 40) return { error: 'متنُ المصحف خارجَ النافذة' };
      const x = Math.round(r.left + r.width / 2);
      const pts = [0.25, 0.5, 0.75].map((f) => [x, Math.round(top + (bottom - top) * f)]);
      const covers = [];
      for (const [px, py] of pts) {
        const el = document.elementFromPoint(px, py);
        if (!el || el === q || q.contains(el)) continue;
        const st = getComputedStyle(el);
        covers.push({
          what: (el.getAttribute('aria-label') || el.className || el.tagName).toString().replace(/\\s+/g, ' ').slice(0, 30),
          pos: st.position, z: st.zIndex, at: px + '×' + py,
        });
      }
      return { covers, n: pts.length, pts: pts.map((p) => p.join('×')) };
    `;
    await cdp.send("Page.navigate", { url: "about:blank" });
    await sleep(200);
    await cdp.send("Page.navigate", { url: `http://localhost:${PORT}/#/read/2` });
    const shown = await cdp.until(`!document.querySelector('.boot') && document.querySelector('.mushaf-page')`);
    if (!shown) {
      missing.push("لم يقم سطحُ المصحف لقياس ما يعلوه");
    } else {
      await sleep(1500);
      const v = await cdp.ev(VEIL);
      if (v.error) {
        fail("لوحٌ يعلو المصحف", v.error);
      } else if (v.covers.length) {
        fail(
          "لوحٌ يعلو المصحف",
          `نقرةُ القارئ في المتن تقع على غيره: ${v.covers.map((c) => `${c.what} [${c.pos}، طبقة ${c.z}] عند ${c.at}`).join(" · ")}`,
        );
      } else {
        notes.push(
          `لا لوحَ يعلو المصحف: ${v.n} نقاطٍ في متنه (${v.pts.join(" · ")}) تقع كلُّها على المصحف نفسِه — ونافذةُ الاستقبال رُفعت إلى سطرٍ في الصفحة الأولى`,
        );
      }
      /* **وضبطُه عينُ الواقعة**: تُزرع النافذةُ الزائلةُ بهيئتها فتُصطاد، ثمّ تُرفع */
      await cdp.ev(`
        const o = document.createElement('div');
        o.id = '__plantVeil'; o.className = 'wq-overlay';
        o.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgb(20 17 12 / 0.45)';
        document.body.appendChild(o);
        return true;
      `);
      await sleep(300);
      const veiled = await cdp.ev(VEIL);
      await cdp.ev(`document.getElementById('__plantVeil')?.remove(); return true;`);
      await sleep(300);
      const lifted = await cdp.ev(VEIL);
      if (veiled.error) {
        fail("ضبطُ اللوح فوق المصحف", `تعثّر القياسُ بعد الزرع: ${veiled.error}`);
      } else if (veiled.covers.length !== veiled.n) {
        fail("ضبطُ اللوح فوق المصحف", `زُرعت نافذةُ الاستقبال فوق المتن فلم تُصطَد إلّا في ${veiled.covers.length} من ${veiled.n} — والفاحصُ لا يفحص`);
      } else if (lifted.error || lifted.covers.length) {
        fail("ضبطُ اللوح فوق المصحف", "رُفع الزرعُ فلم تعُد البوّابةُ خضراء — قياسٌ غيرُ مستقرّ");
      } else {
        notes.push(
          `ضبطٌ سالب: زُرعت نافذةُ الاستقبال (\`wq-overlay\` بهيئتها: \`fixed\` تملأ الشاشة في الطبقة ٨٠) فوق المتن — فوقعت عليها النقاطُ الثلاثُ كلُّها فاصطيدت، ثمّ رُفعت فعادت خضراء`,
        );
      }
    }
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
      scope:
        "الصفحاتُ الأساسيّة وحدَها (المصحف · التتبّع · الإعدادات · القشرة) — والصفحاتُ الداخلةُ خارجُ النطاق بحدّ المالك، لم تُفحص ولم يُقل إنّها مرّت. " +
        "**والقياسُ الحيُّ على مشكاة وحدَها**؛ وأمّا «التلاوة» فيسري عليها الفحصُ الساكنُ وحدَه (لا حوارات · لا أرقامَ خطٍّ في JSX) — وحراستُها الحيّةُ تُبنى في ف٣، فلا يُقال إنّها قِيست حيّةً فمرّت",
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

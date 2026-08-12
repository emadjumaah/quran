/**
 * الفاحصُ الدائمُ لبوّابات مشكاة — **بوّابةٌ لم تُدقَّق هي نفسُها ليست بوّابة.**
 *
 * تثبيتُ عقد بلاغَي المجموعة `2026-08-12-arabic-word-boundary` و`…-python`:
 * في JavaScript لا يتحقّق حدُّ الكلمة `\b` بعد حرفٍ عربيّ (فالعربيُّ ليس من
 * `\w`)، ويتحقّق قبل الرمز اللاتينيِّ ولو التصق به حرفٌ عربيّ قبلَه — فمعناه
 * يختلف باختلاف الجوار. فالعرفُ الواحدُ في اللسانين: **حدودٌ صريحة، ولا `\b`
 * في بوّابةٍ تلمس نصًّا عربيًّا.**
 *
 * وأخو هذا الملفِّ في مستودع التاريخ `scripts/gate_selfcheck.py` — بناؤه
 * الثلاثيُّ محتذًى هنا لا منقول، ومزيدُه رابعٌ اقتضته شجرتُنا (إعلاناتُ الحراس).
 *
 * أربعةُ فحوص:
 *   ١ — **عيوبٌ مزروعة**: لكلِّ نمطِ منعٍ عيّنتان — **مفصولةٌ وملتصقةٌ بحرفٍ
 *       عربيّ** — وحكمٌ منتظرٌ لكلٍّ. والملتصقةُ هي التي تفضح البوّابةَ
 *       المتساهلة. والتضييقُ المقصودُ الموثَّق (التماسُ الكلمة تامّةً في
 *       `fahis-lint`) يُثبَّت على سلوكه بعيّنة `want=false` وسطرِ سببه —
 *       فالفحصُ يحرس الوجهين: لا يتساهل الحارسُ ولا يتشدّد على غير بابه.
 *   ٢ — **ترتيبُ النطاقات المخزون**: كلُّ `[أ-ب]` عربيٍّ في سكربتاتنا وواجهتنا
 *       يُفحص بقيم `codepoints` المخزونة (درسُ خ٢: إعادةُ ترتيب bidi تقلب
 *       المعروضَ لا المخزون — والفيصلُ المخزون).
 *   ٣ — **الحظرُ الساكن**: لا `\b` في سكربتات البوّابات (`check-*` · `fahis-*`
 *       · `gates-*` · هذا الملفّ). التعليقاتُ تُنزع أوّلًا: شرحُ العيب القديم
 *       ليس عيبًا.
 *   ٤ — **إعلاناتُ الحراس**: الحيُّ (`check-tarikh-nopush`) حيٌّ لا مؤرشف،
 *       والمؤرشفُ (`check-tarikh-nopublish`) باقٍ على إعلانه: لا يكتب نجاحًا
 *       لفحصٍ لم يقع (`ok: null`)، ويسمّي خَلَفَه الحيّ.
 *
 * **والأنماطُ تُجتزأ من نصِّ البوّابة الحيِّ نفسِه لا نسخةً عنه** — فلو غُيّر
 * نمطٌ في مصدره تغيّر المفحوصُ معه في الحال، ولو زال أعلن الفاحصُ فقدَه ولم
 * يمرّ صامتًا. وهذا أوثقُ من نسخِ النمط هنا: النسخةُ تشيخ في صمت.
 *
 * التشغيل: node js/scripts/gate-selfcheck.mjs → js/data/gates/GATE-SELFCHECK.json
 * ويستدعيه `fahis-lint.mjs --sync` حيث تجري المسابر — فالبوّابةُ واحدة.
 */
import { mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPTS = join(ROOT, "js", "scripts");
const GATES = join(ROOT, "js", "data", "gates");
const OUT = join(GATES, "GATE-SELFCHECK.json");

/** سكربتاتُ البوّابات التي يقع عليها الحظرُ الساكن (الفحص ٣) */
const GATE_GLOB = /^(?:check-|fahis-|gates-|gate-selfcheck)/;
/** ما يُمسح فيه ترتيبُ النطاقات (الفحص ٢) */
const RANGE_ROOTS = [
  ["js/scripts", false],
  ["js/apps/studio/src", true],
  ["js/apps/studio/api", true],
];

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/* ═══════════ أدواتُ الاجتزاء من المصدر الحيّ ═══════════ */

const missing = [];

/**
 * أوّلُ نمطٍ حرفيٍّ في السطر الحامل للعلامة — ماسحٌ يفهم المهارب وأصنافَ
 * المحارف، فلا يقطعه `\/` ولا `/` داخلَ `[…]`.
 */
const RE_LITERAL = /\/((?:[^/\\[\n]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([a-z]*)/;

function pluckRegex(rel, marker, where) {
  const lines = read(rel).split("\n").filter((l) => l.includes(marker));
  if (lines.length !== 1) {
    missing.push(`${where}: علامةُ الاجتزاء «${marker}» وقعت ${lines.length} مرّةً في ${rel} لا مرّةً واحدة`);
    return null;
  }
  const m = RE_LITERAL.exec(lines[0]);
  if (!m) { missing.push(`${where}: لا نمطَ حرفيًّا في سطر «${marker}» من ${rel}`); return null; }
  try { return new RegExp(m[1], m[2]); } catch (e) { missing.push(`${where}: نمطٌ لا يُبنى (${e.message})`); return null; }
}

/** قائمةُ سلاسلَ مُعلَنةٌ في المصدر — تُقرأ ولا يُنفَّذ من الملفّ شيء */
function pluckList(rel, decl, where) {
  const m = new RegExp(`${decl}\\s*(\\[[^\\]]*\\])`).exec(read(rel));
  if (!m) { missing.push(`${where}: لم تُوجد القائمة «${decl}» في ${rel}`); return null; }
  try { return JSON.parse(m[1]); } catch (e) { missing.push(`${where}: قائمةٌ لا تُقرأ (${e.message})`); return null; }
}

/**
 * **تثبيتُ المرآة**: ما لا يكون نمطًا حرفيًّا يُقارَن بأصله في المصدر نصًّا.
 *
 * فقوائمُ `fahis-lint` تُلتمس بمقارنةٍ مكتوبةٍ في سطرِ حلقةٍ لا في نمطٍ يُجتزأ —
 * فتُحاكى محاكاةً هنا. والمحاكاةُ تشيخ في صمتٍ لو غُيّر السطرُ في مصدره، وهي
 * علّةٌ اصطادها الضبطُ السالبُ في أوّل صياغةٍ لهذا الفاحص: بُدّل حدُّ الالتماس
 * في `fahis-lint` فلم تشعر المرآة. فصار كلُّ سطرِ التماسٍ يُشترط بحرفه:
 * إن تغيّر، أعلن الفاحصُ أنّ المحاكاة لم تعد تطابق أصلَها — فتُراجَع عمدًا.
 */
function pinMirror(rel, exact, where) {
  if (!read(rel).includes(exact)) {
    missing.push(`${where}: حدُّ الالتماس في ${rel} لم يعد «${exact}» — المحاكاةُ هنا لم تعد تطابق أصلَها، فتُراجَع`);
    return false;
  }
  return true;
}

/* ═══════════ الفحص ١ — العيوبُ المزروعة ═══════════ */

const CT = "js/scripts/check-tarikh.mjs";
const CD = "js/scripts/check-docs-sections.mjs";
const FL = "js/scripts/fahis-lint.mjs";

/** حرفٌ عربيٌّ يُلصق بالعيّنة — صورةُ التسرّب الأشيع («بخ٧»، «وهذهدعوى») */
const sample = (rx) => (s) => !!rx && new RegExp(rx.source, rx.flags.replace("g", "")).test(s);

function planted() {
  const rows = [];
  const add = (name, hit, spaced, glued, wantGlued, why = null) =>
    rows.push({ name, hit, spaced, glued, wantGlued, why });

  // ── بوّابةُ باب جمع القرآن: عائلةُ «نظافة العرض» ──
  const HEX = "a".repeat(40);
  add("check-tarikh/SESSION_CODE", sample(pluckRegex(CT, "const SESSION_CODE =", "SESSION_CODE")),
    "وذلك من عمل خ٧/ب في حينه", "وذلكبخ٧/ب في حينه", true);
  add("check-tarikh/اسمُ نموذجٍ أو محرِّر", sample(pluckRegex(CT, '"اسمُ نموذجٍ أو محرِّر"', "INTERNAL/نموذج")),
    "كتبها Claude في حينه", "كتبهاClaude", true);
  add("check-tarikh/مسارُ ملفٍّ في مستودع البحث", sample(pluckRegex(CT, '"مسارُ ملفٍّ في مستودع البحث"', "INTERNAL/مسار")),
    "والتفصيلُ في findings/FAHIS-PLAN.md هنا", "والتفصيلُfindings/FAHIS-PLAN.md", true);
  add("check-tarikh/اسمُ ملفٍّ داخليّ", sample(pluckRegex(CT, '"اسمُ ملفٍّ داخليّ"', "INTERNAL/ملفّ")),
    "انظر HOLDOUT-MOTZKI هناك", "انظرHOLDOUT-MOTZKI", true);
  add("check-tarikh/بصمةٌ أو إيداعة", sample(pluckRegex(CT, '"بصمةٌ أو إيداعة"', "INTERNAL/بصمة")),
    `البصمةُ ${HEX} هنا`, `البصمةُ${HEX}`, true);
  add("check-tarikh/بصمةٌ — تجزئةٌ كاملة", sample(pluckRegex(CT, '"بصمةٌ أو إيداعة"', "INTERNAL/بصمة٢")),
    `البصمةُ ${HEX} هنا`, `${"a".repeat(64)}`, false,
    "أربعون محرفًا هي بصمةُ الإيداعة؛ والتجزئةُ الكاملةُ تُصطاد بمفتاحها «sha256» في الفرع الأوّل من النمط نفسِه");
  add("check-tarikh/لسانُ «دعوى» في مصدر العرض", sample(pluckRegex(CT, '.test(B_SHOWN ?? "")', "لسان الدعوى")),
    "وهذه دعوى مردودة", "وهذهدعوى مردودة", true);

  // ── بوّابةُ صفحة التوثيق (ج٠) ──
  add("check-docs/SESSION_CODE", sample(pluckRegex(CD, "const SESSION_CODE =", "docs/SESSION_CODE")),
    "وهذا من عمل خ٧ هنا", "أنجزتها الجلسةخ٧", true);
  add("check-docs/MODELS (عربيّ)", sample(pluckRegex(CD, "const MODELS =", "docs/MODELS/ar")),
    "كتبها كلود في حينه", "كتبهاكلود", true);
  add("check-docs/MODELS (لاتينيّ)", sample(pluckRegex(CD, "const MODELS =", "docs/MODELS/en")),
    "Produced with Claude here", "أنجزهاClaude", true);
  add("check-docs/PATHS", sample(pluckRegex(CD, "const PATHS =", "docs/PATHS")),
    "والتفصيلُ في findings/A.md هنا", "والتفصيلُfindings/A.md", true);

  // ── قوائمُ فاحص: الالتماسُ كلمةً تامّةً — تضييقٌ مقصودٌ موثَّقٌ يُثبَّت ──
  const tokRe = pluckRegex(FL, "const tokenize =", "fahis/tokenize");
  const stripRe = pluckRegex(FL, "const strip =", "fahis/strip");
  const TONE = pluckList(FL, "const TONE =", "fahis/TONE");
  const T_HARD = pluckList(FL, "const TAFSIR_HARD =", "fahis/TAFSIR_HARD");
  const T_SOFT = pluckList(FL, "const TAFSIR_SOFT =", "fahis/TAFSIR_SOFT");
  const strip = (s) => (stripRe ? s.replace(new RegExp(stripRe.source, "gu"), "") : s);
  const toks = (s) => (tokRe ? strip(s).split(tokRe).filter(Boolean) : []);
  const WHOLE = "الالتماسُ كلمةً تامّةً لا جزءَ كلمةٍ — تضييقٌ مقصودٌ منصوصٌ في المصدر (لا حدَّ `\\b` أصلًا هنا): وإلّا لحُظر «إبراهيم» وهو اسمُ نبيّ";
  // حدودُ الالتماس الخمسةُ مثبَّتةٌ بحروفها — وإلّا شاخت المحاكاةُ في صمت
  pinMirror(FL, "for (const bad of TONE) if (toks.includes(strip(bad)))", "fahis/حدّ TONE");
  pinMirror(FL, "for (const bad of TAFSIR_HARD) if (joined.includes(bad))", "fahis/حدّ TAFSIR_HARD");
  pinMirror(FL, "for (const bad of TAFSIR_SOFT) if (toks.includes(bad))", "fahis/حدّ TAFSIR_SOFT");
  pinMirror(FL, "for (const s of roster.singles) if (toks.includes(strip(s)))", "fahis/حدّ المفرد");
  pinMirror(FL, "for (const p of roster.pairs) if (joined.includes(strip(p)))", "fahis/حدّ الثنائيّ");

  add("fahis-lint/TONE عبر tokenize", (s) => !!TONE && toks(s).some((t) => TONE.map(strip).includes(t)),
    "وهذه دعوى مردودة", "وهذهدعوى مردودة", false, WHOLE);
  add("fahis-lint/TAFSIR_HARD عبر includes", (s) => !!T_HARD && T_HARD.some((b) => strip(s).includes(b)),
    "قال الطبري في تفسيره", "قالالطبري في تفسيره", true);
  add("fahis-lint/TAFSIR_SOFT عبر tokenize", (s) => !!T_SOFT && toks(s).some((t) => T_SOFT.includes(t)),
    "وما في التفاسير من قول", "ومافيالتفاسير من قول", false, WHOLE);

  // أسماءُ الباحثين: السجلُّ محلّيٌّ لا يُرفع — فإن غاب أُعلن التخطّي ولم يُسكت عنه
  const ROSTER = join(ROOT, "research", "roster.json");
  let rosterNote = null;
  if (!existsSync(ROSTER)) {
    rosterNote = "research/roster.json غيرُ حاضرٍ هنا — عيّنتا أسماء الباحثين لم تُزرعا (السجلُّ محلّيٌّ لا يُودَع)";
  } else {
    const COMMON = new Set(pluckList(FL, "const COMMON = new Set\\(", "fahis/COMMON") ?? []);
    const names = JSON.parse(readFileSync(ROSTER, "utf8")).researchers.map((r) => r.name);
    // مرآةٌ مقصودةٌ لبِنيةِ `rosterTokens`: القائمةُ من الملفّ الحيّ، والمفحوصُ
    // هو **حدُّ الالتماس** في وجهيه (المفردُ بالتقطيع، والثنائيُّ بالاحتواء)
    const singles = new Set(), pairs = new Set();
    for (const n of names) {
      const parts = n.replace(/[«»]/g, "").split(/\s+/);
      for (const p of parts) if (!COMMON.has(p)) singles.add(p);
      for (let i = 0; i + 1 < parts.length; i++) pairs.add(`${parts[i]} ${parts[i + 1]}`);
    }
    const one = [...singles][0], two = [...pairs][0];
    add("fahis-lint/اسمُ باحثٍ مفردٌ عبر tokenize", (s) => toks(s).includes(strip(one)),
      `وقال ${one} في ذلك`, `وقال${one} في ذلك`, false, WHOLE);
    add("fahis-lint/اسمُ باحثٍ ثنائيٌّ عبر includes", (s) => strip(s).includes(strip(two)),
      `وقال ${two} في ذلك`, `وقال${two} في ذلك`, true);
  }

  const bad = [];
  for (const r of rows) {
    if (!r.hit(r.spaced)) bad.push(`${r.name}: العيبُ المفصولُ أفلت — «${r.spaced}»`);
    const got = r.hit(r.glued);
    if (got !== r.wantGlued) {
      bad.push(r.wantGlued
        ? `${r.name}: الملتصقُ بحرفٍ عربيٍّ أفلت — «${r.glued}»`
        : `${r.name}: الملتصقُ اصطيد وحقُّه الإفلاتُ الموثَّق — «${r.glued}» (${r.why})`);
    }
  }
  return {
    bad, note: rosterNote,
    rows: rows.map(({ name, spaced, glued, wantGlued, why }) => ({ name, spaced, glued, wantGlued, why })),
  };
}

/* ═══════════ الفحص ٢ — ترتيبُ النطاقات المخزون ═══════════ */

const AR_BLOCK = (c) => c >= 0x0600 && c <= 0x06ff;

/**
 * أصنافُ المحارف المرشَّحة: `[…]` خالٍ من علامات الاقتباس والفواصل والأقواس
 * المعقوفة — فيخرج بذلك ما ليس صنفَ محارف (مصفوفةٌ نصّيّةٌ نحو `["خ٧-ب"]`
 * كانت تُقرأ نطاقًا معكوسًا كاذبًا)، ويبقى كلُّ صنفٍ حقيقيّ.
 */
const CLASS_RE = /\[(?:[^[\]\\\n"'`,{}]|\\.)*\]/g;

/**
 * كلُّ نطاقٍ داخل الصنف لا الصنفَ ذا النطاق الواحد فحسب — فـ`[٠-٩0-9]` فيه
 * نطاقان، وكان الماسحُ الأوّل يعميان عنه جميعًا (اصطاده الضبطُ السالب).
 * والمهاربُ تُفكّ: `\uXXXX` وأخواتُها محرفٌ واحد، و`\-` ليس أداةَ مدًى.
 */
function rangesIn(body) {
  const items = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\") {
      const u = /^\\u\{?([0-9a-fA-F]{1,6})\}?/.exec(body.slice(i));
      if (u) { items.push({ ch: String.fromCodePoint(parseInt(u[1], 16)), esc: true }); i += u[0].length - 1; continue; }
      const x = /^\\x([0-9a-fA-F]{2})/.exec(body.slice(i));
      if (x) { items.push({ ch: String.fromCharCode(parseInt(x[1], 16)), esc: true }); i += x[0].length - 1; continue; }
      items.push({ ch: body[i + 1] ?? "", esc: true }); i++; continue;
    }
    items.push({ ch: body[i], esc: false });
  }
  const out = [];
  for (let k = 1; k + 1 < items.length; k++) {
    if (items[k].ch === "-" && !items[k].esc) out.push([items[k - 1].ch, items[k + 1].ch]);
  }
  return out;
}

function walk(dir, deep, out) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (deep && !["node_modules", "dist"].includes(e.name)) walk(p, deep, out); }
    else if (/\.(mjs|ts|tsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function ranges() {
  const bad = [];
  let files = 0, seen = 0;
  for (const [rel, deep] of RANGE_ROOTS) {
    for (const p of walk(join(ROOT, rel), deep, [])) {
      files++;
      // التعليقاتُ تُعمَّى هنا أيضًا: شرحُ نطاقٍ تالفٍ ليس نطاقًا يعمل
      const lines = blankComments(readFileSync(p, "utf8")).split("\n");
      lines.forEach((line, i) => {
        for (const cls of line.match(CLASS_RE) ?? []) {
          for (const [x, y] of rangesIn(cls.slice(1, -1))) {
            const a = x.codePointAt(0), b = y.codePointAt(0);
            if (a === undefined || b === undefined) continue;
            if (!AR_BLOCK(a) && !AR_BLOCK(b)) continue;
            seen++;
            const hex = (n) => `U+${n.toString(16).toUpperCase().padStart(4, "0")}`;
            if (a > b) bad.push(`${p.slice(ROOT.length + 1)}:${i + 1}: نطاقٌ معكوسُ المخزون [${hex(a)}-${hex(b)}] في «${cls}»`);
          }
        }
      });
    }
  }
  return { bad, files, seen };
}

/* ═══════════ الفحص ٣ — الحظرُ الساكن ═══════════ */

/** تعميةُ التعليقات مع حفظ أرقام الأسطر — المفحوصُ كودٌ يعمل لا شرحٌ يُقرأ */
const blankComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/^([ \t]*)\/\/.*$/gm, (m, w) => w + " ".repeat(Math.max(0, m.length - w.length)));

function wordBoundary() {
  const bad = [];
  let files = 0;
  for (const fn of readdirSync(SCRIPTS).sort()) {
    if (!fn.endsWith(".mjs") || !GATE_GLOB.test(fn)) continue;
    files++;
    blankComments(readFileSync(join(SCRIPTS, fn), "utf8")).split("\n").forEach((line, i) => {
      if (/(?<!\\)\\b/.test(line)) bad.push(`${fn}:${i + 1}: حدُّ كلمةٍ في سكربت بوّابة — الحدودُ تُكتب صريحةً`);
    });
  }
  return { bad, files };
}

/* ═══════════ الفحص ٤ — إعلاناتُ الحراس ═══════════ */

function guards() {
  const bad = [];
  const live = "js/scripts/check-tarikh-nopush.mjs";
  const arch = "js/scripts/check-tarikh-nopublish.mjs";
  const L = read(live), A = read(arch);
  // الحيُّ: فرعُه `main`، ولا مهربَ أرشفةٍ فيه، وخروجُه معقودٌ بحكمه
  if (!/const BRANCH = "main";/.test(L)) bad.push(`${live}: الحارسُ الحيُّ ليس على فرع main`);
  if (/archived:\s*true/.test(L)) bad.push(`${live}: الحارسُ الحيُّ يحمل مهربَ أرشفةٍ — الحيُّ يفحص أو يسقط`);
  if (!/process\.exit\(report\.ok \? 0 : 1\)/.test(L)) bad.push(`${live}: خروجُ الحارس الحيِّ غيرُ معقودٍ بحكمه`);
  // المؤرشف: باقٍ على إعلانه — لا يكتب نجاحًا لفحصٍ لم يقع، ويسمّي خَلَفَه
  if (!/archived:\s*true/.test(A)) bad.push(`${arch}: إعلانُ الأرشفة سقط`);
  if (!/ok:\s*null/.test(A)) bad.push(`${arch}: المؤرشفُ لا يكتب ok: null — وسكوتُه يُقرأ إجازةً`);
  if (/ok:\s*true/.test(A)) bad.push(`${arch}: المؤرشفُ يكتب نجاحًا لفحصٍ لم يقع`);
  if (!A.includes("check-tarikh-nopush.mjs")) bad.push(`${arch}: المؤرشفُ لا يسمّي خَلَفَه الحيّ`);
  return { bad, live, arch };
}

/* ═══════════ التشغيل ═══════════ */

export async function runSelfcheck({ quiet = false } = {}) {
  const p = planted(), r = ranges(), w = wordBoundary(), g = guards();
  const res = {
    "١ العيوب المزروعة": {
      مزروع: p.rows.length, أفلت: [...missing, ...p.bad],
      ملاحظة: p.note, pass: missing.length === 0 && p.bad.length === 0, عيّنات: p.rows,
    },
    "٢ ترتيب النطاقات": { ملفّات: r.files, مفحوص: r.seen, معكوس: r.bad, pass: r.bad.length === 0 },
    "٣ لا حدَّ كلمةٍ في البوّابات": { ملفّات: w.files, مخالف: w.bad, pass: w.bad.length === 0 },
    "٤ إعلانات الحراس": { الحيّ: g.live, المؤرشف: g.arch, مخالف: g.bad, pass: g.bad.length === 0 },
  };
  const ok = Object.values(res).every((v) => v.pass);
  res.الفحص = ok ? "اجتاز" : "لم يجتز";
  mkdirSync(GATES, { recursive: true });
  writeFileSync(OUT, JSON.stringify(res, null, 2));
  if (!quiet) {
    for (const [k, v] of Object.entries(res)) {
      if (typeof v !== "object") continue;
      const flat = Object.fromEntries(Object.entries(v).filter(([a, b]) => !Array.isArray(b) && a !== "pass" && b != null));
      console.log(`${v.pass ? "✓" : "✗"} ${k} — ${JSON.stringify(flat, null, 0)}`);
      // تُطبع قوائمُ المخالفات وحدَها (سلاسلُ نصّ)؛ وأمّا جردُ العيّنات فللتقرير
      for (const list of Object.values(v)) {
        if (Array.isArray(list)) for (const x of list) if (typeof x === "string") console.log(`    ★ ${x}`);
      }
    }
    console.log(`${ok ? "✓" : "✗"} الفاحصُ الدائم: ${res.الفحص} — التقرير: ${OUT}`);
  }
  return { ok, res };
}

if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok } = await runSelfcheck();
  process.exit(ok ? 0 : 1);
}

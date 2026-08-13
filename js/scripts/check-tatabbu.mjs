/**
 * بوّابةُ «التتبّع بالصوت» — **نصُّ المصحف يُعرض من قاعدتنا، لا من الشيفرة.**
 *
 * صفحةُ المسبار تعرض كلماتِ المصحف واحدةً واحدة ليجري المؤشّرُ عليها. فوجب أن
 * يُحرَس الوجهان: أن يكون المعروضُ **مأخوذًا من القاعدة حرفًا بلا تحويل**، وألّا
 * يكون في الشيفرة **حرفُ قرآنٍ مكتوبٌ بيد** يُعرض للقارئ. أربعةُ فحوص:
 *
 *   ١ — **لا نصَّ قرآنٍ في شيفرة المسبار**: يُنزع التعليقُ أوّلًا (شرحُ الشيفرة
 *       ليس معروضًا، وقد يقتضي الاستشهادَ بموضعٍ من المصحف)، ثمّ يُمسح ما بقي:
 *       كلُّ ثلاث كلماتٍ متتاليةٍ فيه تُوافق ثلاثًا متتاليةً في آيةٍ **مخالفةٌ**
 *       تُسمَّى بموضعها. والثلاثُ حدٌّ مقصود: الكلمةُ والكلمتان تقعان في كلام
 *       الناس، والثلاثُ المتتاليةُ نصٌّ منقول.
 *   ٢ — **حرفيّةُ المعروض**: كلُّ مسٍّ لـ`textUthmani` في شيفرة المسبار محصورٌ
 *       في صورٍ معدودةٍ معلنة، ليس فيها تحويلٌ على الرسم — لا `replace` ولا
 *       `normalize` ولا قصٌّ ولا زيادة. فما في القاعدة هو ما يُعرض.
 *   ٣ — **تمامُ المقطع**: كلماتُ كلِّ آيةٍ في القاعدة، مجموعةً، تُساوي نصَّ
 *       الآية نفسِها بعد التطبيع. وفي مادّتنا خمسةُ مواضعَ تختلف اختلافَ حدِّ
 *       كلمةٍ لا اختلافَ نصّ — **مستثناةٌ باسمها وعلّتِها**؛ فإن زاد موضعٌ
 *       سقطت البوّابة، وإن زال مستثنًى أعلنت فقدَه ولم تمرّ صامتة.
 *   ٤ — **مُطبِّعٌ واحدٌ على الطرفين**: شيفرةُ المسبار لا تُنشئ مطبِّعًا ثانيًا
 *       (لا صنفَ حروفٍ عربيًّا ولا تجريدَ ضبطٍ من عندها)، بل تستورد `normalizeAr`
 *       من محلِّل العربيّة. وهذا عقدُ بلاغ الحدود: المصطلحُ يمرّ بمطبِّع النصّ.
 *
 * **والمُطبِّعُ الذي تحكم به هذه البوّابةُ يُجتزأ من مصدره الحيّ** لا نسخةً
 * عنه — فلو بُدّل تبدّل المفحوصُ معه في الحال، ولو زال أعلنت البوّابةُ فقدَه.
 * والنسخةُ تشيخ في صمت.
 *
 * التشغيل: node js/scripts/check-tatabbu.mjs → js/data/gates/TATABBU.json
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SAWT = join(ROOT, "js", "apps", "studio", "src", "lib", "sawt");
const OUT = join(ROOT, "js", "data", "gates", "TATABBU.json");

const read = (p) => readFileSync(p, "utf8");

/** ملفّاتُ المسبار التي يقع عليها الفحص */
const FILES = [
  ["align", join(SAWT, "align.ts")],
  ["script", join(SAWT, "script.ts")],
  ["metrics", join(SAWT, "metrics.ts")],
  ["recognizer", join(SAWT, "recognizer.ts")],
  ["vad", join(SAWT, "vad.ts")],
  ["runs", join(SAWT, "runs.ts")],
  ["view", join(ROOT, "js", "apps", "studio", "src", "views", "Tatabbu.tsx")],
];

const failures = [];
const missing = [];
const fail = (check, detail) => failures.push({ check, detail });

/* ═══════════ المُطبِّعُ مجتزأً من مصدره الحيّ ═══════════ */

const ANALYZER = join(ROOT, "js", "apps", "studio", "src", "lib", "arabicSearch.ts");
const analyzerSrc = read(ANALYZER);

function liveNormalizer() {
  const marks = analyzerSrc.match(/const MARKS = (\/.*\/g);/);
  const fn = analyzerSrc.match(
    /export function normalizeAr\(s: string\): string \{\n([\s\S]*?)\n\}/,
  );
  if (!marks || !fn) {
    missing.push("normalizeAr — تعذّر اجتزاؤه من محلِّل العربيّة الحيّ");
    return null;
  }
  return new Function("s", `const MARKS = ${marks[1]};\n${fn[1]}`);
}

const normalizeAr = liveNormalizer();
const tokens = (s) => (normalizeAr ? normalizeAr(s).split(" ").filter(Boolean) : []);

/* ═══════════ القاعدةُ التي يُعرض منها ═══════════ */

const db = new DatabaseSync(join(ROOT, "quran-app.db"), { readOnly: true });
const ayahRows = db.prepare("select data from ayahs").all().map((r) => JSON.parse(r.data));
const wordRows = db
  .prepare("select surahNo, ayahNo, wordNo, data from words order by surahNo, ayahNo, wordNo")
  .all();

const wordsByAyah = new Map();
for (const w of wordRows) {
  const key = `${w.surahNo}:${w.ayahNo}`;
  const arr = wordsByAyah.get(key);
  const text = JSON.parse(w.data).textUthmani;
  if (arr) arr.push(text);
  else wordsByAyah.set(key, [text]);
}

/* ═══════════ ١ — لا نصَّ قرآنٍ في شيفرة المسبار ═══════════ */

/** نزعُ التعليق: شرحُ الشيفرة ليس معروضًا للقارئ */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");

/** فهرسُ ثلاثيّات المصحف — داخلَ الآية الواحدة، فلا تُلفَّق ثلاثيّةٌ عبر آيتين */
const trigrams = new Map();
for (const a of ayahRows) {
  const t = tokens(a.textUthmani);
  for (let i = 0; i + 2 < t.length; i++) {
    const key = `${t[i]} ${t[i + 1]} ${t[i + 2]}`;
    if (!trigrams.has(key)) trigrams.set(key, a.location);
  }
}

const planted = [];
for (const [name, path] of FILES) {
  const body = stripComments(read(path));
  const t = tokens(body);
  for (let i = 0; i + 2 < t.length; i++) {
    const key = `${t[i]} ${t[i + 1]} ${t[i + 2]}`;
    const at = trigrams.get(key);
    if (at) planted.push({ file: name, phrase: key, ayah: at });
  }
}
for (const p of planted) {
  fail("قرآنٌ في الشيفرة", `${p.file}: «${p.phrase}» وهي من ${p.ayah}`);
}

/* ═══════════ ٢ — حرفيّةُ المعروض ═══════════ */

/**
 * الصورُ المأذونةُ لمسِّ `textUthmani` في شيفرة المسبار. وكلُّ سطرٍ يذكره ولا
 * يوافق واحدةً منها **مخالفةٌ** — فبها يُمنع أن يُقَصَّ الرسمُ أو يُبدَّل أو
 * يُجرَّد ضبطُه قبل العرض.
 */
const ALLOWED_TOUCH = [
  /^text: w\.textUthmani,$/,
  /^norm: normalizeAr\(w\.textUthmani\),$/,
];

let touchSeen = 0;
for (const [name, path] of FILES) {
  const lines = stripComments(read(path)).split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line.includes("textUthmani")) return;
    touchSeen++;
    if (!ALLOWED_TOUCH.some((re) => re.test(line))) {
      fail("حرفيّةُ المعروض", `${name}:${i + 1} — ${line}`);
    }
  });
}
if (touchSeen === 0) missing.push("لم يُمَسَّ textUthmani في شيفرة المسبار — أزال أحدٌ مصدرَ النصّ؟");

/** والعرضُ نفسُه: الكلمةُ تُطبع كما هي، بلا تحويلٍ في موضع العرض */
const viewSrc = stripComments(read(FILES[6][1]));
if (!/\{w\.text\}/.test(viewSrc)) {
  missing.push("موضعُ عرض الكلمة في الصفحة — لم يُوجد {w.text}");
}
for (const bad of [/w\.text\.replace/, /w\.text\.normalize/, /w\.text\.slice/, /w\.text\.trim/]) {
  if (bad.test(viewSrc)) fail("حرفيّةُ المعروض", `تحويلٌ على الكلمة في موضع العرض: ${bad}`);
}

/* ═══════════ ٣ — تمامُ المقطع ═══════════ */

/**
 * مواضعُ تختلف فيها قسمةُ الكلمات بين نصّ الآية ومفرداتها في مادّتنا — اختلافُ
 * **حدِّ كلمةٍ** لا اختلافُ نصّ: «بعد ما» مقابل «بعدما» في أربعةٍ، وقسمةُ
 * «يا صاحبي» في اثنين من يوسف. قائمةٌ مغلقةٌ معلنة: ما زاد عليها يُسقط
 * البوّابة، وما زال منها يُعلَن فقدُه.
 */
const DECLARED_SPLITS = {
  "2:181": "حدُّ كلمة: «بعد ما» في الآية · «بعدما» في المفردات",
  "8:6": "حدُّ كلمة: «بعد ما» في الآية · «بعدما» في المفردات",
  "13:37": "حدُّ كلمة: «بعد ما» في الآية · «بعدما» في المفردات",
  "12:39": "قسمةُ «يا صاحبي» بين الآية ومفرداتها",
  "12:41": "قسمةُ «يا صاحبي» بين الآية ومفرداتها",
};

const seenSplits = new Set();
let ayahsChecked = 0;
for (const a of ayahRows) {
  const ws = wordsByAyah.get(a.location);
  if (!ws) {
    fail("تمامُ المقطع", `${a.location} — لا مفرداتِ لها في القاعدة`);
    continue;
  }
  ayahsChecked++;
  const joined = tokens(ws.join(" ")).join(" ");
  const whole = tokens(a.textUthmani).join(" ");
  if (joined === whole) continue;
  if (DECLARED_SPLITS[a.location]) {
    seenSplits.add(a.location);
    continue;
  }
  fail("تمامُ المقطع", `${a.location} — مفرداتُها لا تجمع نصَّها`);
}
for (const loc of Object.keys(DECLARED_SPLITS)) {
  if (!seenSplits.has(loc)) missing.push(`مستثنًى زال: ${loc} — يُراجَع الاستثناء`);
}

/* ═══════════ ٤ — مُطبِّعٌ واحدٌ على الطرفين ═══════════ */

/**
 * علاماتُ مطبِّعٍ ثانٍ يُنشأ خفيةً في شيفرة المسبار. وهي ثلاثٌ **لا صنفَ
 * حروفٍ مطلقًا**: فقائمةُ نصوصٍ عربيّةٍ بين قوسين معقوفين (`["معي", "يتخلّف"]`)
 * ليست صنفَ حروفٍ ولا شأنَ لها بالتطبيع — ومنعُها تشدُّدٌ على غير بابه.
 * أمّا هذه الثلاثُ فلا تكون إلّا في تطبيعٍ مصنوعٍ باليد:
 *   • **مدًى عربيّ** (حرفٌ إلى حرف) — صريحًا أو بـ`\u06XX`.
 *   • **`replace` بنمطٍ عربيّ** — وهو صورةُ تجريد الضبط وطيِّ الحروف.
 *   • **`RegExp` مبنيٌّ بنصٍّ عربيّ**.
 * وحدودُ المدى مكتوبةٌ `\uXXXX` صريحةً (عبرةُ بلاغ الحدود).
 */
const SECOND_NORMALIZER = [
  [
    "مدًى عربيّ",
    /(?:[\u0600-\u06FF]|\\u06[0-9A-Fa-f]{2})\s*-\s*(?:[\u0600-\u06FF]|\\u06[0-9A-Fa-f]{2})/,
  ],
  ["replace بنمطٍ عربيّ", /\.replace\(\s*\/[^\n]*[\u0600-\u06FF]/],
  ["RegExp بنصٍّ عربيّ", /new RegExp\([^\n]*[\u0600-\u06FF]/],
];
for (const [name, path] of FILES) {
  const body = stripComments(read(path));
  for (const [why, re] of SECOND_NORMALIZER) {
    const m = body.match(re);
    if (m) fail("مُطبِّعٌ ثانٍ", `${name}: ${why} — ${m[0]}`);
  }
}
const alignSrc = read(FILES[0][1]);
if (!/import \{ normalizeAr, stemAr \} from "\.\.\/arabicSearch";/.test(alignSrc)) {
  missing.push("محرّكُ المحاذاة لا يستورد المطبِّعَ من محلِّل العربيّة");
}

/* ═══════════ الخلاصة ═══════════ */

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0 && missing.length === 0;
const report = {
  gate: "tatabbu",
  ok,
  checkedAt: null,
  counts: {
    files: FILES.length,
    ayahsChecked,
    trigramsIndexed: trigrams.size,
    textUthmaniTouches: touchSeen,
    declaredSplits: Object.keys(DECLARED_SPLITS).length,
  },
  failures,
  missing,
};
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

const label = ok ? "خضراء" : "حمراء";
console.log(`بوّابةُ التتبّع: ${label}`);
console.log(
  `  ملفّات ${FILES.length} · آيات ${ayahsChecked} · ثلاثيّات ${trigrams.size} · مسُّ الرسم ${touchSeen}`,
);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
if (!ok) process.exitCode = 1;

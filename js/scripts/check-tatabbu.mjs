/**
 * بوّابةُ «التتبّع» — **نصُّ المصحف يُعرض من قاعدتنا، لا من الشيفرة.**
 *
 * صفحةُ التتبّع تعرض كلماتِ المصحف واحدةً واحدة ليجري المؤشّرُ عليها. فوجب أن
 * يُحرَس الوجهان: أن يكون المعروضُ **مأخوذًا من القاعدة حرفًا بلا تحويل**، وألّا
 * يكون في الشيفرة **حرفُ قرآنٍ مكتوبٌ بيد** يُعرض للقارئ. ستّةُ فحوص — أربعةٌ
 * منذ ص-م١، وزيادتان لمّا صار الاختيارُ على المصحف كلِّه (ص-م٢ §٧):
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
 *   ٥ — **الاختيارُ يبلغ المصحفَ كلَّه**: كلُّ بابٍ من أبواب الاختيار — بالسورة
 *       وبالجزء وبالصفحة ومن آيةٍ إلى آيةٍ وبالمصحف كلِّه — يستوعب **٦٢٣٦ آية**،
 *       بلا تكرارٍ ولا خروجٍ عن ترتيب المصحف.
 *   ٦ — **حرفيّةُ المقطع**: تُعاد قسمةُ مديات التحميل بقاعدتها الحيّة، ويُشغَّل
 *       على كلِّ مدًى استعلامُ النافذة نفسُه، فيُطابَق ما جُمع بنصّ المصحف في
 *       مواضعه — على كلِّ سورةٍ وجزءٍ وصفحةٍ وعلى المصحف كلِّه.
 *
 * **وكلُّ ما تحكم به هذه البوّابةُ يُجتزأ من مصدره الحيّ** لا نسخةً عنه —
 * المطبِّعُ، وشرطُ انتماء الآية إلى مقطع (`inSegment`)، وقاعدةُ اتّصال المدى
 * (`joinsRun`) وحدُّها. فلو بُدّل واحدٌ منها تبدّل المفحوصُ معه في الحال، ولو
 * زال أعلنت البوّابةُ فقدَه. **والنسخةُ تشيخ في صمت.**
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
  ["iltiqat", join(SAWT, "iltiqat.ts")],
  ["view", join(ROOT, "js", "apps", "studio", "src", "views", "Tatabbu.tsx")],
];
/** موضعُ ملفّ الصفحة في `FILES` — تُقرأ منه فحوصُ العرض */
const VIEW = FILES.length - 1;

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
/** آياتُ المصحف بترتيبه — و`ord` رقمُ الآية المتّصلُ الذي به يُعرف الترتيب */
const ayahRows = db
  .prepare("select _id, data from ayahs")
  .all()
  .map((r) => ({ ...JSON.parse(r.data), ord: Number(String(r._id).slice(1)) }))
  .sort((a, b) => a.ord - b.ord);
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
/** ومسُّ كلِّ ملفٍّ على حِدة — فالجملةُ تُخفي فقدَ الواحد */
const touchByFile = {};
for (const [name, path] of FILES) {
  const lines = stripComments(read(path)).split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line.includes("textUthmani")) return;
    touchSeen++;
    touchByFile[name] = (touchByFile[name] ?? 0) + 1;
    if (!ALLOWED_TOUCH.some((re) => re.test(line))) {
      fail("حرفيّةُ المعروض", `${name}:${i + 1} — ${line}`);
    }
  });
}
if (touchSeen === 0) missing.push("لم يُمَسَّ textUthmani في شيفرة المسبار — أزال أحدٌ مصدرَ النصّ؟");
/**
 * **ولا يُقاس المسُّ بالجملة** (ضبطٌ سالبٌ أفلت في ص-م٤ فشُدّ الفحص): لمّا زِيد
 * ملفُّ الالتقاط — وفيه مسٌّ مأذونٌ للرسم — صار قطعُ مصدر النصّ من **بانِي
 * المقطع** يمرّ خضراءَ لأنّ الجملةَ باقية. فيُشترط على كلِّ **مصدرٍ للنصّ**
 * باسمه أن يبقى مأخوذًا من القاعدة.
 */
for (const src of ["script", "iltiqat"]) {
  if (!touchByFile[src]) {
    missing.push(`لم يُمَسَّ textUthmani في «${src}» — أزال أحدٌ مصدرَ النصّ من القاعدة؟`);
  }
}

/** والعرضُ نفسُه: الكلمةُ تُطبع كما هي، بلا تحويلٍ في موضع العرض */
const viewSrc = stripComments(read(FILES[VIEW][1]));
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

/* ═══════════ ٥ — الاختيارُ يبلغ المصحفَ كلَّه ═══════════ */

/**
 * صار الاختيارُ على المصحف كلِّه لا على أربعة مقاطعَ مسمّاة (ص-م٢ §١). فيُشهد
 * ههنا أنّه **يبلغ الآياتِ كلَّها**: بالسورة، وبالجزء، وبالصفحة، ومن آيةٍ إلى
 * آية، وبالمصحف كلِّه — **كلُّ بابٍ منها يستوعب ٦٢٣٦ آيةً لا آيةَ أقلّ**.
 *
 * **والشرطُ الذي يُشغَّل ههنا هو الشرطُ الحيُّ نفسُه** — يُجتزأ `inSegment` من
 * مصدره كما يُجتزأ المطبِّع، فلا يُفحص شرطٌ غيرُ العامل. ولو بُدّل تبدّل
 * المفحوصُ معه، ولو زال أعلنت البوّابةُ فقدَه.
 */
const SCRIPT_TS = join(SAWT, "script.ts");
const scriptSrc = read(SCRIPT_TS);

function liveInSegment() {
  const m = scriptSrc.match(
    /export function inSegment\(spec: SegmentSpec, a: AyahRef\): boolean \{\n([\s\S]*?)\n\}/,
  );
  if (!m) {
    missing.push("inSegment — تعذّر اجتزاؤه من مصدره الحيّ، فلا يُفحص الاختيارُ بشرطه العامل");
    return null;
  }
  return new Function("spec", "a", m[1]);
}

const inSegment = liveInSegment();
const coverage = {};

if (inSegment) {
  const TOTAL = ayahRows.length;
  const surahNos = [...new Set(ayahRows.map((a) => a.surahNo))];
  const lastAyahOf = new Map();
  for (const a of ayahRows) lastAyahOf.set(a.surahNo, Math.max(lastAyahOf.get(a.surahNo) ?? 0, a.ayahNo));

  /** يجمع ما تبلغه أبوابُ الاختيار، ويشهد ألّا تُخلط آيةٌ ولا تُكرَّر داخل الباب */
  const cover = (label, specs) => {
    const seen = new Set();
    let overlap = 0;
    let outOfOrder = 0;
    for (const spec of specs) {
      let prev = -1;
      for (const a of ayahRows) {
        if (!inSegment(spec, a)) continue;
        if (a.ord <= prev) outOfOrder++;
        prev = a.ord;
        if (seen.has(a.location)) overlap++;
        seen.add(a.location);
      }
    }
    coverage[label] = seen.size;
    if (seen.size !== TOTAL) {
      fail("الاختيارُ يبلغ المصحف", `${label}: بلغ ${seen.size} آيةً من ${TOTAL}`);
    }
    if (overlap) fail("الاختيارُ يبلغ المصحف", `${label}: تكرّرت ${overlap} آيةً بين مقاطعه`);
    if (outOfOrder) fail("الاختيارُ يبلغ المصحف", `${label}: ${outOfOrder} آيةً جاءت على غير ترتيب المصحف`);
  };

  cover("بالسورة", surahNos.map((n) => ({ kind: "surahs", surahs: [n] })));
  cover("بالجزء", [...new Set(ayahRows.map((a) => a.juz))].map((n) => ({ kind: "juz", juz: n })));
  cover("بالصفحة", [...new Set(ayahRows.map((a) => a.page))].map((n) => ({ kind: "page", page: n })));
  cover(
    "من آيةٍ إلى آية",
    surahNos.map((n) => ({ kind: "range", surahNo: n, from: 1, to: lastAyahOf.get(n) })),
  );
  cover("المصحف كلُّه", [{ kind: "mushaf" }]);

  // ومدًى في وسط سورةٍ يقف عند حدَّيه لا يتعدّاهما
  const mid = ayahRows.filter((a) => inSegment({ kind: "range", surahNo: 2, from: 253, to: 256 }, a));
  if (mid.length !== 4 || mid[0].ayahNo !== 253 || mid[3].ayahNo !== 256) {
    fail("الاختيارُ يبلغ المصحف", `مدًى في وسط سورةٍ لم يقف عند حدَّيه: ${mid.length} آية`);
  }
}

/* ═══════════ ٦ — نصُّ المقطع يطابق نصَّ المصحف حرفًا ═══════════ */

/**
 * لا يكفي أن تكون كلماتُ الآية تجمع نصَّها (الفحصُ الثالث): فالمقطعُ لم يعُد
 * يُبنى دَفعةً، بل تجلبه **نافذةُ التحميل** على مديات، وكلُّ مدًى استعلامٌ
 * مقيَّدٌ **بسورةٍ واحدةٍ وحدَّي رقمِ آية**. فلو ظُنّ الاتّصالُ في غير موضعه
 * لسقط من نصّ المقطع ما لا يُرى سقوطُه.
 *
 * فتُعاد ههنا **قسمةُ المديات بقاعدتها الحيّة** (`joinsRun` مجتزأةً من مصدرها،
 * وحدُّها `MAX_RUN_AYAHS` مجتزأٌ معها)، ويُشغَّل على كلِّ مدًى **استعلامُ
 * النافذة نفسُه** على القاعدة، ثمّ يُطابَق ما جُمع بنصّ المصحف في تلك المواضع
 * **بترتيبه وبلا نقصٍ ولا تكرار**. ويقع ذلك على **كلِّ سورةٍ وكلِّ جزءٍ وكلِّ
 * صفحةٍ وعلى المصحف كلِّه**.
 */
let segmentsChecked = 0;
let runsChecked = 0;

function liveJoinsRun() {
  const cap = scriptSrc.match(/const MAX_RUN_AYAHS = (\d+);/);
  const fn = scriptSrc.match(
    /export function joinsRun\(prev: AyahRef, next: AyahRef, taken: number\): boolean \{\n([\s\S]*?)\n\}/,
  );
  if (!cap || !fn) {
    missing.push("joinsRun — تعذّر اجتزاؤه من مصدره الحيّ، فلا تُفحص قسمةُ مديات التحميل");
    return null;
  }
  return new Function("prev", "next", "taken", `const MAX_RUN_AYAHS = ${cap[1]};\n${fn[1]}`);
}

const joinsRun = liveJoinsRun();

if (inSegment && joinsRun) {
  /** استعلامُ النافذة بحروفه: سورةٌ واحدةٌ ومدًى من أرقام الآيات */
  const windowQuery = db.prepare(
    "select ayahNo, wordNo, data from words where surahNo = ? and ayahNo >= ? and ayahNo <= ?",
  );

  const literal = (label, spec) => {
    const refs = ayahRows.filter((a) => inSegment(spec, a));
    if (!refs.length) return;
    segmentsChecked++;

    // ١) تُقسَّم آياتُ المقطع مدياتٍ بالقاعدة الحيّة، ويُجلب كلُّ مدًى باستعلامه
    const got = new Map();
    let i = 0;
    while (i < refs.length) {
      let end = i;
      while (end + 1 < refs.length && joinsRun(refs[end], refs[end + 1], end - i + 1)) end++;
      runsChecked++;
      const rows = windowQuery
        .all(refs[i].surahNo, refs[i].ayahNo, refs[end].ayahNo)
        .sort((x, y) => x.ayahNo - y.ayahNo || x.wordNo - y.wordNo);
      for (const w of rows) {
        const key = `${refs[i].surahNo}:${w.ayahNo}`;
        const arr = got.get(key);
        const text = JSON.parse(w.data).textUthmani;
        if (arr) arr.push(text);
        else got.set(key, [text]);
      }
      i = end + 1;
    }

    // ٢) ثمّ يُطابَق ما جُمع بنصّ المصحف في تلك المواضع بترتيبه
    const built = [];
    const whole = [];
    for (const a of refs) {
      const ws = got.get(a.location);
      if (!ws) {
        fail("حرفيّةُ المقطع", `${label} — سقطت ${a.location} من مديات التحميل`);
        return;
      }
      built.push(tokens(ws.join(" ")).join(" "));
      // المواضعُ المعلَنةُ في الفحص الثالث تُقاس بمفرداتها لا بنصّها
      whole.push(
        DECLARED_SPLITS[a.location]
          ? tokens((wordsByAyah.get(a.location) ?? []).join(" ")).join(" ")
          : tokens(a.textUthmani).join(" "),
      );
    }
    if (built.join(" ") !== whole.join(" ")) {
      fail("حرفيّةُ المقطع", `${label} — نصُّ المقطع لا يطابق نصَّ المصحف في مواضعه`);
    }
  };

  for (const n of [...new Set(ayahRows.map((a) => a.surahNo))]) {
    literal(`سورة ${n}`, { kind: "surahs", surahs: [n] });
  }
  for (const n of [...new Set(ayahRows.map((a) => a.juz))]) literal(`جزء ${n}`, { kind: "juz", juz: n });
  for (const n of [...new Set(ayahRows.map((a) => a.page))]) literal(`صفحة ${n}`, { kind: "page", page: n });
  literal("المصحف كلُّه", { kind: "mushaf" });

  // ومقاطعُ المحكّ المختومة — تُقرأ من مصدرها الحيّ لا تُكتب ههنا، فهي مقاطعُ
  // **سورٍ متفرّقةٍ** لا متّصلة، وفيها يقع أشدُّ ما تخطئ فيه قسمةُ المديات.
  const sealedSurahs = [...scriptSrc.matchAll(/kind: "surahs", surahs: \[([\d, ]+)\]/g)].map((m) =>
    m[1].split(",").map((x) => Number(x.trim())),
  );
  const sealedPages = [...scriptSrc.matchAll(/kind: "page", page: (\d+)/g)].map((m) => Number(m[1]));
  if (!sealedSurahs.length && !sealedPages.length) {
    missing.push("مقاطعُ المحكّ المختومة — لم تُوجد في مصدرها الحيّ (أأُلغي خيارُها؟)");
  }
  for (const surahs of sealedSurahs) literal(`مقطعُ محكٍّ: سورٌ ${surahs.join("+")}`, { kind: "surahs", surahs });
  for (const p of sealedPages) literal(`مقطعُ محكٍّ: صفحة ${p}`, { kind: "page", page: p });
}

/* ═══════════ ٨ — خريطةُ حدود الصفحة والجزء تطابق القاعدة ═══════════ */

/**
 * صار فهرسُ الصفحة والجزء يُبنى من **خريطةٍ محفوظة** (`mushaf-bounds.json`) لا
 * من وثائق الآيات — تعجيلًا مقيسًا (٣٢٩ و٣٠١ مِث ⇒ نحوُ ١٥٦). **وخريطةٌ لا
 * تُقابَل بالقاعدة تشيخ في صمت** كما تشيخ النسخة. فيُشهد ههنا أنّ ما تخرجه
 * **يطابق حدودَ القاعدة آيةً آيةً على الآيات كلِّها**: كلُّ صفحةٍ وكلُّ جزء.
 *
 * وضبطُه السالب: تُزحزح حدُّ صفحةٍ واحدةٍ في نسخةٍ من الخريطة فيُصطاد الخللُ.
 */
const boundsPath = join(SAWT, "mushaf-bounds.json");
let boundsChecked = { pages: 0, juz: 0 };
try {
  const BOUNDS = JSON.parse(read(boundsPath));
  /** ترتيبُ المصحف مبنيًّا من عِدّة السور — كما تبنيه `planSegment` بالضبط */
  const surahAyahs = new Map();
  for (const a of ayahRows) surahAyahs.set(a.surahNo, Math.max(surahAyahs.get(a.surahNo) ?? 0, a.ayahNo));
  const order = [];
  for (const s of [...surahAyahs.keys()].sort((x, y) => x - y)) {
    for (let n = 1; n <= surahAyahs.get(s); n++) order.push(`${s}:${n}`);
  }
  const at = (b) => order.indexOf(`${b[0]}:${b[1]}`);

  /** ما تخرجه الخريطةُ لوحدةٍ واحدة، بالمنطق الحيِّ نفسِه */
  const fromBounds = (list, n) => {
    const first = list[n - 1];
    if (!first) return null;
    const from = at(first);
    if (from < 0) return null;
    const next = list[n];
    const to = next ? at(next) : order.length;
    return order.slice(from, to < 0 ? order.length : to);
  };

  const compare = (label, list, key) => {
    const units = [...new Set(ayahRows.map((a) => a[key]))].sort((x, y) => x - y);
    if (units.length !== list.length) {
      fail("خريطةُ الحدود", `${label}: في الخريطة ${list.length} وفي القاعدة ${units.length}`);
      return 0;
    }
    let ok = 0;
    for (const n of units) {
      const want = ayahRows.filter((a) => a[key] === n).map((a) => a.location);
      const got = fromBounds(list, n);
      if (!got || got.join("|") !== want.join("|")) {
        fail("خريطةُ الحدود", `${label} ${n}: الخريطةُ تخالف القاعدة (${got ? got.length : "—"} مقابل ${want.length})`);
        continue;
      }
      ok++;
    }
    return ok;
  };

  boundsChecked = {
    pages: compare("صفحة", BOUNDS.pages, "page"),
    juz: compare("جزء", BOUNDS.juz, "juz"),
  };

  // **الضبطُ السالب**: تُزحزح حدُّ صفحةٍ واحدةٍ فيُشهد أنّ الفحص يصطاده
  const shifted = BOUNDS.pages.map((b, i) => (i === 41 ? BOUNDS.pages[i + 1] : b));
  const before = failures.length;
  compare("صفحةٌ مزحزحةٌ (ضبطٌ سالب)", shifted, "page");
  const caught = failures.length > before;
  failures.length = before;
  if (!caught) fail("خريطةُ الحدود", "زُحزح حدُّ صفحةٍ فلم يُصطَد — والفحصُ لا يفحص");
} catch (e) {
  missing.push(`خريطةُ حدود الصفحة والجزء — تعذّرت قراءتُها: ${e.message}`);
}

/* ═══════════ ٧ — لا تُدَّعى استقلاليّةٌ عن الشبكة ═══════════ */

/**
 * **القيدُ الذي لا يُتجاوز** (ص-م٢ §٦-٣): محرّكُ اليوم يرسل الصوتَ إلى خادم
 * صانع المتصفّح. فلا يُقال في هذه الصفحة — **ولا في يومٍ يُنسى فيه الأمر** —
 * إنّها تعمل بلا إنترنت، ولا إنّ الصوتَ لا يغادر الجهاز، ولا إنّ التعرّفَ يقع
 * على الجهاز وحدَه. **فذلك لا يصحّ إلّا بالمحرّك الحرّ**، ودعواه اليومَ كذبٌ
 * على القارئ في أحوج ما يكون إلى الصدق.
 *
 * وهذا الفحصُ على **النصّ المعروض** لا على التعليق: التعليقُ يشرح القيدَ فيلزمه
 * ذكرُه. ولا حدَّ كلمةٍ (`\b`) مع العربيّة (بلاغ الحدود) — بل عباراتٌ كاملة.
 */
const FORBIDDEN_CLAIMS = [
  ["بلا إنترنت", /بلا\s+إنترنت/],
  ["دون إنترنت", /دون\s+إنترنت/],
  ["لا يغادر الجهاز", /لا\s+يغادر\s+الجهاز/],
  ["لا يخرج من الجهاز", /لا\s+يخرج\s+من\s+الجهاز/],
  ["يبقى في جهازك", /يبقى\s+في\s+جهازك/],
  ["بلا شبكة", /بلا\s+شبكة/],
];

/** النصُّ المعروضُ وحدَه: ما بين وسوم العرض ونصوصُ الصفحة، بعد نزع التعليق */
const viewShown = stripComments(read(FILES[VIEW][1]));
for (const [name, re] of FORBIDDEN_CLAIMS) {
  const m = viewShown.match(re);
  if (m) fail("دعوى استقلالٍ عن الشبكة", `الصفحةُ تقول «${name}» — ولا يصحّ إلّا بالمحرّك الحرّ`);
}

/**
 * وبإزائه: **الإعلانُ نفسُه قائمٌ لم يُنزع** — وقد صار موضعُه `engines.ts` منذ
 * ص-م٣: الصفحةُ تعرض سطرَ المحرّك المختار (`privacyLine`)، والسطرُ يُكتب مع
 * محرّكه لأنّ عبارةً واحدةً في الصفحة تصلح لأحدهما وتكذب على الآخر. فيُفحص
 * ههنا أنّ الصفحةَ تعرض السطر، وأنّ الإعلانَ موجودٌ في مصدره — **وتفصيلُ أيُّ
 * سطرٍ لأيِّ محرّك في `check-sawt-engine.mjs` بضبطه السالب**.
 */
const enginesSrc = stripComments(read(join(SAWT, "engines.ts")));
if (!/يرسل\s+صوتَك\s+إلى\s+خادم/.test(enginesSrc)) {
  missing.push("الإعلانُ الصريحُ بأنّ الصوت يُرسل إلى خادم صانع المتصفّح — لم يُوجد في وصف المحرّكات");
}
/** والموضعُ الذي يلزم فيه السطرُ هو **الإعلانُ قبل الميكروفون** لا أيُّ موضع */
const consentBlock = viewShown.slice(
  Math.max(0, viewShown.indexOf('data-sawt="consent"') - 400),
  viewShown.indexOf('data-sawt="consent"') + 900,
);
if (!/privacyLine/.test(consentBlock)) {
  missing.push("الإعلانُ قبل الميكروفون لا يعرض سطرَ صدق المحرّك (`privacyLine`)");
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
    textUthmaniByFile: touchByFile,
    declaredSplits: Object.keys(DECLARED_SPLITS).length,
    segmentsChecked,
    runsChecked,
    coverage,
    boundsChecked,
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
console.log(
  `  الاختيار: ${Object.entries(coverage).map(([k, v]) => `${k} ${v}`).join(" · ")} · مقاطعُ فُحص نصُّها ${segmentsChecked} في ${runsChecked} مدًى`,
);
console.log(
  `  خريطةُ الحدود: ${boundsChecked.pages} صفحةً و${boundsChecked.juz} جزءًا طابقت القاعدةَ آيةً آيةً — وضبطُها السالب اصطاد الزحزحة`,
);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
if (!ok) process.exitCode = 1;

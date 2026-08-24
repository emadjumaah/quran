/**
 * **بوّابةُ التثبيت** — أسئلةُ المفرق تُقابَل بنصّ المصحف عندنا (بندُ ن١ §٣).
 *
 * بابُ التثبيت **يولّد** سؤالًا: يعرض مشتركًا ثمّ وجهين. ومادّتُه (`furuq.json`)
 * مكتوبةٌ بالإملاء المعتاد مجرّدةً من الضبط — **فلو عُرض منها حرفٌ لعُرض على
 * القارئ قرآنٌ بغير رسمه**. فالمولِّدُ لا يقرأ منها إلّا **مواضعَ الكلمات**،
 * ويقصّ المعروضَ من `mushaf-text.json` نفسِه الذي تُرسم منه الصفحة. وهذه
 * البوّابةُ تشهد على ذلك بثلاثة أبوابٍ ولكلٍّ ضبطُه السالب:
 *
 *   ١ — **كلُّ سؤالٍ مولَّدٍ يطابق نصَّ المصحف حرفًا**: يُشغَّل المولِّدُ الحيُّ على
 *       **كلّ** مفرقٍ وعن **كلتا** الجهتين، ثمّ يُقابَل كلُّ لفظٍ معروضٍ بكلمته
 *       في الآية **مقروءةً من الملفّ من جديد** — نصًّا وموضعًا وترتيبًا.
 *       **وضبطُه السالب**: تُحرَّف كلمةٌ في نصّ آيةٍ فيُولَّد منها السؤالُ ويُقابَل
 *       بالنصّ السليم — فتُصطاد.
 *   ٢ — **لا سؤالَ بلا مفرقٍ محسوب، ولا توأمَ في قالب الوجهين**: كلُّ سؤالٍ
 *       مفرقُه مقروءٌ من المحاذاة بسلسلةٍ مشتركةٍ تبلغ الحدَّ المعلن، وله وجهٌ
 *       واحدٌ على الأقلّ من نصّ المصحف؛ وكلُّ زوجٍ في مجرى المفارق فيه افتراقٌ
 *       حقيقيّ. **وضبطُه السالب**: يُقحَم توأمٌ تامٌّ في مجرى المفارق فيُصطاد،
 *       ويُزرع مفرقٌ سلسلتُه دون الحدّ فيُصطاد.
 *   ٣ — **عددُ المادّة يُنشر بأرقامه**: كم زوجًا دخل، وبأيّ حدٍّ للسلسلة، وكم
 *       سقط ولماذا — تُطبع ههنا، **ويُفحص أنّ الورقةَ نفسَها تنشرها للقارئ**
 *       فلا يبقى سقفٌ مسكوتٌ عنه. ومعها **الأرقامُ المُلزِمةُ من ح١** (٢٬٠١٩
 *       زوجًا · ٣٧٦ توأمًا · ١٬٠٦٠ بالمفرق الداخليّ) تُقاس فإن انحرفت سقطت.
 *
 * **وكلُّ ما تحكم به هذه البوّابةُ مُجتزأٌ من مصدره الحيّ** لا نسخةً عنه:
 * المطبِّعُ من محلِّل العربيّة، وطيّاتُ الرسم وقراءةُ المفارق والتحقّقُ من
 * المحاذاة **والمولِّدُ نفسُه** من `furuq.ts`، وقاعدةُ علامات الوقف من `mushaf.ts`،
 * وعِدّةُ السور من فهرس المصحف. فلو بُدّل واحدٌ منها تبدّل المفحوصُ معه، ولو زال
 * أعلنت البوّابةُ فقدَه. **والنسخةُ تشيخ في صمت.**
 *
 * التشغيل: node js/scripts/check-tathbit.mjs → js/data/gates/TATHBIT.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASSETS = join(ROOT, "js", "packages", "quran-assets", "assets");
const CORE = join(ROOT, "js", "packages", "quran-core", "src");
const APP = join(ROOT, "js", "apps", "tilawa", "src");
const OUT = join(ROOT, "js", "data", "gates", "TATHBIT.json");

const read = (p) => readFileSync(p, "utf8");
const failures = [];
const missing = [];
const fail = (check, detail) => failures.push({ check, detail });

/* ═══════════ اجتزاءُ الشيفرة الحيّة ═══════════ */

const furuqSrc = read(join(APP, "furuq.ts"));
const mushafSrc = read(join(APP, "mushaf.ts"));
const analyzerSrc = read(join(CORE, "lib", "arabicSearch.ts"));
const indexSrc = read(join(CORE, "lib", "sawt", "mushafIndex.ts"));
const sheetSrc = read(join(APP, "components", "Tathbit.tsx"));

/** يجتزئ جسمَ دالّةٍ من مصدرها ويعيد بناءها بلا وسومِ أنواع */
function lift(src, name, head, params) {
  const re = new RegExp(`export function ${name}\\(${head}\\{\\n([\\s\\S]*?)\\n\\}`);
  const m = src.match(re);
  if (!m) {
    missing.push(`${name} — تعذّر اجتزاؤه من مصدره الحيّ`);
    return `function ${name}() { throw new Error("${name} مفقودة"); }`;
  }
  return `function ${name}(${params}) {\n${m[1]}\n}`;
}

const numOf = (src, name) => {
  const m = src.match(new RegExp(`export const ${name} = (\\d+);`));
  if (!m) missing.push(`${name} — تعذّر اجتزاؤه`);
  return m ? Number(m[1]) : 0;
};

const MIN_LEAD = numOf(furuqSrc, "MIN_LEAD");
const LEAD_SHOWN = numOf(furuqSrc, "LEAD_SHOWN");

const marksRe = analyzerSrc.match(/const MARKS = (\/.*\/g);/);
const normFn = analyzerSrc.match(/export function normalizeAr\(s: string\): string \{\n([\s\S]*?)\n\}/);
if (!marksRe || !normFn) missing.push("normalizeAr — تعذّر اجتزاؤه من محلِّل العربيّة الحيّ");

const waqfRe = mushafSrc.match(/const WAQF_ONLY = (\/.*\/);/);
if (!waqfRe) missing.push("WAQF_ONLY — تعذّر اجتزاؤها من نصّ المصحف الحيّ");

const countsRe = indexSrc.match(/export const AYAH_COUNTS = \[([\s\S]*?)\];/);
if (!countsRe) missing.push("AYAH_COUNTS — تعذّر اجتزاؤها من فهرس المصحف");

/** الشيفرةُ الحيّةُ كلُّها في نطاقٍ واحد، فيدعو بعضُها بعضًا كما في التطبيق */
const live = new Function(`
  const MARKS = ${marksRe ? marksRe[1] : "/x/g"};
  const LEAD_SHOWN = ${LEAD_SHOWN};
  function normalizeAr(s) {\n${normFn ? normFn[1] : "return s;"}\n}
  ${lift(furuqSrc, "rasmOf", "w: string\\): string ", "w")}
  ${lift(furuqSrc, "sameWord", "w: string \\| undefined, c: string\\): boolean ", "w, c")}
  ${lift(furuqSrc, "alignsWith", "p: RawPair, wa: string\\[\\], wb: string\\[\\]\\): boolean ", "p, wa, wb")}
  ${lift(furuqSrc, "forksOf", "ops: Op\\[\\], win: Win \\| null\\): Fork\\[\\] ", "ops, win")}
  ${lift(furuqSrc, "questionOf", "[\\s\\S]*?\\): Question ", "pair, fork, side, wa, wb")}
  return { rasmOf, sameWord, alignsWith, forksOf, questionOf };
`)();

/* ═══════════ نصُّ المصحف والمادّة — من أصلهما المشحون ═══════════ */

const mushaf = JSON.parse(read(join(ASSETS, "mushaf-text.json")));
const furuq = JSON.parse(read(join(ASSETS, "furuq.json")));

const AYAH_COUNTS = countsRe
  ? countsRe[1].split(",").map((s) => Number(s.trim())).filter(Number.isFinite)
  : [];
const OFFSET = [0];
for (let i = 0; i < AYAH_COUNTS.length; i++) OFFSET.push(OFFSET[i] + AYAH_COUNTS[i]);
const globalIdOf = (s, a) => OFFSET[s - 1] + a;
const idOf = (loc) => {
  const [s, a] = loc.split(":").map(Number);
  return globalIdOf(s, a);
};

const WAQF_ONLY = waqfRe ? eval(waqfRe[1]) : /^$/;
/** كلماتُ آيةٍ من رسمها — **قسمةُ الصفحة نفسُها**: بالمسافة، وعلاماتُ الوقف مطروحة */
const wordsAt = (id, text) => (text ?? mushaf.text[id - 1]).split(" ").filter((w) => !WAQF_ONLY.test(w));

/* ═══════════ المادّةُ كما يبنيها التطبيق ═══════════ */

/** ما يبلغ الحدَّ من المفارق — **بالدالّة الحيّة وبالحدّ الحيّ** */
const qualified = (p) => live.forksOf(p.ops, p.win ?? null).filter((f) => f.lead >= MIN_LEAD);

const counts = {
  all: furuq.furuq.length,
  misaligned: 0,
  twinPairs: 0,
  twinGroups: 0,
  forkPairs: 0,
  questions: 0,
  belowLead: 0,
  minLead: MIN_LEAD,
  /** ما كان له مفرقٌ داخليٌّ **قبل** إسقاط ما تعذّرت محاذاتُه — وهو رقمُ ح١ المُلزِم */
  internalBeforeAlign: 0,
  twinPairsBeforeAlign: 0,
};

const pairs = [];
const twinPairs = [];
for (const p of furuq.furuq) {
  const idA = idOf(p.a);
  const idB = idOf(p.b);
  const wa = wordsAt(idA);
  const wb = wordsAt(idB);
  const diverges = p.ops.some((o) => typeof o !== "string");
  if (!diverges) counts.twinPairsBeforeAlign++;
  else if (qualified(p).length) counts.internalBeforeAlign++;
  if (!live.alignsWith(p, wa, wb)) {
    counts.misaligned++;
    continue;
  }
  const key = idA <= idB ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
  if (!diverges) {
    const preA = p.win && p.win.s === "a" ? p.win.pre : 0;
    const preB = p.win && p.win.s === "b" ? p.win.pre : 0;
    twinPairs.push({
      key,
      a: p.a,
      b: p.b,
      idA,
      idB,
      ops: p.ops,
      span: { atA: preA + 1, lenA: p.ops.length, atB: preB + 1, lenB: p.ops.length },
    });
    continue;
  }
  const forks = qualified(p);
  if (!forks.length) {
    counts.belowLead++;
    continue;
  }
  pairs.push({ key, a: p.a, b: p.b, idA, idB, cat: p.cat, ops: p.ops, win: p.win ?? null, forks });
  counts.questions += forks.length;
}
counts.forkPairs = pairs.length;
counts.twinPairs = twinPairs.length;
/** والتوائمُ تُجمع مواضعَ — عبارةٌ في ثلاثةٍ لا تُسأل زوجًا زوجًا */
{
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    return r;
  };
  for (const t of twinPairs) {
    for (const loc of [t.a, t.b]) if (!parent.has(loc)) parent.set(loc, loc);
    const ra = find(t.a);
    const rb = find(t.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  counts.twinGroups = new Set([...parent.keys()].map(find)).size;
}

/* ═══════════ ١ — حرفيّةُ المعروض ═══════════ */

/**
 * يُقابَل سؤالٌ مولَّدٌ بنصّ آيتيه: كلُّ لفظٍ معروضٍ **هو الكلمةُ التي في ذلك
 * الموضع من الآية**، والمشتركُ يقع قبل المفرق متّصلًا. و`words` تُمرَّر مقروءةً
 * من الملفّ من جديد، فلا يُقابَل المولَّدُ بما وُلّد منه.
 */
function verifyQuestion(q, waTruth, wbTruth, tag) {
  const bad = [];
  const mineTruth = q.side === "a" ? waTruth : wbTruth;
  const at = q.side === "a" ? q.fork.atA : q.fork.atB;
  const shown = Math.min(q.fork.lead, LEAD_SHOWN);
  const from = at - 1 - shown;
  if (from < 0) bad.push("المشتركُ يبتدئ قبل أوّل الآية");
  q.lead.forEach((w, i) => {
    if (mineTruth[from + i] !== w) bad.push(`المشتركُ ${i + 1}: «${w}» ≠ «${mineTruth[from + i]}»`);
  });
  if (q.lead.length !== shown) bad.push(`طولُ المشترك ${q.lead.length} ≠ ${shown}`);
  const faces = [
    ["أ", q.faceA, waTruth, q.fork.atA, q.fork.lenA],
    ["ب", q.faceB, wbTruth, q.fork.atB, q.fork.lenB],
  ];
  for (const [name, face, truth, fAt, fLen] of faces) {
    if (face === null) {
      if (fLen !== 0) bad.push(`وجهُ «${name}» خالٍ وله ${fLen} كلمة`);
      continue;
    }
    if (face.length !== fLen) bad.push(`وجهُ «${name}»: ${face.length} ≠ ${fLen}`);
    face.forEach((w, i) => {
      if (truth[fAt - 1 + i] !== w) bad.push(`وجهُ «${name}» ${i + 1}: «${w}» ≠ «${truth[fAt - 1 + i]}»`);
    });
  }
  for (const b of bad) fail("حرفيّةُ المعروض", `${tag} — ${b}`);
  return bad.length === 0;
}

let generated = 0;
let verified = 0;
for (const p of pairs) {
  const wa = wordsAt(p.idA);
  const wb = wordsAt(p.idB);
  for (const f of p.forks) {
    for (const side of ["a", "b"]) {
      const q = live.questionOf({ a: p.a, b: p.b, idA: p.idA, idB: p.idB }, f, side, wa, wb);
      generated++;
      if (verifyQuestion(q, wordsAt(p.idA), wordsAt(p.idB), `${p.a}~${p.b} [${side}]`)) verified++;
    }
  }
}

/** وعبارةُ التوأم كذلك: مقصوصةٌ من موضعها لا مكتوبةٌ من المادّة */
let twinTexts = 0;
for (const t of twinPairs) {
  for (const [loc, id, sp] of [
    [t.a, t.idA, { at: t.span.atA, len: t.span.lenA }],
    [t.b, t.idB, { at: t.span.atB, len: t.span.lenB }],
  ]) {
    const truth = wordsAt(id);
    const cut = truth.slice(sp.at - 1, sp.at - 1 + sp.len);
    twinTexts++;
    if (cut.length !== sp.len) fail("حرفيّةُ المعروض", `توأمٌ ${loc}: عبارتُه ${cut.length} ≠ ${sp.len}`);
  }
}

/** **الضبطُ السالب**: تُحرَّف كلمةٌ في آيةٍ فيُولَّد منها ويُقابَل بالسليم */
function negativeLetter() {
  const p = pairs.find((x) => x.forks.some((f) => f.lenA > 0));
  if (!p) return "لم يُوجد زوجٌ يُزرع فيه";
  const f = p.forks.find((x) => x.lenA > 0);
  const truth = wordsAt(p.idA);
  const spoiled = truth.slice();
  spoiled[f.atA - 1] = `${spoiled[f.atA - 1]}ـى`;
  const q = live.questionOf({ a: p.a, b: p.b, idA: p.idA, idB: p.idB }, f, "a", spoiled, wordsAt(p.idB));
  const before = failures.length;
  const ok = verifyQuestion(q, truth, wordsAt(p.idB), "«ضبطٌ سالبٌ» تحريفُ كلمة");
  const caught = !ok;
  failures.length = before; // الزرعُ لا يُحسب سقوطًا — إنّما يُشهد أنّه اصطيد
  return caught ? null : "كلمةٌ حُرّفت فلم تُصطَد";
}
const neg1 = negativeLetter();
if (neg1) fail("ضبطٌ سالب", `١ — ${neg1}`);

/* ═══════════ ٢ — لا سؤالَ بلا مفرق، ولا توأمَ في قالب الوجهين ═══════════ */

/** يفحص مجرى المفارق: كلُّ زوجٍ فيه افتراقٌ، وكلُّ مفرقٍ يبلغ الحدَّ وله وجه */
function auditForkStream(stream, label) {
  const bad = [];
  for (const p of stream) {
    if (!p.ops.some((o) => typeof o !== "string")) {
      bad.push(`${p.a}~${p.b}: توأمٌ تامٌّ في قالب الوجهين`);
      continue;
    }
    for (const f of p.forks) {
      if (f.lead < MIN_LEAD) bad.push(`${p.a}~${p.b}: سلسلةٌ ${f.lead} دون الحدّ ${MIN_LEAD}`);
      if (f.lenA === 0 && f.lenB === 0) bad.push(`${p.a}~${p.b}: مفرقٌ بلا وجهٍ ألبتّة`);
      if (!f.end && (f.lenA === 0 || f.lenB === 0)) bad.push(`${p.a}~${p.b}: وجهٌ خالٍ في غير الذيل`);
    }
    if (!p.forks.length) bad.push(`${p.a}~${p.b}: زوجٌ في المجرى بلا مفرقٍ محسوب`);
  }
  for (const b of bad) fail(label, b);
  return bad.length;
}
auditForkStream(pairs, "قالبُ المفرق");

/** ولا توأمَ يحمل افتراقًا — فقالبُه «أين تقع» لا «أيُّ الوجهين» */
for (const t of twinPairs) {
  if (t.ops.some((o) => typeof o !== "string")) {
    fail("قالبُ التوأم", `${t.a}~${t.b}: توأمٌ في محاذاته افتراق`);
  }
}

/** **الضبطُ السالب**: يُقحَم توأمٌ تامٌّ في المجرى، ويُزرع مفرقٌ دون الحدّ */
function negativeTemplate() {
  const twin = twinPairs[0];
  const host = pairs[0];
  if (!twin || !host) return "لم تُوجد مادّةٌ يُزرع فيها";
  const planted = [
    { ...twin, cat: "تطابق", forks: [{ lead: 5, atA: 1, lenA: 1, atB: 1, lenB: 1, end: false }] },
    { ...host, forks: [{ ...host.forks[0], lead: MIN_LEAD - 1 }] },
  ];
  const before = failures.length;
  const caught = auditForkStream(planted, "زرعٌ");
  const names = failures.slice(before).map((f) => f.detail);
  failures.length = before;
  const sawTwin = names.some((n) => n.includes("قالب الوجهين"));
  const sawShort = names.some((n) => n.includes("دون الحدّ"));
  if (!caught || !sawTwin || !sawShort) {
    return `المزروعُ لم يُصطَد كاملًا (توأم: ${sawTwin ? "نعم" : "لا"} · قصيرٌ: ${sawShort ? "نعم" : "لا"})`;
  }
  return null;
}
const neg2 = negativeTemplate();
if (neg2) fail("ضبطٌ سالب", `٢ — ${neg2}`);

/* ═══════════ ٣ — عددُ المادّة يُنشر بأرقامه ═══════════ */

/** الأرقامُ المُلزِمةُ من ح١ §١ — تُقاس على المادّة، فإن انحرفت سقطت البوّابة */
const BINDING = { all: 2019, twins: 376, internal: 1060 };
if (counts.all !== BINDING.all) {
  fail("أرقامُ المادّة", `جملةُ الأزواج ${counts.all} ≠ ${BINDING.all}`);
}
if (counts.twinPairsBeforeAlign !== BINDING.twins) {
  fail("أرقامُ المادّة", `التوائمُ التامّة ${counts.twinPairsBeforeAlign} ≠ ${BINDING.twins}`);
}
if (counts.internalBeforeAlign !== BINDING.internal) {
  fail(
    "أرقامُ المادّة",
    `المفرقُ الداخليُّ بحدّ ${MIN_LEAD}: ${counts.internalBeforeAlign} ≠ ${BINDING.internal}`,
  );
}

/** **والورقةُ تنشرها للقارئ** — لا تُطبع ههنا وتُخفى هناك */
for (const [name, re] of [
  ["جملةُ المادّة", /counts\.all/],
  ["أزواجُ المفرق", /counts\.forkPairs/],
  ["عدّةُ الأسئلة", /counts\.questions/],
  ["التوائمُ التامّة", /counts\.twinPairs/],
  ["ما دون الحدّ", /counts\.belowLead/],
  ["الحدُّ نفسُه", /counts\.minLead/],
]) {
  if (!re.test(sheetSrc)) missing.push(`ورقةُ التثبيت لا تنشر «${name}» للقارئ`);
}

/* ═══════════ الخلاصة ═══════════ */

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0 && missing.length === 0;
writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      gate: "tathbit",
      ok,
      checkedAt: null,
      counts: { ...counts, generated, verified, twinTexts, leadShown: LEAD_SHOWN },
      binding: BINDING,
      failures,
      missing,
    },
    null,
    2,
  )}\n`,
);

console.log(`بوّابةُ التثبيت: ${ok ? "خضراء" : "حمراء"}`);
console.log(
  `  المادّة ${counts.all} زوجًا · دخل ${counts.forkPairs} ذا مفرقٍ داخليٍّ (حدُّ السلسلة ${MIN_LEAD}) و${counts.twinPairs} توأمًا تامًّا في ${counts.twinGroups} مجموعة`,
);
console.log(
  `  سقط ${counts.belowLead} دون الحدّ · و${counts.misaligned} لم تستقم محاذاتُه — والمُلزِمُ من ح١: ${counts.internalBeforeAlign}/${BINDING.internal} داخليًّا و${counts.twinPairsBeforeAlign}/${BINDING.twins} توأمًا`,
);
console.log(
  `  وُلّد ${generated} سؤالًا (عن الجهتين) فطابق نصَّ المصحف منها ${verified} · وعباراتُ التوائم ${twinTexts}`,
);
console.log(
  `  ضبطٌ سالب: تحريفُ كلمةٍ ${neg1 ? "لم يُصطَد ✗" : "اصطيد ✓"} · إقحامُ توأمٍ ومفرقٍ قصيرٍ ${neg2 ? "لم يُصطَد ✗" : "اصطيدا ✓"}`,
);
for (const f of failures.slice(0, 20)) console.log(`  ✗ [${f.check}] ${f.detail}`);
if (failures.length > 20) console.log(`  … و${failures.length - 20} غيرها`);
for (const m of missing) console.log(`  ؟ ${m}`);
if (!ok) process.exitCode = 1;

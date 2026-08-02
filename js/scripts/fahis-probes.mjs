/**
 * مسابرُ الفحص — «دعاوى معلومةُ الحكم يُعاد تشغيلُها قبل أيِّ تغيير» (الخطّة ٧٫٥ / البند ٤٫٤).
 *
 * كلُّ مسبارٍ يحمل: بطاقتَه، والجملةَ المرقومةَ كما نُشرت، والقيمةَ المجمَّدة،
 * ووصفةَ إعادةِ الحساب من قاعدة الوسم نفسِها (quran-kg.db). فإن انحرف رقمٌ —
 * لتغيّرِ قاعدةٍ أو وسمٍ أو بطاقةٍ — سقط التشغيلُ بصوتٍ عالٍ قبل أن يمرّ.
 *
 * التشغيل: node js/scripts/fahis-probes.mjs
 * ويستدعيه `fahis-lint.mjs --sync` تلقائيًّا متى وُجدت القاعدة — فالبوّابةُ
 * واحدةٌ: لا مزامنةَ للعرض إلا ومساميرُ الأرقام في مواضعها.
 *
 * أوّلُ حصاده (٢ آب ٢٠٢٦، قبل تجميده): ضبطُ آيات «مطر» (٩ لا ١٠) وضبطُ
 * اقتران الصلاة والزكاة على لفظَيه (٢٦ لا ٢٨) — بمراجعتين ظاهرتين في البطاقتين.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DBP = path.join(ROOT, "quran-kg.db");
const CARDS = path.join(ROOT, "js", "data", "fahis", "cards.json");
const PUB = path.join(ROOT, "js", "apps", "studio", "public", "fahis-cards.json");

// حركاتُ الضبط بمهارِبها الصريحة — لا مدياتِ حروفٍ حرفيّةً أبدًا (درسُ ى/ي)
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;
const bare = (s) => String(s ?? "").replace(MARKS, "");

/** المسابر: قيمٌ مجمَّدةٌ من بطاقاتٍ منشورةٍ + وصفةُ إعادتها من القاعدة */
const PROBES = [
  { card: "awrah-marah", says: "لفظُ «عورة»: أربعةُ مواضعَ لا غير", expect: 4, run: (q) => q.lemmaOcc("عورة") },
  { card: "hudud-allah", says: "تركيبُ «حدود الله» وما اشتُقّ منه: تسعُ آيات", expect: 9, run: (q) => q.one(`select count(distinct ayah_id) n from word where text_clean like '%حدود%'`) },
  { card: "hudud-ahkam", says: "لفظُ «الحدّ» مفردًا: صفرُ مواضع", expect: 0, run: (q) => q.rasm("الحد") },
  { card: "jizyah-marratan", says: "لفظُ «الجزية»: موضعٌ واحد", expect: 1, run: (q) => q.rasm("الجزية") },
  { card: "dhil-marah", says: "مادّةُ «ضلع»: صفرُ مواضع", expect: 0, run: (q) => q.rootOcc("ضلع") },
  { card: "dajjal-lafz", says: "مادّةُ «دجل»: صفر", expect: 0, run: (q) => q.rootOcc("دجل") },
  { card: "dajjal-lafz", says: "«المسيح»: أحدَ عشرَ موضعًا", expect: 11, run: (q) => q.rasm("المسيح") + q.rasm("والمسيح") },
  { card: "rajm-uqubah", says: "مادّةُ «رجم»: ١٤ موضعًا", expect: 14, run: (q) => q.rootOcc("رجم") },
  { card: "asbab-nuzul", says: "«يسألونك»: خمسةَ عشرَ موضعًا", expect: 15, run: (q) => q.rasm("يسألونك") + q.rasm("ويسألونك") },
  { card: "fawatih-suwar", says: "الفواتح بالوسم: ثلاثون موضعًا", expect: 30, run: (q) => q.inl().words },
  { card: "fawatih-suwar", says: "…في تسعٍ وعشرين سورة", expect: 29, run: (q) => q.inl().surahs },
  { card: "fawatih-suwar", says: "…من أربعةَ عشرَ حرفًا", expect: 14, run: (q) => q.inl().letters },
  { card: "zakat-tuhr-amwal", says: "مادّةُ «طهر»: ٣١ موضعًا", expect: 31, run: (q) => q.rootOcc("طهر") },
  { card: "raghba-azm-irada", says: "«رغب» ٨ مواضع", expect: 8, run: (q) => q.rootOcc("رغب") },
  { card: "raghba-azm-irada", says: "«عزم» ٩", expect: 9, run: (q) => q.rootOcc("عزم") },
  { card: "raghba-azm-irada", says: "«رود» ١٤٨", expect: 148, run: (q) => q.rootOcc("رود") },
  { card: "raghba-azm-irada", says: "لا اجتماعَ لزوجٍ من الموادّ الثلاث في آية", expect: 0, run: (q) => q.rootCo("رغب", "عزم") + q.rootCo("رغب", "رود") + q.rootCo("عزم", "رود") },
  { card: "saraf-tabdhir", says: "مادّةُ «سرف»: ٢٣ موضعًا في ٢١ آية", expect: "23/21", run: (q) => `${q.rootOcc("سرف")}/${q.rootAyat("سرف")}` },
  { card: "saraf-tabdhir", says: "مادّةُ «بذر»: ٣ مواضعَ في آيتين — ولا اجتماع", expect: "3/2/0", run: (q) => `${q.rootOcc("بذر")}/${q.rootAyat("بذر")}/${q.rootCo("سرف", "بذر")}` },
  { card: "lafz-aya", says: "المفردُ بصيغه ٨٦: آية ٤٧ · لآية ٢٠ · بآية ١٢ · وآية ٤ · آيتك ٢ · الآية ١", expect: "47+20+12+4+2+1=86", run: (q) => { const p = ["آية", "لآية", "بآية", "وآية", "آيتك", "الآية"].map((t) => q.rasm(t)); return `${p.join("+")}=${p.reduce((a, b) => a + b, 0)}`; } },
  { card: "lafz-aya", says: "المثنّى «آيتين» موضعٌ واحد", expect: 1, run: (q) => q.rasm("آيتين") },
  { card: "lafz-aya", says: "العددُ المذكور يطابق صيغتين لا غير: ٤٧+٢٠=٦٧", expect: 67, run: (q) => q.rasm("آية") + q.rasm("لآية") },
  { card: "salat-anbiya", says: "مادّةُ «صلو»: ٩٩ موضعًا", expect: 99, run: (q) => q.rootOcc("صلو") },
  { card: "salat-anbiya", says: "لفظا «الصلاة» و«الزكاة» معًا: ٢٦ آية", expect: 26, run: (q) => q.lemmaCo("صلاة", "زكاة") },
  { card: "umm-alkitab", says: "تركيبُ «أم الكتاب» في مواضعه الثلاثة", expect: 3, run: (q) => q.one(`select count(*) n from ayah where text_clean like '%أم الكتاب%'`) },
  { card: "matar-ghadab", says: "مادّةُ «مطر»: ١٥ موضعًا في ٩ آيات", expect: "15/9", run: (q) => `${q.rootOcc("مطر")}/${q.rootAyat("مطر")}` },
  { card: "nur-diya", says: "«ضياء» في مواضعه الثلاثة", expect: 3, run: (q) => q.one(`select count(*) n from word where text_clean like '%ضياء%'`) },
  { card: "wildan-ghilman", says: "مادّةُ «غلم»: ١٣ موضعًا", expect: 13, run: (q) => q.rootOcc("غلم") },
  { card: "wildan-ghilman", says: "لفظُ «الولدان»: ٦ مواضع", expect: 6, run: (q) => q.one(`select count(*) n from word where text_clean like '%ولدان%'`) },
];

/** عدّةُ الاستعلام — تُبنى مرّةً وتُمرَّر للمسابر */
function makeQ(db) {
  const one = (sql, ...a) => Number(Object.values(db.prepare(sql).get(...a))[0]);
  const lemmaIds = (bareForm) => db.prepare(`select lemma_id, lemma_ar from lemma`).all().filter((r) => bare(r.lemma_ar) === bareForm).map((r) => r.lemma_id);
  return {
    one,
    rasm: (t) => one(`select count(*) n from word where text_clean=?`, t),
    rootOcc: (r) => one(`select count(*) n from word w join root t on t.root_id=w.root_id where t.root_ar=?`, r),
    rootAyat: (r) => one(`select count(distinct w.ayah_id) n from word w join root t on t.root_id=w.root_id where t.root_ar=?`, r),
    rootCo: (a, b) => one(`select count(*) n from (select distinct w.ayah_id from word w join root t on t.root_id=w.root_id where t.root_ar=?) x join (select distinct w.ayah_id from word w join root t on t.root_id=w.root_id where t.root_ar=?) y on x.ayah_id=y.ayah_id`, a, b),
    lemmaOcc: (bareForm) => { const ids = lemmaIds(bareForm); return ids.length ? one(`select count(*) n from word where lemma_id in (${ids.join(",")})`) : 0; },
    lemmaCo: (a, b) => { const ia = lemmaIds(a), ib = lemmaIds(b); if (!ia.length || !ib.length) return -1; return one(`select count(*) n from (select distinct ayah_id from word where lemma_id in (${ia.join(",")})) x join (select distinct ayah_id from word where lemma_id in (${ib.join(",")})) y on x.ayah_id=y.ayah_id`); },
    inl: () => { const rows = db.prepare(`select distinct w.word_id, w.surah_no, w.text_clean from segment s join word w on w.word_id=s.word_id where s.pos='INL'`).all(); return { words: rows.length, surahs: new Set(rows.map((r) => r.surah_no)).size, letters: new Set(rows.flatMap((r) => bare(r.text_clean).split(""))).size }; },
  };
}

export async function runProbes({ quiet = false } = {}) {
  const say = (s) => { if (!quiet) console.log(s); };
  if (!existsSync(DBP)) return { skipped: true, pass: 0, fail: 0 };
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DBP, { readOnly: true });
  const q = makeQ(db);

  let pass = 0, fail = 0;
  const doc = JSON.parse(readFileSync(CARDS, "utf8"));
  const ids = new Set(doc.cards.map((c) => c.id));

  for (const p of PROBES) {
    if (!ids.has(p.card)) { fail++; console.error(`✗ مسبار ${p.card}: البطاقةُ غير موجودةٍ في المصدر الحاكم`); continue; }
    let got;
    try { got = p.run(q); } catch (e) { fail++; console.error(`✗ ${p.card} «${p.says}»: عطلُ وصفةٍ — ${e.message}`); continue; }
    if (String(got) === String(p.expect)) { pass++; }
    else { fail++; console.error(`✗ ${p.card} «${p.says}»: المتوقَّع ${p.expect} والمعادُ من القاعدة ${got}`); }
  }

  // سلامةُ البنية: معرِّفاتٌ وأرقامُ استشهادٍ فريدة
  const seenId = new Set(), seenN = new Set();
  for (const c of doc.cards) {
    if (seenId.has(c.id)) { fail++; console.error(`✗ معرِّف مكرَّر: ${c.id}`); } seenId.add(c.id);
    if (seenN.has(c.n)) { fail++; console.error(`✗ رقمُ استشهادٍ مكرَّر: ${c.n}`); } seenN.add(c.n);
  }
  pass++;

  // طزاجةُ نسخة العرض: المصدرُ الحاكم مجرَّدًا يطابق المنشورَ حرفًا حرفًا
  if (existsSync(PUB)) {
    const pub = JSON.parse(readFileSync(PUB, "utf8"));
    const strippedSrc = JSON.stringify(doc.cards.map(({ sources, ...rest }) => rest));
    if (strippedSrc === JSON.stringify(pub.cards)) pass++;
    else { fail++; console.error(`✗ نسخةُ العرض بائتة: المصدرُ الحاكم تغيّر ولم تُعَد المزامنة — شغِّل fahis-lint.mjs --sync`); }
  }

  say(`المسابر: ${pass} سليمًا · ${fail} منحرفًا${fail ? " — لا يمرّ تغييرٌ ومسمارٌ خارجَ موضعه" : ""}`);
  return { skipped: false, pass, fail };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await runProbes();
  if (r.skipped) { console.error("⚠ quran-kg.db غيرُ حاضرةٍ — المسابرُ لم تُشغَّل"); process.exit(2); }
  process.exit(r.fail ? 1 : 0);
}

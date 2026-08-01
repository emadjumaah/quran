/**
 * فحصُ الكلّيّة «لا ترادفَ في القرآن» — أصلُ أصولِ ثلاثةٍ من الباحثين.
 *
 * والكلّيّةُ لا تُفحص بشاهدٍ يوافقها، بل **بالبحث عمّا ينقضها**: فإن وُجد
 * زوجان يتبادلان مواقعَهما في المصحف سقط الإطلاق، وإن لم يوجد في أزواجٍ
 * كثيرةٍ مرشَّحةٍ قوي القول.
 *
 * والمقياسُ حسابيٌّ لا ذوقيّ — ثلاثةُ أوجه:
 *   ١) **التبادلُ في التركيب**: أيرد اللفظان في **جوارٍ لفظيٍّ واحد**؟ فإن ورد
 *      «فعل + س» و«فعل + ص» فالموقعُ واحدٌ وهو أقوى قرينةِ ترادف.
 *   ٢) **الاجتماعُ في آية**: اجتماعُهما معطوفَين قرينةُ **مغايرة** لا ترادف.
 *   ٣) **التفاوتُ في الشيوع**: الغلبةُ الشديدةُ لأحدهما قرينةُ اختصاص.
 *
 * والأزواجُ المرشَّحةُ **ليست من عندنا**: هي ما عدّه اللغويّون مترادفًا وفرّق
 * بينه أبو هلال العسكريّ في «الفروق» — فالمصدرُ خصمُ الدعوى لا نصيرُها،
 * وذلك أعدلُ في الاختبار.
 *
 * usage: node js/scripts/fahis-taraduf.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(HERE, "..", "..", "quran-kg.db"), { readOnly: true });
const norm = (s) => (s || "").replace(/[ً-ْٰـۖ-ۭ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي")
  .replace(/ة/g, "ه").replace(/[^؀-ۿ\s]/g, " ").replace(/\s+/g, " ").trim();

const ayat = db.prepare("SELECT location, text_clean FROM ayah").all()
  .map((a) => ({ loc: a.location, w: norm(a.text_clean).split(" ").filter(Boolean) }));

/** أزواجٌ عدّها اللغويّون مترادفةً وفرّق بينها أهلُ الفروق */
const PAIRS = [
  ["الخوف", "الخشية"], ["العلم", "المعرفة"], ["الحمد", "المدح"], ["الكسب", "الاكتساب"],
  ["القعود", "الجلوس"], ["الشح", "البخل"], ["الفؤاد", "القلب"], ["الحلف", "القسم"],
  ["الرؤيا", "الحلم"], ["السبيل", "الطريق"], ["البشر", "الإنسان"], ["الظلم", "الجور"],
  ["الرجس", "النجس"], ["العام", "السنة"], ["الجسم", "الجسد"], ["الرزق", "الطعام"],
];

/** صيغُ اللفظ كلُّها بالجذع — فالبحثُ بالمعرَّف وحدَه يُسقط أكثرَ المواضع */
const lemmaOf = db.prepare("SELECT lemma_id FROM word WHERE text_clean=? LIMIT 1");
const formsOf = db.prepare("SELECT DISTINCT text_clean f FROM word WHERE lemma_id=?");
function variants(word) {
  const bare = word.replace(/^ال/, "");
  for (const cand of [word, bare]) {
    const l = lemmaOf.get(cand);
    if (l?.lemma_id) return new Set(formsOf.all(l.lemma_id).map((r) => norm(r.f)));
  }
  return new Set([norm(word)]);
}

/** كلُّ مواضع لفظٍ: أيُّ كلمةٍ سبقته وأيُّ كلمةٍ تلته — لقياس الجوار */
function ctx(word) {
  const V = variants(word);
  const before = new Map(), after = new Map();
  const locs = [];
  for (const a of ayat) {
    for (let i = 0; i < a.w.length; i++) {
      if (!V.has(a.w[i])) continue;
      locs.push(a.loc);
      if (i > 0) before.set(a.w[i - 1], (before.get(a.w[i - 1]) ?? 0) + 1);
      if (i + 1 < a.w.length) after.set(a.w[i + 1], (after.get(a.w[i + 1]) ?? 0) + 1);
    }
  }
  return { n: locs.length, locs: [...new Set(locs)], before, after };
}

/**
 * الحروفُ والأدواتُ تسبق كلَّ شيءٍ وتتلو كلَّ شيء، فاشتراكُها لا يدلّ على
 * تبادلٍ ألبتّة — والمحكُّ الحقيقيُّ **اشتراكُ كلمةٍ ذاتِ معنًى**: أن يقع
 * اللفظان بعد فعلٍ واحدٍ أو قبل اسمٍ واحد. فتُستبعد الأدواتُ من الحساب.
 */
const STOP = new Set(["من","الي","علي","في","عن","ان","انه","انها","اذا","ما","لا","لم","لن",
  "هو","هي","هم","هن","انت","نحن","كان","كانوا","قال","قالوا","الذي","التي","الذين","هذا","هذه",
  "ذلك","تلك","كل","بعض","غير","مثل","به","بها","بهم","له","لها","لهم","لكم","لنا","وما","ولا",
  "ثم","او","بل","قد","لقد","يا","ايها","الله","رب","ربك","ربهم","و","ف","ب","ل","ك"]);
const inter = (a, b) => [...a.keys()].filter((k) => b.has(k) && !STOP.has(k) && k.length > 2);

console.log("فحصُ الكلّيّة «لا ترادفَ في القرآن» — بالبحث عمّا ينقضها\n");
console.log("| الزوج | العدد | يجتمعان | جوارٌ مشترك | القرينة |");
console.log("|---|---|---|---|---|");

let noOverlap = 0, someOverlap = 0, absent = 0;
const detail = [];
for (const [x, y] of PAIRS) {
  const A = ctx(x), B = ctx(y);
  if (!A.n || !B.n) { absent++; console.log(`| ${x} / ${y} | ${A.n}/${B.n} | — | — | أحدُهما لا يرد بهذا الرسم |`); continue; }
  const together = A.locs.filter((l) => B.locs.includes(l));
  const shBefore = inter(A.before, B.before), shAfter = inter(A.after, B.after);
  const shared = [...new Set([...shBefore, ...shAfter])];
  if (shared.length) someOverlap++; else noOverlap++;
  detail.push({ x, y, shared, together, A, B });
  console.log(`| ${x} / ${y} | ${A.n}/${B.n} | ${together.length} | ${shared.length ? shared.slice(0, 4).join(" · ") : "لا شيء"} | ${shared.length ? "تبادلٌ محتمَل" : "لا تبادل"} |`);
}

console.log(`\nالحصيلة: ${PAIRS.length} زوجًا — بلا جوارٍ مشترك ${noOverlap} · بجوارٍ مشترك ${someOverlap} · غائب ${absent}`);
console.log("\n— تفصيلُ ما ظهر فيه جوارٌ مشترك (وهو محكُّ النقض) —");
for (const d of detail.filter((d) => d.shared.length)) {
  console.log(`\n«${d.x}» / «${d.y}» — مشترَكٌ في: ${d.shared.join(" · ")}`);
  for (const s of d.shared.slice(0, 3)) {
    const inA = d.A.locs.filter((l) => ayat.find((a) => a.loc === l)?.w.includes(s)).slice(0, 2);
    const inB = d.B.locs.filter((l) => ayat.find((a) => a.loc === l)?.w.includes(s)).slice(0, 2);
    console.log(`   «${s}»: مع ${d.x} في ${inA.join(",")} · ومع ${d.y} في ${inB.join(",")}`);
  }
}

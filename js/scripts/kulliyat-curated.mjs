/**
 * الكلّيّاتُ المختارة — «اختيارٌ مراجَعٌ بأدلّةٍ محسوبة».
 *
 * بعد النتيجتين السالبتين (KULLIYAT-CEILING-2026-07-21.md): لا مقياسَ متّجهيًّا
 * يقيس الاندراج، ولا تضييقَ صرفيًّا يميّز جوامعَ الكلم — فالعمومُ في الصيغة ليس
 * الجمعَ في المعنى. فالحكمُ للقارئ، والحاسوبُ يتحقّق ويُسنِد.
 *
 * الترشيحُ هنا بالمعنى (بيد المساعد، بمراجعة المالك)، والسكربتُ:
 *   ١) يجلب نصَّ كلِّ آيةٍ من قاعدتنا لا من ذاكرةِ أحد — فالمرجعُ الخاطئ يفتضح.
 *   ٢) يُلحق أدلّتَها المحسوبة: بوّاباتُ صيغة القاعدة · صلاتُها المفحوصة في
 *      الشبكة (م/محاور) إن وُجدت · وحدةُ سياقها المحسوبة.
 *   ٣) يَسِمُ كلَّ مدخلٍ بصدق: «اختيارٌ مراجَع» لا «حسابٌ آليّ كامل».
 * ما لم يجتزِ التحقّقَ يُطبع محذَّرًا منه ولا يُنشر.
 *
 * usage: node js/scripts/kulliyat-curated.mjs
 * out:   findings/unified/KULLIYAT-CURATED.json + apps/studio/public/kulliyat-curated.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");

/** الدفعةُ الأولى — مرتَّبةٌ أبوابًا؛ العنوانُ وصفُ القاعدة لا تفسيرٌ لها */
const BATCH1 = [
  // ── التوحيد وأسماء الله ──
  { loc: "112:1", bab: "التوحيد", title: "أحديّةُ الله المطلقة" },
  { loc: "112:4", bab: "التوحيد", title: "نفيُ الكفء عن الله" },
  { loc: "42:11", bab: "التوحيد", title: "ليس كمثله شيء — نفيُ المماثلة" },
  { loc: "2:255", bab: "التوحيد", title: "قيّوميّةُ الله وإحاطةُ علمه ومُلكه" },
  { loc: "57:3", bab: "التوحيد", title: "الأوّلُ والآخرُ والظاهرُ والباطن" },
  { loc: "6:59", bab: "التوحيد", title: "مفاتحُ الغيب وإحاطةُ العلم بكل شيء" },
  { loc: "51:56", bab: "التوحيد", title: "الغايةُ من خلق الثقلين: العبادة" },
  { loc: "1:5", bab: "التوحيد", title: "حصرُ العبادة والاستعانة بالله" },

  // ── العدل والأخلاق الجامعة ──
  { loc: "16:90", bab: "العدل والإحسان", title: "جامعُ الأمر والنهي: العدلُ والإحسانُ وإيتاءُ ذي القربى" },
  { loc: "55:60", bab: "العدل والإحسان", title: "جزاءُ الإحسان إحسان" },
  { loc: "4:58", bab: "العدل والإحسان", title: "أداءُ الأمانات والحكمُ بالعدل" },
  { loc: "5:8", bab: "العدل والإحسان", title: "العدلُ مع المخالف: لا يحملنّكم بغضٌ على جور" },
  { loc: "4:135", bab: "العدل والإحسان", title: "القيامُ بالقسط ولو على النفس" },
  { loc: "7:199", bab: "العدل والإحسان", title: "خذ العفوَ وأمُرْ بالعرف وأعرضْ عن الجاهلين" },
  { loc: "41:34", bab: "العدل والإحسان", title: "ادفعْ بالتي هي أحسن" },
  { loc: "42:40", bab: "العدل والإحسان", title: "جزاءُ السيّئة بمثلها، والعفوُ أعظمُ أجرًا" },

  // ── ميزانُ التفاضل والاجتماع ──
  { loc: "49:13", bab: "الاجتماع", title: "ميزانُ التفاضل: التقوى لا النسب" },
  { loc: "49:10", bab: "الاجتماع", title: "أخوّةُ المؤمنين والإصلاحُ بينهم" },
  { loc: "49:12", bab: "الاجتماع", title: "اجتنابُ الظنّ والتجسّسِ والغِيبة" },
  { loc: "3:103", bab: "الاجتماع", title: "الاعتصامُ بحبل الله ونبذُ الفرقة" },
  { loc: "5:2", bab: "الاجتماع", title: "التعاونُ على البرّ لا على الإثم" },
  { loc: "42:38", bab: "الاجتماع", title: "الشورى أصلٌ في أمر الأمّة" },
  { loc: "3:104", bab: "الاجتماع", title: "الدعوةُ إلى الخير والأمرُ بالمعروف" },
  { loc: "9:71", bab: "الاجتماع", title: "ولايةُ المؤمنين بعضِهم بعضًا" },

  // ── النفس والعمل والجزاء ──
  { loc: "99:7", bab: "الجزاء", title: "مثقالُ الذرّة خيرًا يُرى" },
  { loc: "53:39", bab: "الجزاء", title: "ليس للإنسان إلا ما سعى" },
  { loc: "35:18", bab: "الجزاء", title: "لا تزرُ وازرةٌ وزرَ أخرى" },
  { loc: "2:286", bab: "الجزاء", title: "لا يكلّف اللهُ نفسًا إلا وسعها" },
  { loc: "13:11", bab: "الجزاء", title: "تغييرُ الحال يبدأ بتغيير النفس" },
  { loc: "103:2", bab: "الجزاء", title: "خسرانُ الإنسان إلا بأربع" },
  { loc: "6:160", bab: "الجزاء", title: "الحسنةُ بعشرٍ والسيّئةُ بمثلها" },

  // ── الابتلاء والصبر واليسر ──
  { loc: "2:155", bab: "الابتلاء", title: "سنّةُ الابتلاء وبشرى الصابرين" },
  { loc: "2:216", bab: "الابتلاء", title: "قد تكرهون ما هو خير لكم" },
  { loc: "94:5", bab: "الابتلاء", title: "مع العسر يسر" },
  { loc: "65:2", bab: "الابتلاء", title: "من يتّقِ الله يجعلْ له مخرجًا" },
  { loc: "39:53", bab: "الابتلاء", title: "سعةُ المغفرة والنهيُ عن القنوط" },
  { loc: "14:7", bab: "الابتلاء", title: "الشكرُ يزيد والكفرُ يُعقب العذاب" },

  // ── الدين واليسر والتكليف ──
  { loc: "2:185", bab: "اليسر", title: "يريد اللهُ بكم اليسر" },
  { loc: "22:78", bab: "اليسر", title: "ما جعل عليكم في الدين من حرج" },
  { loc: "2:256", bab: "اليسر", title: "لا إكراه في الدين" },
  { loc: "64:16", bab: "اليسر", title: "فاتقوا الله ما استطعتم" },

  // ── الوحي والرسالة ──
  { loc: "21:107", bab: "الرسالة", title: "الرسالةُ رحمةٌ للعالمين" },
  { loc: "33:21", bab: "الرسالة", title: "الأسوةُ الحسنة في الرسول" },
  { loc: "59:7", bab: "الرسالة", title: "ما آتاكم الرسولُ فخذوه" },
  { loc: "47:24", bab: "الرسالة", title: "الأمرُ بتدبّر القرآن" },
  { loc: "17:9", bab: "الرسالة", title: "هدايةُ القرآن للأقوم" },

  // ── كرامةُ الإنسان والكون ──
  { loc: "17:70", bab: "الإنسان والكون", title: "تكريمُ بني آدم" },
  { loc: "5:32", bab: "الإنسان والكون", title: "حرمةُ النفس: قتلُ نفسٍ كقتل الناس جميعًا" },
  { loc: "7:31", bab: "الإنسان والكون", title: "الأخذُ بالزينة والنهيُ عن الإسراف" },
  { loc: "55:7", bab: "الإنسان والكون", title: "وضعُ الميزان والنهيُ عن الطغيان فيه" },
];

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const NAME = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));
// الاستشهادُ بآيةٍ يكون برسم المصحف (أمر المالك 2026-07-26) — والإملائيُّ للبحث
const AY = new Map(db.prepare("SELECT location, text_uthmani, text_clean, word_count FROM ayah").all().map((r) => [r.location, r]));
const gates = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/kulliyat-v2/gates-v1.json"), "utf8"));
const ev = JSON.parse(fs.readFileSync(path.join(PUB, "v3-evidence.json"), "utf8"));
const ranks = JSON.parse(fs.readFileSync(path.join(PUB, "ranks-v1.json"), "utf8")).ranks;
const siyaq = JSON.parse(fs.readFileSync(path.join(PUB, "siyaq-units.json"), "utf8")).units.map((u, i) => ({ i, s: u[0], a1: u[1], a2: u[2], name: u[3] }));
const unitOf = (loc) => {
  const [s, a] = loc.split(":").map(Number);
  return siyaq.find((u) => u.s === s && u.a1 <= a && a <= u.a2) ?? null;
};

const out = [];
const bad = [];
for (const item of BATCH1) {
  const ay = AY.get(item.loc);
  if (!ay) { bad.push(`${item.loc} — لا وجودَ لهذا الموضع`); continue; }
  const g = gates[item.loc];
  const gs = [...new Set((g?.units ?? []).filter((u) => u.qualified).flatMap((u) => u.gates.map((x) => x.split(":")[1])))];
  const rels = {};
  for (const u of ev.verses[item.loc] ?? []) for (const [rel, ls] of Object.entries(u.links ?? {})) rels[rel] = [...new Set([...(rels[rel] ?? []), ...ls])];
  const rk = ranks[item.loc];
  const unit = unitOf(item.loc);
  out.push({
    loc: item.loc, bab: item.bab, title: item.title,
    ref: `${NAME.get(Number(item.loc.split(":")[0]))} ${item.loc.split(":")[1]}`,
    text: ay.text_uthmani ?? ay.text_clean,
    gates: gs,                       // بوّاباتُ صيغة القاعدة (محسوبة)
    m: Object.values(rels).flat().length,
    T: rk?.T ?? 0,
    rels,                            // الصلاتُ المفحوصة إن وُجدت
    netTier: rk?.r ?? (ev.verses[item.loc] ? "تفصيل" : "لم تجتز البوّابة"),
    unit: unit ? { name: unit.name, span: `${unit.s}:${unit.a1}-${unit.a2}` } : null,
  });
}

const byBab = {};
for (const r of out) (byBab[r.bab] ??= []).push(r);
console.log(`الدفعةُ الأولى: ${out.length} كلّيّةً مختارة · أبواب: ${Object.keys(byBab).length}\n`);
for (const [bab, list] of Object.entries(byBab)) {
  console.log(`━━ ${bab} (${list.length}) ━━`);
  for (const r of list) {
    const ev2 = r.m ? `صلاتٌ مفحوصة ${r.m}` : "لا صلاتِ فحصٍ عندها";
    console.log(`  ${r.ref.padEnd(14)} ${r.title}`);
    console.log(`     ${r.text.slice(0, 100)}`);
    console.log(`     بوّابات: ${r.gates.join("، ") || "—"} | ${ev2} | الوسمُ الشبكيّ: ${r.netTier} | مقطع: ${r.unit?.name ?? "—"}`);
  }
  console.log("");
}
if (bad.length) { console.log("✗ لم يجتزِ التحقّق:"); bad.forEach((b) => console.log("  " + b)); }

const payload = {
  meta: {
    date: "2026-07-21",
    grade: "اختيارٌ مراجَعٌ بأدلّةٍ محسوبة",
    note: "الترشيحُ بالمعنى (مساعدُ مشكاة، بمراجعة المالك)؛ النصوصُ والبوّاباتُ والصلاتُ والمقاطعُ محسوبةٌ من بياناتنا. ليس حسابًا آليًّا كاملًا، ولا يُقرأ حكمًا على ما سواه.",
    count: out.length,
  },
  kulliyat: out,
};
fs.writeFileSync(path.join(ROOT, "findings/unified/KULLIYAT-CURATED.json"), JSON.stringify(payload, null, 1));
fs.writeFileSync(path.join(PUB, "kulliyat-curated.json"), JSON.stringify(payload));
console.log(`✓ findings/unified/KULLIYAT-CURATED.json + public/kulliyat-curated.json`);

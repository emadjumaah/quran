/**
 * عدُّ «الرسم الأوّل» بقاعدة صاحبها — شرطُ إمكان الفحص العادل لباب العدد كلِّه.
 *
 * القاعدةُ المستخرَجةُ من نصّه (FAHIS-USUL — الملحق): الرسمُ الأوّل · بلا همزٍ
 * ولا ضبطٍ ولا ألفٍ مقصورة · وواوُ العطف مُلحقةٌ بما بعدها. وبعضُ حدودها لم
 * يُنصَّ عليه (أتدخل البسملةُ في عدِّ السورة؟ ماذا تصير المقصورة؟) — **فتُعايَر
 * الآلةُ على مراسيه هو**: أرقامٌ نشرها بنفسه (حروفُ «م ر ي م» في مريم:
 * ٢٨٧ · ١٦٧ · ٣٤٢ · ٢٨٧، وألفُ يس ٤٨٢، والعلقُ ٧٦ كلمةً و٢٨٥ حرفًا،
 * ومريمُ ١٠٨٣ كلمة). فإن أعادت تركيبةٌ من الحدود أرقامَه ثبتت قاعدتُه
 * واعتُمدت في فحص الباقي؛ وما لا تُعيده تركيبةٌ معقولةٌ يُعلن على حاله.
 *
 * الأساس: الرسمُ العثمانيُّ في القاعدة، مجرَّدًا من الضبط وعلاماتِ التجويد
 * والحروفِ الصغيرة — فهي إعانةُ نطقٍ لا حروفَ رسم.
 *
 * usage: node js/scripts/fahis-rasm-awwal.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(HERE, "..", "..", "quran-kg.db"), { readOnly: true });

// ── التجريد الأساس: يبقى هيكلُ الرسم وحدَه ──────────────────────────────────
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/gu;
function skeleton(s, keepDagger) {
  let t = s.replace(/ٱ/g, "ا");
  if (keepDagger) t = t.replace(/ٰ/g, "ا"); // الألفُ الخنجريّةُ ألفًا مرسومة
  return t.replace(MARKS, "");
}

/** تجريدُ الهمز والمقصورة بحسب حدود التركيبة */
function rasm0(s, o) {
  let t = skeleton(s, o.dagger);
  if (o.hamza) t = t.replace(/[أإآ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "");
  if (o.maqsura) t = t.replace(/ى/g, "ي");
  return t;
}

// ── نصُّ المصحف وواواتُ العطف ────────────────────────────────────────────────
const words = db.prepare("SELECT word_id, surah_no s, text_uthmani t FROM word ORDER BY surah_no, ayah_no, word_no").all();
const conjWaw = new Set(
  db.prepare(`SELECT s.word_id FROM segment s
    WHERE s.seg_no = 1 AND s.pos = 'CONJ' AND REPLACE(REPLACE(s.text,'َ',''),'ٱ','') = 'و'`).all().map((r) => r.word_id),
);

const BASMALA = ["بِسْمِ", "ٱللَّهِ", "ٱلرَّحْمَٰنِ", "ٱلرَّحِيمِ"];

function surahStats(surah, o) {
  let ws = words.filter((w) => w.s === surah);
  let wordCount = 0;
  const letters = new Map();
  const add = (txt) => { for (const ch of rasm0(txt, o)) letters.set(ch, (letters.get(ch) ?? 0) + 1); };
  for (const w of ws) {
    if (!(o.waw && conjWaw.has(w.word_id))) wordCount++;
    add(w.t);
  }
  if (o.basmala && surah !== 1 && surah !== 9) {
    wordCount += o.waw ? 4 : 4; // لا واوَ في البسملة
    for (const b of BASMALA) add(b);
  }
  const total = [...letters.values()].reduce((a, b) => a + b, 0);
  return { wordCount, letters, total };
}

// ── مراسي المعايرة — أرقامُه المنشورةُ بلفظه ─────────────────────────────────
const ANCHORS = [
  { label: "مريم: م", his: 287, get: (o) => surahStats(19, o).letters.get("م") ?? 0 },
  { label: "مريم: ر", his: 167, get: (o) => surahStats(19, o).letters.get("ر") ?? 0 },
  { label: "مريم: ي", his: 342, get: (o) => surahStats(19, o).letters.get("ي") ?? 0 },
  { label: "مريم: حروفها", his: 3876, get: (o) => surahStats(19, o).total },
  { label: "مريم: كلماتها", his: 1083, get: (o) => surahStats(19, o).wordCount },
  { label: "يس: ا", his: 482, get: (o) => surahStats(36, o).letters.get("ا") ?? 0 },
  { label: "العلق: حروفها", his: 285, get: (o) => surahStats(96, o).total },
  { label: "العلق: كلماتها", his: 76, get: (o) => surahStats(96, o).wordCount },
];

console.log("معايرةُ «الرسم الأوّل» على مراسي صاحب القاعدة\n");
console.log("التركيبة: همز = تجريدُ مقاعد الهمز · مقصورة = ى←ي · بسملة = تُعدّ مع السورة · واو = عطفُها مُلحق\n");

const header = ["التركيبة", ...ANCHORS.map((a) => a.label)];
console.log("| " + header.join(" | ") + " |");
console.log("|" + header.map(() => "---").join("|") + "|");
console.log("| **عندَه** | " + ANCHORS.map((a) => `**${a.his}**`).join(" | ") + " |");

const combos = [];
for (const dagger of [true, false])
  for (const hamza of [true, false])
    for (const maqsura of [true, false])
      for (const basmala of [true, false])
        for (const waw of [true, false]) combos.push({ dagger, hamza, maqsura, basmala, waw });

let best = null;
for (const o of combos) {
  const vals = ANCHORS.map((a) => a.get(o));
  const hits = vals.filter((v, i) => v === ANCHORS[i].his).length;
  if (hits < 3) continue; // تُطبع الوافياتُ وحدَها — والمصفوفةُ الكاملةُ تُعاد بإزالة هذا الشرط
  const name = [o.dagger ? "خنجرية" : "·", o.hamza ? "همز" : "·", o.maqsura ? "مقصورة" : "·", o.basmala ? "بسملة" : "·", o.waw ? "واو" : "·"].join("+");
  console.log(`| ${name} | ` + vals.map((v, i) => (v === ANCHORS[i].his ? `**${v} ✓**` : v)).join(" | ") + " |");
  if (!best || hits > best.hits) best = { o, hits, vals };
}

console.log(`\nأوفقُ تركيبة: ${JSON.stringify(best.o)} — طابقت ${best.hits} من ${ANCHORS.length} مراسٍ.`);

// ── مسابرُ عدِّ الكلمات: ما الذي يُخرج ١٠٨٣ لمريم و٧٦ للعلق؟ ─────────────────
console.log("\n— مسابرُ الكلمات (بتجريد الرسم الأوفق) —");
for (const surah of [19, 96]) {
  const ws = words.filter((w) => w.s === surah);
  const toks = ws.map((w) => rasm0(w.t, best.o));
  const waw = ws.filter((w) => conjWaw.has(w.word_id)).length;
  const al = toks.filter((t) => /^و?ال./.test(t)).length;
  const ya = toks.filter((t) => /^و?يا./.test(t)).length;
  const base = toks.length;
  console.log(`سورة ${surah}: كلماتُ المصحف ${base} · واواتُ عطفٍ ${waw} · معرَّفٌ بأل ${al} · نداءٌ بيا مدمجةٌ ${ya} · بالبسملة ${base + 4}`);
  console.log(`  احتمالات: +واو مفصولة=${base + waw} · +أل مفصولة=${base + al} · +الاثنتين=${base + waw + al} · +واو+بسملة=${base + waw + 4} · +أل+بسملة=${base + al + 4} · +الاثنتين+بسملة=${base + waw + al + 4} · +يا=${base + ya}`);
}

// ── وبها تُفحص دعوى الاجتماع: «الشمس مع القمر في الآية نفسِها ١٩ مرّة» ────────
const ayat = db.prepare("SELECT surah_no s, ayah_no a, GROUP_CONCAT(text_uthmani, ' ') t FROM word GROUP BY surah_no, ayah_no").all();
for (const o of [best.o, { ...best.o, hamza: true, maqsura: true }]) {
  let both = 0;
  const locs = [];
  for (const ay of ayat) {
    const t = " " + rasm0(ay.t, o).replace(/ /g, "  ") + " ";
    const has = (w) => new RegExp(`(^| )(و?(ال)?)${w}( |$)`).test(rasm0(ay.t, o).split(" ").join("\n").replace(/\n/g, " ")) ||
      rasm0(ay.t, o).split(" ").some((tok) => tok.replace(/^و/, "").replace(/^ال/, "") === w || tok.replace(/^و/, "").replace(/^ب/, "").replace(/^ال/, "") === w);
    if (has("شمس") && has("قمر")) { both++; locs.push(`${ay.s}:${ay.a}`); }
  }
  console.log(`\nآياتٌ فيها «الشمس» و«القمر» معًا (لفظًا بسوابقه، بهذه التركيبة): ${both}`);
  console.log("  " + locs.join(" · "));
  break;
}

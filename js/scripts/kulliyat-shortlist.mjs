/**
 * قائمةُ المراجعة للكلّيّات — تضييقٌ حتميٌّ يسبق حكمَ القارئ.
 *
 * بعد النتيجة السالبة (KULLIYAT-CEILING-2026-07-21.md): لا مقياسَ متّجهيًّا يقيس
 * الاندراج، فالحكمُ للقارئ. وهذا السكربت لا يحكم — إنما يضيّق ٢٬٥٣٧ مؤهَّلًا
 * بالبوّابة إلى قائمةٍ قابلةٍ للقراءة بشروطٍ معلنة، ثم يُقرأ كلُّ سطرٍ ويُختار
 * بالحكم المباشر (بلا أسراب — أمر المالك 2026-07-21).
 *
 * شروطُ التضييق (كلُّها حتميّةٌ ظاهرة):
 *   ١) اجتازت بوّابةَ صيغة القاعدة (gates-v1) بلا حواجب.
 *   ٢) إيجازُ اللفظ: ≤ ٢٨ كلمة — جوامعُ الكلم موجزة.
 *   ٣) بوّابةُ عمومٍ صريحة: كل/جميع · شرط · نفي+نكرة · حصر · موصول · تشريع ·
 *      اسميّةٌ لله · أمرٌ جمعيّ — لا مجرّدَ إسنادٍ خبريّ.
 *   ٤) لا عَلَمَ شخصيًّا في الآية (عدا لفظ الجلالة والأعيان الشرعيّة).
 *
 * usage: node js/scripts/kulliyat-shortlist.mjs > /tmp/shortlist.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");

const gates = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/kulliyat-v2/gates-v1.json"), "utf8"));
const ev = JSON.parse(fs.readFileSync(path.join(PUB, "v3-evidence.json"), "utf8"));
const ranks = JSON.parse(fs.readFileSync(path.join(PUB, "ranks-v1.json"), "utf8")).ranks;

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const AY = db.prepare("SELECT ayah_id, location, text_clean, word_count, surah_no FROM ayah ORDER BY ayah_id").all();
const NAME = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));
const nm = (loc) => `${NAME.get(Number(loc.split(":")[0]))} ${loc.split(":")[1]}`;

// أعلامُ الأشخاص في كل آية (QAC) — عدا لفظ الجلالة والأعيان الشرعيّة المعلنة
const DOCTRINAL = new Set(["الله", "اللهم", "جهنم", "شيطان", "قرآن", "جنة", "توراة", "إنجيل", "إسلام", "رمضان", "فردوس", "سقر", "عدن", "زبور", "فرقان", "كوثر", "تسنيم", "سلسبيل", "عليون", "سجين", "آدم", "إبليس"]);
const pnByAyah = new Map();
for (const r of db.prepare("SELECT a.location, s.text FROM segment s JOIN word w ON w.word_id=s.word_id JOIN ayah a ON a.ayah_id=s.ayah_id WHERE s.pos='PN'").all()) {
  const t = (r.text || "").normalize("NFC").replace(/[ً-ْٰـٱ]/g, "");
  if (DOCTRINAL.has(t) || [...DOCTRINAL].some((d) => t.includes(d.replace(/^ال/, "")))) continue;
  (pnByAyah.get(r.location) ?? pnByAyah.set(r.location, []).get(r.location)).push(t);
}

const GENERAL = ["كل/جميع", "شرط-العموم", "شرط-الخطاب", "نفي+نكرة", "حصر-إلا", "حصر-مفرَّغ", "حصر-إنما", "قصر-إيّا", "موصول-العموم", "تشريع", "اسم-مفعول-تشريعي", "اسمية-لله", "أمر-جمعي", "نهي-جمعي", "لام-الأمر"];

const out = [];
for (const a of AY) {
  const g = gates[a.location];
  if (!g?.qualified) continue;
  if (a.word_count > 28) continue;
  const gs = [...new Set((g.units ?? []).filter((u) => u.qualified).flatMap((u) => u.gates.map((x) => x.split(":")[1])))];
  if (!gs.some((x) => GENERAL.includes(x))) continue;
  if ((pnByAyah.get(a.location) ?? []).length) continue;
  const rk = ranks[a.location];
  const rels = {};
  for (const u of ev.verses[a.location] ?? []) for (const [rel, ls] of Object.entries(u.links ?? {})) rels[rel] = [...new Set([...(rels[rel] ?? []), ...ls])];
  out.push({
    loc: a.location, text: a.text_clean, w: a.word_count, gates: gs,
    m: rk?.m ?? Object.values(rels).flat().length, T: rk?.T ?? 0, tier: rk?.r ?? "تفصيل",
    // ترتيبُ القراءة: الأعمُّ لفظًا والأوجزُ أولًا — ترتيبُ عرضٍ لا حكم
    ord: gs.filter((x) => GENERAL.includes(x)).length * 3 + Math.max(0, 28 - a.w) / 4,
  });
}
out.sort((x, y) => y.ord - x.ord || x.loc.localeCompare(y.loc));

console.log(`مؤهَّلو البوّابة: 2537 · بعد التضييق: ${out.length}\n`);
out.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(4)}. ${nm(r.loc).padEnd(15)} [${r.loc}] ك${String(r.w).padStart(2)} م${String(r.m).padStart(2)} ${r.tier.padEnd(6)} ${r.gates.join("،").slice(0, 30)}`);
  console.log(`      ${r.text}`);
});
fs.writeFileSync(path.join(ROOT, "findings/unified/KULLIYAT-SHORTLIST.json"), JSON.stringify({ meta: { date: "2026-07-21", filters: "بوّابة + ≤٢٨ كلمة + بوّابة عموم صريحة + بلا علَم شخصي", count: out.length }, rows: out }, null, 1));

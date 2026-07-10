/**
 * Findings package — exports Pass A (الجوامع) and Pass B (التفصيل) into
 * durable, reusable artifacts under findings/:
 *
 *   findings/PASS-A-الجوامع.md   methodology + rubric + full lists (human)
 *   findings/PASS-B-التفصيل.md   methodology + the محكم→تفصيل graph (human)
 *   findings/quran-tafsil.json   machine-readable graph
 *   (quran-principles.json at repo root is the Pass A machine export)
 *
 * Usage: node scripts/export-findings.mjs   (after harvest-pass-a/b)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DB = path.join(ROOT, "quran-kg.db");
const DIR = path.join(ROOT, "findings");
fs.mkdirSync(DIR, { recursive: true });

const db = new DatabaseSync(DB, { readOnly: true });
const ayah = new Map(
  db.prepare("SELECT ayah_id, location, surah_no, text_clean FROM ayah").all().map((r) => [r.ayah_id, r]),
);
const surahName = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));
const ref = (id) => {
  const a = ayah.get(id);
  return `${surahName.get(a.surah_no)} ${a.location.split(":")[1]} (${a.location})`;
};

/* ---------------- Pass A ---------------- */
const principles = db.prepare("SELECT ayah_id, p, kind FROM ayah_principle ORDER BY ayah_id").all();
const p2 = principles.filter((r) => r.p === 2);
const p1 = principles.filter((r) => r.p === 1);
const byKind = {};
for (const r of p2) (byKind[r.kind] ??= []).push(r);

let mdA = `# الآيات الجوامع — نتائج التصنيف الكامل (Pass A)

**التاريخ:** 2026-07-10 · **الطريقة:** تصنيف كل آيات القرآن (٦٢٣٦) بواسطة سرب من
١٤٤ وكيلًا (دفعات ٨٠ آية) وفق معيار صارم موحّد · **المصدر:** جدول \`ayah_principle\`
في quran-kg.db · **الأصل الآلي:** quran-principles.json

## المعيار (rubric)

الآية «جامعة» (p=2) إذا قررت قاعدة عامة تتجاوز حدثًا أو شخصًا بعينه:
**حكم** (تشريع عملي عام) · **أخلاق** (مبدأ خلقي عام) · **عقيدة** (أصل اعتقادي/صفة
إلهية مقررة كقاعدة) · **سنة** (قانون إلهي في الخلق أو التاريخ) · **وعد** (وعد أو
وعيد عام معلق على وصف لا على أشخاص). p=1 للحدّي (عامّ اللفظ مرتبط بسياقه أو جزء
من مبدأ ممتد). ليست جامعةً: وقائع القصص وأقوال أصحابها، الحوادث المعينة، مشاهد
الجنة والنار الوصفية، الأسئلة والتحديات والأقسام والحروف المقطعة، الأدعية،
الخطابات الخاصة بالنبي ﷺ في واقعة معينة.

## الإحصاء

| p | العدد |
|---|---|
| 2 — جامعة صريحة | **${p2.length}** |
| 1 — حدّية | ${p1.length} |
| 0 — ليست جامعة | ${principles.length - p2.length - p1.length} |

بحسب النوع (p=2): ${Object.entries(byKind).map(([k, v]) => `${k} ${v.length}`).join(" · ")}

**اختبار الصدق:** كل الجوامع المشهورة نالت p=2 دون أي توجيه مسبق (آية الكرسي،
النحل ٩٠، النساء ٥٨، الإخلاص ١، الزمر ٥٣، الشورى ١١، الحجرات ١٣، العصر ٢،
الأنعام ١٥١، الطلاق ٢) — وآية المحكمات نفسها (آل عمران ٧) نالت p=1.

`;
for (const [kind, rows] of Object.entries(byKind)) {
  mdA += `\n## ${kind} (${rows.length})\n\n`;
  for (const r of rows) mdA += `- **${ref(r.ayah_id)}** — ${ayah.get(r.ayah_id).text_clean}\n`;
}
mdA += `\n## الحدّية p=1 (${p1.length}) — مواضع فقط\n\n`;
mdA += p1.map((r) => `${ayah.get(r.ayah_id).location} (${r.kind ?? "?"})`).join(" · ") + "\n";
fs.writeFileSync(path.join(DIR, "PASS-A-الجوامع.md"), mdA);
console.log(`PASS-A md: ${(mdA.length / 1024).toFixed(0)} KB`);

/* ---------------- Pass B ---------------- */
let hasB = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='ayah_tafsil'").get().n;
if (hasB) {
  const links = db.prepare("SELECT hub_ayah_id h, tafsil_ayah_id t, rel FROM ayah_tafsil ORDER BY hub_ayah_id, rel").all();
  const byHub = new Map();
  for (const l of links) (byHub.get(l.h) ?? byHub.set(l.h, []).get(l.h)).push(l);
  const relCount = {};
  for (const l of links) relCount[l.rel] = (relCount[l.rel] ?? 0) + 1;
  const hubsWithLinks = [...byHub.entries()].sort((a, b) => b[1].length - a[1].length);

  let mdB = `# محكم ← تفصيل — الشبكة الكاملة (Pass B)

**التاريخ:** 2026-07-10 · **الطريقة:** لكل جامعة (p=2) رُشّح ~٢٦ نظيرًا (أقرب
المتجهات ∪ مشاركة الجذور النادرة)، وحكم سربٌ من ٨٦ وكيلًا على كل مرشح بمعيار
صارم؛ القبول بأربع علاقات فقط: **بيان** (تفصيل الحكم وشروطه) · **مثال** (واقعة
محكومة بالقاعدة) · **جزاء** (تفصيل الثواب/العقاب الموعود) · **توكيد** (تقرير
القاعدة نفسها بصياغة أخرى). الاختيار الفارغ إجابة صحيحة.
**المصدر:** جدول \`ayah_tafsil\` · **الأصل الآلي:** findings/quran-tafsil.json

## الإحصاء

- جوامع لها تفصيل: **${byHub.size}** من ${p2.length}
- مجموع الروابط: **${links.length}** (${Object.entries(relCount).map(([k, v]) => `${k} ${v}`).join(" · ")})

`;
  for (const [h, ls] of hubsWithLinks) {
    mdB += `\n### ${ref(h)}\n> ${ayah.get(h).text_clean}\n\n`;
    for (const l of ls) mdB += `- ${l.rel} — **${ref(l.t)}**: ${ayah.get(l.t).text_clean.slice(0, 90)}${ayah.get(l.t).text_clean.length > 90 ? "…" : ""}\n`;
  }
  fs.writeFileSync(path.join(DIR, "PASS-B-التفصيل.md"), mdB);

  const json = hubsWithLinks.map(([h, ls]) => ({
    hub: ayah.get(h).location,
    kind: p2.find((r) => r.ayah_id === h) ? db.prepare("SELECT kind FROM ayah_principle WHERE ayah_id=?").get(h).kind : null,
    tafsil: ls.map((l) => ({ loc: ayah.get(l.t).location, rel: l.rel })),
  }));
  fs.writeFileSync(path.join(DIR, "quran-tafsil.json"), JSON.stringify(json, null, 1));
  console.log(`PASS-B md: ${(mdB.length / 1024).toFixed(0)} KB, links ${links.length}`);
} else {
  console.log("ayah_tafsil not present yet — run harvest-pass-b first");
}
db.close();

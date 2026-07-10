/**
 * Categorize the جوامع — neutral, computed facets over Pass A principles.
 *
 * Facet 1 (ready now, needs only Pass A + morphology):
 *   tahrim   — explicit prohibition present (root ح-ر-م among the ayah's words)
 *   hasr     — restriction/exclusivity particle (إنّما / negation+exception)
 *   amr_nahy — imperative or prohibition (لا الناهية) verb present
 * These are LINGUISTIC features, not theological claims — they surface the
 * "الأحكام الحاصرة" facet the Shahrour lens points at, without adopting it.
 *
 * Facet 2 (deferred until Pass B complete): grade = branching vs terminal by
 * تفصيل-degree (COUNT in ayah_tafsil).
 *
 * Writes columns onto ayah_principle; prints counts. Idempotent.
 * Usage: node scripts/categorize-jawami.mjs
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const db = new DatabaseSync(DB);

for (const col of ["tahrim INTEGER DEFAULT 0", "hasr INTEGER DEFAULT 0", "amr_nahy INTEGER DEFAULT 0", "grade TEXT"]) {
  try { db.exec(`ALTER TABLE ayah_principle ADD COLUMN ${col}`); } catch { /* exists */ }
}

const jawami = db.prepare("SELECT ayah_id FROM ayah_principle WHERE p=2").all().map((r) => r.ayah_id);

// morphology signals per ayah
const HARAM_ROOT = "حرم";
const upd = db.prepare("UPDATE ayah_principle SET tahrim=?, hasr=?, amr_nahy=? WHERE ayah_id=?");

// tahrim = the VERB حَرَّم (root ح-ر-م, form II) — not the noun حَرام/حُرُم "sacred"
const lemmaHaram = new Map();
for (const r of db.prepare(
  "SELECT DISTINCT g.ayah_id a FROM segment g JOIN root r ON r.root_id=g.root_id WHERE r.root_ar='حرم' AND g.pos_basic='V'"
).iterate()) lemmaHaram.set(r.a, 1);
const wordRoots = db.prepare(`
  SELECT w.ayah_id a, GROUP_CONCAT(r.root_ar) roots
  FROM word w LEFT JOIN root r ON r.root_id=w.root_id WHERE w.ayah_id=? GROUP BY w.ayah_id`);
// segment features per ayah: RES particle (إنّما/حصر) and imperative/prohibition
const segFeat = db.prepare(`
  SELECT
    MAX(CASE WHEN pos='RES' OR pos='EXP' THEN 1 ELSE 0 END) has_res,
    MAX(CASE WHEN aspect='IMPV' OR pos='PRO' OR pos='IMPV_LAM' THEN 1 ELSE 0 END) has_cmd,
    MAX(CASE WHEN pos='NEG' THEN 1 ELSE 0 END) has_neg
  FROM segment g JOIN word w ON w.word_id=g.word_id WHERE w.ayah_id=?`);

let t = 0, h = 0, c = 0;
db.exec("BEGIN");
for (const id of jawami) {
  // tahrim: require the VERB lemma حَرَّم/حُرِّم (not حَرام/حُرُم "sacred")
  const lem = (lemmaHaram.get(id) ?? 0);
  const tahrim = lem ? 1 : 0;
  const sf = segFeat.get(id) ?? {};
  const hasr = sf.has_res ? 1 : 0;
  const amrNahy = sf.has_cmd || sf.has_neg ? 1 : 0;
  upd.run(tahrim, hasr, amrNahy, id);
  t += tahrim; h += hasr; c += amrNahy;
}
db.exec("COMMIT");

console.log(`الجوامع (p=2): ${jawami.length}`);
console.log(`  تحريم صريح (root ح-ر-م): ${t}`);
console.log(`  حصر/قصر (إنّما/استثناء): ${h}`);
console.log(`  أمر أو نهي: ${c}`);

/* ---------- Facet 2: grade by تفصيل-degree (needs Pass B + reviewed Pass C) ---------- */
const hasTafsil = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='ayah_tafsil'").get().n;
if (hasTafsil) {
  const hasReview = db.prepare("SELECT COUNT(*) n FROM pragma_table_info('ayah_tafsil') WHERE name='review'").get().n;
  const surviving = hasReview ? "AND (review IS NULL OR review!='reject')" : "";
  // out-degree: how many surviving تفصيل a جامعة elaborates into
  const outDeg = new Map();
  for (const r of db.prepare(`SELECT hub_ayah_id h, COUNT(*) n FROM ayah_tafsil WHERE 1=1 ${surviving} GROUP BY hub_ayah_id`).iterate())
    outDeg.set(r.h, r.n);
  // in-degree: is this جامعة itself a تفصيل of a higher جامعة? (→ it's a branch, not a root)
  const inDeg = new Map();
  for (const r of db.prepare(`SELECT tafsil_ayah_id t, COUNT(*) n FROM ayah_tafsil WHERE 1=1 ${surviving} GROUP BY tafsil_ayah_id`).iterate())
    inDeg.set(r.t, r.n);

  const gradeUpd = db.prepare("UPDATE ayah_principle SET grade=? WHERE ayah_id=?");
  const g = { "أصل جامع": 0, "متفرّع": 0, "موجز": 0, "مجرّد": 0 };
  db.exec("BEGIN");
  for (const id of jawami) {
    const out = outDeg.get(id) ?? 0;
    const inn = inDeg.get(id) ?? 0;
    // أصل جامع: branches widely and is not itself elaborated by a higher آية (a network root)
    // متفرّع: elaborates others yet is also elaborated by a higher principle (an internal node)
    // موجز: has a little تفصيل · مجرّد: stands alone with no surviving تفصيل
    let grade;
    if (out >= 8 && inn === 0) grade = "أصل جامع";
    else if (out >= 1 && inn >= 1) grade = "متفرّع";
    else if (out >= 1) grade = "موجز";
    else grade = "مجرّد";
    gradeUpd.run(grade, id);
    g[grade]++;
  }
  db.exec("COMMIT");
  console.log(`\n=== الدرجة (grade) بحسب درجة التفصيل ===`);
  for (const [k, v] of Object.entries(g)) console.log(`  ${k.padEnd(10)} ${v}`);
  const roots = db.prepare(`
    SELECT a.location, substr(a.text_clean,1,46) t,
      (SELECT COUNT(*) FROM ayah_tafsil x WHERE x.hub_ayah_id=ap.ayah_id ${surviving.replace(/review/g,"x.review")}) deg
    FROM ayah_principle ap JOIN ayah a ON a.ayah_id=ap.ayah_id
    WHERE ap.grade='أصل جامع' ORDER BY deg DESC LIMIT 15`).all();
  console.log(`\n  أوسع الأصول الجامعة تفصيلًا:`);
  for (const r of roots) console.log(`  ${String(r.deg).padStart(3)}  ${r.location.padEnd(7)} ${r.t}`);
}

// the "الأحكام الحاصرة للمحرمات" set = حكم-kind + explicit tahrim
const hasira = db.prepare(`
  SELECT a.location, substr(a.text_clean,1,50) t FROM ayah_principle ap JOIN ayah a ON a.ayah_id=ap.ayah_id
  WHERE ap.p=2 AND ap.kind='حكم' AND ap.tahrim=1 ORDER BY a.surah_no, a.ayah_no`).all();
console.log(`\n=== الأحكام الحاصرة للمحرمات (حكم + تحريم صريح): ${hasira.length} ===`);
for (const r of hasira.slice(0, 25)) console.log(`  ${r.location.padEnd(7)} ${r.t}`);
if (hasira.length > 25) console.log(`  … +${hasira.length - 25}`);
db.close();

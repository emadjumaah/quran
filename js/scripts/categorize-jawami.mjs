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
  const roots = (wordRoots.get(id)?.roots ?? "").split(",");
  const tahrim = roots.includes(HARAM_ROOT) ? 1 : 0;
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

// the "الأحكام الحاصرة للمحرمات" set = حكم-kind + explicit tahrim
const hasira = db.prepare(`
  SELECT a.location, substr(a.text_clean,1,50) t FROM ayah_principle ap JOIN ayah a ON a.ayah_id=ap.ayah_id
  WHERE ap.p=2 AND ap.kind='حكم' AND ap.tahrim=1 ORDER BY a.surah_no, a.ayah_no`).all();
console.log(`\n=== الأحكام الحاصرة للمحرمات (حكم + تحريم صريح): ${hasira.length} ===`);
for (const r of hasira.slice(0, 25)) console.log(`  ${r.location.padEnd(7)} ${r.t}`);
if (hasira.length > 25) console.log(`  … +${hasira.length - 25}`);
db.close();

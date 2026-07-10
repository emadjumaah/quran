/**
 * Pass C harvester — applies the adversarial review verdicts to the network.
 * Keeps the original link (never destroys data); adds a `review` column:
 *   confirm  → kept as-is
 *   reweight → rel corrected to the reviewer's rel
 *   reject   → marked rejected (excluded from the final/app view, still stored)
 * Also records weak hubs (hub_ok=false) and suggested missing تفصيل (gaps).
 *
 * Idempotent. Usage: node scripts/harvest-pass-c.mjs [journal.jsonl]
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const DEFAULT_JOURNAL =
  "/Users/emad/.claude/projects/-Volumes-data-new-projects-quran/762c865b-b6d5-4d4f-8fad-46cbaa8a28f2/subagents/workflows/wf_0215faa2-2b8/journal.jsonl";
const journalPath = process.argv[2] ?? DEFAULT_JOURNAL;
if (!fs.existsSync(journalPath)) { console.error(`journal not found: ${journalPath}`); process.exit(1); }

const db = new DatabaseSync(DB);
for (const col of ["review TEXT", "review_rel TEXT"]) {
  try { db.exec(`ALTER TABLE ayah_tafsil ADD COLUMN ${col}`); } catch { /* exists */ }
}
db.exec(`CREATE TABLE IF NOT EXISTS ayah_principle_review (ayah_id INTEGER PRIMARY KEY, hub_ok INTEGER);
         CREATE TABLE IF NOT EXISTS ayah_tafsil_gap (hub_ayah_id INTEGER, tafsil_ayah_id INTEGER, PRIMARY KEY (hub_ayah_id, tafsil_ayah_id));
         CREATE TABLE IF NOT EXISTS ayah_tafsil_reviewed_hubs (hub_ayah_id INTEGER PRIMARY KEY);`);
const idOf = new Map(db.prepare("SELECT ayah_id, location FROM ayah").all().map((r) => [r.location, r.ayah_id]));
const setLink = db.prepare("UPDATE ayah_tafsil SET review=?, review_rel=? WHERE hub_ayah_id=? AND tafsil_ayah_id=?");
const setHub = db.prepare("INSERT OR REPLACE INTO ayah_principle_review VALUES (?,?)");
const seenHub = db.prepare("INSERT OR IGNORE INTO ayah_tafsil_reviewed_hubs VALUES (?)");
const addGap = db.prepare("INSERT OR IGNORE INTO ayah_tafsil_gap VALUES (?,?)");

let hubs = 0, confirm = 0, reweight = 0, reject = 0, weak = 0, gaps = 0;
for (const line of fs.readFileSync(journalPath, "utf-8").split("\n")) {
  if (!line.trim()) continue;
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.type !== "result" || !e.result?.hubs) continue;
  db.exec("BEGIN");
  for (const h of e.result.hubs) {
    const hid = idOf.get(h.hub);
    if (!hid) continue;
    hubs++; seenHub.run(hid);
    setHub.run(hid, h.hub_ok === false ? 0 : 1);
    if (h.hub_ok === false) weak++;
    for (const l of h.links ?? []) {
      const tid = idOf.get(l.loc);
      if (!tid) continue;
      setLink.run(l.verdict, l.verdict === "reweight" ? (l.rel ?? null) : null, hid, tid);
      if (l.verdict === "confirm") confirm++;
      else if (l.verdict === "reweight") reweight++;
      else if (l.verdict === "reject") reject++;
    }
    for (const g of h.missed ?? []) {
      const gid = idOf.get(g);
      if (gid) { addGap.run(hid, gid); gaps++; }
    }
  }
  db.exec("COMMIT");
}
const reviewedHubs = db.prepare("SELECT COUNT(*) n FROM ayah_tafsil_reviewed_hubs").get().n;
const total = db.prepare("SELECT COUNT(*) n FROM ayah_tafsil").get().n;
const surviving = db.prepare("SELECT COUNT(*) n FROM ayah_tafsil WHERE review IS NULL OR review!='reject'").get().n;
console.log(`reviewed ${reviewedHubs} hubs · links: ${confirm} confirm, ${reweight} reweight, ${reject} reject`);
console.log(`weak hubs: ${weak} · gaps flagged: ${gaps}`);
console.log(`surviving links: ${surviving} / ${total} (${((surviving / total) * 100).toFixed(1)}%)`);
db.close();

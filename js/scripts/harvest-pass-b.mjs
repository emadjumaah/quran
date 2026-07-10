/**
 * محكم Pass B harvester — persists verified تفصيل links from the swarm
 * journal into quran-kg.db (table ayah_tafsil). Idempotent; prints coverage.
 *
 * Usage: node scripts/harvest-pass-b.mjs [journal.jsonl]
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const DEFAULT_JOURNAL =
  "/Users/emad/.claude/projects/-Volumes-data-new-projects-quran/762c865b-b6d5-4d4f-8fad-46cbaa8a28f2/subagents/workflows/wf_4fd3dae1-b0e/journal.jsonl";
const journalPath = process.argv[2] ?? DEFAULT_JOURNAL;
if (!fs.existsSync(journalPath)) {
  console.error(`journal not found: ${journalPath}`);
  process.exit(1);
}

const db = new DatabaseSync(DB);
db.exec(`
  CREATE TABLE IF NOT EXISTS ayah_tafsil (
    hub_ayah_id    INTEGER NOT NULL REFERENCES ayah(ayah_id),
    tafsil_ayah_id INTEGER NOT NULL REFERENCES ayah(ayah_id),
    rel            TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT 'claude-swarm-pass-b',
    PRIMARY KEY (hub_ayah_id, tafsil_ayah_id)
  );
`);
const idOf = new Map(db.prepare("SELECT ayah_id, location FROM ayah").all().map((r) => [r.location, r.ayah_id]));
const insert = db.prepare("INSERT OR REPLACE INTO ayah_tafsil (hub_ayah_id, tafsil_ayah_id, rel) VALUES (?,?,?)");
const seenHub = db.prepare("INSERT OR IGNORE INTO ayah_tafsil_hubs_seen (hub_ayah_id) VALUES (?)");
db.exec("CREATE TABLE IF NOT EXISTS ayah_tafsil_hubs_seen (hub_ayah_id INTEGER PRIMARY KEY)");

let links = 0, hubsSeen = 0;
for (const line of fs.readFileSync(journalPath, "utf-8").split("\n")) {
  if (!line.trim()) continue;
  let e;
  try { e = JSON.parse(line); } catch { continue; }
  if (e.type !== "result" || !e.result?.hubs) continue;
  db.exec("BEGIN");
  for (const h of e.result.hubs) {
    const hubId = idOf.get(h.hub);
    if (!hubId) continue;
    seenHub.run(hubId);
    hubsSeen++;
    for (const t of h.tafsil ?? []) {
      const tid = idOf.get(t.loc);
      if (tid && tid !== hubId) { insert.run(hubId, tid, t.rel ?? "بيان"); links++; }
    }
  }
  db.exec("COMMIT");
}
const totalLinks = db.prepare("SELECT COUNT(*) n FROM ayah_tafsil").get().n;
const totalHubs = db.prepare("SELECT COUNT(*) n FROM ayah_tafsil_hubs_seen").get().n;
console.log(`harvested: ${hubsSeen} hub entries, ${links} links this run; totals: ${totalHubs}/1032 hubs judged, ${totalLinks} tafsil links`);
const missing = db.prepare(`
  SELECT a.location FROM ayah_principle ap JOIN ayah a ON a.ayah_id=ap.ayah_id
  WHERE ap.p=2 AND ap.ayah_id NOT IN (SELECT hub_ayah_id FROM ayah_tafsil_hubs_seen)`).all();
if (missing.length === 0) {
  console.log("COMPLETE — all hubs judged");
} else {
  console.log(`missing hubs (${missing.length}): ${missing.slice(0, 12).map((m) => m.location).join(", ")}${missing.length > 12 ? "…" : ""}`);
  // map missing hubs back to batch indices in pass-b-batches.json for a gap re-run
  const batchesPath = path.resolve(HERE, "../../pass-b-batches.json");
  if (fs.existsSync(batchesPath)) {
    const missSet = new Set(missing.map((m) => m.location));
    const { batches } = JSON.parse(fs.readFileSync(batchesPath, "utf-8"));
    const idxs = [];
    batches.forEach((b, i) => {
      if (b.some((h) => missSet.has(h.hub))) idxs.push(i);
    });
    console.log(`RE-RUN batch indices: [${idxs.join(",")}] (same rubric, same pass-b-batches.json)`);
  }
}
db.close();

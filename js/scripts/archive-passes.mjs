/**
 * Raw-data preservation — archives the COMPLETE output of every classification
 * pass (A, B, and any future pass) into the repo under data/passes/, so no
 * agent's work is ever lost and the full record stays available for review or
 * new uses. Idempotent; re-run after each pass or harvest.
 *
 * Produces (all tracked in git, both remotes):
 *   data/passes/pass-a-full.jsonl   every ayah: {loc, id, p, kind}  (incl p=0)
 *   data/passes/pass-b-full.jsonl   every judged hub: {hub, kind, tafsil[]}
 *   data/passes/journals/*.jsonl    the raw workflow result journals (copied)
 *   data/passes/MANIFEST.md         which workflow = which pass/model/date
 * (per-agent transcripts are tarred separately by the shell wrapper.)
 *
 * Usage: node scripts/archive-passes.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DB = path.join(ROOT, "quran-kg.db");
const DIR = path.join(ROOT, "data", "passes");
fs.mkdirSync(path.join(DIR, "journals"), { recursive: true });

const db = new DatabaseSync(DB, { readOnly: true });
const loc = new Map(db.prepare("SELECT ayah_id, location FROM ayah").all().map((r) => [r.ayah_id, r.location]));

// Pass A — complete (all 6236, including p=0)
const pa = db.prepare("SELECT ayah_id, p, kind FROM ayah_principle ORDER BY ayah_id").all();
fs.writeFileSync(
  path.join(DIR, "pass-a-full.jsonl"),
  pa.map((r) => JSON.stringify({ loc: loc.get(r.ayah_id), id: r.ayah_id, p: r.p, kind: r.kind ?? null })).join("\n") + "\n",
);

// Pass B — every judged hub with its full tafsil (incl relation types)
let pbCount = 0;
if (db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='ayah_tafsil_hubs_seen'").get().n) {
  const seen = db.prepare("SELECT hub_ayah_id FROM ayah_tafsil_hubs_seen ORDER BY hub_ayah_id").all();
  const links = db.prepare("SELECT tafsil_ayah_id t, rel FROM ayah_tafsil WHERE hub_ayah_id=? ORDER BY rel");
  const kindOf = db.prepare("SELECT kind FROM ayah_principle WHERE ayah_id=?");
  const out = [];
  for (const { hub_ayah_id: h } of seen) {
    const tafsil = links.all(h).map((l) => ({ loc: loc.get(l.t), rel: l.rel }));
    out.push(JSON.stringify({ hub: loc.get(h), kind: kindOf.get(h)?.kind ?? null, count: tafsil.length, tafsil }));
    pbCount++;
  }
  fs.writeFileSync(path.join(DIR, "pass-b-full.jsonl"), out.join("\n") + "\n");
}

// Pass C — the adversarial review verdicts (every link's verdict + reweight,
// weak-hub flags, gap suggestions). Complete record; nothing discarded.
let pcCount = 0;
const hasReview = db.prepare("SELECT COUNT(*) n FROM pragma_table_info('ayah_tafsil') WHERE name='review'").get().n;
if (hasReview && db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='ayah_tafsil_reviewed_hubs'").get().n) {
  const reviewed = db.prepare("SELECT hub_ayah_id FROM ayah_tafsil_reviewed_hubs ORDER BY hub_ayah_id").all();
  const links = db.prepare("SELECT tafsil_ayah_id t, rel, review, review_rel FROM ayah_tafsil WHERE hub_ayah_id=? ORDER BY rel");
  const hubOk = db.prepare("SELECT hub_ok FROM ayah_principle_review WHERE ayah_id=?");
  const gaps = db.prepare("SELECT tafsil_ayah_id t FROM ayah_tafsil_gap WHERE hub_ayah_id=?");
  const out = [];
  for (const { hub_ayah_id: h } of reviewed) {
    const verdicts = links.all(h).map((l) => ({
      loc: loc.get(l.t), rel: l.rel, verdict: l.review ?? "confirm",
      ...(l.review === "reweight" ? { rel_fixed: l.review_rel } : {}),
    }));
    const missed = gaps.all(h).map((g) => loc.get(g.t));
    out.push(JSON.stringify({
      hub: loc.get(h), hub_ok: (hubOk.get(h)?.hub_ok ?? 1) === 1,
      links: verdicts, ...(missed.length ? { missed } : {}),
    }));
    pcCount++;
  }
  fs.writeFileSync(path.join(DIR, "pass-c-full.jsonl"), out.join("\n") + "\n");
}
db.close();

// copy the Pass C review journal into the archive (idempotent)
const PASS_C_JOURNAL =
  "/Users/emad/.claude/projects/-Volumes-data-new-projects-quran/762c865b-b6d5-4d4f-8fad-46cbaa8a28f2/subagents/workflows/wf_0215faa2-2b8/journal.jsonl";
if (fs.existsSync(PASS_C_JOURNAL)) {
  fs.copyFileSync(PASS_C_JOURNAL, path.join(DIR, "journals", "passC-review.jsonl"));
}
console.log(`pass-a-full: ${pa.length} ayahs · pass-b-full: ${pbCount} hubs · pass-c-full: ${pcCount} reviewed hubs`);

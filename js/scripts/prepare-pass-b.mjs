/**
 * محكم → تفصيل Pass B prep: for every p=2 جامعة, build its candidate
 * elaborator list = top-24 cosine neighbors ∪ top shared-rare-root ayahs,
 * excluding near-duplicates and same-surah ±2 context. Emits batches for the
 * verification swarm.
 *
 * Usage: node scripts/prepare-pass-b.mjs   → ../../pass-b-batches.json
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const OUT = path.resolve(HERE, "../../pass-b-batches.json");
const DIM = 768, TOP_COS = 24, TOP_ROOT = 12, CAP = 26, RARE_OCC = 300;

const db = new DatabaseSync(DB, { readOnly: true });
const meta = db.prepare("SELECT ayah_id, location, surah_no, ayah_no, text_clean FROM ayah ORDER BY ayah_id").all();
const N = meta.length;
const hubs = db.prepare("SELECT ayah_id FROM ayah_principle WHERE p=2 ORDER BY ayah_id").all().map((r) => r.ayah_id);

const vecRows = db.prepare("SELECT vector FROM ayah_embedding WHERE model='gemini-embedding-001' AND dim=? ORDER BY ayah_id").all(DIM);
const mat = new Float32Array(N * DIM);
for (let r = 0; r < N; r++) {
  const v = new Float32Array(vecRows[r].vector.buffer, vecRows[r].vector.byteOffset, DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) mat[r * DIM + i] = v[i] / n;
}

// rare roots per ayah + inverted index root -> ayahs
const rare = Array.from({ length: N }, () => []);
const byRoot = new Map();
for (const r of db.prepare(
  "SELECT w.ayah_id a, w.root_id rid, rt.occurrences occ FROM word w JOIN root rt ON rt.root_id=w.root_id WHERE w.root_id IS NOT NULL",
).iterate()) {
  if (r.occ < RARE_OCC) {
    rare[r.a - 1].push(r.rid);
    const list = byRoot.get(r.rid) ?? [];
    if (list[list.length - 1] !== r.a) list.push(r.a);
    byRoot.set(r.rid, list);
  }
}
db.close();
console.log(`hubs: ${hubs.length}`);

const batches = [];
let batch = [];
const t0 = Date.now();
hubs.forEach((hubId, hi) => {
  const h = hubId - 1;
  const hm = meta[h];
  // cosine top
  const row = new Float32Array(N);
  const base = h * DIM;
  for (let b = 0; b < N; b++) {
    if (b === h) { row[b] = -1; continue; }
    let d = 0;
    const bb = b * DIM;
    for (let i = 0; i < DIM; i++) d += mat[base + i] * mat[bb + i];
    row[b] = d;
  }
  const ok = (j) => {
    const m = meta[j];
    if (m.surah_no === hm.surah_no && Math.abs(m.ayah_no - hm.ayah_no) <= 2) return false;
    if (row[j] >= 0.95) return false;
    return true;
  };
  const cand = new Map(); // id -> reason
  for (const j of [...row.keys()].sort((a, b) => row[b] - row[a]).slice(0, TOP_COS * 2)) {
    if (cand.size >= TOP_COS) break;
    if (ok(j)) cand.set(j + 1, "cos");
  }
  // shared rare roots (count shared)
  const shareCount = new Map();
  for (const rid of new Set(rare[h])) {
    for (const a of byRoot.get(rid) ?? []) {
      if (a - 1 === h) continue;
      shareCount.set(a, (shareCount.get(a) ?? 0) + 1);
    }
  }
  const rootTop = [...shareCount.entries()]
    .filter(([a]) => ok(a - 1))
    .sort((x, y) => y[1] - x[1] || row[y[0] - 1] - row[x[0] - 1])
    .slice(0, TOP_ROOT);
  for (const [a] of rootTop) if (!cand.has(a) && cand.size < CAP) cand.set(a, "root");

  batch.push({
    hub: hm.location,
    hubText: hm.text_clean,
    candidates: [...cand.keys()].map((id) => ({ location: meta[id - 1].location, text: meta[id - 1].text_clean })),
  });
  if (batch.length === 12) {
    batches.push(batch);
    batch = [];
  }
  if ((hi + 1) % 100 === 0) console.log(`  ${hi + 1}/${hubs.length} (${((Date.now() - t0) / 1000) | 0}s)`);
});
if (batch.length) batches.push(batch);

fs.writeFileSync(OUT, JSON.stringify({ batches }, null, 0));
console.log(`wrote ${OUT}: ${batches.length} batches × ~12 hubs (${hubs.length} total)`);

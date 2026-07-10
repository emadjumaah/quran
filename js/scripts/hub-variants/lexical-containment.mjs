/**
 * hub-variant: LEXICAL CONTAINMENT DIRECTION (محكم → تفصيل)
 *
 * Hypothesis under test: direction from vectors alone (v1's "generality") is
 * crude and rewards dense clusters. Instead, direct edges by LEXICAL
 * CONTAINMENT: an elaboration B (تفصيل) points at a principle A (محكم) when
 *
 *   1. cosine(A,B) passes the top-K similarity gate (K=15, symmetrized) —
 *      same sparsification as v1;
 *   2. the RARE roots of A (root.occurrences < 300) are substantially
 *      contained in B's root set (containment ratio >= 0.5;
 *      an ayah with zero rare roots is vacuously contained, ratio = 1);
 *   3. B is strictly longer (word_count) — longer = more specific.
 *
 * Hubs = short, rare-root-poor principle ayahs whose distinctive vocabulary
 * is re-used inside many longer elaborations. Rank = weighted in-degree,
 * edge weight = containment ratio × cosine.
 *
 * Fully content-blind: no ayah is special-cased anywhere.
 *
 * Usage: node scripts/hub-variants/lexical-containment.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../../quran-kg.db");
const OUT = path.resolve(HERE, "lexical-containment.out.json");
const OUT_FULL = path.resolve(HERE, "lexical-containment.full.json");
const DIM = 768;
const K = 15;
const RARE_OCC = 300; // a root is "rare" if it occurs < 300 times in the corpus
const CONTAIN_MIN = 0.5; // "substantially contained"

// ---------- load ----------
const db = new DatabaseSync(DB, { readOnly: true });
const meta = db
  .prepare(
    "SELECT ayah_id, location, surah_no, substr(text_clean,1,90) AS t, word_count AS wc FROM ayah ORDER BY ayah_id",
  )
  .all();
const vecRows = db
  .prepare(
    "SELECT vector FROM ayah_embedding WHERE model='gemini-embedding-001' AND dim=? ORDER BY ayah_id",
  )
  .all(DIM);
// per-ayah root sets, flagged rare/common
const wordRows = db
  .prepare(
    `SELECT w.ayah_id AS aid, w.root_id AS rid, r.occurrences AS occ
     FROM word w JOIN root r ON r.root_id = w.root_id
     WHERE w.root_id IS NOT NULL`,
  )
  .all();
db.close();

const N = meta.length;
const allRoots = Array.from({ length: N }, () => new Set()); // every root of the ayah
const rareRoots = Array.from({ length: N }, () => new Set()); // roots with occ < RARE_OCC
for (const { aid, rid, occ } of wordRows) {
  const i = aid - 1;
  allRoots[i].add(rid);
  if (occ < RARE_OCC) rareRoots[i].add(rid);
}
console.log(`loaded ${N} ayahs, root sets ready`);

// ---------- normalized embedding matrix ----------
const mat = new Float32Array(N * DIM);
for (let r = 0; r < N; r++) {
  const v = new Float32Array(vecRows[r].vector.buffer, vecRows[r].vector.byteOffset, DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) mat[r * DIM + i] = v[i] / n;
}
console.log(`vectors ready (${N})`);

// ---------- top-K similarity gate (full cosine pass, same as v1) ----------
const nbr = Array.from({ length: N }, () => []); // [{j, w}]
const t0 = Date.now();
const row = new Float32Array(N);
for (let a = 0; a < N; a++) {
  const base = a * DIM;
  for (let b = 0; b < N; b++) {
    if (b === a) {
      row[b] = 0;
      continue;
    }
    let dot = 0;
    const bb = b * DIM;
    for (let i = 0; i < DIM; i++) dot += mat[base + i] * mat[bb + i];
    row[b] = dot;
  }
  const idx = [...row.keys()].sort((x, y) => row[y] - row[x]).slice(0, K);
  nbr[a] = idx.map((j) => ({ j, w: row[j] }));
  if ((a + 1) % 1000 === 0)
    console.log(`  sim ${a + 1}/${N} (${((Date.now() - t0) / 1000) | 0}s)`);
}

// ---------- containment-directed edges ----------
// For each gated pair {a,b}: A = shorter (candidate محكم), B = longer (تفصيل).
// containment(A in B) = |rareRoots(A) ∩ allRoots(B)| / |rareRoots(A)|  (1 if A has none)
// edge B → A iff containment >= CONTAIN_MIN and wc(B) > wc(A).
const containment = (A, B) => {
  const ra = rareRoots[A];
  if (ra.size === 0) return 1;
  let hit = 0;
  const rb = allRoots[B];
  for (const r of ra) if (rb.has(r)) hit++;
  return hit / ra.size;
};

const inEdges = Array.from({ length: N }, () => []); // hub A <- [{src: B, w, c, cos}]
const edgeSet = new Set();
let gatedPairs = 0,
  kept = 0;
for (let a = 0; a < N; a++) {
  for (const { j, w: cos } of nbr[a]) {
    const key = a < j ? a * N + j : j * N + a;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    gatedPairs++;
    // direction by length: A = shorter = candidate hub
    let A, B;
    if (meta[a].wc < meta[j].wc) (A = a), (B = j);
    else if (meta[j].wc < meta[a].wc) (A = j), (B = a);
    else continue; // equal length → no direction (kills duplicate-refrain self-loops)
    const c = containment(A, B);
    if (c < CONTAIN_MIN) continue;
    kept++;
    inEdges[A].push({ src: B, w: c * cos, c, cos });
  }
}
console.log(`gated pairs: ${gatedPairs}, containment-directed edges kept: ${kept}`);

// ---------- rank: weighted in-degree (containment ratio × cosine) ----------
const score = new Float64Array(N);
for (let A = 0; A < N; A++) for (const { w } of inEdges[A]) score[A] += w;
const order = [...Array(N).keys()].sort((a, b) => score[b] - score[a]);

// ---------- outputs ----------
const hubOut = (id, nTafsil) => ({
  location: meta[id].location,
  score: Number(score[id].toFixed(3)),
  inDegree: inEdges[id].length,
  wordCount: meta[id].wc,
  rareRootCount: rareRoots[id].size,
  text: meta[id].t,
  tafsil: inEdges[id]
    .sort((x, y) => y.w - x.w)
    .slice(0, nTafsil)
    .map(({ src, w, c, cos }) => ({
      location: meta[src].location,
      w: Number(w.toFixed(3)),
      containment: Number(c.toFixed(2)),
      cos: Number(cos.toFixed(3)),
      text: meta[src].t.slice(0, 60),
    })),
});

const top300 = order.slice(0, 300).map((id) => hubOut(id, 30));
fs.writeFileSync(
  OUT_FULL,
  JSON.stringify(
    {
      method:
        "lexical-containment: topK=15 cosine gate + rare-root(occ<300) containment>=0.5 into strictly-longer ayah; direction تفصيل(longer,containing)→محكم(shorter,contained); score = Σ containment×cosine over in-edges",
      hubs: top300,
    },
    null,
    1,
  ),
);

const top30 = order.slice(0, 30).map((id) => ({
  location: meta[id].location,
  score: Number(score[id].toFixed(3)),
  textSnippet: meta[id].t,
}));
// samples filled by a second pass (editorial pick of 5 themes among top hubs) —
// here we emit the 5 highest-scoring hubs from 5 DIFFERENT surahs as a
// content-blind default; the analyst may re-pick for theme diversity.
const seenSurah = new Set();
const samples = [];
for (const id of order) {
  if (samples.length >= 5) break;
  if (seenSurah.has(meta[id].surah_no)) continue;
  if (inEdges[id].length < 10) continue;
  seenSurah.add(meta[id].surah_no);
  samples.push({
    hub: meta[id].location,
    hubText: meta[id].t,
    tafsil: inEdges[id]
      .sort((x, y) => y.w - x.w)
      .slice(0, 10)
      .map(({ src }) => meta[src].location),
  });
}
fs.writeFileSync(OUT, JSON.stringify({ top30, samples }, null, 1));

console.log(`\n=== top 30 (lexical-containment) ===`);
for (const h of order.slice(0, 30))
  console.log(
    `  ${meta[h].location.padEnd(7)} score=${score[h].toFixed(2).padStart(7)} in=${String(inEdges[h].length).padStart(3)} wc=${String(meta[h].wc).padStart(2)} rare=${String(rareRoots[h].size).padStart(2)}  ${meta[h].t}`,
  );
console.log(`\nwrote ${OUT}\nwrote ${OUT_FULL}`);

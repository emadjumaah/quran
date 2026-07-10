/**
 * محكم → تفصيل v2 — the judge-prescribed hybrid:
 * "surprise-weighted root-containment authority".
 *
 * Edges: embedding surprise (density-normalized cosine) × lexical evidence
 *        (rare-root containment). Direction: containment asymmetry — B
 *        elaborates A when A's rare roots live inside B (no length rule).
 * Score: diversity-discounted incoming weight + damped propagation.
 * Tafsil: in-neighbors by containment×cosine with near-dup filtering.
 *
 * Recipe + parameters exactly as specified by the method-swarm judge
 * (see WORLD-FIRSTS addendum / workflow wf_535a6a8d). Content-blind.
 *
 * Usage: node scripts/compute-hubs-v2.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const OUT = path.resolve(HERE, "../../quran-hubs-v2.json");

const DIM = 768, KC = 40, B_LO = 21, B_HI = 35, TOPK_DENS = 20;
const ADJ_EXCLUDE = 2, NEARDUP = 0.95, RARE_OCC = 300;
const CONTAIN_MIN = 0.5, ASYM_MARGIN = 0.2, ALPHA = 0.35, TAFSIL_DEDUP = 0.92;

const SANITY = ["2:255","16:90","112:1","39:53","42:11","4:58","49:13","5:2","103:2","31:18","6:151","21:107"];

const db = new DatabaseSync(DB, { readOnly: true });
const meta = db.prepare(
  "SELECT ayah_id, location, surah_no, ayah_no, substr(text_clean,1,80) t FROM ayah ORDER BY ayah_id",
).all();
const vecRows = db
  .prepare("SELECT vector FROM ayah_embedding WHERE model='gemini-embedding-001' AND dim=? ORDER BY ayah_id")
  .all(DIM);
const N = meta.length;

// roots per ayah: full set + rare set (occ < RARE_OCC)
const fullRoots = Array.from({ length: N }, () => new Set());
const rareRoots = Array.from({ length: N }, () => new Set());
for (const r of db
  .prepare(
    "SELECT w.ayah_id a, w.root_id rid, r.occurrences occ FROM word w JOIN root r ON r.root_id=w.root_id WHERE w.root_id IS NOT NULL",
  )
  .iterate()) {
  fullRoots[r.a - 1].add(r.rid);
  if (r.occ < RARE_OCC) rareRoots[r.a - 1].add(r.rid);
}
db.close();

// unit-normalized matrix
const mat = new Float32Array(N * DIM);
for (let r = 0; r < N; r++) {
  const v = new Float32Array(vecRows[r].vector.buffer, vecRows[r].vector.byteOffset, DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) mat[r * DIM + i] = v[i] / n;
}
const dot = (a, b) => {
  let s = 0;
  const ba = a * DIM, bb = b * DIM;
  for (let i = 0; i < DIM; i++) s += mat[ba + i] * mat[bb + i];
  return s;
};
console.log(`ready: ${N} ayahs`);

// pass 1: per-node top-KC candidates, background B(x), top-K density, row mean
const cand = Array.from({ length: N }, () => []);
const B = new Float64Array(N);
const densK = new Float64Array(N);
const rowMean = new Float64Array(N);
{
  const row = new Float32Array(N);
  const t0 = Date.now();
  for (let a = 0; a < N; a++) {
    const base = a * DIM;
    let sum = 0;
    for (let b = 0; b < N; b++) {
      if (b === a) { row[b] = -1; continue; }
      let d = 0;
      const bb = b * DIM;
      for (let i = 0; i < DIM; i++) d += mat[base + i] * mat[bb + i];
      row[b] = d;
      sum += d;
    }
    rowMean[a] = sum / (N - 1);
    const order = [...row.keys()].sort((x, y) => row[y] - row[x]);
    let bAcc = 0;
    for (let r = B_LO - 1; r < B_HI; r++) bAcc += row[order[r]];
    B[a] = bAcc / (B_HI - B_LO + 1);
    let dAcc = 0;
    for (let r = 0; r < TOPK_DENS; r++) dAcc += row[order[r]];
    densK[a] = dAcc / TOPK_DENS;
    cand[a] = order.slice(0, KC).map((j) => ({ j, cos: row[j] }));
    if ((a + 1) % 1000 === 0) console.log(`  pass1 ${a + 1}/${N} (${((Date.now() - t0) / 1000) | 0}s)`);
  }
}
const corpusMean = rowMean.reduce((s, x) => s + x, 0) / N;

// unify candidate pairs with exclusions; surprise s
const pairs = new Map(); // "a|b" a<b -> {cos, s}
for (let a = 0; a < N; a++) {
  for (const { j, cos } of cand[a]) {
    if (meta[a].surah_no === meta[j].surah_no && Math.abs(meta[a].ayah_no - meta[j].ayah_no) <= ADJ_EXCLUDE) continue;
    if (cos >= NEARDUP) continue;
    const key = a < j ? `${a}|${j}` : `${j}|${a}`;
    if (!pairs.has(key)) {
      const s = Math.max(0, cos - (B[a] + B[j]) / 2);
      if (s > 0) pairs.set(key, { cos, s });
    }
  }
}
const sVals = [...pairs.values()].map((p) => p.s).sort((x, y) => x - y);
const sMed = sVals[Math.floor(sVals.length / 2)] || 1e-6;
const phi = (s) => s / (s + sMed);
console.log(`candidate pairs: ${pairs.size}, median surprise ${sMed.toFixed(4)}`);

// containment c(A⊂B): rare roots of A inside full roots of B
const contain = (A, Bn) => {
  const ra = rareRoots[A];
  if (ra.size === 0) return null;
  let hit = 0;
  for (const r of ra) if (fullRoots[Bn].has(r)) hit++;
  return hit / ra.size;
};

// ds(x): greedy diversity-discounted sum of incident φ-weights (for soft split)
const incident = Array.from({ length: N }, () => []);
for (const [key, { s }] of pairs) {
  const [a, b] = key.split("|").map(Number);
  incident[a].push({ o: b, f: phi(s) });
  incident[b].push({ o: a, f: phi(s) });
}
const redundancy = (y, z) => {
  const denom = (densK[y] + densK[z]) / 2 - corpusMean;
  if (denom <= 0) return 1;
  return Math.min(1, Math.max(0, (dot(y, z) - corpusMean) / denom));
};
const ds = new Float64Array(N);
for (let x = 0; x < N; x++) {
  const inc = incident[x].sort((p, q) => q.f - p.f).slice(0, 25);
  const picked = [];
  let acc = 0;
  for (const { o, f } of inc) {
    let red = 0;
    for (const p of picked) red = Math.max(red, redundancy(o, p));
    acc += f * (1 - red);
    picked.push(o);
  }
  ds[x] = acc;
}
console.log("ds computed");

// directed edges
const inEdges = Array.from({ length: N }, () => []); // hub <- [{src, w, cos, c}]
const outStr = new Float64Array(N);
let directed = 0, soft = 0;
for (const [key, { cos, s }] of pairs) {
  const [a, b] = key.split("|").map(Number);
  const f = phi(s);
  const cA = contain(a, b); // A's rare roots inside B → B elaborates A
  const cB = contain(b, a);
  const add = (hub, src, c) => {
    inEdges[hub].push({ src, w: f * (0.5 + 0.5 * c), cos, c });
    outStr[src] += f * (0.5 + 0.5 * c);
  };
  const okA = cA != null && cA >= CONTAIN_MIN;
  const okB = cB != null && cB >= CONTAIN_MIN;
  if (okA && (cB == null || cA - cB >= ASYM_MARGIN)) { add(a, b, cA); directed++; }
  else if (okB && (cA == null || cB - cA >= ASYM_MARGIN)) { add(b, a, cB); soft += 0; directed++; }
  else if (okA || okB) {
    const shareA = ds[a] ** 2 / (ds[a] ** 2 + ds[b] ** 2 || 1);
    if (okA) { inEdges[a].push({ src: b, w: f * (0.5 + 0.5 * cA) * shareA, cos, c: cA }); outStr[b] += f * (0.5 + 0.5 * cA) * shareA; }
    if (okB) { inEdges[b].push({ src: a, w: f * (0.5 + 0.5 * cB) * (1 - shareA), cos, c: cB }); outStr[a] += f * (0.5 + 0.5 * cB) * (1 - shareA); }
    soft++;
  }
}
console.log(`directed edges: ${directed}, soft-split: ${soft}`);

// hub prior: diversity-discounted incoming weight
const prior = new Float64Array(N);
for (let h = 0; h < N; h++) {
  const inc = inEdges[h].sort((p, q) => q.w - p.w).slice(0, 30);
  const picked = [];
  let acc = 0;
  for (const { src, w } of inc) {
    let red = 0;
    for (const p of picked) red = Math.max(red, redundancy(src, p));
    acc += w * (1 - red);
    picked.push(src);
  }
  prior[h] = acc;
}

// damped propagation x = prior + ALPHA * Wᵀ (x / outStr)
let score = Float64Array.from(prior);
for (let it = 0; it < 40; it++) {
  const nx = Float64Array.from(prior);
  for (let h = 0; h < N; h++) {
    let acc = 0;
    for (const { src, w } of inEdges[h]) if (outStr[src] > 0) acc += (w * score[src]) / outStr[src];
    nx[h] += ALPHA * acc;
  }
  score = nx;
}

// outputs
const order = [...score.keys()].sort((a, b) => score[b] - score[a]);
const rankOfLoc = new Map(order.map((id, i) => [meta[id].location, i + 1]));
const hubs = order.slice(0, 300).map((id) => ({
  location: meta[id].location,
  text: meta[id].t,
  score: Number(score[id].toFixed(4)),
  inDegree: inEdges[id].length,
  tafsil: inEdges[id]
    .sort((p, q) => q.c * q.cos - p.c * p.cos)
    .reduce((acc, e) => {
      if (acc.every((x) => dot(e.src, x.srcId) <= TAFSIL_DEDUP)) acc.push({ location: meta[e.src].location, srcId: e.src, c: Number(e.c.toFixed(2)), cos: Number(e.cos.toFixed(3)) });
      return acc;
    }, [])
    .slice(0, 25)
    .map(({ srcId, ...rest }) => rest),
}));
fs.writeFileSync(OUT, JSON.stringify({ method: "hybrid v2 (judge recipe)", hubs }, null, 1));

console.log("\n=== v2 top 25 ===");
for (const h of hubs.slice(0, 25))
  console.log(`  ${h.location.padEnd(7)} score=${String(h.score).padStart(8)} in=${String(h.inDegree).padStart(3)}  ${h.text}`);
console.log("\n=== sanity ranks (list is diagnostic only — nothing hardcoded) ===");
for (const loc of SANITY) console.log(`  ${loc.padEnd(7)} rank ${rankOfLoc.get(loc)}`);
console.log(`\nwrote ${OUT}`);

/**
 * محكم → تفصيل v2 — DIVERSITY-WEIGHTED AUTHORITY.
 *
 * V1's flaw: raw centrality (PR/HITS/in-strength) rewards the densest thematic
 * cluster (كفر/تكذيب/عذاب monopolizes the top-20). A real محكمة/جامعة ayah
 * gathers تفصيل from MANY DIFFERENT contexts — a wide fan, not a clique.
 *
 * Method (fully content-blind):
 *  1. Same graph as v1: cosine top-K=15 per ayah, generality-directed
 *     (less general → more general), symmetrized candidate edges.
 *  2. For each node, over its in-neighbor set compute BREADTH components:
 *     (a) dispersion d   = mean pairwise DISsimilarity among in-neighbors
 *                          (1 - mean pairwise cosine, via the sum-vector trick)
 *     (b) surah spread   = exp(entropy of in-neighbor surah distribution)
 *                          → "effective number of distinct surahs" effS
 *     (c) root breadth   = exp(entropy of the multiset of each in-neighbor's
 *                          top-3 RAREST roots, rarity = global occurrences)
 *                          → "effective number of distinct rare roots" effR
 *  3. score = S^1 · d^α · (effS/n)^β · (effR/T)^γ   with S = Σ in-edge weight,
 *     n = in-degree, T = root tokens. Ratios make breadth per-neighbor
 *     (size-free); S carries size. A small grid of (α,β,γ) is evaluated and
 *     the winner picked by a STRUCTURAL criterion only: minimize thematic
 *     redundancy of the resulting top-30 (mean pairwise cosine + fraction of
 *     near-duplicate pairs), subject to median top-30 in-degree ≥ 8.
 *  4. Sample hubs across themes: greedy min-max-cosine (MMR) over top-30.
 *     Tafsil per hub: MMR over in-neighbors (weight − 0.5·max cos to picked)
 *     so the shown تفصيل spans the fan rather than repeating one context.
 *
 * Usage: node scripts/hub-variants/diversity-authority.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../../quran-kg.db");
const OUT = path.resolve(HERE, "diversity-authority.out.json");
const DIM = 768;
const K = 15;
const RARE_ROOTS_PER_AYAH = 3;

const db = new DatabaseSync(DB, { readOnly: true });
const meta = db
  .prepare(
    "SELECT a.ayah_id, a.location, a.surah_no, substr(a.text_clean,1,80) AS t FROM ayah a ORDER BY a.ayah_id",
  )
  .all();
const vecRows = db
  .prepare(
    "SELECT vector FROM ayah_embedding WHERE model='gemini-embedding-001' AND dim=? ORDER BY ayah_id",
  )
  .all(DIM);
// per-ayah rare-root profile: top-3 rarest distinct roots (global occurrences asc)
const rootRows = db
  .prepare(
    `SELECT w.ayah_id AS aid, w.root_id AS rid, r.occurrences AS occ
     FROM word w JOIN root r ON r.root_id = w.root_id
     WHERE w.root_id IS NOT NULL
     GROUP BY w.ayah_id, w.root_id
     ORDER BY w.ayah_id, r.occurrences ASC, w.root_id ASC`,
  )
  .all();
db.close();
const N = meta.length;

const rareRoots = Array.from({ length: N }, () => []); // ayah idx -> [root_id x <=3]
for (const { aid, rid } of rootRows) {
  const list = rareRoots[aid - 1];
  if (list.length < RARE_ROOTS_PER_AYAH) list.push(rid);
}

// normalized embedding matrix
const mat = new Float32Array(N * DIM);
for (let r = 0; r < N; r++) {
  const v = new Float32Array(vecRows[r].vector.buffer, vecRows[r].vector.byteOffset, DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) mat[r * DIM + i] = v[i] / n;
}
console.log(`vectors ready (${N}), root profiles for ${rareRoots.filter((x) => x.length).length} ayahs`);

const cos = (a, b) => {
  let dot = 0;
  const ab = a * DIM, bb = b * DIM;
  for (let i = 0; i < DIM; i++) dot += mat[ab + i] * mat[bb + i];
  return dot;
};

// ---- 1. top-K similarity graph + generality (v1 pattern) ----
const nbr = Array.from({ length: N }, () => []);
const generality = new Float64Array(N);
const t0 = Date.now();
const row = new Float32Array(N);
for (let a = 0; a < N; a++) {
  const base = a * DIM;
  let sum = 0;
  for (let b = 0; b < N; b++) {
    if (b === a) {
      row[b] = 0;
      continue;
    }
    let dot = 0;
    const bb = b * DIM;
    for (let i = 0; i < DIM; i++) dot += mat[base + i] * mat[bb + i];
    row[b] = dot;
    sum += dot;
  }
  generality[a] = sum / (N - 1);
  const idx = [...row.keys()].sort((x, y) => row[y] - row[x]).slice(0, K);
  nbr[a] = idx.map((j) => ({ j, w: row[j] }));
  if ((a + 1) % 1000 === 0) console.log(`  sim ${a + 1}/${N} (${((Date.now() - t0) / 1000) | 0}s)`);
}

// ---- directed edges تفصيل → محكم (v1 direction) ----
const inEdges = Array.from({ length: N }, () => []);
const edgeSet = new Set();
for (let a = 0; a < N; a++) {
  for (const { j, w } of nbr[a]) {
    const key = a < j ? a * N + j : j * N + a;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    const [src, dst] = generality[a] >= generality[j] ? [j, a] : [a, j];
    inEdges[dst].push({ src, w });
  }
}
console.log(`directed edges: ${edgeSet.size}`);

// ---- 2. breadth components per node ----
const inStrength = new Float64Array(N);
const dispersion = new Float64Array(N); // (a) mean pairwise dissimilarity
const surahRatio = new Float64Array(N); // (b) effS / n
const rootRatio = new Float64Array(N); //  (c) effR / T
const effSurahs = new Float64Array(N);
const effRoots = new Float64Array(N);
const sumVec = new Float64Array(DIM);

const entropyEff = (counts) => {
  let T = 0;
  for (const c of counts.values()) T += c;
  if (T === 0) return { eff: 0, T: 0 };
  let H = 0;
  for (const c of counts.values()) {
    const p = c / T;
    H -= p * Math.log(p);
  }
  return { eff: Math.exp(H), T };
};

for (let dst = 0; dst < N; dst++) {
  const edges = inEdges[dst];
  const n = edges.length;
  if (n === 0) continue;
  let S = 0;
  for (const { w } of edges) S += w;
  inStrength[dst] = S;
  if (n < 3) continue; // too small for meaningful breadth

  // (a) mean pairwise cosine via ||Σv||² trick (unit vectors)
  sumVec.fill(0);
  for (const { src } of edges) {
    const b = src * DIM;
    for (let i = 0; i < DIM; i++) sumVec[i] += mat[b + i];
  }
  let sq = 0;
  for (let i = 0; i < DIM; i++) sq += sumVec[i] * sumVec[i];
  const meanPairCos = (sq - n) / (n * (n - 1));
  dispersion[dst] = Math.max(0, 1 - meanPairCos);

  // (b) surah-distribution entropy → effective surah count
  const sCounts = new Map();
  for (const { src } of edges) {
    const s = meta[src].surah_no;
    sCounts.set(s, (sCounts.get(s) || 0) + 1);
  }
  const { eff: effS } = entropyEff(sCounts);
  effSurahs[dst] = effS;
  surahRatio[dst] = effS / n;

  // (c) rare-root-profile entropy → effective rare-root count
  const rCounts = new Map();
  for (const { src } of edges)
    for (const rid of rareRoots[src]) rCounts.set(rid, (rCounts.get(rid) || 0) + 1);
  const { eff: effR, T } = entropyEff(rCounts);
  effRoots[dst] = effR;
  rootRatio[dst] = T > 0 ? effR / T : 0;
}
console.log("breadth components done");

// ---- 3. score grid + structural selection ----
const combos = [
  { name: "A a1 b1 g1", a: 1, b: 1, g: 1 },
  { name: "B a1 b.5 g.5 (degree-neutral)", a: 1, b: 0.5, g: 0.5 },
  { name: "C a1.5 b.75 g.75", a: 1.5, b: 0.75, g: 0.75 },
  { name: "D a2 b1 g1 (sharp)", a: 2, b: 1, g: 1 },
  { name: "E a1 b0 g1 (roots only)", a: 1, b: 0, g: 1 },
  { name: "F a0 b.5 g.5 (no dispersion)", a: 0, b: 0.5, g: 0.5 },
];

const scoreCombo = ({ a, b, g }) => {
  const sc = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (inEdges[i].length < 3) continue;
    sc[i] =
      inStrength[i] *
      Math.pow(dispersion[i], a) *
      Math.pow(surahRatio[i], b) *
      Math.pow(rootRatio[i], g);
  }
  return sc;
};

const structural = (top) => {
  // redundancy of the top-30 itself: mean pairwise cosine + near-dup fraction
  let sum = 0, pairs = 0, hi = 0;
  for (let x = 0; x < top.length; x++)
    for (let y = x + 1; y < top.length; y++) {
      const c = cos(top[x], top[y]);
      sum += c;
      pairs++;
      if (c > 0.7) hi++;
    }
  const meanCos = sum / pairs;
  const hiFrac = hi / pairs;
  const surahs = new Set(top.map((i) => meta[i].surah_no)).size;
  const degs = top.map((i) => inEdges[i].length).sort((x, y) => x - y);
  const medDeg = degs[(degs.length / 2) | 0];
  return { meanCos, hiFrac, surahs, medDeg, redundancy: meanCos + hiFrac };
};

let best = null;
for (const cmb of combos) {
  const sc = scoreCombo(cmb);
  const top = [...sc.keys()].sort((x, y) => sc[y] - sc[x]).slice(0, 30);
  const st = structural(top);
  console.log(
    `${cmb.name.padEnd(32)} meanCos=${st.meanCos.toFixed(3)} hiFrac=${st.hiFrac.toFixed(3)} surahs=${st.surahs} medDeg=${st.medDeg}`,
  );
  const eligible = st.medDeg >= 8;
  if (eligible && (!best || st.redundancy < best.st.redundancy)) best = { cmb, sc, top, st };
}
if (!best) throw new Error("no eligible combo (median in-degree gate)");
console.log(`\nselected: ${best.cmb.name}`);

const { sc, top } = best;

// ---- 4. outputs ----
const top30 = top.map((i) => ({
  location: meta[i].location,
  score: Number(sc[i].toFixed(4)),
  textSnippet: meta[i].t,
  inDegree: inEdges[i].length,
  dispersion: Number(dispersion[i].toFixed(3)),
  effSurahs: Number(effSurahs[i].toFixed(1)),
  effRoots: Number(effRoots[i].toFixed(1)),
}));

// 5 sample hubs across DIFFERENT themes: greedy min-max-cos over top-30
const sampleIdx = [top[0]];
while (sampleIdx.length < 5) {
  let pick = -1, pickVal = Infinity;
  for (const cand of top) {
    if (sampleIdx.includes(cand)) continue;
    let mx = -1;
    for (const s of sampleIdx) mx = Math.max(mx, cos(cand, s));
    if (mx < pickVal) {
      pickVal = mx;
      pick = cand;
    }
  }
  sampleIdx.push(pick);
}

// tafsil per hub: MMR over in-neighbors so the 10 span the fan
const mmrTafsil = (hubId, k) => {
  const cands = [...inEdges[hubId]].sort((x, y) => y.w - x.w);
  const picked = [];
  while (picked.length < k && picked.length < cands.length) {
    let bestC = null, bestV = -Infinity;
    for (const c of cands) {
      if (picked.some((p) => p.src === c.src)) continue;
      let mx = 0;
      for (const p of picked) mx = Math.max(mx, cos(c.src, p.src));
      const v = c.w - 0.5 * mx;
      if (v > bestV) {
        bestV = v;
        bestC = c;
      }
    }
    if (!bestC) break;
    picked.push(bestC);
  }
  return picked.map((p) => meta[p.src].location);
};

const samples = sampleIdx.map((i) => ({
  hub: meta[i].location,
  hubText: meta[i].t,
  tafsil: mmrTafsil(i, 10),
}));

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      method: `diversity-weighted authority: in-strength × dispersion^${best.cmb.a} × (effSurahs/n)^${best.cmb.b} × (effRareRoots/T)^${best.cmb.g}; topK=${K} cosine, generality-directed (v1); combo selected by structural top-30 redundancy`,
      top30,
      samples,
    },
    null,
    1,
  ),
);

console.log(`\n=== top 30 (diversity-weighted authority) ===`);
for (const h of top30)
  console.log(
    `  ${h.location.padEnd(7)} sc=${String(h.score).padStart(8)} in=${String(h.inDegree).padStart(3)} d=${h.dispersion} effS=${h.effSurahs} effR=${h.effRoots}  ${h.textSnippet.slice(0, 55)}`,
  );
console.log(`\nwrote ${OUT}`);

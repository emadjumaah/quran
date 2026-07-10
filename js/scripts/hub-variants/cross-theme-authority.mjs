/**
 * hub-variant: cross-theme-authority
 *
 * V1's flaw: raw centrality on the تفصيل→محكم graph rewards the densest
 * thematic cluster (كفر/تكذيب/عذاب monopolizes the top-20). A جامعة/محكمة
 * should instead be an ayah whose elaborators SPAN themes.
 *
 * Method:
 *  1. Same top-K cosine graph + generality direction as v1 (theme-blind).
 *  2. Spherical k-means over all 6,236 vectors into T themes
 *     (k-means++ init, deterministic seeded PRNG). T ∈ {25, 40, 60};
 *     T=40 is primary, others reported for sensitivity.
 *  3. An edge is "strong" if its cosine ≥ global median edge weight.
 *  4. A theme "counts" for hub h if ≥ MIN_PRESENCE strong in-neighbors of h
 *     belong to it.
 *  5. score(h) = (#counting themes) × (mean weight of strong in-edges).
 *     Cross-theme breadth is the first-order term; density only matters
 *     within a breadth level (and mildly, via mean weight).
 *
 * No ayah is special-cased; everything is derived from vectors alone.
 *
 * Usage: cd /Volumes/data/new-projects/quran/js && node scripts/hub-variants/cross-theme-authority.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../../quran-kg.db");
const OUT = path.resolve(HERE, "cross-theme-authority.out.json");
const DIM = 768;
const K = 15; // v1's sparsification
const THEME_COUNTS = [25, 40, 60];
const PRIMARY_T = 40;
const MIN_PRESENCE = 2; // strong in-neighbors from a theme needed for it to count
const SEED = 20260710; // deterministic

// ---------- load ----------
const db = new DatabaseSync(DB, { readOnly: true });
const meta = db
  .prepare(
    "SELECT a.ayah_id, a.location, a.surah_no, substr(a.text_clean,1,90) AS t FROM ayah a ORDER BY a.ayah_id",
  )
  .all();
const vecRows = db
  .prepare(
    "SELECT vector FROM ayah_embedding WHERE model='gemini-embedding-001' AND dim=? ORDER BY ayah_id",
  )
  .all(DIM);
db.close();
const N = meta.length;
if (vecRows.length !== N) throw new Error(`vector/meta mismatch ${vecRows.length}/${N}`);

const mat = new Float32Array(N * DIM);
for (let r = 0; r < N; r++) {
  const v = new Float32Array(vecRows[r].vector.buffer, vecRows[r].vector.byteOffset, DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) mat[r * DIM + i] = v[i] / n;
}
console.log(`vectors ready (${N})`);

// ---------- 1. top-K similarity graph + generality (v1 pattern) ----------
const nbr = Array.from({ length: N }, () => []);
const generality = new Float64Array(N);
{
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
    if ((a + 1) % 1000 === 0)
      console.log(`  sim ${a + 1}/${N} (${((Date.now() - t0) / 1000) | 0}s)`);
  }
}

// directed edges تفصيل → محكم (less general -> more general), deduped
const inEdges = Array.from({ length: N }, () => []);
const allWeights = [];
{
  const edgeSet = new Set();
  for (let a = 0; a < N; a++) {
    for (const { j, w } of nbr[a]) {
      const key = a < j ? `${a}|${j}` : `${j}|${a}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      const [src, dst] = generality[a] >= generality[j] ? [j, a] : [a, j];
      inEdges[dst].push({ src, w });
      allWeights.push(w);
    }
  }
  console.log(`directed edges: ${edgeSet.size}`);
}
allWeights.sort((x, y) => x - y);
const STRONG = allWeights[Math.floor(allWeights.length / 2)]; // global median
console.log(`strong-edge threshold (median cosine): ${STRONG.toFixed(4)}`);

// ---------- 2. deterministic spherical k-means ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kmeans(T, seed) {
  const rng = mulberry32(seed);
  const cent = new Float32Array(T * DIM);
  // k-means++ init: squared euclid on unit sphere = 2(1 - cos)
  const d2 = new Float64Array(N).fill(Infinity);
  let pick = Math.floor(rng() * N);
  for (let c = 0; c < T; c++) {
    cent.set(mat.subarray(pick * DIM, pick * DIM + DIM), c * DIM);
    if (c === T - 1) break;
    let total = 0;
    for (let i = 0; i < N; i++) {
      let dot = 0;
      const ib = i * DIM,
        cb = c * DIM;
      for (let d = 0; d < DIM; d++) dot += mat[ib + d] * cent[cb + d];
      const dist = 2 * (1 - dot);
      if (dist < d2[i]) d2[i] = dist;
      total += d2[i];
    }
    let r = rng() * total;
    pick = N - 1;
    for (let i = 0; i < N; i++) {
      r -= d2[i];
      if (r <= 0) {
        pick = i;
        break;
      }
    }
  }
  // Lloyd iterations (spherical)
  const assign = new Int32Array(N).fill(-1);
  const bestDot = new Float64Array(N);
  for (let it = 0; it < 60; it++) {
    let moved = 0;
    for (let i = 0; i < N; i++) {
      let best = -1,
        bd = -2;
      const ib = i * DIM;
      for (let c = 0; c < T; c++) {
        let dot = 0;
        const cb = c * DIM;
        for (let d = 0; d < DIM; d++) dot += mat[ib + d] * cent[cb + d];
        if (dot > bd) {
          bd = dot;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        moved++;
      }
      bestDot[i] = bd;
    }
    if (moved === 0) break;
    // recompute centroids
    cent.fill(0);
    const size = new Int32Array(T);
    for (let i = 0; i < N; i++) {
      const cb = assign[i] * DIM,
        ib = i * DIM;
      size[assign[i]]++;
      for (let d = 0; d < DIM; d++) cent[cb + d] += mat[ib + d];
    }
    for (let c = 0; c < T; c++) {
      if (size[c] === 0) {
        // reseed empty cluster at worst-fit point
        let worst = 0;
        for (let i = 1; i < N; i++) if (bestDot[i] < bestDot[worst]) worst = i;
        cent.set(mat.subarray(worst * DIM, worst * DIM + DIM), c * DIM);
        bestDot[worst] = 2;
        continue;
      }
      let n = 0;
      const cb = c * DIM;
      for (let d = 0; d < DIM; d++) n += cent[cb + d] * cent[cb + d];
      n = Math.sqrt(n) || 1;
      for (let d = 0; d < DIM; d++) cent[cb + d] /= n;
    }
  }
  return assign;
}

// ---------- 3. cross-theme authority score ----------
function scoreAll(assign) {
  const scores = new Float64Array(N);
  const themeSpan = new Int32Array(N);
  const meanW = new Float64Array(N);
  const inStrength = new Float64Array(N);
  for (let dst = 0; dst < N; dst++) {
    const per = new Map();
    let sum = 0,
      cnt = 0;
    for (const { src, w } of inEdges[dst]) {
      inStrength[dst] += w;
      if (w < STRONG) continue;
      per.set(assign[src], (per.get(assign[src]) || 0) + 1);
      sum += w;
      cnt++;
    }
    let span = 0;
    for (const c of per.values()) if (c >= MIN_PRESENCE) span++;
    themeSpan[dst] = span;
    meanW[dst] = cnt ? sum / cnt : 0;
    scores[dst] = span * meanW[dst];
  }
  const ranked = [...Array(N).keys()].sort(
    (a, b) => scores[b] - scores[a] || inStrength[b] - inStrength[a],
  );
  return { scores, themeSpan, meanW, inStrength, ranked };
}

const runs = {};
for (const T of THEME_COUNTS) {
  const t0 = Date.now();
  const assign = kmeans(T, SEED);
  const res = scoreAll(assign);
  runs[T] = { assign, ...res };
  console.log(
    `T=${T}: kmeans+score in ${((Date.now() - t0) / 1000) | 0}s; top1=${meta[res.ranked[0]].location} span=${res.themeSpan[res.ranked[0]]}`,
  );
}

const primary = runs[PRIMARY_T];

// sensitivity: top-30 overlap across theme counts
const top30Of = (T) => new Set(runs[T].ranked.slice(0, 30));
const overlap = (A, B) => [...A].filter((x) => B.has(x)).length;
const sensitivity = {};
for (const a of THEME_COUNTS)
  for (const b of THEME_COUNTS)
    if (a < b) sensitivity[`top30_overlap_${a}_vs_${b}`] = overlap(top30Of(a), top30Of(b));
console.log("sensitivity:", sensitivity);

// ---------- outputs ----------
const top30 = primary.ranked.slice(0, 30).map((id) => ({
  location: meta[id].location,
  score: Number(primary.scores[id].toFixed(3)),
  themeSpan: primary.themeSpan[id],
  meanEdgeW: Number(primary.meanW[id].toFixed(4)),
  inDegree: inEdges[id].length,
  textSnippet: meta[id].t,
}));

// theme-diverse tafsil: round-robin over themes ordered by best edge weight
function tafsilOf(id, n) {
  const byTheme = new Map();
  for (const { src, w } of inEdges[id]) {
    if (w < STRONG) continue;
    const t = primary.assign[src];
    if (!byTheme.has(t)) byTheme.set(t, []);
    byTheme.get(t).push({ src, w });
  }
  const groups = [...byTheme.values()]
    .map((g) => g.sort((x, y) => y.w - x.w))
    .sort((g1, g2) => g2[0].w - g1[0].w);
  const out = [];
  for (let round = 0; out.length < n; round++) {
    let any = false;
    for (const g of groups) {
      if (round < g.length) {
        out.push(meta[g[round].src].location);
        any = true;
        if (out.length >= n) break;
      }
    }
    if (!any) break;
  }
  return out;
}

// 5 sample hubs from DIFFERENT own-themes (primary assignment)
const samples = [];
const seenThemes = new Set();
for (const id of primary.ranked) {
  const t = primary.assign[id];
  if (seenThemes.has(t)) continue;
  seenThemes.add(t);
  samples.push({ hub: meta[id].location, hubText: meta[id].t, tafsil: tafsilOf(id, 10) });
  if (samples.length === 5) break;
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      method:
        "cross-theme-authority: v1 topK=15 generality-directed graph; spherical k-means themes (seeded k-means++); score = (#themes with >=2 strong in-neighbors) x mean strong-edge weight; strong = median edge cosine",
      settings: { K, THEME_COUNTS, PRIMARY_T, MIN_PRESENCE, SEED, strongThreshold: Number(STRONG.toFixed(4)) },
      sensitivity,
      top30,
      samples,
      top10ByThemeCount: Object.fromEntries(
        THEME_COUNTS.map((T) => [
          T,
          runs[T].ranked.slice(0, 10).map((id) => ({
            location: meta[id].location,
            score: Number(runs[T].scores[id].toFixed(3)),
            themeSpan: runs[T].themeSpan[id],
          })),
        ]),
      ),
    },
    null,
    1,
  ),
);

console.log(`\n=== top 30 (T=${PRIMARY_T}) ===`);
for (const h of top30)
  console.log(
    `  ${h.location.padEnd(7)} score=${String(h.score).padStart(7)} span=${String(h.themeSpan).padStart(2)} in=${String(h.inDegree).padStart(3)}  ${h.textSnippet}`,
  );
console.log(`\nwrote ${OUT}`);

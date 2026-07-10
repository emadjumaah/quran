/**
 * محكم → تفصيل — Quran-wide verse-relatedness graph + centrality ensemble.
 *
 * Beyond ICCKE-2018 (per-surah central verse): the WHOLE Quran as one directed
 * graph where elaborating (specific) ayahs point to principle (general) ayahs.
 *
 * Pipeline:
 *  1. similarity graph: full cosine over the 6,236 Gemini vectors,
 *     sparsified to top-K neighbors per ayah (K=15).
 *  2. generality g(x) = mean cosine of x to the whole corpus
 *     (a universal-principle ayah is broadly similar to everything).
 *  3. direction: for each similar pair, the LESS general points to the MORE
 *     general (تفصيل → محكم).
 *  4. centrality ensemble on the directed graph: in-degree, PageRank,
 *     HITS authority — plus undirected PageRank for stability comparison.
 *  5. output: quran-hubs.json — ranked hub ayahs, each with its تفصيل set
 *     (in-neighbors by edge weight); plus per-surah central verse (paper
 *     reproduction) for validation.
 *
 * Usage: node scripts/compute-hubs.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const OUT = path.resolve(HERE, "../../quran-hubs.json");
const DIM = 768;
const K = 15;

const db = new DatabaseSync(DB, { readOnly: true });
const meta = db.prepare(
  "SELECT a.ayah_id, a.location, a.surah_no, substr(a.text_clean,1,80) AS t, a.word_count AS wc FROM ayah a ORDER BY a.ayah_id",
).all();
const vecRows = db
  .prepare("SELECT vector FROM ayah_embedding WHERE model='gemini-embedding-001' AND dim=? ORDER BY ayah_id")
  .all(DIM);
db.close();
const N = meta.length;

// normalized matrix
const mat = new Float32Array(N * DIM);
for (let r = 0; r < N; r++) {
  const v = new Float32Array(vecRows[r].vector.buffer, vecRows[r].vector.byteOffset, DIM);
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) mat[r * DIM + i] = v[i] / n;
}
console.log(`vectors ready (${N})`);

// 1+2: top-K neighbors + generality, one pass
const nbr = Array.from({ length: N }, () => []); // [{j, w}]
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
  // top-K of row
  const idx = [...row.keys()].sort((x, y) => row[y] - row[x]).slice(0, K);
  nbr[a] = idx.map((j) => ({ j, w: row[j] }));
  if ((a + 1) % 1000 === 0) console.log(`  sim ${a + 1}/${N} (${((Date.now() - t0) / 1000) | 0}s)`);
}

// 3: directed edges تفصيل → محكم (less general -> more general), symmetrized candidate set
const inEdges = Array.from({ length: N }, () => []); // hub <- [{src, w}]
const outDeg = new Float64Array(N);
const edgeSet = new Set();
for (let a = 0; a < N; a++) {
  for (const { j, w } of nbr[a]) {
    const key = a < j ? `${a}|${j}` : `${j}|${a}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    const [src, dst] = generality[a] >= generality[j] ? [j, a] : [a, j];
    inEdges[dst].push({ src, w });
    outDeg[src] += w;
  }
}
console.log(`directed edges: ${edgeSet.size}`);

// 4a: weighted PageRank on the directed graph
const pr = new Float64Array(N).fill(1 / N);
const tmp = new Float64Array(N);
const D = 0.85;
for (let it = 0; it < 40; it++) {
  tmp.fill((1 - D) / N);
  let dangling = 0;
  for (let a = 0; a < N; a++) if (outDeg[a] === 0) dangling += pr[a];
  const dShare = (D * dangling) / N;
  for (let dst = 0; dst < N; dst++) {
    let acc = 0;
    for (const { src, w } of inEdges[dst]) acc += (pr[src] * w) / outDeg[src];
    tmp[dst] += D * acc + dShare;
  }
  pr.set(tmp);
}

// 4b: HITS (authority = محكم, hub-score = jam' of تفصيل)
let auth = new Float64Array(N).fill(1);
let hub = new Float64Array(N).fill(1);
for (let it = 0; it < 30; it++) {
  const na = new Float64Array(N);
  for (let dst = 0; dst < N; dst++)
    for (const { src, w } of inEdges[dst]) na[dst] += hub[src] * w;
  const nh = new Float64Array(N);
  for (let dst = 0; dst < N; dst++)
    for (const { src, w } of inEdges[dst]) nh[src] += na[dst] * w;
  const normA = Math.hypot(...na) || 1;
  const normH = Math.hypot(...nh) || 1;
  auth = na.map((x) => x / normA);
  hub = nh.map((x) => x / normH);
}

// rank fusion: mean of ranks (PageRank, in-strength, authority)
const inStrength = new Float64Array(N);
for (let dst = 0; dst < N; dst++) for (const { w } of inEdges[dst]) inStrength[dst] += w;
const rankOf = (arr) => {
  const order = [...arr.keys()].sort((x, y) => arr[y] - arr[x]);
  const rank = new Float64Array(N);
  order.forEach((id, i) => (rank[id] = i + 1));
  return rank;
};
const rPR = rankOf(pr), rIS = rankOf(inStrength), rAU = rankOf(Float64Array.from(auth));
const fused = [...Array(N).keys()].sort(
  (a, b) => rPR[a] + rIS[a] + rAU[a] - (rPR[b] + rIS[b] + rAU[b]),
);

// 5: outputs
const hubs = fused.slice(0, 300).map((id) => ({
  location: meta[id].location,
  text: meta[id].t,
  pagerank: Number((pr[id] * N).toFixed(3)),
  authority: Number(auth[id].toFixed(4)),
  inDegree: inEdges[id].length,
  generality: Number(generality[id].toFixed(4)),
  tafsil: inEdges[id]
    .sort((x, y) => y.w - x.w)
    .slice(0, 30)
    .map(({ src, w }) => ({ location: meta[src].location, w: Number(w.toFixed(3)) })),
}));

// per-surah central verse (ICCKE reproduction, our data): max in-strength within surah subgraph
const perSurah = [];
for (let s = 1; s <= 114; s++) {
  const ids = meta.filter((m) => m.surah_no === s).map((m) => m.ayah_id - 1);
  const idSet = new Set(ids);
  let best = -1, bestScore = -1;
  for (const id of ids) {
    let score = 0;
    for (const { src, w } of inEdges[id]) if (idSet.has(src)) score += w;
    for (const { j, w } of nbr[id]) if (idSet.has(j)) score += w * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  perSurah.push({ surah: s, central: meta[best].location, text: meta[best].t });
}

fs.writeFileSync(OUT, JSON.stringify({ method: "hubs v1: topK=15 cosine, generality-directed, PR+HITS+in-strength fused", hubs, perSurah }, null, 1));
console.log(`\n=== أعلى ٢٠ مرشحًا (محكم/جامعة) — fused ranking ===`);
for (const h of hubs.slice(0, 20))
  console.log(`  ${h.location.padEnd(7)} PR=${String(h.pagerank).padStart(6)} in=${String(h.inDegree).padStart(3)}  ${h.text}`);
console.log(`\nwrote ${OUT}`);

/**
 * محكم → تفصيل — variant "pmi-surprise": DENSITY-NORMALIZED (PMI-style) EDGES.
 *
 * v1's flaw: raw cosine centrality rewards cluster density — the huge
 * كفر/تكذيب/عذاب cluster makes every internal edge strong, so its members
 * monopolize PageRank. Principle-breadth is not cluster density.
 *
 * This variant applies ONE idea consistently at every stage: a similarity is
 * meaningful only insofar as it exceeds what local density predicts.
 *
 *  1. EDGE SURPRISE. For each node, background B(x) = mean cosine of its
 *     rank-(K+1..K+B_WIDTH) neighbors — the similarity level "just outside"
 *     its top-K window. Edge weight:
 *         w'(a,b) = max(0, cos(a,b) − (B(a)+B(b))/2)
 *     Dense-cluster nodes have flat neighbor profiles (top sims ≈ background)
 *     so their internal edges shrink to ~0; nodes with steep profiles keep
 *     ~K graded surprising edges. (An earlier attempt clipped at the top-K
 *     MEAN — too harsh: it kept only ~3 near-twin edges per node and erased
 *     the "many moderately-surprising diverse links" breadth signal.)
 *     Same-surah pairs within ±2 ayahs are excluded (contextual run-on, not
 *     Quran-wide تفصيل), and pairs with cos ≥ 0.95 are excluded (verbatim /
 *     near-verbatim repetition — muqatta'at, refrains, twin retellings —
 *     is recitation parallelism, neither side elaborates the other).
 *     Weights are then SATURATED: φ(w) = w / (w + median positive w), so an
 *     edge contributes at most ~1 and the hub signal becomes the effective
 *     NUMBER of diverse surprising elaborators, not a sum that one strong
 *     paraphrase-level parallel can dominate.
 *
 *  2. DIVERSITY-DISCOUNTED GENERALITY ds(x). Accept x's incident edges in
 *     descending w'; discount each by the redundancy of its partner with
 *     already-accepted partners, where redundancy is measured against the
 *     partners' OWN density level:
 *         red(y,z) = clamp((cos(y,z) − m) / (mean(dK(y),dK(z)) − m), 0, 1)
 *     (m = corpus mean similarity, dK = top-K mean). Members of a tight
 *     family (parallel narrative retellings, formula twins) are mutually
 *     redundant → a hub must attract strong links from ayahs that are NOT
 *     otherwise near each other.
 *
 *  3. SOFT DIRECTION (تفصيل → محكم). Raw mean-cosine generality is itself
 *     density-corrupted, and winner-take-all direction starves hubs whose
 *     neighbors edge them out. Each edge's mass flows to endpoint e with
 *     share ds(e)² / (ds(a)² + ds(b)²).
 *
 *  4. HUB PRIOR = diversity-discounted incoming surprise (same discount as
 *     step 2, over directed in-edges), then damped propagation
 *         x = prior + α · Wᵀ(x / outStrength),   α = 0.35
 *     — a personalized PageRank where absolute surprise mass lives in the
 *     prior and the walk only adds تفصيل-of-تفصيل flow (plain PageRank's
 *     per-source normalization washes edge magnitudes out entirely).
 *
 * Samples: 5 hubs auto-picked from the top-30 by greedy farthest-point
 * (max-min cosine) so they span different themes — fully content-blind.
 *
 * Usage: node scripts/hub-variants/pmi-surprise.mjs   (from js/)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../../quran-kg.db");
const OUT = path.resolve(HERE, "pmi-surprise.out.json");
const DEBUG_OUT = path.resolve(HERE, "pmi-surprise.debug.json");
const DIM = 768;
const K = 20; // top-K window (density + background boundary)
const B_WIDTH = 15; // background band = ranks K+1 .. K+B_WIDTH
const KC = 40; // candidate neighbors kept per node
const ALPHA = 0.35; // propagation damping
const ADJ_EXCLUDE = 2; // drop same-surah pairs within this ayah distance
const NEARDUP = 0.95; // drop verbatim/near-verbatim pairs (repetition, not تفصيل)

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
db.close();
const N = meta.length;
if (vecRows.length !== N) throw new Error(`vector/meta mismatch: ${vecRows.length} vs ${N}`);
const ayahNoOf = meta.map((m) => Number(m.location.split(":")[1]));

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

const cosOf = (a, b) => {
  let dot = 0;
  const ba = a * DIM,
    bb = b * DIM;
  for (let i = 0; i < DIM; i++) dot += mat[ba + i] * mat[bb + i];
  return dot;
};

// 1: full cosine pass — top-KC candidates, density dK, background B, raw generality
const nbr = Array.from({ length: N }, () => []); // [{j, w}] raw cosine, top-KC
const density = new Float64Array(N); // mean of top-K
const backgr = new Float64Array(N); // mean of ranks K+1..K+B_WIDTH
const rawGen = new Float64Array(N);
const t0 = Date.now();
const row = new Float32Array(N);
const order = new Int32Array(N);
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
    for (let i = 0; i < DIM; i += 4) {
      dot +=
        mat[base + i] * mat[bb + i] +
        mat[base + i + 1] * mat[bb + i + 1] +
        mat[base + i + 2] * mat[bb + i + 2] +
        mat[base + i + 3] * mat[bb + i + 3];
    }
    row[b] = dot;
    sum += dot;
  }
  rawGen[a] = sum / (N - 1);
  for (let b = 0; b < N; b++) order[b] = b;
  order.sort((x, y) => row[y] - row[x]);
  let dsum = 0,
    bsum = 0;
  const lst = new Array(KC);
  for (let k = 0; k < KC; k++) {
    const j = order[k];
    lst[k] = { j, w: row[j] };
    if (k < K) dsum += row[j];
    else if (k < K + B_WIDTH) bsum += row[j];
  }
  nbr[a] = lst;
  density[a] = dsum / K;
  backgr[a] = bsum / B_WIDTH;
  if ((a + 1) % 1000 === 0)
    console.log(`  sim ${a + 1}/${N} (${((Date.now() - t0) / 1000) | 0}s)`);
}
console.log(`sim pass done in ${((Date.now() - t0) / 1000) | 0}s`);
const corpusMeanSim = rawGen.reduce((s, x) => s + x, 0) / N;
console.log(`corpus mean similarity: ${corpusMeanSim.toFixed(4)}`);

// redundancy of two nodes, measured against their own density level
const redundancy = (y, z) => {
  const yard = 0.5 * (density[y] + density[z]) - corpusMeanSim;
  if (yard <= 0) return 0;
  const r = (cosOf(y, z) - corpusMeanSim) / yard;
  return r < 0 ? 0 : r > 1 ? 1 : r;
};

// diversity-discounted sum over {partner, w} items (greedy, descending w)
const discountedSum = (items) => {
  items.sort((x, y) => y.w - x.w);
  const acc = [];
  let eff = 0;
  for (const { partner, w } of items) {
    let red = 0;
    for (const p of acc) {
      const r = redundancy(partner, p);
      if (r > red) red = r;
    }
    eff += w * (1 - red);
    acc.push(partner);
  }
  return eff;
};

// 2: surprising edges (undirected) + diversity-discounted generality ds
const edges = []; // {a, b, w}
const incident = Array.from({ length: N }, () => []); // [{partner, w}]
{
  const seen = new Set();
  let adjDropped = 0,
    dupDropped = 0;
  for (let a = 0; a < N; a++) {
    for (const { j, w } of nbr[a]) {
      const key = a < j ? a * N + j : j * N + a;
      if (seen.has(key)) continue;
      seen.add(key);
      if (
        meta[a].surah_no === meta[j].surah_no &&
        Math.abs(ayahNoOf[a] - ayahNoOf[j]) <= ADJ_EXCLUDE
      ) {
        adjDropped++;
        continue;
      }
      if (w >= NEARDUP) {
        dupDropped++;
        continue;
      }
      const s = w - 0.5 * (backgr[a] + backgr[j]);
      if (s <= 0) continue;
      edges.push({ a, b: j, w: s });
    }
  }
  console.log(
    `candidate pairs ${seen.size}: kept ${edges.length} surprising, dropped ${adjDropped} same-surah-adjacent, ${dupDropped} near-duplicates`,
  );
}
// saturate: φ(w) = w / (w + median positive w) — breadth over intensity
{
  const ws = edges.map((e) => e.w).sort((x, y) => x - y);
  const w0 = ws[ws.length >> 1] || 1;
  console.log(`median positive surprise: ${w0.toFixed(4)}`);
  for (const e of edges) {
    e.w = e.w / (e.w + w0);
    incident[e.a].push({ partner: e.b, w: e.w });
    incident[e.b].push({ partner: e.a, w: e.w });
  }
}
const ds = new Float64Array(N);
for (let x = 0; x < N; x++) if (incident[x].length) ds[x] = discountedSum(incident[x]);

// 3: soft direction — edge mass splits by ds² shares
const inEdges = Array.from({ length: N }, () => []); // hub <- [{src, w}]
const outStr = new Float64Array(N);
for (const { a, b, w } of edges) {
  const qa = ds[a] * ds[a],
    qb = ds[b] * ds[b];
  const tot = qa + qb;
  const shareA = tot > 0 ? qa / tot : 0.5;
  if (shareA > 0) {
    inEdges[a].push({ src: b, w: w * shareA });
    outStr[b] += w * shareA;
  }
  if (shareA < 1) {
    inEdges[b].push({ src: a, w: w * (1 - shareA) });
    outStr[a] += w * (1 - shareA);
  }
}

// 4: prior = diversity-discounted incoming surprise; damped propagation
const prior = new Float64Array(N);
const inStrength = new Float64Array(N);
for (let h = 0; h < N; h++) {
  if (!inEdges[h].length) continue;
  inStrength[h] = inEdges[h].reduce((s, e) => s + e.w, 0);
  prior[h] = discountedSum(inEdges[h].map(({ src, w }) => ({ partner: src, w })));
}
const score = Float64Array.from(prior);
const tmp = new Float64Array(N);
for (let it = 0; it < 40; it++) {
  tmp.set(prior);
  for (let dst = 0; dst < N; dst++) {
    let acc = 0;
    for (const { src, w } of inEdges[dst]) acc += (score[src] * w) / outStr[src];
    tmp[dst] += ALPHA * acc;
  }
  score.set(tmp);
}

const ranked = [...Array(N).keys()].sort((a, b) => score[b] - score[a]);
const sMax = score[ranked[0]] || 1;
const top30 = ranked.slice(0, 30).map((id) => ({
  location: meta[id].location,
  score: Number(((score[id] / sMax) * 100).toFixed(2)),
  textSnippet: meta[id].t,
}));

// 5: pick 5 sample hubs from top-30 — greedy farthest-point on embeddings
const pool = ranked.slice(0, 30);
const picked = [pool[0]];
while (picked.length < 5) {
  let best = -1,
    bestScore = -Infinity;
  for (const c of pool) {
    if (picked.includes(c)) continue;
    let maxSim = -Infinity;
    for (const p of picked) maxSim = Math.max(maxSim, cosOf(c, p));
    if (-maxSim > bestScore) {
      bestScore = -maxSim;
      best = c;
    }
  }
  picked.push(best);
}
const samples = picked.map((id) => ({
  hub: meta[id].location,
  hubText: meta[id].t,
  tafsil: inEdges[id]
    .slice()
    .sort((x, y) => y.w - x.w)
    .slice(0, 10)
    .map(({ src }) => meta[src].location),
}));

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      method:
        "pmi-surprise: edge surprise = cos − mean(out-of-window background of endpoints); same-surah-adjacent and near-duplicate (cos>=0.95) pairs excluded; weights saturated w/(w+median); soft direction by diversity-discounted generality²; prior = source-diversity-discounted incoming surprise (effective count of diverse elaborators); damped propagation alpha=0.35",
      top30,
      samples,
    },
    null,
    1,
  ),
);
fs.writeFileSync(
  DEBUG_OUT,
  JSON.stringify({
    stats: { surprisingEdges: edges.length, corpusMeanSim: Number(corpusMeanSim.toFixed(4)) },
    fullRanking: ranked.map((id) => ({
      location: meta[id].location,
      score: Number(score[id].toFixed(5)),
      prior: Number(prior[id].toFixed(5)),
      inStrength: Number(inStrength[id].toFixed(5)),
      inDeg: inEdges[id].length,
      ds: Number(ds[id].toFixed(5)),
      d: Number(density[id].toFixed(4)),
      bg: Number(backgr[id].toFixed(4)),
      g: Number(rawGen[id].toFixed(4)),
    })),
  }),
);

console.log(`\n=== top 30 (pmi-surprise final) ===`);
for (const [i, id] of ranked.slice(0, 30).entries())
  console.log(
    `  ${String(i + 1).padStart(2)}. ${meta[id].location.padEnd(7)} score=${score[id].toFixed(3)} prior=${prior[id].toFixed(3)} in=${String(inEdges[id].length).padStart(3)} ds=${ds[id].toFixed(3)} d=${density[id].toFixed(3)}  ${meta[id].t.slice(0, 60)}`,
  );
console.log(`\n=== sample hubs (farthest-point picked) ===`);
for (const s of samples)
  console.log(`  ${s.hub}  ${s.hubText.slice(0, 50)}  <- ${s.tafsil.join(", ")}`);
console.log(`\nwrote ${OUT}`);

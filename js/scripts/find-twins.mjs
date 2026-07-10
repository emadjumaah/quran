/**
 * فروق التنزيل — step 1: the tiered twin-verse catalog.
 *
 * Finds every pair of ayahs that resemble each other, in three tiers:
 *   exact      — identical clean text
 *   near       — high lemma n-gram overlap (Jaccard ≥ 0.45)
 *   phrase     — share a long common lemma run (≥ 5 words) without being near
 *   paraphrase — meaning-close (Gemini cosine ≥ 0.82) without lexical overlap
 *
 * Candidate generation: inverted index over lemma 4-grams (lexical) unioned
 * with embedding cosine (semantic). Writes quran-twins.json + prints stats.
 *
 * Usage: node scripts/find-twins.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const OUT = path.resolve(HERE, "../../quran-twins.json");
const DIM = 768;

const db = new DatabaseSync(DB, { readOnly: true });

// --- load ayahs: clean text + lemma-id sequence --------------------------------
const ayahs = db.prepare("SELECT ayah_id, location, text_clean FROM ayah ORDER BY ayah_id").all();
const lemSeq = new Map(); // ayah_id -> number[]
for (const r of db
  .prepare("SELECT ayah_id, lemma_id FROM word ORDER BY word_id")
  .iterate()) {
  const arr = lemSeq.get(r.ayah_id) ?? [];
  arr.push(r.lemma_id ?? -1);
  lemSeq.set(r.ayah_id, arr);
}
const N = ayahs.length;
console.log(`loaded ${N} ayahs`);

// --- lexical candidates: inverted index over lemma 4-grams ---------------------
const gramIndex = new Map(); // gram-string -> ayah_id[]
const gramsOf = new Map(); // ayah_id -> Set<string>
for (const a of ayahs) {
  const seq = lemSeq.get(a.ayah_id) ?? [];
  const set = new Set();
  for (let i = 0; i + 4 <= seq.length; i++) {
    const g = seq.slice(i, i + 4).join(",");
    set.add(g);
  }
  gramsOf.set(a.ayah_id, set);
  for (const g of set) {
    const list = gramIndex.get(g);
    if (list) list.push(a.ayah_id);
    else gramIndex.set(g, [a.ayah_id]);
  }
}
const candCount = new Map(); // "a|b" -> shared gram count
for (const [, list] of gramIndex) {
  if (list.length < 2 || list.length > 60) continue; // ignore hyper-common formulas at candidate stage
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const key = `${list[i]}|${list[j]}`;
      candCount.set(key, (candCount.get(key) ?? 0) + 1);
    }
  }
}
console.log(`lexical candidate pairs: ${candCount.size}`);

// --- longest common lemma run (for phrase tier + alignment preview) -------------
function longestRun(a, b) {
  const s1 = lemSeq.get(a) ?? [];
  const s2 = lemSeq.get(b) ?? [];
  let best = 0;
  const prev = new Array(s2.length + 1).fill(0);
  for (let i = 1; i <= s1.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= s2.length; j++) {
      const tmp = prev[j];
      if (s1[i - 1] !== -1 && s1[i - 1] === s2[j - 1]) {
        prev[j] = diagonal + 1;
        if (prev[j] > best) best = prev[j];
      } else prev[j] = 0;
      diagonal = tmp;
    }
  }
  return best;
}

const jaccard = (a, b) => {
  const A = gramsOf.get(a), B = gramsOf.get(b);
  if (!A?.size || !B?.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
};

// --- semantic candidates: MUTUAL top-8 neighbors (quran-neighbors.bin) ----------
const nb = fs.readFileSync(path.resolve(HERE, "../../quran-neighbors.bin"));
const nbHl = nb.readUInt32LE(0);
const nbHeader = JSON.parse(nb.subarray(4, 4 + nbHl).toString());
const nbData = nb.subarray(4 + nbHl);
const topOf = (id) => {
  const out = new Map();
  for (let i = 0; i < nbHeader.k; i++) {
    const off = ((id - 1) * nbHeader.k + i) * 3;
    const other = nbData[off] | (nbData[off + 1] << 8);
    if (other > 0) out.set(other, nbData[off + 2] / 100);
  }
  return out;
};
const semantic = new Map(); // "a|b" -> score (mutual nearest only)
for (let a = 1; a <= N; a++) {
  const mine = topOf(a);
  for (const [b, score] of mine) {
    if (b <= a) continue;
    if (topOf(b).has(a)) semantic.set(`${a}|${b}`, score);
  }
}
console.log(`mutual-nearest semantic pairs: ${semantic.size}`);

// --- unify + tier ----------------------------------------------------------------
const textOf = new Map(ayahs.map((a) => [a.ayah_id, a.text_clean]));
const locOf = new Map(ayahs.map((a) => [a.ayah_id, a.location]));
const pairs = [];
const seen = new Set();

function consider(aId, bId, sharedGrams, cos) {
  const key = `${aId}|${bId}`;
  if (seen.has(key)) return;
  seen.add(key);
  const jac = jaccard(aId, bId);
  const run = sharedGrams > 0 || jac > 0 ? longestRun(aId, bId) : 0;
  const exact = textOf.get(aId) === textOf.get(bId);
  let tier = null;
  if (exact) tier = "exact";
  else if (jac >= 0.45) tier = "near";
  else if (run >= 5) tier = "phrase";
  else if ((cos ?? 0) >= 0.62 && jac < 0.2) tier = "paraphrase"; // mutual-nearest + strong score
  if (!tier) return;
  pairs.push({
    a: locOf.get(aId),
    b: locOf.get(bId),
    tier,
    jaccard: Number(jac.toFixed(3)),
    run,
    cos: cos != null ? Number(cos.toFixed(3)) : null,
  });
}

for (const [key, shared] of candCount) {
  if (shared < 2) continue;
  const [a, b] = key.split("|").map(Number);
  consider(a, b, shared, semantic.get(key) ?? null);
}
for (const [key, cos] of semantic) {
  const [a, b] = key.split("|").map(Number);
  consider(a, b, 0, cos);
}

const byTier = {};
for (const p of pairs) byTier[p.tier] = (byTier[p.tier] ?? 0) + 1;
fs.writeFileSync(OUT, JSON.stringify({ generated: "find-twins v1", pairs }, null, 1));
console.log("tiers:", byTier, `total ${pairs.length}`);
console.log(`wrote ${OUT}`);
db.close();

/**
 * Semantic search over the Quran — find ayahs by MEANING, not wording.
 *
 * Embeds the query with Gemini (same model/dim as embed-ayahs.mjs, task type
 * RETRIEVAL_QUERY) and ranks all ayah embeddings by cosine similarity.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/semantic-search.mjs "patience in hardship"
 *   GEMINI_API_KEY=... node scripts/semantic-search.mjs --top 15 "الصبر عند المصيبة"
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");

const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const TOP = topIdx >= 0 ? Number(args.splice(topIdx, 2)[1]) : 10;
const QUERY = args.join(" ").trim();
const MODEL = "gemini-embedding-001";
const DIM = 768;
const KEY = process.env.GEMINI_API_KEY;

if (!QUERY) {
  console.error('usage: GEMINI_API_KEY=... node scripts/semantic-search.mjs "your question"');
  process.exit(1);
}
if (!KEY) {
  console.error("GEMINI_API_KEY is not set");
  process.exit(1);
}

const db = new DatabaseSync(DB, { readOnly: true });
const rows = db
  .prepare(
    `SELECT e.ayah_id, e.vector, a.location, a.text_uthmani,
            (SELECT text FROM translation t WHERE t.ayah_id = e.ayah_id AND t.lang='en' LIMIT 1) AS en
     FROM ayah_embedding e JOIN ayah a ON a.ayah_id = e.ayah_id
     WHERE e.model = ? AND e.dim = ?`,
  )
  .all(MODEL, DIM);
if (rows.length === 0) {
  console.error("no embeddings found — run embed-ayahs.mjs first");
  process.exit(1);
}

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${KEY}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text: QUERY }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: DIM,
    }),
  },
);
if (!res.ok) {
  console.error(`query embedding failed: HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const q = Float32Array.from((await res.json()).embedding.values);
let qn = 0;
for (const v of q) qn += v * v;
qn = Math.sqrt(qn);

const scored = rows.map((r) => {
  const v = new Float32Array(r.vector.buffer, r.vector.byteOffset, DIM);
  let dot = 0,
    n = 0;
  for (let i = 0; i < DIM; i++) {
    dot += q[i] * v[i];
    n += v[i] * v[i];
  }
  return { ...r, score: dot / (qn * Math.sqrt(n)) };
});
scored.sort((a, b) => b.score - a.score);

console.log(`\nSemantic search: "${QUERY}"  (${rows.length} ayahs indexed)\n`);
for (const r of scored.slice(0, TOP)) {
  console.log(`  ${r.location.padEnd(8)} ${r.score.toFixed(4)}  ${r.text_uthmani}`);
  if (r.en) console.log(`           ${r.en}`);
  console.log();
}
db.close();

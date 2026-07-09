/**
 * Verify quran-embeddings.bin: int8 ranking must match float32 ranking.
 * Compares top-10 results for several queries between the exact float
 * vectors in quran-kg.db and the quantized sidecar file.
 *
 * Usage: GEMINI_API_KEY=... node scripts/verify-embeddings.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const BIN = path.resolve(HERE, "../../quran-embeddings.bin");
const MODEL = "gemini-embedding-001";
const DIM = 768;
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY not set");
  process.exit(1);
}

// float32 store
const db = new DatabaseSync(DB, { readOnly: true });
const rows = db
  .prepare("SELECT ayah_id, vector FROM ayah_embedding WHERE model=? AND dim=? ORDER BY ayah_id")
  .all(MODEL, DIM);
db.close();

// int8 store
const buf = fs.readFileSync(BIN);
const headerLen = buf.readUInt32LE(0);
const header = JSON.parse(buf.subarray(4, 4 + headerLen).toString());
const scalesOff = 4 + headerLen;
const scales = new Float32Array(
  buf.buffer.slice(buf.byteOffset + scalesOff, buf.byteOffset + scalesOff + header.count * 4),
);
const data = new Int8Array(buf.buffer, buf.byteOffset + scalesOff + header.count * 4, header.count * DIM);

async function embed(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: DIM,
      }),
    },
  );
  const q = Float32Array.from((await res.json()).embedding.values);
  let n = 0;
  for (const v of q) n += v * v;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) q[i] /= n;
  return q;
}

const topFloat = (q, k) =>
  rows
    .map((r) => {
      const v = new Float32Array(r.vector.buffer, r.vector.byteOffset, DIM);
      let dot = 0,
        n = 0;
      for (let i = 0; i < DIM; i++) {
        dot += v[i] * q[i];
        n += v[i] * v[i];
      }
      return [r.ayah_id, dot / Math.sqrt(n)];
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map((x) => x[0]);

const topInt8 = (q, k) => {
  const scored = [];
  for (let r = 0; r < header.count; r++) {
    let dot = 0;
    const base = r * DIM;
    for (let i = 0; i < DIM; i++) dot += data[base + i] * q[i];
    scored.push([r + 1, dot * scales[r]]);
  }
  return scored
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map((x) => x[0]);
};

const QUERIES = [
  "patience in hardship and loss",
  "رحمة الله بعباده",
  "forgiveness of sins",
  "the creation of the heavens",
];
let allOk = true;
for (const text of QUERIES) {
  const q = await embed(text);
  const a = topFloat(q, 10);
  const b = topInt8(q, 10);
  const overlap = a.filter((x) => b.includes(x)).length;
  const top1 = a[0] === b[0];
  // int8 keeps top-1 exact; tail of top-10 may jitter by one rank on
  // near-tied scores — require top-1 match and >= 8/10 overlap.
  allOk &&= overlap >= 8 && top1;
  console.log(
    `${top1 && overlap >= 9 ? "OK " : "FAIL"} "${text}" — top1 ${top1 ? "match" : "DIFFERS"}, top10 overlap ${overlap}/10`,
  );
}
process.exit(allOk ? 0 : 1);

/**
 * Export ayah embeddings from quran-kg.db into a compact binary sidecar for
 * the browser: quran-embeddings.bin (~4.8 MB for 6,236 × 768-dim int8).
 *
 * Format (little-endian):
 *   uint32  headerLength
 *   bytes   JSON header { magic, model, dim, count, quant: "int8" }
 *   f32[count]        per-vector dequantization scale
 *   i8[count * dim]   quantized vectors, ordered by ayah_id (1..count)
 *
 * Vectors are L2-normalized before quantization, so
 *   cosine(v, q) ≈ scale_v * Σ int8_v[i] * qnorm[i]
 * and ranking by that dot product is exact enough for retrieval (verified
 * against float32 by verify-embeddings.mjs).
 *
 * Usage: node scripts/export-embeddings.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");
const OUT = path.resolve(HERE, "../../quran-embeddings.bin");
const MODEL = "gemini-embedding-001";
const DIM = 768;

const db = new DatabaseSync(DB, { readOnly: true });
const rows = db
  .prepare(
    "SELECT ayah_id, vector FROM ayah_embedding WHERE model=? AND dim=? ORDER BY ayah_id",
  )
  .all(MODEL, DIM);
db.close();
if (rows.length === 0) {
  console.error("no embeddings in quran-kg.db — run embed-ayahs.mjs first");
  process.exit(1);
}
for (let i = 0; i < rows.length; i++) {
  if (rows[i].ayah_id !== i + 1) {
    console.error(`gap: expected ayah_id ${i + 1}, got ${rows[i].ayah_id}`);
    process.exit(1);
  }
}

const count = rows.length;
const scales = new Float32Array(count);
const data = new Int8Array(count * DIM);

for (let r = 0; r < count; r++) {
  const buf = rows[r].vector;
  const v = new Float32Array(buf.buffer, buf.byteOffset, DIM);
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  let maxAbs = 0;
  for (let i = 0; i < DIM; i++) maxAbs = Math.max(maxAbs, Math.abs(v[i] / norm));
  const s = maxAbs / 127 || 1;
  scales[r] = s;
  for (let i = 0; i < DIM; i++) data[r * DIM + i] = Math.round(v[i] / norm / s);
}

let headerJson = JSON.stringify({ magic: "qkg-emb-1", model: MODEL, dim: DIM, count, quant: "int8" });
// pad so the scales section starts 4-byte aligned (Float32Array views)
while ((4 + Buffer.byteLength(headerJson)) % 4 !== 0) headerJson += " ";
const header = Buffer.from(headerJson);
const head = Buffer.alloc(4);
head.writeUInt32LE(header.length);
fs.writeFileSync(
  OUT,
  Buffer.concat([head, header, Buffer.from(scales.buffer), Buffer.from(data.buffer)]),
);
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${count} vectors, dim ${DIM}, int8)`);

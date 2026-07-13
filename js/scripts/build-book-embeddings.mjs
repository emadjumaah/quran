/**
 * build-book-embeddings.mjs — embed a tafsir/book into BROWSER-side int8 files,
 * exactly like the āyāt (quran-embeddings.bin). No monlite vector, no server RAG:
 * نِبراس loads a book on demand and searches it client-side (cosine over int8),
 * the same way مثلها/meaning-search work. The heavy server path (rag.db) stays in
 * reserve for a desktop/heavy build.
 *
 * Outputs (public/):
 *   rag-<source>.bin   — header {magic:"qkg-book-1", model, dim, count, quant:int8}
 *                        + f32[count] scales + int8[count*dim] (L2-normed, quantized)
 *   rag-<source>.json  — [{ref, text}] aligned by index (citation + display)
 *
 * Usage: GEMINI_API_KEY=… node scripts/build-book-embeddings.mjs <source-id> <records.jsonl>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = "gemini-embedding-001";
const DIM = 768;
const [, , source, file] = process.argv;
if (!source || !file) { console.error("usage: GEMINI_API_KEY=… node scripts/build-book-embeddings.mjs <source-id> <records.jsonl>"); process.exit(1); }
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("set GEMINI_API_KEY"); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, "../apps/studio/public");

const raw = fs.readFileSync(path.resolve(file), "utf8").trim();
const records = (raw.startsWith("[") ? JSON.parse(raw) : raw.split("\n").filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => r && r.ref != null && r.text);
console.log(`${records.length} records for source="${source}"`);

async function embedBatch(texts, tries = 0) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${key}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ requests: texts.map((t) => ({ model: `models/${MODEL}`, content: { parts: [{ text: String(t).slice(0, 2000) }] }, taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: DIM })) }),
  });
  if (res.status === 429 && tries < 6) { const wait = 2000 * (tries + 1); console.log(`  429 — waiting ${wait}ms`); await new Promise((r) => setTimeout(r, wait)); return embedBatch(texts, tries + 1); }
  if (!res.ok) throw new Error(`embed HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { embeddings } = await res.json();
  return embeddings.map((e) => e.values);
}

const count = records.length;
const scales = new Float32Array(count);
const data = new Int8Array(count * DIM);
const B = 96;
for (let i = 0; i < count; i += B) {
  const chunk = records.slice(i, i + B);
  const vecs = await embedBatch(chunk.map((r) => r.text));
  for (let j = 0; j < chunk.length; j++) {
    const v = vecs[j];
    let norm = 0; for (let d = 0; d < DIM; d++) norm += v[d] * v[d];
    norm = Math.sqrt(norm) || 1;
    let maxAbs = 0; for (let d = 0; d < DIM; d++) maxAbs = Math.max(maxAbs, Math.abs(v[d] / norm));
    const s = maxAbs / 127 || 1;
    const r = i + j;
    scales[r] = s;
    for (let d = 0; d < DIM; d++) data[r * DIM + d] = Math.round(v[d] / norm / s);
  }
  console.log(`  …${Math.min(i + B, count)}/${count}`);
}

let headerJson = JSON.stringify({ magic: "qkg-book-1", model: MODEL, dim: DIM, count, quant: "int8", source });
while ((4 + Buffer.byteLength(headerJson)) % 4 !== 0) headerJson += " ";
const header = Buffer.from(headerJson);
const head = Buffer.alloc(4); head.writeUInt32LE(header.length);
const binPath = path.join(PUB, `rag-${source}.bin`);
fs.writeFileSync(binPath, Buffer.concat([head, header, Buffer.from(scales.buffer), Buffer.from(data.buffer)]));
fs.writeFileSync(path.join(PUB, `rag-${source}.json`), JSON.stringify(records.map((r) => ({ ref: String(r.ref), text: String(r.text) }))));
console.log(`wrote rag-${source}.bin (${(fs.statSync(binPath).size / 1e6).toFixed(1)} MB, ${count} vectors) + rag-${source}.json`);

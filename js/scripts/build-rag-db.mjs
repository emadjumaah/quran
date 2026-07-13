/**
 * build-rag-db.mjs — build rag.db, نِبراس's semantic corpus, from the āyāt.
 *
 * The first SOURCE is "quran" (reusing the float ayah vectors already in
 * quran-kg.db → ayah_embedding). Tafsir + books get appended the same way, each
 * under its own `source`, so نِبراس can retrieve + CITE per source while the
 * computed layers stay Quran+معاجم+QAC only.
 *
 * Uses @monlite/vector's `createVectorStore` (RAG store): the vector lives in a
 * COMPACT sqlite-vec (vec0) binary index — not fat JSON floats — with
 * `source` as an indexed filter column and {ref,text} as metadata. Serverless:
 * one read-only .db a function opens; no always-on server.
 *
 * Usage: node scripts/build-rag-db.mjs   → writes ../../rag.db
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb } from "@monlite/core";
import { createVectorStore } from "@monlite/vector";
import { RAG_DIM } from "../shared/monlite-schemas.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KG = path.resolve(HERE, "../../quran-kg.db");
const OUT = path.resolve(HERE, "../../rag.db");
const MODEL = "gemini-embedding-001";

for (const ext of ["", "-journal", "-wal", "-shm"]) fs.rmSync(OUT + ext, { force: true });

// 1) read āyāt + their float vectors from quran-kg.db
const kg = new DatabaseSync(KG, { readOnly: true });
const ayat = kg.prepare("SELECT ayah_id, location, text_clean FROM ayah ORDER BY ayah_id").all();
const vecStmt = kg.prepare("SELECT vector FROM ayah_embedding WHERE ayah_id=? AND model=? AND dim=?");
const vecOf = (id) => {
  const row = vecStmt.get(id, MODEL, RAG_DIM);
  if (!row) return null;
  const u8 = new Uint8Array(row.vector);
  return Array.from(new Float32Array(u8.buffer, u8.byteOffset, RAG_DIM));
};

// 2) build the compact RAG store (sqlite-vec vec0 index)
const db = createDb(OUT, { allowExtensions: true });
const store = createVectorStore(db);
store.ensureCollection("rag", { dimensions: RAG_DIM, metric: "cosine", indexedFields: ["source"] });

const BATCH = 500;
let batch = [];
let n = 0;
for (const a of ayat) {
  const vector = vecOf(a.ayah_id);
  if (!vector) continue;
  batch.push({ id: `quran#${a.location}`, vector, metadata: { source: "quran", ref: a.location, text: a.text_clean } });
  if (batch.length >= BATCH) { store.upsert("rag", batch); n += batch.length; batch = []; console.log(`  …${n}`); }
}
if (batch.length) { store.upsert("rag", batch); n += batch.length; }
console.log(`built rag.db — ${n} rows (source=quran)`);

// 3) smoke test — nearest to آية الكرسي (2:255) — read seed BEFORE closing kg
const seedId = ayat.find((a) => a.location === "2:255")?.ayah_id;
const seedVec = seedId ? vecOf(seedId) : null;
kg.close();
if (seedVec) {
  const hits = store.search("rag", { vector: seedVec, topK: 6, where: { source: "quran" } });
  console.log("\nnearest to 2:255:");
  console.log("(hit shape:", JSON.stringify(hits[0]).slice(0, 120), ")");
  for (const h of hits) {
    const m = h.metadata || h;
    console.log(`  ${m.ref}  d=${(h._distance ?? h.distance ?? 0).toFixed?.(3)}  ${String(m.text).slice(0, 40)}`);
  }
}

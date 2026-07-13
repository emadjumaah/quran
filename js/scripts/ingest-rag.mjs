/**
 * ingest-rag.mjs — add a SOURCE (tafsir / book) to نِبراس's RAG corpus (rag.db).
 *
 * Reads {ref, text} records, embeds each with Gemini (RETRIEVAL_DOCUMENT), and
 * upserts them SOURCE-TAGGED into the compact sqlite-vec store. Run once per book;
 * nothing about the āyāt (or the browser) changes — this only grows the server
 * corpus نِبراس cites from.
 *
 * Usage:
 *   GEMINI_API_KEY=… node scripts/ingest-rag.mjs <source-id> <records.jsonl>
 *   records.jsonl: one JSON object per line — {"ref":"2:255","text":"…"}
 *   (verse-anchored tafsir → ref = the āyah; topical book → ref = a locator)
 *
 * Then register it: add { id:"<source-id>", label:"…" } to BOOK_SOURCES in
 * src/rag.ts, and نِبراس starts drawing on it. Re-running replaces that source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@monlite/core";
import { createVectorStore } from "@monlite/vector";
import { RAG_DIM } from "../shared/monlite-schemas.mjs";

const MODEL = "gemini-embedding-001";
const [, , source, file] = process.argv;
if (!source || !file) {
  console.error("usage: GEMINI_API_KEY=… node scripts/ingest-rag.mjs <source-id> <records.jsonl>");
  process.exit(1);
}
const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("set GEMINI_API_KEY"); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../rag.db");

const raw = fs.readFileSync(path.resolve(file), "utf8").trim();
const records = raw.startsWith("[") ? JSON.parse(raw) : raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
const recs = records.filter((r) => r && r.ref != null && r.text);
console.log(`${recs.length} records for source="${source}"`);

async function embedBatch(texts) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text: String(t).slice(0, 2000) }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: RAG_DIM,
        })),
      }),
    },
  );
  if (!res.ok) throw new Error(`embed HTTP ${res.status}: ${await res.text()}`);
  const { embeddings } = await res.json();
  return embeddings.map((e) => e.values);
}

const db = createDb(OUT, { allowExtensions: true });
const store = createVectorStore(db);
store.ensureCollection("rag", { dimensions: RAG_DIM, metric: "cosine", indexedFields: ["source"] });
store.delete("rag", { where: { source } }); // idempotent re-ingest

const B = 96;
let n = 0;
for (let i = 0; i < recs.length; i += B) {
  const chunk = recs.slice(i, i + B);
  const vecs = await embedBatch(chunk.map((r) => r.text));
  store.upsert(
    "rag",
    chunk.map((r, j) => ({
      id: `${source}#${r.ref}#${i + j}`,
      vector: vecs[j],
      metadata: { source, ref: String(r.ref), text: String(r.text) },
    })),
  );
  n += chunk.length;
  console.log(`  …${n}/${recs.length}`);
}
console.log(`ingested ${n} passages (source="${source}") → rag.db.\nNow add { id:"${source}", label:"…" } to BOOK_SOURCES in src/rag.ts.`);

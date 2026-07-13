/**
 * embed-books.mjs — build نِبراس embeddings for the CHOSEN set of books, one at a
 * time (sequential; concurrency throttles the API). Each produces public/rag-<id>.bin
 * (+ refreshes rag-<id>.json, ranges preserved). After this succeeds, flip these ids
 * to `embedded: true` in src/books.ts so نِبراس searches them.
 *
 * Usage:  GEMINI_API_KEY=…  node scripts/embed-books.mjs
 *   (or put GEMINI_API_KEY=… in js/.env and:  node --env-file=.env scripts/embed-books.mjs)
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");

// (id, genre) — the meaning-lens set that joins الميسّر + الجلالين
const CHOSEN = [
  ["mukhtasar", "tafsir"], // finest per-verse coverage
  ["saadi", "tafsir"],     // reasoning + فوائد
  ["seraj", "gharib"],     // lexical lens
  ["wahidi", "asbab"],     // occasion-of-revelation (context)
  ["muharrar", "asbab"],   // verified asbab (narrow, clean)
];

if (!process.env.GEMINI_API_KEY) { console.error("set GEMINI_API_KEY (env or --env-file=.env)"); process.exit(1); }

for (const [id, genre] of CHOSEN) {
  const src = join(DATA, genre, `${id}.jsonl`);
  if (!existsSync(src)) { console.warn(`SKIP ${id}: ${src} missing`); continue; }
  console.log(`\n=== embedding ${id} (${genre}) ===`);
  const r = spawnSync(process.execPath, [join(HERE, "build-book-embeddings.mjs"), id, src], {
    stdio: "inherit", env: process.env,
  });
  if (r.status !== 0) { console.error(`FAILED on ${id} — stopping (safe to re-run; done books are cached).`); process.exit(1); }
}
console.log("\n✅ all embeddings built. Now set embedded:true for these ids in src/books.ts.");

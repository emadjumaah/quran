/**
 * Semantic layer: embed every ayah with the Gemini embedding API and store
 * vectors in quran-kg.db (table ayah_embedding). The converter then copies
 * them into quran-app.db for monlite vector search (@monlite/vector has a
 * pure-JS fallback in the browser).
 *
 * Per project decision (2026-07-09): all semantic vectors go through Gemini,
 * so future tests are apples-to-apples.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/embed-ayahs.mjs [--model gemini-embedding-001] [--dim 768]
 *
 * - Embeds the CLEAN Arabic text plus (when present) the English translation
 *   as one document per ayah, task type RETRIEVAL_DOCUMENT.
 * - Batches 100 ayahs per request, resumes automatically (skips ayahs already
 *   embedded with the same model+dim), rate-limit aware.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = path.resolve(HERE, "../../quran-kg.db");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const MODEL = opt("model", "gemini-embedding-001");
const DIM = Number(opt("dim", "768"));
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error(
    "GEMINI_API_KEY is not set.\n" +
      "Get a key at https://aistudio.google.com/apikey then run:\n" +
      "  GEMINI_API_KEY=... node scripts/embed-ayahs.mjs",
  );
  process.exit(1);
}

const db = new DatabaseSync(DB);
db.exec(`
  CREATE TABLE IF NOT EXISTS ayah_embedding (
    ayah_id INTEGER NOT NULL REFERENCES ayah(ayah_id),
    model   TEXT NOT NULL,
    dim     INTEGER NOT NULL,
    vector  BLOB NOT NULL,          -- float32 array, little-endian
    PRIMARY KEY (ayah_id, model, dim)
  );
`);

const hasTranslation = db
  .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='translation'")
  .get().n;

const rows = db
  .prepare(
    `SELECT a.ayah_id, a.location, a.text_clean,
            ${hasTranslation ? "(SELECT text FROM translation t WHERE t.ayah_id=a.ayah_id AND t.lang='en' LIMIT 1)" : "NULL"} AS en
     FROM ayah a
     WHERE NOT EXISTS (SELECT 1 FROM ayah_embedding e
                       WHERE e.ayah_id=a.ayah_id AND e.model=? AND e.dim=?)
     ORDER BY a.ayah_id`,
  )
  .all(MODEL, DIM);
console.log(`${rows.length} ayahs to embed with ${MODEL} (dim ${DIM})`);

const insert = db.prepare("INSERT OR REPLACE INTO ayah_embedding VALUES (?,?,?,?)");
const URL_ = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;

const BATCH = 100;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const body = {
    requests: batch.map((r) => ({
      model: `models/${MODEL}`,
      content: { parts: [{ text: r.en ? `${r.text_clean}\n${r.en}` : r.text_clean }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: DIM,
    })),
  };
  let res;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(`${URL_}?key=${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) break;
    if ((res.status === 429 || res.status >= 500) && attempt <= 5) {
      const wait = attempt * 5000;
      console.log(`  HTTP ${res.status}, retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    console.error(`embedding request failed: HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { embeddings } = await res.json();
  db.exec("BEGIN");
  for (let j = 0; j < batch.length; j++) {
    const vec = Float32Array.from(embeddings[j].values);
    insert.run(batch[j].ayah_id, MODEL, DIM, Buffer.from(vec.buffer));
  }
  db.exec("COMMIT");
  console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}

const n = db.prepare("SELECT COUNT(*) n FROM ayah_embedding WHERE model=? AND dim=?").get(MODEL, DIM).n;
console.log(`done — ${n} ayah embeddings stored in quran-kg.db (${MODEL}, dim ${DIM})`);
db.close();

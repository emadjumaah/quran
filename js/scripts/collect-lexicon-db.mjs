/**
 * collect-lexicon-db.mjs — export a root-keyed lexicon table from the
 * wizsk/arabic_lexicons SQLite (11 classical Arabic dictionaries) into
 * `{root, text}` JSONL for نِبراس. The `word` column is the bare root
 * (no ḥarakāt) → joins directly to مشكاة's QAC roots.
 *
 *   node scripts/collect-lexicon-db.mjs <db.sqlite> <table> <outId>
 *   e.g. node scripts/collect-lexicon-db.mjs db.sqlite maqayeesul_luga maqayis
 *
 * Tables: maqayeesul_luga (مقاييس اللغة) · lisanularab (لسان العرب) ·
 *   mujamul_shihah (الصحاح) · mujamul_muhith (المحيط) · mujamul_wasith (الوسيط) ·
 *   mujamul_ghoni (الغني) · mujamul_muashiroh (المعاصر) ·
 *   mufradat_alfajul_quran (المفردات) · ghoribulquran (غريب القرآن)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const [DB, TABLE, OUT_ID] = process.argv.slice(2);
if (!DB || !TABLE || !OUT_ID) { console.error("usage: collect-lexicon-db.mjs <db.sqlite> <table> <outId>"); process.exit(1); }
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(REPO, "data", "lexicon");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, `${OUT_ID}.jsonl`);

const db = new DatabaseSync(DB, { readOnly: true });
const cols = db.prepare(`PRAGMA table_info(${TABLE})`).all().map((c) => c.name);
const rootCol = cols.includes("word") ? "word" : cols.includes("root") ? "root" : cols[1];
const rows = db.prepare(`SELECT ${rootCol} AS root, meanings AS text FROM ${TABLE}`).all();

const clean = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const out = [];
for (const r of rows) {
  const root = String(r.root || "").trim();
  const text = clean(r.text);
  if (root && text) out.push({ root, text });
}
fs.writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n"));
const bytes = out.reduce((n, r) => n + Buffer.byteLength(r.text), 0);
console.log(`${TABLE} → ${OUT_ID}: ${out.length} مادّة · ${(bytes / 1e6).toFixed(2)} MB · متوسط ${Math.round(bytes / out.length)} حرف`);
console.log("sample:", JSON.stringify(out.find((r) => r.root === "حمد") || out[0]).slice(0, 200));
db.close();

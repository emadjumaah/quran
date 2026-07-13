/**
 * harvest-quranpedia-book.mjs — pull ONE Quranpedia book (by id) as verse-anchored
 * `{ref, text}` JSONL. The API is per-āyah (`/ayah/{s}/{a}/book/{id}`) and returns
 * only āyāt that have content; a long entry is split across `content[]` page-fragments,
 * which we concatenate. HTML is stripped. Polite (conc 5), resumable.
 *
 *   node scripts/harvest-quranpedia-book.mjs <bookId> <genre> <outId>
 *   e.g. node scripts/harvest-quranpedia-book.mjs 460 asbab muharrar
 */
import fs from "node:fs";
import path from "node:path";

const [BOOK_ID, GENRE, OUT_ID] = process.argv.slice(2);
if (!BOOK_ID || !GENRE || !OUT_ID) { console.error("usage: harvest-quranpedia-book.mjs <bookId> <genre> <outId>"); process.exit(1); }
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(REPO, "data", GENRE);
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, `${OUT_ID}.jsonl`);

const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,72,135,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const ALL = [];
for (let s = 1; s <= 114; s++) for (let a = 1; a <= AYAH_COUNTS[s - 1]; a++) ALL.push(`${s}:${a}`);

const done = new Set();
if (fs.existsSync(OUT)) for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
  if (!line) continue; try { done.add(JSON.parse(line).ref); } catch {}
}
const todo = ALL.filter((r) => !done.has(r));
console.log(`book ${BOOK_ID} → ${GENRE}/${OUT_ID}: ${done.size} done, ${todo.length} to fetch`);

const clean = (html) => String(html)
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const stream = fs.createWriteStream(OUT, { flags: "a" });
const CONCURRENCY = 5;
let idx = 0, saved = 0, empty = 0, errors = 0;

async function fetchRef(ref) {
  const [s, a] = ref.split(":");
  const url = `https://api.quranpedia.net/v1/ayah/${s}/${a}/book/${BOOK_ID}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) { if (res.status === 404) return; throw new Error(res.status); }
      const d = await res.json();
      const parts = Array.isArray(d.content) ? d.content : [];
      const text = clean(parts.map((c) => c.text || "").join(" "));
      if (!text) { empty++; return; }
      stream.write(JSON.stringify({ ref, text }) + "\n");
      saved++; return;
    } catch (e) { if (attempt === 2) { errors++; return; } await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
  }
}
async function worker() {
  while (idx < todo.length) {
    await fetchRef(todo[idx++]);
    if ((saved + empty + errors) % 250 === 0) console.log(`  …${idx}/${todo.length} saved=${saved} empty=${empty} err=${errors}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
stream.end();
console.log(`DONE book ${BOOK_ID}: saved=${saved} empty=${empty} err=${errors} → ${OUT}`);

/**
 * harvest-quranpedia.mjs — pull a per-āyah content layer from the Quranpedia API
 * into NDJSON. Polite (small concurrency), resumable (skips āyāt already saved),
 * and stores only āyāt that actually have data.
 *
 *   node scripts/harvest-quranpedia.mjs <type>
 *   <type> ∈ similar | qiraat | e3rab | meanings | topics-per-ayah | notes
 *
 * Output: js/data/quranpedia/<type>.ndjson   (one line: {"ref":"2:255","data":[...]})
 */
import fs from "node:fs";
import path from "node:path";

const TYPE = process.argv[2];
if (!TYPE) { console.error("usage: harvest-quranpedia.mjs <type>"); process.exit(1); }
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(REPO, "data", "quranpedia");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, `${TYPE}.ndjson`);

const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,72,135,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const ALL = [];
for (let s = 1; s <= 114; s++) for (let a = 1; a <= AYAH_COUNTS[s - 1]; a++) ALL.push(`${s}:${a}`);

// resume: which refs already saved
const done = new Set();
if (fs.existsSync(OUT)) for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
  if (!line) continue; try { done.add(JSON.parse(line).ref); } catch {}
}
const todo = ALL.filter((r) => !done.has(r));
console.log(`${TYPE}: ${done.size} done, ${todo.length} to fetch (of ${ALL.length})`);

const stream = fs.createWriteStream(OUT, { flags: "a" });
const CONCURRENCY = 5;
let idx = 0, saved = 0, empty = 0, errors = 0;

async function fetchRef(ref) {
  const [s, a] = ref.split(":");
  const url = `https://api.quranpedia.net/v1/ayah/${s}/${a}/${TYPE}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) { if (res.status === 404) return null; throw new Error(res.status); }
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) { empty++; return null; }
      stream.write(JSON.stringify({ ref, data }) + "\n");
      saved++; return true;
    } catch (e) { if (attempt === 2) { errors++; return null; } await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
  }
}

async function worker() {
  while (idx < todo.length) {
    const ref = todo[idx++];
    await fetchRef(ref);
    if ((saved + empty + errors) % 250 === 0) console.log(`  …${idx}/${todo.length}  saved=${saved} empty=${empty} err=${errors}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
stream.end();
console.log(`DONE ${TYPE}: saved=${saved} empty=${empty} err=${errors} → ${OUT}`);

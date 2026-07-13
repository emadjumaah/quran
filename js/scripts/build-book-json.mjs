/**
 * Convert a curated selection of verse-anchored books (js/data/<genre>/<id>.jsonl,
 * grouped {ref,text[,refEnd]}) into browser display files public/rag-<id>.json.
 *
 * Display-only: no embeddings (.bin) — the reader's «تفسير» button and the تفاسير
 * section look these up BY REF (range-aware), so no Gemini cost. Heavy tafsirs are
 * deliberately excluded to keep the browser light; see PHASE-2 in js/data/README.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data");
const OUT = join(HERE, "..", "apps", "studio", "public");

// The Phase-1 concise set (id, genre folder, output label). muyassar/jalalayn already shipped.
const BOOKS = [
  ["mukhtasar", "tafsir", "المختصر في التفسير"],
  ["saadi", "tafsir", "تيسير الكريم الرحمن — السعدي"],
  ["aysar", "tafsir", "أيسر التفاسير — الجزائري"],
  ["gharibmuyassar", "gharib", "الميسّر في غريب القرآن"],
  ["seraj", "gharib", "السراج في غريب القرآن — الخضيري"],
  ["i3rabmuyassar", "i3rab", "الإعراب الميسّر"],
  ["nashr", "qiraat", "النشر في القراءات العشر — ابن الجزري"],
  ["qiraat", "qiraat", "الموسوعة القرآنية للقراءات"],
  ["wahidi", "asbab", "أسباب نزول القرآن — الواحدي"],
  ["muharrar", "asbab", "المحرَّر في أسباب النزول — المزيني"],
];

const clean = (s) => s.replace(/\s+/g, " ").trim();
const refNum = (ref) => { const [s, a] = ref.split(":").map(Number); return s * 1000 + a; };

const asbabRanges = []; // [startNum, endNum] union, for a tiny "which verses have a sabab" index

for (const [id, genre, label] of BOOKS) {
  const src = join(DATA, genre, `${id}.jsonl`);
  if (!existsSync(src)) { console.warn(`SKIP ${id}: ${src} missing`); continue; }
  const lines = readFileSync(src, "utf8").split("\n").filter(Boolean);
  const out = [];
  for (const line of lines) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec.ref || !rec.text) continue;
    const e = { ref: rec.ref, text: clean(rec.text) };
    if (rec.refEnd && rec.refEnd !== rec.ref) e.refEnd = rec.refEnd;
    out.push(e);
    if (genre === "asbab") asbabRanges.push([refNum(e.ref), refNum(e.refEnd ?? e.ref)]);
  }
  const dest = join(OUT, `rag-${id}.json`);
  writeFileSync(dest, JSON.stringify(out));
  const mb = (Buffer.byteLength(JSON.stringify(out)) / 1e6).toFixed(1);
  console.log(`${id.padEnd(16)} ${String(out.length).padStart(5)} blocks  ${mb} MB  (${genre})  ${label}`);
}

// merged, sorted range index → the reader shows «سبب النزول» only where one exists
asbabRanges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const merged = [];
for (const [s, e] of asbabRanges) {
  const last = merged[merged.length - 1];
  if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
  else merged.push([s, e]);
}
writeFileSync(join(OUT, "asbab-index.json"), JSON.stringify(merged));
console.log(`asbab-index      ${merged.length} ranges`);
console.log("done →", OUT);

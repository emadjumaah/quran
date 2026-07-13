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
];

const clean = (s) => s.replace(/\s+/g, " ").trim();

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
  }
  const dest = join(OUT, `rag-${id}.json`);
  writeFileSync(dest, JSON.stringify(out));
  const mb = (Buffer.byteLength(JSON.stringify(out)) / 1e6).toFixed(1);
  console.log(`${id.padEnd(16)} ${String(out.length).padStart(5)} blocks  ${mb} MB  (${genre})  ${label}`);
}
console.log("done →", OUT);

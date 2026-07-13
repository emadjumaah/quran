/**
 * extract-tafsir.mjs — pull tafsir editions out of the alquran.cloud MySQL dump
 * into {ref, text} JSONL for ingest-rag.mjs. Streams the INSERT tuples with a
 * small SQL-value parser (handles backslash escapes).
 *   edition 1 = تفسير الميسر (ar.muyassar) → muyassar.jsonl
 *   edition 103 = تفسير الجلالين (ar.jalalayn) → jalalayn.jsonl
 */
import fs from "node:fs";
const SRC = "/Users/emad/Downloads/quran.sql";
const OUT = "/private/tmp/claude-503/-Volumes-data-new-projects-quran/762c865b-b6d5-4d4f-8fad-46cbaa8a28f2/scratchpad";
const sql = fs.readFileSync(SRC, "utf8");

// iterate every VALUES tuple of `INSERT INTO `table`` → cb(fields[])
function eachRow(table, cb) {
  const marker = "INSERT INTO `" + table + "`";
  let idx = 0;
  while ((idx = sql.indexOf(marker, idx)) !== -1) {
    let i = sql.indexOf("VALUES", idx);
    if (i === -1) break;
    i += 6;
    while (i < sql.length) {
      while (i < sql.length && /[\s,]/.test(sql[i])) i++;
      if (sql[i] === ";") { i++; break; }
      if (sql[i] !== "(") { i++; continue; }
      i++; // past '('
      const fields = [];
      let cur = "";
      let inStr = false;
      while (i < sql.length) {
        const c = sql[i];
        if (inStr) {
          if (c === "\\") {
            const n = sql[i + 1];
            cur += n === "n" ? "\n" : n === "r" ? "\r" : n === "t" ? "\t" : n === "0" ? "" : n;
            i += 2; continue;
          }
          if (c === "'") { inStr = false; i++; continue; }
          cur += c; i++; continue;
        } else {
          if (c === "'") { inStr = true; i++; continue; }
          if (c === ",") { fields.push(cur.trim()); cur = ""; i++; continue; }
          if (c === ")") { fields.push(cur.trim()); i++; break; }
          cur += c; i++; continue;
        }
      }
      cb(fields);
    }
    idx = i;
  }
}

// 1) ayahs: id → "surah:ayah"  (fields: id, number, text, number_in_surah, page, surah_id, …)
const ref = new Map();
eachRow("ayahs", (f) => { ref.set(f[0], `${f[5]}:${f[3]}`); });
console.log("ayahs mapped:", ref.size);

// 2) ayah_edition: (id, ayah_id, edition_id, data, …) → editions 1 & 103
const EDS = { "1": "muyassar", "103": "jalalayn" };
const out = { muyassar: [], jalalayn: [] };
eachRow("ayah_edition", (f) => {
  const ed = EDS[f[2]];
  if (!ed) return;
  const r = ref.get(f[1]);
  if (!r) return;
  const text = String(f[3]).replace(/\s+/g, " ").trim();
  if (text) out[ed].push({ ref: r, text });
});

for (const [ed, rows] of Object.entries(out)) {
  rows.sort((a, b) => { const [s1, a1] = a.ref.split(":").map(Number); const [s2, a2] = b.ref.split(":").map(Number); return s1 - s2 || a1 - a2; });
  fs.writeFileSync(`${OUT}/${ed}.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n"));
  console.log(`${ed}: ${rows.length} rows → ${ed}.jsonl  | sample:`, JSON.stringify(rows[254] || rows[0]).slice(0, 110));
}

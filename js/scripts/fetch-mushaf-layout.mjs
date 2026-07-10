/**
 * Fetch the KFGQPC/QCF v2 Madina-mushaf layout — every word's page, line, and
 * glyph code — so the reader can render pages pixel-identical to the printed
 * mushaf while each word stays real, interactive text.
 *
 * Source: quran.com API (api.qurancdn.com) — code_v2 glyph + line_number/page.
 * Output: public/mushaf/layout.json  { pages: { "<page>": [ { line, words:[
 *          { key:"s:a:w", code, ayah } ] } ] } }  and per-page-font list.
 *
 * Usage: node scripts/fetch-mushaf-layout.mjs   (~604 requests, gentle)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../apps/studio/public/mushaf");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, "layout.json");

const API = "https://api.qurancdn.com/api/qdc/verses/by_page";
const pages = {};
const t0 = Date.now();

for (let p = 1; p <= 604; p++) {
  let ok = false;
  for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
    try {
      const res = await fetch(
        `${API}/${p}?words=true&per_page=300&word_fields=code_v2,line_number,page_number,location`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { verses } = await res.json();
      const lines = new Map(); // line_number -> [{key, code, ayah}]
      for (const v of verses) {
        for (const w of v.words) {
          const ln = w.line_number ?? w.v2_page_line ?? 0;
          const arr = lines.get(ln) ?? [];
          arr.push({
            key: w.location ?? `${v.verse_key}:${w.position}`,
            code: w.code_v2 ?? w.code ?? "",
            ayah: v.verse_key,
            end: w.char_type_name === "end", // ayah-number marker glyph
          });
          lines.set(ln, arr);
        }
      }
      pages[p] = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([line, words]) => ({ line, words }));
      ok = true;
    } catch (e) {
      if (attempt === 4) console.error(`page ${p} failed: ${e.message}`);
      else await new Promise((r) => setTimeout(r, attempt * 800));
    }
  }
  if (p % 25 === 0) console.log(`  ${p}/604 (${((Date.now() - t0) / 1000) | 0}s)`);
  await new Promise((r) => setTimeout(r, 40));
}

fs.writeFileSync(OUT, JSON.stringify({ version: "qcf-v2", pages }));
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${Object.keys(pages).length} pages)`);

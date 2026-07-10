/**
 * Download the 604 QCF v2 (KFGQPC Madina) WOFF2 page-fonts to self-host them —
 * so the mushaf view works offline and depends on no external server.
 * Gitignored (large); fetched at build like the app database.
 *
 * Usage: node scripts/fetch-mushaf-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../apps/studio/public/mushaf/fonts");
fs.mkdirSync(DIR, { recursive: true });
const SRC = "https://quran.com/fonts/quran/hafs/v2/woff2";

let done = 0, bytes = 0;
const t0 = Date.now();
for (let p = 1; p <= 604; p++) {
  const out = path.join(DIR, `p${p}.woff2`);
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) { done++; continue; }
  let ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      const res = await fetch(`${SRC}/p${p}.woff2`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(out, buf);
      bytes += buf.length;
      done++;
      ok = true;
    } catch (e) {
      if (a === 4) console.error(`p${p} failed: ${e.message}`);
      else await new Promise((r) => setTimeout(r, a * 700));
    }
  }
  if (p % 50 === 0) console.log(`  ${p}/604 (${(bytes / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000) | 0}s)`);
  await new Promise((r) => setTimeout(r, 25));
}
console.log(`done: ${done}/604 fonts, ${(bytes / 1e6).toFixed(1)} MB downloaded`);

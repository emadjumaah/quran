/**
 * كلمةً كلمةً للقارئ غير العربيّ — جلبُ معنى كلِّ كلمةٍ ونقحرتِها (2026-07-29،
 * «جسرًا إلى العربية»): من واجهة Quran.com (بيانات QUL/مجمع الملك فهد المنسوبة
 * في مصادرنا)، ملفًّا لكلِّ سورةٍ يُجلب عند الحاجة — نمطُ الصوت نفسُه.
 * usage: node js/scripts/fetch-wbw.mjs
 * out:   js/apps/studio/public/wbw/{surah}.json  { "<ayahNo>": [[translit, gloss], ...] }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "apps/studio/public/wbw");
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let s = 1; s <= 114; s++) {
  const f = path.join(OUT, `${s}.json`);
  if (fs.existsSync(f)) { continue; }
  const bySura = {};
  let page = 1, totalPages = 1;
  do {
    const url = `https://api.quran.com/api/v4/verses/by_chapter/${s}?words=true&word_fields=text_uthmani&per_page=50&page=${page}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`s${s} p${page}: ${r.status}`);
    const d = await r.json();
    totalPages = d.pagination.total_pages;
    for (const v of d.verses) {
      const ws = v.words.filter((w) => w.char_type_name === "word");
      bySura[v.verse_number] = ws.map((w) => [w.transliteration?.text ?? "", (w.translation?.text ?? "").trim()]);
    }
    page++;
    await sleep(120);
  } while (page <= totalPages);
  fs.writeFileSync(f, JSON.stringify(bySura));
  process.stdout.write(`${s} `);
}
console.log("\n✓ wbw complete");

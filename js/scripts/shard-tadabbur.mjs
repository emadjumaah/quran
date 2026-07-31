/**
 * تشظيةُ التدبّر المولَّد إلى ملفّاتٍ ساكنةٍ يقرؤها التطبيق.
 *
 * ملفٌّ لكلِّ سورة: `public/tadabbur/<lang>/<sura>.json` — فالقارئُ في سورةٍ
 * يجلب ملفَّها مرّةً واحدةً ثمّ يقرأ منه كلَّ آياتها بلا شبكة. وأكبرُ السور
 * (البقرة) دون حدِّ الشظيّة، فلا حاجةَ إلى تقسيمٍ أدقّ.
 *
 * ويُكتب معها `index.json` بالتغطية — فيعرف التطبيقُ ما وُلّد وما لم يُولَّد،
 * فيقرأ الساكنَ إن وُجد ويُنادي الواجهةَ إن غاب. فالتغطيةُ تنمو والنداءُ يتناقص.
 *
 * usage: node js/scripts/shard-tadabbur.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const SRC = path.join(ROOT, "js/data/tadabbur");
const OUT = path.join(ROOT, "js/apps/studio/public/tadabbur");

if (!fs.existsSync(SRC)) { console.error("لا مادّةَ مولَّدة"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const index = { date: new Date().toISOString().slice(0, 10), langs: {} };
for (const lang of fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory())) {
  const dst = path.join(OUT, lang);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  let ayat = 0, bytes = 0;
  const suras = [];
  for (const f of fs.readdirSync(path.join(SRC, lang)).filter((f) => f.endsWith(".json"))) {
    const obj = JSON.parse(fs.readFileSync(path.join(SRC, lang, f), "utf8"));
    const n = Object.keys(obj).length;
    if (!n) continue;
    const buf = JSON.stringify(obj);
    fs.writeFileSync(path.join(dst, f), buf);
    ayat += n; bytes += buf.length;
    suras.push(Number(f.replace(".json", "")));
  }
  index.langs[lang] = { ayat, suras: suras.sort((a, b) => a - b), mb: +(bytes / 1024 / 1024).toFixed(2) };
  console.log(`${lang}: ${ayat} آيةً في ${suras.length} سورة · ${(bytes / 1024 / 1024).toFixed(1)}MB`);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
console.log("✓ الفهرس مكتوب");

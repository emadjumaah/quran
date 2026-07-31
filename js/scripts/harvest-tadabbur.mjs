/**
 * حصادُ ما ولّده القرّاءُ — يُنزّل من ذاكرة فيرسل ما وُلّد فعلًا، ولا يولّد شيئًا.
 *
 * الطريقةُ التي أمر بها المالك: يُترك التوليدُ للاستعمال الحقيقيّ (كلُّ قارئٍ
 * ينقر «تدبّر» يولّد آيتَه مرّةً واحدةً وتُخزَّن في الشبكة)، ثمّ يُحصد ما
 * تجمّع دوريًّا ويُضمّ إلى ما عندنا. فتنمو التغطيةُ بلا كلفةِ توليدٍ جماعيّ.
 *
 * **وشرطُ الحصاد أن يكون مخزَّنًا سلفًا**: تُقرأ ترويسةُ `x-vercel-cache`،
 * فلا يُقبل إلا `HIT` أو `STALE`. وما كان `MISS` فقد ولّدناه نحن بالطلب، فلا
 * نحفظه — لئلّا يصير الحاصدُ مولِّدًا من حيث لا نريد.
 *
 * usage: node js/scripts/harvest-tadabbur.mjs [--host https://www.mishkat.qa] [--lang ar]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const args = process.argv.slice(2);
const HOST = args.includes("--host") ? args[args.indexOf("--host") + 1] : "https://www.mishkat.qa";
const LANG = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "ar";
const CONC = 8;

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const locs = db.prepare("SELECT location FROM ayah ORDER BY ayah_id").all().map((r) => r.location);

const dir = path.join(ROOT, "js/data/tadabbur", LANG);
fs.mkdirSync(dir, { recursive: true });
const store = new Map();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")))
  store.set(Number(f.replace(".json", "")), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

const missing = locs.filter((l) => !store.get(Number(l.split(":")[0]))?.[l]);
console.log(`عندنا ${locs.length - missing.length} · ناقصٌ ${missing.length} · يُسأل عن المخزَّن في ${HOST}`);

let got = 0, miss = 0, err = 0;
for (let i = 0; i < missing.length; i += CONC) {
  await Promise.all(missing.slice(i, i + CONC).map(async (loc) => {
    try {
      const r = await fetch(`${HOST}/api/tadabbur?loc=${encodeURIComponent(loc)}&lang=${LANG}`);
      const state = (r.headers.get("x-vercel-cache") || "").toUpperCase();
      if (!r.ok) { err++; return; }
      if (state !== "HIT" && state !== "STALE") { miss++; return; } // لم يولّده أحدٌ بعدُ — لا نحفظ ما ولّدناه بطلبنا
      const { text } = await r.json();
      if (!text) { err++; return; }
      const s = Number(loc.split(":")[0]);
      if (!store.has(s)) store.set(s, {});
      store.get(s)[loc] = text;
      got++;
    } catch { err++; }
  }));
  if ((i / CONC) % 20 === 0) console.log(`  …${i + CONC}/${missing.length} · حُصد ${got}`);
}
for (const [s, obj] of store) fs.writeFileSync(path.join(dir, `${s}.json`), JSON.stringify(obj));
console.log(`\n✓ حُصد ${got} · لم يُولَّد بعدُ ${miss} · أخطاء ${err}`);
console.log(`المجموعُ عندنا الآن: ${[...store.values()].reduce((n, o) => n + Object.keys(o).length, 0)} آية`);
console.log("ثمّ: node js/scripts/shard-tadabbur.mjs");

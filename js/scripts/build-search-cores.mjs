/**
 * لُبابُ كلمات المصحف للبحث — منهجُ السوابق الشامل (2026-07-29، أمر المالك:
 * «جد هذه الحروف وكلَّ حالاتها وجد معالجةً فنيّةً بمنهجٍ واضح لا لكلمةٍ أو كلمتين»).
 *
 * الحروفُ التي تلتصق بأول الكلمة وليست من أصلها لا تُخمَّن تخمينًا — الوسمُ
 * الصرفيُّ (QAC) يقطع فيها: كلُّ كلمةٍ مقسومةٌ مقاطعَ، والمقطعُ الموسومُ
 * role='prefix' سابقةٌ يقينًا. جردُها الكامل في مصحفنا (٢٨٬٩٨٢ سابقة):
 *   وَ (٩٬٥٧٢) · ال بصورها (٨٬٥٦٤) · فَ (٣٬٠٠١) · بِ (٢٬٥٣٩) · لَ/لِ/لّ (٣٬٧٧١)
 *   · أَ/ءَ الاستفهام (٥١٣) · يَا النداء (٣٦٠) · هَا التنبيه (٣٣٠) · كَ (٢٨٧)
 *   · سَ الاستقبال (١١٩).
 *
 * يُخرج هذا المولّدُ لكلِّ آيةٍ «لبابَها»: كلماتِها بعد نزع السوابق الموسومة،
 * مطبَّعةً بنفس تطبيع البحث حرفًا حرفًا — فيطابقُ البحثُ «خلق منها» قولَه
 * ﴿وَخَلَقَ مِنْهَا﴾ مطابقةَ عبارةٍ تامّة، بلا أيِّ نزعٍ ظنّيّ في جهة النص.
 *
 * usage: node js/scripts/build-search-cores.mjs
 * out:   js/apps/studio/public/search-cores.json  { meta, ayahs: { "s:a": "لباب..." } }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });

/** تطبيعُ البحث نفسُه (lib/arabicSearch.normalizeAr) — حرفًا بحرف */
const MARKS = /[ً-ٰٟۖ-ۭـ]/g;
function normalizeAr(s) {
  return (s || "")
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// كلُّ المقاطع بترتيبها: الموضعُ s:a:w:g — نجمع الكلمةَ من مقاطعها غير السابقة
const segs = db.prepare(`
  SELECT location, text, role FROM segment ORDER BY seg_id
`).all();

/** wordLoc "s:a:w" ← نصُّ اللباب المجمّع */
const wordCore = new Map();
const wordFull = new Map();
for (const g of segs) {
  const wloc = g.location.split(":").slice(0, 3).join(":");
  wordFull.set(wloc, (wordFull.get(wloc) ?? "") + g.text);
  if (g.role !== "prefix") wordCore.set(wloc, (wordCore.get(wloc) ?? "") + g.text);
}

// آياتُ المصحف بترتيب كلماتها
const ayahWords = new Map();
for (const wloc of wordFull.keys()) {
  const [s, a, w] = wloc.split(":").map(Number);
  const aloc = `${s}:${a}`;
  const l = ayahWords.get(aloc) ?? [];
  l.push(w);
  ayahWords.set(aloc, l);
}

const out = {};
let differing = 0, words = 0, prefixed = 0, empty = 0;
for (const [aloc, ws] of ayahWords) {
  ws.sort((x, y) => x - y);
  const cores = [];
  let anyDiff = false;
  for (const w of ws) {
    const wloc = `${aloc}:${w}`;
    const full = normalizeAr(wordFull.get(wloc) ?? "");
    let core = normalizeAr(wordCore.get(wloc) ?? "");
    // كلمةٌ كلُّها سوابقُ لا لبَّ لها (لا تقع عمليًّا) — تبقى بنصّها
    if (!core) { core = full; empty++; }
    cores.push(core);
    words++;
    if (core !== full) { anyDiff = true; prefixed++; }
  }
  if (anyDiff) { out[aloc] = cores.join(" "); differing++; }
}

const meta = {
  date: "2026-07-29",
  method: "لبابُ كلِّ كلمةٍ = مقاطعُها غير الموسومة سابقةً في QAC، بتطبيع البحث نفسه",
  ayahs: differing, words, prefixedWords: prefixed,
};
fs.writeFileSync(path.join(PUB, "search-cores.json"), JSON.stringify({ meta, ayahs: out }), "utf-8");
console.log(`✓ search-cores.json: ${differing} آيةً فيها سوابقُ من ${ayahWords.size} · ${prefixed} كلمةً مسبوقةً من ${words}${empty ? ` · بلا لبّ ${empty}` : ""}`);

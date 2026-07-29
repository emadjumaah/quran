/**
 * جسرُ «جمال العربية» الأكبر (2026-07-29، إنهاءُ النسخة الإنجليزية):
 *   ١) بطاقاتُ البيان المحرَّرة العشرون: العنوانُ والكشفُ وأسماءُ الأطراف
 *      وأنواعُ البطاقات واقتباساتُ الأعلام — بالإنجليزية، فيقرأ غيرُ العربيّ
 *      لماذا اختار القرآنُ هذا اللفظَ لا أختَه.
 *   ٢) «الآياتُ الجامعة» الخمسون: أبوابُها وعناوينُها.
 * التوليدُ بمراجعة عددٍ وترتيبٍ آليّة، والملفّان يقرؤهما التطبيق عند EN.
 * out: public/bayan-en.json · public/kulliyat-curated-en.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const KEY = fs.readFileSync(path.join(ROOT, ".env"), "utf8").match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const URL_ = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`;

async function gen(prompt, expectLen) {
  for (let t = 1; t <= 5; t++) {
    try {
      const r = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, responseMimeType: "application/json" } }) });
      if (!r.ok) { await new Promise((x) => setTimeout(x, 2500 * t)); continue; }
      const d = await r.json();
      const arr = JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]");
      if (Array.isArray(arr) && arr.length === expectLen) return arr.map((x) => String(x).trim());
    } catch { await new Promise((x) => setTimeout(x, 2500 * t)); }
  }
  throw new Error("gen failed " + expectLen);
}
const T = (list, what, extra = "") =>
  gen(`Translate these Arabic ${what} into dignified, precise English${extra}. Return ONLY a JSON array of ${list.length} strings, same order.\n\n${list.map((x, i) => `${i + 1}. ${x}`).join("\n")}`, list.length);

// ── ١: بطاقات البيان المحررة ─────────────────────────────────────────────────
const b = JSON.parse(fs.readFileSync(path.join(PUB, "bayan.json"), "utf8"));
const cards = b.cards;
const titles = await T(cards.map((c) => c.title), "titles of Quranic word-comparison studies", " (keep Arabic word pairs as transliterations, e.g. «خوف / خشية» → “khawf / khashya”)");
const kashfs = await T(cards.map((c) => c.kashf), "one-line findings about Quranic word usage", " (these reveal why the Quran chose one word over its near-synonym; keep them vivid and faithful)");
const sideNames = [...new Set(cards.flatMap((c) => c.sides.map((s) => s.name)))];
const sidesEn = await T(sideNames, "Quranic Arabic words/labels", " (transliterate the Arabic word, then a 1-3 word gloss in parentheses, e.g. “khawf (fear)”)");
const typeNames = Object.values(b.types);
const typesEn = await T(typeNames, "category names of word-study cards");
// اقتباسات الأعلام: ترجمة بتصرف موسومة
const quotes = cards.flatMap((c) => c.readings.map((r) => r.quote));
const quotesEn = await T(quotes, "classical Arabic lexicographers' statements on word distinctions", " (translate faithfully; these are scholarly quotes)");
let qi = 0;
const out1 = {
  meta: { date: "2026-07-29", cards: cards.length, note: "ترجمةٌ مولَّدةٌ بمراجعة عددٍ وترتيب — الاقتباساتُ ترجمةُ معنًى لا نصًّا محكَّمًا" },
  cards: Object.fromEntries(cards.map((c, i) => [c.id, {
    title: titles[i], kashf: kashfs[i],
    readings: c.readings.map(() => quotesEn[qi++]),
  }])),
  sides: Object.fromEntries(sideNames.map((n, i) => [n, sidesEn[i]])),
  types: Object.fromEntries(Object.keys(b.types).map((k, i) => [k, typesEn[i]])),
};
fs.writeFileSync(path.join(PUB, "bayan-en.json"), JSON.stringify(out1));
console.log("✓ bayan-en.json", cards.length, "cards,", sideNames.length, "sides,", quotes.length, "quotes");

// ── ٢: الآيات الجامعة ────────────────────────────────────────────────────────
const k = JSON.parse(fs.readFileSync(path.join(PUB, "kulliyat-curated.json"), "utf8"));
const babs = [...new Set(k.kulliyat.map((x) => x.bab))];
const babsEn = await T(babs, "chapter names of a curated Quranic-verse collection");
const vTitles = await T(k.kulliyat.map((x) => x.title), "one-line titles describing comprehensive Quranic verses");
const out2 = {
  meta: { date: "2026-07-29", n: k.kulliyat.length },
  babs: Object.fromEntries(babs.map((n, i) => [n, babsEn[i]])),
  titles: Object.fromEntries(k.kulliyat.map((x, i) => [x.loc, vTitles[i]])),
};
fs.writeFileSync(path.join(PUB, "kulliyat-curated-en.json"), JSON.stringify(out2));
console.log("✓ kulliyat-curated-en.json", k.kulliyat.length, "verses,", babs.length, "babs");

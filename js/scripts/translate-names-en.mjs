/**
 * أسماءُ طبقات مشكاة بالإنجليزية — المواضيعُ وأبوابُها ومحاورُ الشبكة
 * (أمر المالك 2026-07-29: «نترجم محاور مواضيع وأجزاء مشكاة الأخرى»).
 * التوليدُ بمراجعةِ عددٍ وترتيبٍ آليّة، والملفُّ واحدٌ تقرؤه الواجهةُ عند EN.
 * out: js/apps/studio/public/names-en.json { topics:{ar:en}, babs:{ar:en}, themes:[en…] }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const KEY = fs.readFileSync(path.join(ROOT, ".env"), "utf8").match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const URL_ = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`;

async function translate(list, what) {
  const prompt = `Translate these short Arabic ${what} titles into concise, dignified English titles (2-6 words). Return ONLY a JSON array of ${list.length} strings, same order.\n\n${list.map((x, i) => `${i + 1}. ${x}`).join("\n")}`;
  for (let t = 1; t <= 4; t++) {
    try {
      const r = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }) });
      if (!r.ok) { await new Promise((x) => setTimeout(x, 2000 * t)); continue; }
      const d = await r.json();
      const arr = JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]");
      if (Array.isArray(arr) && arr.length === list.length) return arr.map((x) => String(x).trim());
    } catch { await new Promise((x) => setTimeout(x, 2000 * t)); }
  }
  throw new Error(`${what} failed`);
}

const m = JSON.parse(fs.readFileSync(path.join(PUB, "mawadi-v2.json"), "utf8"));
const topicNames = m.topics.map((t) => t.name);
const babNames = [...new Set(m.topics.map((t) => t.bab))];
const k = JSON.parse(fs.readFileSync(path.join(PUB, "kulliyat.json"), "utf8"));
const themeLabels = k.meta.themeLabels ?? [];

const [tEn, bEn, thEn] = [
  await translate(topicNames, "Quranic topic"),
  await translate(babNames, "topic-category"),
  await translate(themeLabels, "Quranic thematic-axis"),
];
const out = { meta: { date: "2026-07-29", topics: topicNames.length, babs: babNames.length, themes: themeLabels.length },
  topics: Object.fromEntries(topicNames.map((n, i) => [n, tEn[i]])),
  babs: Object.fromEntries(babNames.map((n, i) => [n, bEn[i]])),
  themes: thEn };
fs.writeFileSync(path.join(PUB, "names-en.json"), JSON.stringify(out));
console.log("✓ names-en.json", topicNames.length, babNames.length, themeLabels.length);

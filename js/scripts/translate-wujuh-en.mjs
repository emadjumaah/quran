/**
 * وجوهُ اللفظ بالإنجليزية — «ليرى الإنجليزيُّ جمالَ عربية القرآن» (أمر المالك
 * 2026-07-29): معاني أوجه الكلمات متعددةِ المعاني تُترجم ترجمةً وجيزةً كريمة،
 * فيقرأ غيرُ العربيّ لماذا لا تكفي كلمةٌ إنجليزيةٌ واحدةٌ لهذا اللفظ.
 * out: js/apps/studio/public/wujuh-en.json { "<lemma>|<faceIdx>": "English sense" }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const KEY = fs.readFileSync(path.join(ROOT, ".env"), "utf8").match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const URL_ = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`;

const d = JSON.parse(fs.readFileSync(path.join(PUB, "wujuh.json"), "utf8"));
const words = d.words ?? d;
const items = [];
for (const w of words) w.faces.forEach((f, i) => items.push({ key: `${w.lemma}|${i}`, lemma: w.lemma, sense: f.sense }));

const list = items.map((x, k) => `${k + 1}. [${x.lemma}] ${x.sense}`).join("\n");
const prompt = `These are senses of polysemous Quranic Arabic words (word in brackets, then its sense in Arabic). Translate each sense into ONE concise, dignified English sentence fragment (8-16 words) that helps an English reader feel why this Arabic word is rich. Return ONLY a JSON array of ${items.length} strings, same order.\n\n${list}`;
let arr = null;
for (let t = 1; t <= 4 && !arr; t++) {
  try {
    const r = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }) });
    if (!r.ok) { await new Promise((x) => setTimeout(x, 2000 * t)); continue; }
    const dd = await r.json();
    const parsed = JSON.parse(dd.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]");
    if (Array.isArray(parsed) && parsed.length === items.length) arr = parsed;
  } catch { await new Promise((x) => setTimeout(x, 2000 * t)); }
}
if (!arr) throw new Error("failed");
const out = {};
items.forEach((x, k) => { out[x.key] = String(arr[k]).trim(); });
fs.writeFileSync(path.join(PUB, "wujuh-en.json"), JSON.stringify({ meta: { date: "2026-07-29", n: items.length }, senses: out }));
console.log("✓ wujuh-en.json", items.length);

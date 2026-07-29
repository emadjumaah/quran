/**
 * ترجمةُ أسماء وحدات السياق للإنجليزية (2026-07-29، أمر المالك: «ترجمة السياقات»)
 * — ١٬٣٢٥ اسمًا وصفيًّا قصيرًا تُترجم دفعاتٍ بنموذج فلاش، وتُراجَع آليًّا:
 * كلُّ دفعةٍ تُطلب JSON بنفس العدد والترتيب، ومن فشل عدُّها تُعاد.
 * out: js/apps/studio/public/siyaq-units-en.json  { "s:a1:a2": "English name" }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const KEY = fs.readFileSync(path.join(ROOT, ".env"), "utf8").match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!KEY) throw new Error("no GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";
const URL_ = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;

const su = JSON.parse(fs.readFileSync(path.join(PUB, "siyaq-units.json"), "utf8"));
const units = su.units;
const out = {};
const BATCH = 60;
for (let i = 0; i < units.length; i += BATCH) {
  const chunk = units.slice(i, i + BATCH);
  const names = chunk.map((u, k) => `${k + 1}. ${u[3]}`).join("\n"); // الوحدةُ مصفوفة [s,a1,a2,name]
  const prompt = `Translate these short Arabic titles of Quranic passage sections into concise, dignified English titles (3-7 words each). Return ONLY a JSON array of ${chunk.length} strings, same order, no numbering.\n\n${names}`;
  let tries = 0, arr = null;
  while (tries < 4 && !arr) {
    tries++;
    try {
      const r = await fetch(URL_, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
      });
      if (!r.ok) { await new Promise((x) => setTimeout(x, 2500 * tries)); continue; }
      const d = await r.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed) && parsed.length === chunk.length) arr = parsed;
    } catch { await new Promise((x) => setTimeout(x, 2500 * tries)); }
  }
  if (!arr) throw new Error(`batch ${i} failed`);
  chunk.forEach((u, k) => { out[`${u[0]}:${u[1]}:${u[2]}`] = String(arr[k]).trim(); });
  process.stdout.write(`${Math.min(i + BATCH, units.length)}/${units.length} `);
  await new Promise((x) => setTimeout(x, 400));
}
fs.writeFileSync(path.join(PUB, "siyaq-units-en.json"), JSON.stringify({ meta: { date: "2026-07-29", model: MODEL, n: units.length }, names: out }));
console.log("\n✓ siyaq-units-en.json", Object.keys(out).length);

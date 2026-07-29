/**
 * التوثيقُ بالإنجليزية — ترجمةُ صفحة /docs كاملةً (البقايا الصغيرة 2026-07-29).
 * يقرأ docsContent.ts (المصدر الواحد)، يترجم كلَّ الحقول النصية دفعةً محكومةً
 * بعدّها وترتيبها، ويحوّل الأرقامَ الهندية غربيةً في القيم.
 * out: public/docs-en.json { intro, sanad:[{k,d}], sections:[…], open:[…] }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const KEY = fs.readFileSync(path.join(ROOT, ".env"), "utf8").match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
const URL_ = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`;

// نقرأ الوحدة بعد تحويل TS→نص ثم نلتقط الكائنات بتقويم بسيط: الأسلم تنفيذها
// عبر esbuild غير متاح — فنستعمل استخراج JSON عبر node --experimental-strip-types? أبسط:
// نحمّل الملف بتحويل يدوي: export const → globalThis
const src = fs.readFileSync(path.join(ROOT, "js/apps/studio/src/docsContent.ts"), "utf8")
  .replace(/export interface[\s\S]*?\n}\n/, "")
  .replace(/: DocSection\[\]/, "")
  .replace(/export const /g, "globalThis.");
eval(src);
const { DOC_INTRO, DOC_SANAD, DOC_SECTIONS, DOC_OPEN } = globalThis;

async function T(list, what) {
  const prompt = `Translate these Arabic ${what} from a Quran research project's documentation into precise, dignified English. Keep technical fidelity (layer names may stay transliterated with a gloss). Return ONLY a JSON array of ${list.length} strings, same order.\n\n${list.map((x, i) => `${i + 1}. ${x}`).join("\n---\n")}`;
  for (let t = 1; t <= 5; t++) {
    try {
      const r = await fetch(URL_, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }) });
      if (!r.ok) { await new Promise((x) => setTimeout(x, 2500 * t)); continue; }
      const d = await r.json();
      const arr = JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]");
      if (Array.isArray(arr) && arr.length === list.length) return arr.map((x) => String(x).trim());
    } catch { await new Promise((x) => setTimeout(x, 2500 * t)); }
  }
  throw new Error("T failed " + what);
}
const west = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٬/g, ",").replace(/٫/g, ".");

const [intro] = await T([DOC_INTRO], "project introduction paragraphs");
const sanadD = await T(DOC_SANAD.map((x) => x.d), "evidence-grade definitions");
const sanadK = await T(DOC_SANAD.map((x) => x.k), "evidence-grade names (one word each)");
const titles = await T(DOC_SECTIONS.map((x) => x.title), "section titles");
const leads = await T(DOC_SECTIONS.map((x) => x.lead), "section one-line summaries");
const whats = await T(DOC_SECTIONS.map((x) => x.what), "'what it is' paragraphs");
const hows = await T(DOC_SECTIONS.map((x) => x.how), "'how it was built' paragraphs");
const limitsIdx = DOC_SECTIONS.map((x, i) => (x.limits ? i : -1)).filter((i) => i >= 0);
const limitsEn = await T(limitsIdx.map((i) => DOC_SECTIONS[i].limits), "'declared limits' paragraphs");
const statKeys = DOC_SECTIONS.flatMap((x) => (x.stats ?? []).map((s) => s.k));
const statKeysEn = await T(statKeys, "statistic labels (1-3 words each)");
const linkLabels = DOC_SECTIONS.flatMap((x) => (x.links ?? []).map((l) => l.label));
const linkLabelsEn = await T(linkLabels, "in-app link labels (2-4 words each)");
const open = await T(DOC_OPEN, "'not done yet' items");

let si = 0, li = 0, lim = 0;
const sections = DOC_SECTIONS.map((x, i) => ({
  id: x.id, title: titles[i], lead: leads[i], what: whats[i], how: hows[i],
  limits: x.limits ? limitsEn[lim++] : undefined,
  stats: x.stats?.map((st) => ({ k: statKeysEn[si++], v: west(st.v) })),
  links: x.links?.map((l) => ({ to: l.to, label: linkLabelsEn[li++] })),
}));
fs.writeFileSync(path.join(PUB, "docs-en.json"), JSON.stringify({
  meta: { date: "2026-07-29" },
  intro, sanad: DOC_SANAD.map((x, i) => ({ k: sanadK[i], d: sanadD[i] })), sections, open,
}));
console.log("✓ docs-en.json", sections.length, "sections");

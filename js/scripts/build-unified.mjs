/**
 * المصالحة — unify every layer into ONE per-verse source. The موضوعي hierarchy
 * (قسم → موضوع → آية) is the master tree; the محكمات/الشبكة (principles + تفصيل)
 * overlay it. Each محكمة is nested under its home موضوعي section (no competing
 * taxonomies). Output is one compact index the future UI reads for any verse:
 *   verse → { topic, section, is-جامعة?+kind+grade, محكمة, تفصيل-degree,
 *             elaborates-count, twins-count }
 *
 * Reads mawdui.json + jawami.json + muhkamat.json + furuq.json. Writes
 * js/apps/studio/public/verse-index.json + findings/RECONCILE.md.
 * Usage: node scripts/build-unified.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const mawdui = rd(path.join(PUB, "mawdui.json"));
const jawami = rd(path.join(PUB, "jawami.json"));
const muhk = rd(path.join(PUB, "muhkamat.json"));
const furuq = rd(path.join(PUB, "furuq.json"));

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const allLocs = db.prepare("SELECT location FROM ayah ORDER BY ayah_id").all().map((r) => r.location);
db.close();

// --- موضوعي: flat topic list + loc→topic --------------------------------------
const sections = mawdui.sections.map((s) => ({ title: s.title, theme: s.theme }));
const topics = []; // {title, sec}
const locTopic = new Map();
mawdui.sections.forEach((s, si) => s.topics.forEach((t) => {
  const tid = topics.length; topics.push({ title: t.title, sec: si });
  for (const m of t.members) if (!locTopic.has(m)) locTopic.set(m, tid);
}));

// --- المحكمات: flat list + loc(جامعة)→محكمة -----------------------------------
const muhkamat = []; // {title, kubra}
const locMuhkama = new Map();
muhk.kubra.forEach((k) => k.muhkamat.forEach((m) => {
  const mid = muhkamat.length; muhkamat.push({ title: m.title, kubra: k.title, section: -1 });
  for (const l of m.members) if (!locMuhkama.has(l)) locMuhkama.set(l, mid);
}));
// home section of each محكمة = plurality of its members' موضوعي sections
muhkamat.forEach((mk, mid) => {
  const tally = new Map();
  for (const [l, id] of locMuhkama) if (id === mid) { const tid = locTopic.get(l); if (tid != null) { const s = topics[tid].sec; tally.set(s, (tally.get(s) ?? 0) + 1); } }
  mk.section = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
});

// --- network signals per verse -------------------------------------------------
const KIND = { "حكم": 1, "أخلاق": 2, "عقيدة": 3, "سنة": 4, "وعد": 5 };
const GRADE = { "أصل جامع": 1, "متفرّع": 2, "موجز": 3, "مجرّد": 4 };
const tafsilDeg = new Map(), elaborates = new Map();
for (const [hub, links] of Object.entries(jawami.tafsil)) {
  tafsilDeg.set(hub, links.length);
  for (const [t] of links) elaborates.set(t, (elaborates.get(t) ?? 0) + 1);
}
const twins = new Map();
for (const p of furuq.furuq) { twins.set(p.a, (twins.get(p.a) ?? 0) + 1); twins.set(p.b, (twins.get(p.b) ?? 0) + 1); }

// --- per-verse unified record (compact array) ----------------------------------
// [ topicId, kindCode, gradeCode, tafsilDeg, elaborates, twins, muhkamaId ]
const verses = {};
let inNet = 0, isJamia = 0;
for (const loc of allLocs) {
  const p = jawami.principles[loc];
  const rec = [
    locTopic.get(loc) ?? -1,
    p ? (KIND[p.kind] ?? 0) : 0,
    p ? (GRADE[p.grade] ?? 0) : 0,
    tafsilDeg.get(loc) ?? 0,
    elaborates.get(loc) ?? 0,
    twins.get(loc) ?? 0,
    locMuhkama.get(loc) ?? -1,
  ];
  verses[loc] = rec;
  if (p) isJamia++;
  if (rec[3] || rec[4]) inNet++;
}

const out = {
  meta: {
    verses: allLocs.length, sections: sections.length, topics: topics.length,
    muhkamat: muhkamat.length, jawami: isJamia, inNetwork: inNet,
    kinds: KIND, grades: GRADE,
    schema: ["topicId", "kindCode", "gradeCode", "tafsilDeg", "elaborates", "twins", "muhkamaId"],
  },
  sections, topics, muhkamat, verses,
};
fs.writeFileSync(path.join(PUB, "verse-index.json"), JSON.stringify(out));

// --- reconciliation report: المحكمات nested under موضوعي sections --------------
let md = `# المصالحة — البنية الواحدة الموحّدة

كل آيةٍ في القرآن لها الآن **موضعٌ وروابط** في مصدرٍ واحد (\`verse-index.json\`):
المحور الرأسي (الموضوعي: قسم → موضوع → آية) هو الهيكل الأمّ، والمحور الأفقي
(المحكمات والشبكة: محكم → تفصيل) يعلوه. كل محكمة أُلحِقت بقسمها الموضوعي فلا تنافس.

**الأرقام:** ${allLocs.length} آية · ${sections.length} قسمًا · ${topics.length} موضوعًا · ${muhkamat.length} محكمة · ${isJamia} جامعة · ${inNet} آية داخل الشبكة.

## المحكمات موزّعةً على الأقسام الموضوعية

`;
sections.forEach((s, si) => {
  const mine = muhkamat.filter((m) => m.section === si);
  if (!mine.length) return;
  md += `\n### ${si + 1}. ${s.title} — ${mine.length} محكمة\n`;
  md += mine.map((m) => `- ${m.title}`).join("\n") + "\n";
});
fs.writeFileSync(path.join(ROOT, "findings/RECONCILE.md"), md);

console.log(`verse-index.json: ${allLocs.length} verses · ${sections.length} sec · ${topics.length} topics · ${muhkamat.length} محكمة`);
console.log(`  جوامع ${isJamia} · داخل الشبكة ${inNet} · size ${(fs.statSync(path.join(PUB, "verse-index.json")).size / 1024).toFixed(0)} KB`);
console.log(`المحكمات موزّعة على ${new Set(muhkamat.map((m) => m.section)).size} قسمًا`);
console.log(`→ public/verse-index.json + findings/RECONCILE.md`);

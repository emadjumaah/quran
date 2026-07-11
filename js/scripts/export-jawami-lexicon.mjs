/**
 * معجم الجوامع — the fingerprint of each principle-kind (حكم/أخلاق/عقيدة/سنة/وعد):
 * its distinctive roots (roots that occur far more inside that kind's جوامع than
 * in the Qur'an at large), its language patterns (أمر/حصر/تحريم), and its grade
 * mix — all from the جوامع data + the text's roots. Writes jawami-lexicon.json.
 *   node scripts/export-jawami-lexicon.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const jawami = JSON.parse(fs.readFileSync(path.join(PUB, "jawami.json"), "utf8"));
const principles = jawami.principles;

const db = new DatabaseSync(path.join(ROOT, "quran-app.db"), { readOnly: true });
const rootsByLoc = new Map();
for (const w of db.prepare("SELECT surahNo, ayahNo, root FROM words WHERE root IS NOT NULL").all()) {
  const loc = `${w.surahNo}:${w.ayahNo}`;
  (rootsByLoc.get(loc) ?? rootsByLoc.set(loc, []).get(loc)).push(w.root);
}
db.close();

const KINDS = ["حكم", "أخلاق", "عقيدة", "سنة", "وعد"];
const kd = {};
for (const k of KINDS) kd[k] = { count: 0, grades: {}, patterns: { amr: 0, hasr: 0, tahrim: 0 }, rootN: {}, tot: 0 };
const allRootN = {};
let allTot = 0;

for (const [loc, p] of Object.entries(principles)) {
  const d = kd[p.kind];
  if (!d) continue;
  d.count++;
  d.grades[p.grade] = (d.grades[p.grade] ?? 0) + 1;
  if (p.amr) d.patterns.amr++;
  if (p.hasr) d.patterns.hasr++;
  if (p.tahrim) d.patterns.tahrim++;
  for (const r of rootsByLoc.get(loc) ?? []) {
    d.rootN[r] = (d.rootN[r] ?? 0) + 1;
    d.tot++;
    allRootN[r] = (allRootN[r] ?? 0) + 1;
    allTot++;
  }
}

const kinds = KINDS.map((k) => {
  const d = kd[k];
  const roots = Object.entries(d.rootN)
    .filter(([, n]) => n >= 4) // meaningful presence in the kind
    .map(([root, n]) => ({ root, n, score: +(((n / d.tot) / (allRootN[root] / allTot))).toFixed(2) }))
    .sort((a, b) => b.score - a.score || b.n - a.n)
    .slice(0, 14);
  return { kind: k, count: d.count, grades: d.grades, patterns: d.patterns, roots };
});

const out = { meta: { principles: Object.keys(principles).length, kinds: KINDS.length }, kinds };
fs.writeFileSync(path.join(PUB, "jawami-lexicon.json"), JSON.stringify(out));
console.log(`jawami-lexicon.json: ${(fs.statSync(path.join(PUB, "jawami-lexicon.json")).size / 1024).toFixed(1)} KB`);
for (const k of kinds) console.log(`  ${k.kind} (${k.count}): ${k.roots.slice(0, 6).map((r) => `${r.root}×${r.n}`).join(" ")}`);

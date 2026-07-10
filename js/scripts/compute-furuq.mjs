/**
 * فروق التنزيل — the diff engine over the twin-verse catalog. For every
 * word-alignable near-identical pair (tiers exact/near/phrase, not the semantic
 * paraphrase tier), aligns the two verses word-by-word and marks EXACTLY what
 * differs — computed, neutral, from the Quran's own text (+ roots for صرفي vs
 * lexical substitution). No tafsīr, no external ملاك-التأويل book.
 *
 * Reads quran-twins.json + quran-kg.db. Writes:
 *   findings/FURUQ.md               summary + category examples (human)
 *   js/apps/studio/public/furuq.json  full aligned-diff catalog (app layer)
 * Usage: node scripts/compute-furuq.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DB = path.join(ROOT, "quran-kg.db");
const TWINS = path.join(ROOT, "quran-twins.json");
const MD = path.join(ROOT, "findings/FURUQ.md");
const APP = path.join(ROOT, "js/apps/studio/public/furuq.json");

const db = new DatabaseSync(DB, { readOnly: true });
// per-ayah word tokens (ordered) with their root — the tokenization for diffs
const words = new Map(); // "s:a" -> [{t, root}]
for (const r of db.prepare(`
  SELECT w.surah_no s, w.ayah_no a, w.word_no n, w.text_clean t, rt.root_ar root
  FROM word w LEFT JOIN root rt ON rt.root_id = w.root_id
  ORDER BY w.surah_no, w.ayah_no, w.word_no`).iterate()) {
  const loc = `${r.s}:${r.a}`;
  (words.get(loc) ?? words.set(loc, []).get(loc)).push({ t: r.t, root: r.root ?? null });
}
const twins = JSON.parse(fs.readFileSync(TWINS, "utf-8"));
const arr = Array.isArray(twins) ? twins : (twins.pairs ?? Object.values(twins).find(Array.isArray));

/** word-level LCS diff → ops (eq/del/ins), del=only in A, ins=only in B. */
function diff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i].t === b[j].t ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i].t === b[j].t) { ops.push({ op: "eq", t: a[i].t }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: "del", t: a[i].t, root: a[i].root }); i++; }
    else { ops.push({ op: "ins", t: b[j].t, root: b[j].root }); j++; }
  }
  while (i < n) ops.push({ op: "del", t: a[i].t, root: a[i++].root });
  while (j < m) ops.push({ op: "ins", t: b[j].t, root: b[j++].root });
  return ops;
}

/** classify a diff: category + whether substitutions are صرفي (same root). */
function classify(ops) {
  const del = ops.filter((o) => o.op === "del");
  const ins = ops.filter((o) => o.op === "ins");
  if (!del.length && !ins.length) return { cat: "تطابق", morph: false };
  // reordering: a deleted word reappears as an inserted word
  const insSet = new Set(ins.map((o) => o.t));
  const reordered = del.some((o) => insSet.has(o.t));
  // adjacent del↔ins = substitution; same root ⇒ صرفي
  let subs = 0, morphSubs = 0;
  for (let k = 0; k < ops.length - 1; k++) {
    if (ops[k].op === "del" && ops[k + 1].op === "ins") {
      subs++;
      if (ops[k].root && ops[k].root === ops[k + 1].root) morphSubs++;
    }
  }
  let cat;
  if (reordered) cat = "تقديم وتأخير";
  else if (subs && del.length === subs && ins.length === subs) cat = morphSubs === subs ? "اختلاف صيغة" : "إبدال";
  else if (!del.length || !ins.length) cat = "زيادة/نقص";
  else cat = "مركّب";
  return { cat, morph: morphSubs > 0 };
}

const ALIGN_TIERS = new Set(["exact", "near", "phrase"]);
const cats = {};
const out = [];
let skipped = 0;
for (const p of arr) {
  if (!ALIGN_TIERS.has(p.tier)) continue;
  const A = words.get(p.a), B = words.get(p.b);
  if (!A || !B) { skipped++; continue; }
  const ops = diff(A, B);
  const { cat, morph } = classify(ops);
  cats[cat] = (cats[cat] ?? 0) + 1;
  out.push({ a: p.a, b: p.b, tier: p.tier, cat, morph, ops });
}
// order: most-different first within category isn't needed; sort by category then a
const CAT_ORDER = ["إبدال", "اختلاف صيغة", "زيادة/نقص", "تقديم وتأخير", "مركّب", "تطابق"];
out.sort((x, y) => (CAT_ORDER.indexOf(x.cat) - CAT_ORDER.indexOf(y.cat)) || x.a.localeCompare(y.a));

console.log(`aligned pairs: ${out.length} (skipped ${skipped} missing) — by category:`);
for (const c of CAT_ORDER) if (cats[c]) console.log(`  ${c.padEnd(14)} ${cats[c]}`);

// --- app layer (drop per-token root; keep the aligned ops for rendering) -------
const slim = out.map((p) => ({
  a: p.a, b: p.b, tier: p.tier, cat: p.cat, ...(p.morph ? { morph: 1 } : {}),
  ops: p.ops.map((o) => (o.op === "eq" ? o.t : [o.op === "ins" ? "+" : "-", o.t])),
}));
fs.writeFileSync(APP, JSON.stringify({ meta: { pairs: out.length, categories: cats }, furuq: slim }));

// --- human summary + examples --------------------------------------------------
const render = (ops) => ops.map((o) =>
  o.op === "eq" ? o.t : o.op === "del" ? `⟨−${o.t}⟩` : `⟨+${o.t}⟩`).join(" ");
let md = `# فروق التنزيل — فروق الآيات المتشابهات (محرّك محوسب)

**التاريخ:** 2026-07-10 · **الطريقة:** لكل زوجٍ من الآيات المتشابهة لفظًا (تطابق/قريب/عبارة
من كتالوج ${arr.length} توأمًا) حوذيت الآيتان كلمةً بكلمة (LCS) ورُصد ما اختلف بالضبط —
محسوبًا محايدًا من نصّ القرآن وجذوره وحدها، دون تفسير أو مصدر خارجي.
**زيادة الآية «ب» ⟨+..⟩ · ما انفردت به «أ» ⟨−..⟩.**

## الإحصاء (${out.length} زوجًا قابلًا للمحاذاة)

${CAT_ORDER.filter((c) => cats[c]).map((c) => `- **${c}**: ${cats[c]}`).join("\n")}

`;
for (const c of CAT_ORDER) {
  if (!cats[c] || c === "تطابق") continue;
  md += `\n## ${c} (${cats[c]}) — أمثلة\n\n`;
  for (const p of out.filter((x) => x.cat === c).slice(0, 12)) {
    md += `**${p.a} ⇄ ${p.b}**${p.morph ? " · صرفي" : ""}\n\n\`${render(p.ops)}\`\n\n`;
  }
}
fs.writeFileSync(MD, md);
db.close();
console.log(`\n→ findings/FURUQ.md (${(fs.statSync(MD).size / 1024).toFixed(0)} KB)`);
console.log(`→ public/furuq.json (${(fs.statSync(APP).size / 1024).toFixed(0)} KB)`);

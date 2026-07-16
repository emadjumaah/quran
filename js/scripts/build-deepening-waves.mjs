/**
 * بناء دفعات موجات التعميق (ما بعد الجزء الأول) — بقرارَي بوابة الجزء الأول:
 *   الاتجاهي بذراع السياق A (نوافذ وحداتنا المعتمدة) · المتماثل بذراع B (بلا نوافذ).
 * التجميع الاتجاهي يعاد إنتاجه حرفيًّا كما في build-deepening-chunk1.mjs (نفس الكود)،
 * تُستبعد دفعات الجزء الأول، ويُخلط الباقي خلطًا حتميًّا (LCG بذرة 20260716) ثم يُقطَّع
 * أسرابًا ×٩٥ (+٥ مكررات كابا لكل سرب) — فكل موجة عينة غير متحيزة من المصحف كله،
 * وأي انقطاع يترك شبكة جزئية صالحة إحصائيًّا.
 *
 * Writes: findings/deepening/waves/{dirA-*.json, sym-*.json, waves-manifest.json}
 *   (ملفات الدفعات لا تدخل git — قابلة لإعادة الإنتاج من هذا السكربت + المرشحين الملتزمين)
 * Usage: node scripts/build-deepening-waves.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DP = path.join(ROOT, "findings/deepening");
const OUT = path.join(DP, "waves");
fs.mkdirSync(OUT, { recursive: true });

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const txt = new Map(db.prepare("SELECT surah_no s, ayah_no a, text_clean t FROM ayah").all().map((r) => [`${r.s}:${r.a}`, r.t]));
const nm = new Map(db.prepare("SELECT surah_no n, name_ar x FROM surah").all().map((r) => [r.n, r.x]));
db.close();

const units = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/siyaq-swarm/units-computed.json"), "utf-8")).units;
const unitIdx = new Map();
for (const u of units) for (let a = u.a1; a <= u.a2; a++) unitIdx.set(`${u.s}:${a}`, u);
const windowOf = (loc, cap = 600) => {
  const u = unitIdx.get(loc);
  if (!u) return null;
  const parts = [];
  for (let a = u.a1; a <= u.a2; a++) parts.push(txt.get(`${u.s}:${a}`));
  let t = parts.join(" ۝ ");
  if (t.length > cap) t = t.slice(0, cap) + "…";
  return { span: `${nm.get(u.s)} ${u.a1}–${u.a2}`, title: u.title ?? "", text: t };
};

const hubs = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, "findings/kulliyat-v2/provenance/v2-run/hubs.json"), "utf-8")).map((h) => [h.id, h]));

// —— إعادة إنتاج التجميع الاتجاهي حرفيًّا (يجب أن يطابق manifest الجزء الأول) ——
const dir = fs.readFileSync(path.join(DP, "candidates-directional.jsonl"), "utf-8").split("\n").filter(Boolean).map(JSON.parse);
const byHub = new Map();
for (const p of dir) {
  if (!byHub.has(p.hub)) byHub.set(p.hub, []);
  byHub.get(p.hub).push(p);
}
const groups = [...byHub.entries()];
const dirBatches = [];
let cur = [], n = 0;
for (const [hubId, pairs] of groups) {
  cur.push({ hubId, pairs });
  n += pairs.length;
  if (n >= 60) { dirBatches.push(cur); cur = []; n = 0; }
}
if (cur.length) dirBatches.push(cur);

const chunk1 = JSON.parse(fs.readFileSync(path.join(DP, "chunk1/manifest.json"), "utf-8"));
if (dirBatches.length !== chunk1.dirBatchesTotal) throw new Error(`عدم تطابق التجميع: ${dirBatches.length} ≠ ${chunk1.dirBatchesTotal}`);
const totalPairs = dirBatches.reduce((t, b) => t + b.reduce((x, g) => x + g.pairs.length, 0), 0);
console.log(`التجميع مطابق: ${dirBatches.length} دفعة، ${totalPairs} زوجًا`);

// —— الخلط الحتمي للمتبقي ——
const done = new Set(chunk1.chunk1Dir);
const remaining = [...Array(dirBatches.length).keys()].filter((i) => !done.has(i));
let seed = 20260716;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let i = remaining.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
}

// —— كتابة ملفات الذراع A للمتبقي ——
const mkDir = (bi) => dirBatches[bi].map(({ hubId, pairs }) => {
  const h = hubs.get(hubId);
  return {
    id: hubId,
    unit_text: h.text,
    full_ayah: txt.get(h.loc),
    gates: h.gates,
    window: windowOf(h.loc),
    candidates: pairs.map((p) => ({ loc: p.cand, text: txt.get(p.cand), window: windowOf(p.cand) })),
  };
});
for (const bi of remaining) {
  fs.writeFileSync(path.join(OUT, `dirA-${String(bi).padStart(4, "0")}.json`), JSON.stringify(mkDir(bi), null, 1));
}

// —— المتماثل: الذراع B (بلا نوافذ) للمتبقي ——
const sym = fs.readFileSync(path.join(DP, "candidates-symmetric.jsonl"), "utf-8").split("\n").filter(Boolean).map(JSON.parse);
const symBatches = [];
for (let i = 0; i < sym.length; i += 40) symBatches.push(sym.slice(i, i + 40));
if (symBatches.length !== chunk1.symBatchesTotal) throw new Error("عدم تطابق المتماثل");
const symDone = new Set(chunk1.chunk1Sym);
const symRemaining = [...Array(symBatches.length).keys()].filter((i) => !symDone.has(i));
for (const bi of symRemaining) {
  const batch = symBatches[bi].map((p) => ({ a: { loc: p.a, text: txt.get(p.a) }, b: { loc: p.b, text: txt.get(p.b) } }));
  fs.writeFileSync(path.join(OUT, `sym-${String(bi).padStart(3, "0")}.json`), JSON.stringify(batch, null, 1));
}

// —— تقطيع الأسراب: ×٩٥ + ٥٪ كابا؛ الأخير يبتلع الفضلة ——
const SWARM = 95;
const dirSwarms = [];
for (let i = 0; i < remaining.length; i += SWARM) {
  let slice = remaining.slice(i, i + SWARM);
  if (remaining.length - (i + SWARM) > 0 && remaining.length - (i + SWARM) < SWARM / 2) {
    slice = remaining.slice(i); i = remaining.length;
  }
  const files = slice.map((bi) => `dirA-${String(bi).padStart(4, "0")}`);
  const kn = Math.ceil(files.length * 0.05);
  const kappa = [...Array(kn).keys()].map((k) => files[Math.floor((k * files.length) / kn)]);
  dirSwarms.push({ files, kappa });
  if (slice.length > SWARM) break;
}
const symFiles = symRemaining.map((bi) => `sym-${String(bi).padStart(3, "0")}`);
const symKappa = [0, 20, 40, 60, 80].map((k) => symFiles[k]);
const symSwarm = { files: symFiles, kappa: symKappa };

// —— الموجات: م١ = سربان اتجاهيان + المتماثل كله؛ بعدها ٣ اتجاهية لكل موجة ——
const waves = [];
waves.push({ wave: 1, swarms: [{ kind: "dir", ...dirSwarms[0] }, { kind: "dir", ...dirSwarms[1] }, { kind: "sym", ...symSwarm }] });
let w = 2;
for (let i = 2; i < dirSwarms.length; i += 3) {
  waves.push({ wave: w++, swarms: dirSwarms.slice(i, i + 3).map((s) => ({ kind: "dir", ...s })) });
}

const manifest = {
  date: "2026-07-17",
  seed: 20260716,
  arms: { dir: "A (نوافذ وحداتنا)", sym: "B (بلا نوافذ)" },
  dirRemaining: remaining.length,
  symRemaining: symRemaining.length,
  pairsRemaining: remaining.reduce((t, bi) => t + dirBatches[bi].reduce((x, g) => x + g.pairs.length, 0), 0),
  shuffledDir: remaining,
  waves: waves.map((wv) => ({ wave: wv.wave, swarms: wv.swarms.map((s) => ({ kind: s.kind, n: s.files.length, kappa: s.kappa.length, files: s.files, kappaFiles: s.kappa })) })),
};
fs.writeFileSync(path.join(OUT, "waves-manifest.json"), JSON.stringify(manifest, null, 1));
const tot = waves.reduce((t, wv) => t + wv.swarms.reduce((x, s) => x + s.files.length + s.kappa.length, 0), 0);
console.log(`موجات: ${waves.length} · أسراب اتجاهية: ${dirSwarms.length} (${remaining.length} دفعة، ${manifest.pairsRemaining} زوجًا) · متماثل: ${symFiles.length}+${symKappa.length}κ · وكلاء إجمالًا: ${tot}`);
waves.forEach((wv) => console.log(`  م${wv.wave}: ${wv.swarms.map((s) => `${s.kind}:${s.files.length}+${s.kappa.length}κ`).join(" · ")}`));

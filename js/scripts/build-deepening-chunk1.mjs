/**
 * بناء دفعات الجزء الأول من التعميق — بذراعين على نفس الأزواج:
 *   الذراع A (بسياق): كل طرفٍ معه نافذةُ وحدته المعتمدة؛ الذراع B (بلا سياق): كنمط v2.
 * الاتجاهي: ٤٠ دفعة منثورة ×~٦٠ زوجًا · المتماثل: ٦ دفعات ×~٤٠ · كابا: ٣ اتجاهية
 * + ١ متماثلة تُكرَّر داخل كل ذراع (run=2) لقياس κ لكل ذراع.
 *
 * Writes: findings/deepening/chunk1/{dirA,dirB,symA,symB}-*.json + manifest.json
 * Usage: node scripts/build-deepening-chunk1.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DP = path.join(ROOT, "findings/deepening");
const OUT = path.join(DP, "chunk1");
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

// —— الاتجاهي: تجميع الأزواج بحسب المحور ثم تقطيع دفعات ×٦٠ ثم نثر ٤٠ ——
const dir = fs.readFileSync(path.join(DP, "candidates-directional.jsonl"), "utf-8").split("\n").filter(Boolean).map(JSON.parse);
const byHub = new Map();
for (const p of dir) {
  if (!byHub.has(p.hub)) byHub.set(p.hub, []);
  byHub.get(p.hub).push(p);
}
const groups = [...byHub.entries()]; // [hubId, pairs[]]
const dirBatches = [];
let cur = [], n = 0;
for (const [hubId, pairs] of groups) {
  cur.push({ hubId, pairs });
  n += pairs.length;
  if (n >= 60) { dirBatches.push(cur); cur = []; n = 0; }
}
if (cur.length) dirBatches.push(cur);
console.log(`دفعات اتجاهية كلية: ${dirBatches.length}`);
const step = Math.floor(dirBatches.length / 40);
const chunk1Dir = [...Array(40).keys()].map((k) => k * step);

const mkDir = (bi, withCtx) => {
  const batch = dirBatches[bi].map(({ hubId, pairs }) => {
    const h = hubs.get(hubId);
    return {
      id: hubId,
      unit_text: h.text,
      full_ayah: txt.get(h.loc),
      gates: h.gates,
      ...(withCtx ? { window: windowOf(h.loc) } : {}),
      candidates: pairs.map((p) => ({ loc: p.cand, text: txt.get(p.cand), ...(withCtx ? { window: windowOf(p.cand) } : {}) })),
    };
  });
  return batch;
};
for (const bi of chunk1Dir) {
  fs.writeFileSync(path.join(OUT, `dirA-${String(bi).padStart(4, "0")}.json`), JSON.stringify(mkDir(bi, true), null, 1));
  fs.writeFileSync(path.join(OUT, `dirB-${String(bi).padStart(4, "0")}.json`), JSON.stringify(mkDir(bi, false), null, 1));
}

// —— المتماثل: دفعات ×٤٠ ثم نثر ٦ ——
const sym = fs.readFileSync(path.join(DP, "candidates-symmetric.jsonl"), "utf-8").split("\n").filter(Boolean).map(JSON.parse);
const symBatches = [];
for (let i = 0; i < sym.length; i += 40) symBatches.push(sym.slice(i, i + 40));
const sstep = Math.floor(symBatches.length / 6);
const chunk1Sym = [...Array(6).keys()].map((k) => k * sstep);
const mkSym = (bi, withCtx) => symBatches[bi].map((p) => ({
  a: { loc: p.a, text: txt.get(p.a), ...(withCtx ? { window: windowOf(p.a) } : {}) },
  b: { loc: p.b, text: txt.get(p.b), ...(withCtx ? { window: windowOf(p.b) } : {}) },
}));
for (const bi of chunk1Sym) {
  fs.writeFileSync(path.join(OUT, `symA-${String(bi).padStart(3, "0")}.json`), JSON.stringify(mkSym(bi, true), null, 1));
  fs.writeFileSync(path.join(OUT, `symB-${String(bi).padStart(3, "0")}.json`), JSON.stringify(mkSym(bi, false), null, 1));
}

const manifest = {
  date: "2026-07-16",
  dirBatchesTotal: dirBatches.length,
  symBatchesTotal: symBatches.length,
  chunk1Dir,
  chunk1Sym,
  kappaDir: [chunk1Dir[0], chunk1Dir[19], chunk1Dir[39]],
  kappaSym: [chunk1Sym[0]],
  pairsDir: chunk1Dir.reduce((t, bi) => t + dirBatches[bi].reduce((x, g) => x + g.pairs.length, 0), 0),
  pairsSym: chunk1Sym.length * 40,
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`chunk1: اتجاهي ${chunk1Dir.length} دفعة (${manifest.pairsDir} زوجًا) ×ذراعين · متماثل ${chunk1Sym.length} (${manifest.pairsSym}) ×ذراعين · كابا ${manifest.kappaDir.length}+${manifest.kappaSym.length} ×ذراعين`);

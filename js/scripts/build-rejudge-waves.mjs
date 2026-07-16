/**
 * بناء موجات التوحيد (ت١–ت٣): إعادة حكم نطاق v2 الأقرب (~١٠٤٫٧ ألف زوج) بذراع
 * السياق A — قرار المالك 2026-07-17 (الدائرة الأقرب ~٧٢٪ من الصلات فتُوحَّد أولًا،
 * ثم تُستأنف موجات العمق ٢–٧). أحكام v2 المؤرشفة تصير ذراعَ المقارنة «بلا سياق».
 *
 * المصدر: ملفات دفعات v2 نفسها (كل ما رآه حاكم v2 فقد حُكم) — تُفلطح أزواجًا،
 * تُزال الازدواجات، تُلحق نوافذ وحدات v1.1، تُعاد التعبئة ×~١٠٠ زوج، تُخلط خلطًا
 * حتميًّا (بذرة 20260717)، وتُقطَّع ٩ أسراب ≈ ٣ موجات × ٣ أسراب + ٥٪ كابا.
 *
 * Writes: findings/deepening/rejudge/{dirA-r*.json, rejudge-manifest.json}
 * Usage: node scripts/build-rejudge-waves.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const V2B = path.join(ROOT, "findings/kulliyat-v2/provenance/v2-run/batches");
const OUT = path.join(ROOT, "findings/deepening/rejudge");
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

// —— فلطحة أزواج v2 من ملفات دفعاتها (مع إزالة الازدواج) ——
const principals = new Map(); // id -> {id, unit_text, full_ayah, gates, loc, cands: Map(loc->text)}
for (const f of fs.readdirSync(V2B).filter((x) => x.startsWith("batch-"))) {
  const arr = JSON.parse(fs.readFileSync(path.join(V2B, f), "utf-8"));
  for (const p of arr) {
    if (!principals.has(p.id)) {
      principals.set(p.id, { id: p.id, unit_text: p.unit_text, full_ayah: p.full_ayah, gates: p.gates, loc: p.id.split("/")[0], cands: new Map() });
    }
    const P = principals.get(p.id);
    for (const c of p.candidates) if (!P.cands.has(c.loc)) P.cands.set(c.loc, c.text);
  }
}
const totalPairs = [...principals.values()].reduce((t, p) => t + p.cands.size, 0);
console.log(`قواعد: ${principals.size} · أزواج v2 الفريدة: ${totalPairs}`);

// —— تعبئة ×~١٠٠ زوج (القاعدة لا تُشق بين دفعتين) ——
const batches = [];
let cur = [], n = 0;
for (const p of principals.values()) {
  cur.push(p);
  n += p.cands.size;
  if (n >= 100) { batches.push(cur); cur = []; n = 0; }
}
if (cur.length) batches.push(cur);
console.log(`دفعات التوحيد: ${batches.length}`);

// —— كتابة ملفات الذراع A ——
batches.forEach((batch, bi) => {
  const out = batch.map((p) => ({
    id: p.id,
    unit_text: p.unit_text,
    full_ayah: p.full_ayah,
    gates: p.gates,
    window: windowOf(p.loc),
    candidates: [...p.cands.entries()].map(([loc, text]) => ({ loc, text, window: windowOf(loc) })),
  }));
  fs.writeFileSync(path.join(OUT, `dirA-r${String(bi).padStart(4, "0")}.json`), JSON.stringify(out, null, 1));
});

// —— خلط حتمي ثم ٩ أسراب (٣ موجات × ٣) + ٥٪ كابا ——
const order = [...Array(batches.length).keys()];
let seed = 20260717;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}
const SW = Math.ceil(order.length / 9);
const swarms = [];
for (let i = 0; i < order.length; i += SW) {
  const files = order.slice(i, i + SW).map((bi) => `dirA-r${String(bi).padStart(4, "0")}`);
  const kn = Math.ceil(files.length * 0.05);
  const kappa = [...Array(kn).keys()].map((k) => files[Math.floor((k * files.length) / kn)]);
  swarms.push({ files, kappa });
}
const waves = [1, 2, 3].map((w) => ({ wave: `ت${w}`, swarms: swarms.slice((w - 1) * 3, w * 3) }));

const manifest = {
  date: "2026-07-17",
  seed: 20260717,
  arm: "A (نوافذ وحدات v1.1) — المقارنة: أحكام v2 المؤرشفة نفسها ذراع «بلا سياق»",
  principals: principals.size,
  pairs: totalPairs,
  batches: batches.length,
  waves: waves.map((wv) => ({ wave: wv.wave, swarms: wv.swarms.map((s) => ({ n: s.files.length, kappa: s.kappa.length, files: s.files, kappaFiles: s.kappa })) })),
};
fs.writeFileSync(path.join(OUT, "rejudge-manifest.json"), JSON.stringify(manifest, null, 1));
const tot = swarms.reduce((t, s) => t + s.files.length + s.kappa.length, 0);
console.log(`أسراب: ${swarms.length} · وكلاء إجمالًا: ${tot}`);
waves.forEach((wv) => console.log(`  ${wv.wave}: ${wv.swarms.map((s) => `${s.files.length}+${s.kappa.length}κ`).join(" · ")}`));

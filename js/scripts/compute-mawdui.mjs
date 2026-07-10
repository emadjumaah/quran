/**
 * المصحف الموضوعي — cluster ALL 6,236 āyāt by their semantic vectors into topic
 * groups (the layer that covers the whole muṣḥaf, not just the principle
 * network). Deterministic k-means; each cluster's «مثال» is the āyah closest to
 * the centroid. A swarm names + adversarially verifies these next.
 *
 * Reads quran-kg.db (embeddings). Writes findings/mawdui-clusters.json.
 * Usage: node scripts/compute-mawdui.mjs [K]
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "findings/mawdui-clusters.json");
const K = Number(process.argv[2] ?? 90);

let _s = 0x1a2b3c4d;
const rand = () => { _s |= 0; _s = (_s + 0x6d2b79f5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const loc = new Map(db.prepare("SELECT ayah_id, location FROM ayah").all().map((r) => [r.ayah_id, r.location]));
const textOf = new Map(db.prepare("SELECT location, text_clean FROM ayah").all().map((r) => [r.location, r.text_clean]));
const surahAr = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));

const rows = db.prepare("SELECT e.ayah_id, e.dim, e.vector FROM ayah_embedding e ORDER BY e.ayah_id").all();
const items = [];
for (const r of rows) {
  const l = loc.get(r.ayah_id); if (!l) continue;
  const v = new Float32Array(r.vector.buffer, r.vector.byteOffset, r.dim);
  let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i]; n = Math.sqrt(n) || 1;
  const u = new Float32Array(v.length); for (let i = 0; i < v.length; i++) u[i] = v[i] / n;
  items.push({ loc: l, vec: u });
}
db.close();
const D = items[0].vec.length;
console.log(`آيات: ${items.length} · dim ${D} · K=${K}`);
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// k-means++ init
const centroids = [items[Math.floor(rand() * items.length)].vec.slice()];
while (centroids.length < K) {
  const d2 = items.map((it) => { let best = -1; for (const c of centroids) best = Math.max(best, dot(it.vec, c)); return 1 - best; });
  const sum = d2.reduce((a, b) => a + b, 0); let x = rand() * sum, idx = 0;
  for (; idx < d2.length; idx++) { x -= d2[idx]; if (x <= 0) break; }
  centroids.push(items[Math.min(idx, items.length - 1)].vec.slice());
}
let assign = new Array(items.length).fill(0);
for (let iter = 0; iter < 50; iter++) {
  let moved = 0;
  for (let i = 0; i < items.length; i++) { let best = 0, bs = -2; for (let c = 0; c < K; c++) { const s = dot(items[i].vec, centroids[c]); if (s > bs) { bs = s; best = c; } } if (assign[i] !== best) moved++; assign[i] = best; }
  for (let c = 0; c < K; c++) { const mem = []; for (let i = 0; i < items.length; i++) if (assign[i] === c) mem.push(items[i].vec); if (!mem.length) continue; const nc = new Float32Array(D); for (const v of mem) for (let d = 0; d < D; d++) nc[d] += v[d]; let n = 0; for (let d = 0; d < D; d++) n += nc[d] * nc[d]; n = Math.sqrt(n) || 1; for (let d = 0; d < D; d++) nc[d] /= n; centroids[c] = nc; }
  if (moved === 0) break;
}

const clusters = [];
for (let c = 0; c < K; c++) {
  const mem = items.filter((_, i) => assign[i] === c);
  if (!mem.length) continue;
  // representative = closest to centroid
  let rep = mem[0], rs = -2; for (const m of mem) { const s = dot(m.vec, centroids[c]); if (s > rs) { rs = s; rep = m; } }
  const coh = mem.reduce((s, m) => s + dot(m.vec, centroids[c]), 0) / mem.length;
  // members in mushaf order
  const locs = mem.map((m) => m.loc).sort((a, b) => { const [s1, a1] = a.split(":").map(Number), [s2, a2] = b.split(":").map(Number); return s1 - s2 || a1 - a2; });
  clusters.push({ size: mem.length, rep: rep.loc, cohesion: +coh.toFixed(3), members: locs });
}
clusters.sort((a, b) => b.size - a.size);

console.log(`\nموضوعات: ${clusters.length} · تماسك: أضعف ${clusters.map(c=>c.cohesion).sort((a,b)=>a-b).slice(0,4).join(", ")} · أقوى ${clusters.map(c=>c.cohesion).sort((a,b)=>b-a).slice(0,3).join(", ")}`);
console.log(`أحجام: أكبر ${clusters.slice(0,3).map(c=>c.size).join(", ")} · أصغر ${clusters.slice(-3).map(c=>c.size).join(", ")}`);
console.log(`\nعيّنة (أكبر ١٢ موضوعًا، ممثّلها):`);
for (const cl of clusters.slice(0, 12)) {
  const [s] = cl.rep.split(":"); console.log(`  ×${String(cl.size).padStart(3)}  ${cl.rep.padEnd(8)} [${surahAr.get(Number(s))}]  ${(textOf.get(cl.rep)??"").slice(0,40)}`);
}

const payload = {
  meta: { ayahs: items.length, K, clusters: clusters.length },
  clusters: clusters.map((cl) => ({ size: cl.size, rep: cl.rep, cohesion: cl.cohesion,
    members: cl.members.map((l) => ({ loc: l, text: (textOf.get(l) ?? "").slice(0, 68) })) })),
};
fs.writeFileSync(OUT, JSON.stringify(payload));
console.log(`\n→ findings/mawdui-clusters.json (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB) — needs naming + verification`);

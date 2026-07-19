/**
 * مواضيع مشكاة v2 — من منتجات أسراب السياق مباشرة: عنقدة متجهات وحدات السياق
 * الـ١٣٢٥ (k-means حتمي، بذرة معلنة) إلى ~١٢٠ موضوعًا متجانس المعنى، ثم عنقدة
 * مراكز المواضيع إلى ١٤ بابًا. الاسم المبدئي لكل موضوع/باب: اسم وحدته الأقرب
 * لمركزه (تُستبدل بأسماء سرب التسمية). كل وحدة في موضعها — المصحف كله مبوَّب.
 *
 * Writes: js/apps/studio/public/topics-v1.json + findings/unified/TOPICS-V1.md
 * Usage: node scripts/build-topics.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const units = JSON.parse(fs.readFileSync(path.join(PUB, "siyaq-units.json"), "utf-8")).units; // [s,a1,a2,name]

const buf = fs.readFileSync(path.join(PUB, "siyaq-embeddings.bin"));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const hlen = new DataView(ab).getUint32(0, true);
const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, hlen)));
const sOff = 4 + hlen;
const scales = new Float32Array(ab.slice(sOff, sOff + hdr.count * 4));
const data = new Int8Array(ab, sOff + hdr.count * 4, hdr.count * hdr.dim);
const uvec = (row) => {
  const v = new Float32Array(hdr.dim);
  for (let k = 0; k < hdr.dim; k++) v[k] = data[row * hdr.dim + k] * scales[row];
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  for (let k = 0; k < hdr.dim; k++) v[k] /= n;
  return v;
};
const vecs = units.map((_, i) => uvec(i));
const cosv = (x, y) => { let d = 0; for (let k = 0; k < x.length; k++) d += x[k] * y[k]; return d; };

function kmeans(items, K, seedBase, iters = 60) {
  let seed = seedBase;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const idx = [...Array(items.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  let means = idx.slice(0, K).map((i) => Float32Array.from(items[i]));
  const assign = new Array(items.length).fill(0);
  for (let it = 0; it < iters; it++) {
    let moved = false;
    items.forEach((v, i) => {
      let best = 0, bc = -2;
      means.forEach((m, k) => { const d = cosv(v, m); if (d > bc) { bc = d; best = k; } });
      if (assign[i] !== best) { assign[i] = best; moved = true; }
    });
    means = means.map((old, k) => {
      const v = new Float32Array(items[0].length);
      let cnt = 0;
      items.forEach((x, i) => { if (assign[i] === k) { cnt++; for (let d = 0; d < v.length; d++) v[d] += x[d]; } });
      if (!cnt) return old;
      let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
      for (let d = 0; d < v.length; d++) v[d] /= n;
      return v;
    });
    if (!moved) break;
  }
  return { assign, means };
}

// ~١٢٠ موضوعًا من الوحدات
const T = 120;
const { assign, means } = kmeans(vecs, T, 20260720);
const topics = [...Array(T).keys()].map((t) => {
  const members = [];
  assign.forEach((a, i) => { if (a === t) members.push(i); });
  if (!members.length) return null;
  // الوحدة الأقرب للمركز = الاسم المبدئي؛ والأعضاء بترتيب المصحف
  let cent = members[0], bc = -2;
  for (const i of members) { const d = cosv(vecs[i], means[t]); if (d > bc) { bc = d; cent = i; } }
  members.sort((a, b) => (units[a][0] - units[b][0]) || (units[a][1] - units[b][1]));
  return { centerUnit: cent, name: units[cent][3], units: members, v: means[t] };
}).filter(Boolean);

// ١٤ بابًا من مراكز المواضيع (موزونة بالحجم)
const K = 14;
const { assign: ta } = kmeans(topics.map((t) => t.v), K, 20260721);
const babsRaw = [...Array(K).keys()].map((k) => {
  const ts = topics.map((t, i) => ({ t, i })).filter(({ i }) => ta[i] === k).map(({ t }) => t);
  if (!ts.length) return null;
  ts.sort((a, b) => b.units.length - a.units.length);
  const unitsCount = ts.reduce((s, t) => s + t.units.length, 0);
  return { name: ts[0].name, topics: ts, unitsCount };
}).filter(Boolean).sort((a, b) => b.unitsCount - a.unitsCount);

let tid = 0;
const babs = babsRaw.map((b, i) => ({
  id: i + 1,
  name: b.name,
  unitsCount: b.unitsCount,
  topics: b.topics.map((t) => ({ id: ++tid, name: t.name, units: t.units })),
}));
fs.writeFileSync(path.join(PUB, "topics-v1.json"), JSON.stringify({
  meta: { date: "2026-07-19", method: "k-means حتمي على متجهات وحدات السياق (بذرة 20260720) ثم عنقدة المراكز أبوابًا (20260721)", topics: tid, babs: babs.length, units: units.length, note: "أسماء مبدئية من الوحدة المركزية — تستبدل بسرب التسمية" },
  babs,
}));
const doc = babs.map((b) => `### باب ${b.id}: ${b.name} (${b.unitsCount} وحدة)\n${b.topics.slice(0, 6).map((t) => `- ${t.name} (${t.units.length})`).join("\n")}`).join("\n\n");
fs.writeFileSync(path.join(ROOT, "findings/unified/TOPICS-V1.md"), `# مواضيع مشكاة v2 — عنقدة وحدات السياق\n\n${doc}\n`);
console.log(`أبواب: ${babs.length} · مواضيع: ${tid} · وحدات: ${units.length}`);
for (const b of babs.slice(0, 4)) {
  console.log(`\n#${b.id} ${b.name} (${b.unitsCount}):`);
  for (const t of b.topics.slice(0, 4)) console.log(`  · ${t.name} — ${t.units.slice(0, 4).map((u) => units[u][3]).join(" | ")}`);
}

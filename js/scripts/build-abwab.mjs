/**
 * أبواب مواضيع مشكاة المحسوبة v1: عنقدة مراكز المحاور الـ٢٠٦ (k-means حتمي،
 * بذرة معلنة، k=14) إلى أبوابٍ كبرى — فتنشأ هرمية «أبواب ← مواضيع (محاور
 * مسماة) ← وحدات سياق مسماة» تغطي المصحف كله، على شكل التقليدي وبحسابنا كله.
 *
 * Writes: js/apps/studio/public/abwab-v1.json
 * Usage: node scripts/build-abwab.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const axesF = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/unified/axes-v1.json"), "utf-8"));
const axesP = JSON.parse(fs.readFileSync(path.join(PUB, "axes-v1.json"), "utf-8"));
const tabwib = JSON.parse(fs.readFileSync(path.join(PUB, "tabwib-v1.json"), "utf-8"));
const nameOf = new Map(axesP.axes.map((a) => [a.id, a.label]));

// متجهات الآيات لمراكز المحاور
const buf = fs.readFileSync(path.join(PUB, "quran-embeddings.bin"));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const hlen = new DataView(ab).getUint32(0, true);
const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, hlen)));
const sOff = 4 + hlen;
const scales = new Float32Array(ab.slice(sOff, sOff + hdr.count * 4));
const data = new Int8Array(ab, sOff + hdr.count * 4, hdr.count * hdr.dim);
const C = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const base = {}; { let acc = 0; for (let s = 1; s <= 114; s++) { base[s] = acc; acc += C[s - 1]; } }
const vec = (loc) => {
  const [s, a] = loc.split(":").map(Number);
  const row = base[s] + a - 1;
  const v = new Float32Array(hdr.dim);
  for (let k = 0; k < hdr.dim; k++) v[k] = data[row * hdr.dim + k] * scales[row];
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  for (let k = 0; k < hdr.dim; k++) v[k] /= n;
  return v;
};
const centroids = axesF.axes.map((a) => {
  const v = new Float32Array(hdr.dim);
  for (const loc of a.topLocs) { const av = vec(loc); for (let k = 0; k < v.length; k++) v[k] += av[k]; }
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  for (let k = 0; k < v.length; k++) v[k] /= n;
  return { id: a.id, size: a.size, v };
});

// k-means حتمي (بذرة 20260719، k=14)
const K = 14;
let seed = 20260719;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const idx = [...Array(centroids.length).keys()];
for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
let means = idx.slice(0, K).map((i) => Float32Array.from(centroids[i].v));
const cosv = (x, y) => { let d = 0; for (let k = 0; k < x.length; k++) d += x[k] * y[k]; return d; };
let assign = new Array(centroids.length).fill(0);
for (let it = 0; it < 40; it++) {
  let moved = false;
  centroids.forEach((c, i) => {
    let best = 0, bc = -2;
    means.forEach((m, k) => { const d = cosv(c.v, m); if (d > bc) { bc = d; best = k; } });
    if (assign[i] !== best) { assign[i] = best; moved = true; }
  });
  means = means.map((_, k) => {
    const v = new Float32Array(hdr.dim);
    let cnt = 0;
    centroids.forEach((c, i) => { if (assign[i] === k) { cnt++; for (let d = 0; d < v.length; d++) v[d] += c.v[d] * c.size; } });
    let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
    for (let d = 0; d < v.length; d++) v[d] /= n;
    return v;
  });
  if (!moved) break;
}
// وحدات كل محور (للعدّ)
const unitsPerAxis = new Map();
tabwib.units.forEach((e) => { for (const ax of e.ax) unitsPerAxis.set(ax, (unitsPerAxis.get(ax) ?? 0) + 1); });

const babs = [...Array(K).keys()].map((k) => {
  const members = centroids.filter((_, i) => assign[i] === k).sort((a, b) => b.size - a.size);
  const axIds = members.map((m) => m.id);
  const units = axIds.reduce((t, id) => t + (unitsPerAxis.get(id) ?? 0), 0);
  return { axes: axIds, units, name: nameOf.get(axIds[0]) ?? "", rules: members.reduce((t, m) => t + m.size, 0) };
}).filter((b) => b.axes.length).sort((a, b) => b.units - a.units).map((b, i) => ({ id: i + 1, ...b }));

fs.writeFileSync(path.join(PUB, "abwab-v1.json"), JSON.stringify({
  meta: { date: "2026-07-19", k: K, seed: 20260719, note: "أبواب مواضيع مشكاة المحسوبة: عنقدة حتمية لمراكز المحاور؛ أسماؤها مبدئية من أكبر محاورها" },
  babs,
}));
console.log(babs.map((b) => `#${b.id} (${b.axes.length} محورًا · ${b.units} وحدة) ${b.name}`).join("\n"));

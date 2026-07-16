/**
 * توليد مرشحي أسراب التعميق — المعاملات الموسعة (×٣–٥ من v2) + مساران:
 *   الاتجاهي (بيان/مثال/جزاء + توكيد لا-متماثل) بالمعاملات الموسعة، و
 *   المتماثل (توكيد/مثاني) الذي كان v2 يستبعده بنيويًّا (NEAR_DUP≥0.95 مرفوع).
 * كلُّ مرشحٍ يُلحق بوحدة سياقه المعتمدة (نافذة الحاكم في ذراع «بسياق»).
 * الأزواج التي حكمها v2 تُستبعد من الاتجاهي الجديد (تُعاد فقط إن أثبت ذراعا
 * الجزء الأول أن السياق يغيّر الأحكام جوهريًّا — بوابة قرار موثقة في الدفتر).
 *
 * Writes: findings/deepening/{candidates-directional.jsonl, candidates-symmetric.jsonl,
 *         PREP-STATS.md}
 * Usage: node scripts/prepare-deepening.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const V2 = path.join(ROOT, "findings/kulliyat-v2/provenance/v2-run");
const OUT = path.join(ROOT, "findings/deepening");
fs.mkdirSync(OUT, { recursive: true });

// —— المعاملات الموسعة (تُدوَّن في الدفتر) ——
const FWD_K = 60, REV_K = 30, ROOT_K = 15, RARE_OCC = 300, CAP = 90, COS_FLOOR = 0.50;
const SYM_FLOOR = 0.80; // المسار المتماثل: كل زوج قواعد بهذا التشابه فأعلى (يشمل ما فوق 0.95)

const hubs = JSON.parse(fs.readFileSync(path.join(V2, "hubs.json"), "utf-8"));
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const N = 6236;
const VDIM = 768;
const V = new Float32Array(N * VDIM);
for (const r of db.prepare("SELECT ayah_id, vector FROM ayah_embedding WHERE dim=768").iterate()) {
  const v = new Float32Array(r.vector.buffer, r.vector.byteOffset, VDIM);
  let n = 0;
  for (let i = 0; i < VDIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < VDIM; i++) V[(r.ayah_id - 1) * VDIM + i] = v[i] / n;
}
const locOf = new Map(db.prepare("SELECT ayah_id, location FROM ayah").all().map((r) => [r.ayah_id, r.location]));
const idOf = new Map(db.prepare("SELECT ayah_id, location FROM ayah").all().map((r) => [r.location, r.ayah_id]));
// الجذور النادرة (تواتر ≤ RARE_OCC) لكل آية
const rootOcc = new Map();
for (const r of db.prepare("SELECT root_id, COUNT(*) c FROM word WHERE root_id IS NOT NULL GROUP BY root_id").iterate()) rootOcc.set(r.root_id, r.c);
const rareByAyah = new Map();
const ayahsByRare = new Map();
for (const r of db.prepare("SELECT DISTINCT ayah_id, root_id FROM word WHERE root_id IS NOT NULL").iterate()) {
  if ((rootOcc.get(r.root_id) ?? 1e9) > RARE_OCC) continue;
  (rareByAyah.get(r.ayah_id) ?? rareByAyah.set(r.ayah_id, new Set()).get(r.ayah_id)).add(r.root_id);
  (ayahsByRare.get(r.root_id) ?? ayahsByRare.set(r.root_id, new Set()).get(r.root_id)).add(r.ayah_id);
}
db.close();

// وحدات السياق المعتمدة (لنافذة الحاكم)
const su = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/siyaq-swarm/units-computed.json"), "utf-8")).units;
const unitIdx = new Map();
for (const u of su) for (let a = u.a1; a <= u.a2; a++) unitIdx.set(`${u.s}:${a}`, u);

// أزواج v2 المحكومة (تُستبعد من الاتجاهي الجديد)
const judged = new Set();
for (const l of fs.readFileSync(path.join(V2, "judge-results-raw.jsonl"), "utf-8").split("\n").filter(Boolean)) {
  const r = JSON.parse(l);
  for (const j of r.judgments ?? []) {
    // الدفعات الأصلية تحمل المرشحين في ملفاتها؛ نعيد بناءها من ملفات الدفعات أدق —
    // هنا نكتفي بأزواج القبول والرفض المسجلة في judgments إن وُجد مرشحوها
  }
}
// الأدق: من ملفات الدفعات نفسها (كل ما رآه الحاكم فقد حُكم)
for (const f of fs.readdirSync(path.join(V2, "batches")).filter((x) => x.startsWith("batch-"))) {
  const arr = JSON.parse(fs.readFileSync(path.join(V2, "batches", f), "utf-8"));
  for (const p of arr) for (const c of p.candidates) judged.add(`${p.id}|${c.loc}`);
}
console.log(`أزواج v2 المحكومة: ${judged.size}`);

const cos = (i, j) => {
  let d = 0;
  const oi = i * VDIM, oj = j * VDIM;
  for (let k = 0; k < VDIM; k++) d += V[oi + k] * V[oj + k];
  return d;
};

// —— المسار الاتجاهي: استرجاع موسع لكل محور ——
const dirPairs = [];
const revLists = new Map(); // ayah_id -> [{hub, cos}]
let t0 = Date.now();
for (let h = 0; h < hubs.length; h++) {
  const hub = hubs[h];
  const hi = hub.ayah_id - 1;
  const scored = [];
  for (let j = 0; j < N; j++) {
    if (j === hi) continue;
    const c = cos(hi, j);
    if (c >= COS_FLOOR) scored.push([j, c]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const chosen = new Map();
  for (const [j, c] of scored.slice(0, FWD_K)) chosen.set(j, { c, src: "fwd" });
  // الجذور النادرة
  let added = 0;
  for (const r of rareByAyah.get(hub.ayah_id) ?? []) {
    for (const aid of ayahsByRare.get(r) ?? []) {
      if (added >= ROOT_K) break;
      const j = aid - 1;
      if (j === hi || chosen.has(j)) continue;
      chosen.set(j, { c: cos(hi, j), src: "root" });
      added++;
    }
  }
  // القناة العكسية تُجمع لاحقًا؛ سجل قوائم أفضل المحاور لكل آية عبر عينة الترتيب
  for (const [j, m] of chosen) {
    if (chosen.size > CAP) break;
    const loc = locOf.get(j + 1);
    if (judged.has(`${hub.id}|${loc}`)) continue; // حُكم في v2
    dirPairs.push({ hub: hub.id, hubLoc: hub.loc, cand: loc, cos: +m.c.toFixed(3), src: m.src, unit: (() => { const u = unitIdx.get(loc); return u ? `${u.s}:${u.a1}-${u.a2}` : null; })() });
  }
  if (h % 500 === 0) process.stdout.write(`\r${h}/${hubs.length}`);
}
console.log(`\nالاتجاهي الجديد (fwd+root بعد استبعاد المحكوم): ${dirPairs.length} · زمن ${(Date.now() - t0) / 1000 | 0}ث`);

// —— المسار المتماثل: أزواج المحاور المتشابهة جدًّا (كان v2 يستبعدها) ——
const hubByAyah = new Map();
for (const hub of hubs) {
  if (!hubByAyah.has(hub.ayah_id)) hubByAyah.set(hub.ayah_id, []);
  hubByAyah.get(hub.ayah_id).push(hub);
}
const hubAyahs = [...hubByAyah.keys()];
const symPairs = [];
for (let x = 0; x < hubAyahs.length; x++) {
  const ai = hubAyahs[x] - 1;
  for (let y = x + 1; y < hubAyahs.length; y++) {
    const bj = hubAyahs[y] - 1;
    const c = cos(ai, bj);
    if (c < SYM_FLOOR) continue;
    const la = locOf.get(hubAyahs[x]), lb = locOf.get(hubAyahs[y]);
    symPairs.push({ a: la, b: lb, cos: +c.toFixed(3), unitA: (() => { const u = unitIdx.get(la); return u ? `${u.s}:${u.a1}-${u.a2}` : null; })(), unitB: (() => { const u = unitIdx.get(lb); return u ? `${u.s}:${u.a1}-${u.a2}` : null; })() });
  }
  if (x % 200 === 0) process.stdout.write(`\rsym ${x}/${hubAyahs.length}`);
}
console.log(`\nالمتماثل (أزواج قواعد cos≥${SYM_FLOOR}): ${symPairs.length}`);

fs.writeFileSync(path.join(OUT, "candidates-directional.jsonl"), dirPairs.map((p) => JSON.stringify(p)).join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "candidates-symmetric.jsonl"), symPairs.map((p) => JSON.stringify(p)).join("\n") + "\n");

const PAIRS_PER_BATCH_DIR = 60; // السياق يضخم الدفعة — من قياس ذراعي الجزء الأول يُضبط
const PAIRS_PER_BATCH_SYM = 40;
const stats = `# إحصاء تجهيز التعميق — أرقام حقيقية لا تقديرية (2026-07-16)

| | العدد |
|---|---|
| محاور (وحدات مبوّبة، من v2) | ${hubs.length} |
| أزواج v2 المحكومة سلفًا (تُحفظ ولا تُعاد ابتداءً) | ${judged.size} |
| **الاتجاهي الجديد** (FWD ${FWD_K} + ROOT ${ROOT_K}، أرضية ${COS_FLOOR}، بعد الاستبعاد) | **${dirPairs.length}** |
| **المتماثل** (أزواج قواعد cos≥${SYM_FLOOR} — مسار المثاني المستحدث) | **${symPairs.length}** |
| دفعات متوقعة: اتجاهي ÷${PAIRS_PER_BATCH_DIR} + متماثل ÷${PAIRS_PER_BATCH_SYM} | ~${Math.ceil(dirPairs.length / PAIRS_PER_BATCH_DIR)} + ~${Math.ceil(symPairs.length / PAIRS_PER_BATCH_SYM)} |
| كابا ~٥٪ | ~${Math.ceil((Math.ceil(dirPairs.length / PAIRS_PER_BATCH_DIR) + Math.ceil(symPairs.length / PAIRS_PER_BATCH_SYM)) * 0.05)} |

القناة العكسية (REV_K=${REV_K}) والقناة الوحدوية (متجهات وحداتنا) تُضافان عند بناء
الدفعات النهائية بعد بوابة الجزء الأول — مرشحوهما يوسمان بمصدرهما ويقاس مردودهما.
`;
fs.writeFileSync(path.join(OUT, "PREP-STATS.md"), stats);
console.log(stats);

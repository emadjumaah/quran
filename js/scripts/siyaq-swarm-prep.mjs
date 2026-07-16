/**
 * تجهيز سرب السياق: (١) العيّنة المجمّدة ٤٠+٢٠ من إجماع المراجع الثلاثة، مشقوقة
 * نصفين (ضبط/محجوب) بتقسيمٍ حتمي، مع عتبات نجاحٍ معلنة قبل أول دفعة؛
 * (٢) دفعات المنطقة الرمادية (٢٠٨٢ فجوة → ٨٤ دفعة × ٢٥) بنصوص السياق؛
 * (٣) خطة الأجزاء: الجزء الأول = الدفعات ≡0 (mod 8) منثورةً على المصحف كله + ٣ كابا.
 *
 * Writes: findings/siyaq-swarm/{FROZEN-SAMPLE.md, frozen-sample.json, rubric.txt,
 *         batches/gray-NNN.json, chunk-plan.json}
 * Usage: node scripts/siyaq-swarm-prep.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SEED = path.join(ROOT, "findings/siyaq-seed");
const OUT = path.join(ROOT, "findings/siyaq-swarm");
fs.mkdirSync(path.join(OUT, "batches"), { recursive: true });

const gaps = fs.readFileSync(path.join(SEED, "gaps.jsonl"), "utf-8").split("\n").filter(Boolean).map(JSON.parse);
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const txt = new Map(db.prepare("SELECT surah_no s, ayah_no a, text_clean t FROM ayah").all().map((r) => [`${r.s}:${r.a}`, r.t]));
const AC = new Map(db.prepare("SELECT surah_no n, ayah_count c FROM surah").all().map((r) => [r.n, r.c]));
const nm = new Map(db.prepare("SELECT surah_no n, name_ar x FROM surah").all().map((r) => [r.n, r.x]));
const rukuStarts = new Set();
{
  let prev = null;
  for (const r of db.prepare("SELECT surah_no s, ayah_no a, ruku FROM ayah ORDER BY ayah_id").iterate()) {
    const key = `${r.s}/${r.ruku}`;
    if (key !== prev) rukuStarts.add(`${r.s}:${r.a}`);
    prev = key;
  }
}
db.close();
const tafsil = JSON.parse(fs.readFileSync(path.join(ROOT, "js/data/tafsil/units.json"), "utf-8")).units;
const tStarts = new Set(tafsil.map((u) => `${u.s}:${u.a1}`));
const aysar = JSON.parse(fs.readFileSync(path.join(ROOT, "js/apps/studio/public/rag-aysar.json"), "utf-8"));
const aStarts = new Set(aysar.map((e) => e.ref));

// —— العيّنة المجمّدة: ٤٠ حدًّا بإجماع الثلاثة + ٢٠ ضدًّا بإجماعها — منثورةً حتميًّا ——
const isB = (g) => tStarts.has(`${g.s}:${g.a + 1}`) && aStarts.has(`${g.s}:${g.a + 1}`) && rukuStarts.has(`${g.s}:${g.a + 1}`);
const isC = (g) => !tStarts.has(`${g.s}:${g.a + 1}`) && !aStarts.has(`${g.s}:${g.a + 1}`) && !rukuStarts.has(`${g.s}:${g.a + 1}`) && g.z_depth < 0;
const pick = (arr, k) => { const st = Math.max(1, Math.floor(arr.length / k)); return arr.filter((_, i) => i % st === 0).slice(0, k); };
const B = pick(gaps.filter(isB), 40);
const C = pick(gaps.filter(isC), 20);
const half = (id) => parseInt(createHash("md5").update(id).digest("hex").slice(0, 8), 16) % 2 === 0 ? "tune" : "holdout";
const sample = [
  ...B.map((g) => ({ id: `${g.s}:${g.a}`, kind: "boundary", half: half(`${g.s}:${g.a}b`) })),
  ...C.map((g) => ({ id: `${g.s}:${g.a}`, kind: "counter", half: half(`${g.s}:${g.a}c`) })),
];
fs.writeFileSync(path.join(OUT, "frozen-sample.json"), JSON.stringify({ frozen: true, date: "2026-07-15", grain: "tafsil (~1300 unit)", sample }, null, 1));

const cnt = (k, h) => sample.filter((x) => x.kind === k && x.half === h).length;
let md = `# العيّنة المجمّدة لوحدات السياق — قفلُها رقمُ commit هذا الملف

**التاريخ:** 2026-07-15 · **المصادقة:** المالك («لنبدأ») على مرشّحات إجماع المراجع الثلاثة
· **الحبّة المعتمدة:** حبّةُ التفصيل الموضوعي (~١٣٠٠ وحدة للمصحف، وسيط ٤–٥ آيات).

## عتبات النجاح — معلنةٌ قبل أول دفعة (على المحجوب، يُفتح مرةً واحدة بعد اكتمال السرب والمعايرة)

- استعادة حدود المحجوب ≥ **٨٠٪**
- رفض أضداد المحجوب ≥ **٩٠٪**
- κ الكابا الثنائي ≥ **0.55** (وإلا روجعت الحبّة في الـrubric قبل المتابعة)

دون العتبتين الأوليين: لا تُعلن الطبقة نهائيةً، ويُنشر التقرير كما هو (سنّة المشروع).

## التقسيم

| | ضبط | محجوب |
|---|---|---|
| حدود (إجماع ثلاثي) | ${cnt("boundary", "tune")} | ${cnt("boundary", "holdout")} |
| أضداد (وصل بإجماع) | ${cnt("counter", "tune")} | ${cnt("counter", "holdout")} |

القوائم الكاملة في frozen-sample.json (الشقّ بتجزئة md5 حتمية).
`;
fs.writeFileSync(path.join(OUT, "FROZEN-SAMPLE.md"), md);
console.log(`العيّنة: ${B.length} حدًّا + ${C.length} ضدًّا · ضبط/محجوب: ${sample.filter((x) => x.half === "tune").length}/${sample.filter((x) => x.half === "holdout").length}`);

// —— دفعات الرمادية ——
const gray = gaps.filter((g) => g.cls === "gray");
const item = (g) => {
  const before = [], after = [];
  for (let d = 2; d >= 0; d--) if (g.a - d >= 1) before.push(`﴿${nm.get(g.s)} ${g.a - d}﴾ ${txt.get(`${g.s}:${g.a - d}`)}`);
  for (let d = 1; d <= 3; d++) if (g.a + d <= AC.get(g.s)) after.push(`﴿${nm.get(g.s)} ${g.a + d}﴾ ${txt.get(`${g.s}:${g.a + d}`)}`);
  return { id: `${g.s}:${g.a}`, before: before.join("\n"), after: after.join("\n") };
};
const BATCH = 25;
const nBatches = Math.ceil(gray.length / BATCH);
for (let b = 0; b < nBatches; b++) {
  fs.writeFileSync(path.join(OUT, "batches", `gray-${String(b).padStart(3, "0")}.json`), JSON.stringify(gray.slice(b * BATCH, (b + 1) * BATCH).map(item), null, 1));
}

// —— خطة الأجزاء: منثورة على المصحف (mod 8) + كابا ——
const all = [...Array(nBatches).keys()];
const chunks = [[], [], [], []];
for (const b of all) chunks[b % 8 === 0 ? 0 : b % 8 <= 2 ? 1 : b % 8 <= 5 ? 2 : 3].push(b);
const kappa = { 0: [chunks[0][0], chunks[0][Math.floor(chunks[0].length / 2)], chunks[0][chunks[0].length - 1]], later: 5 };
fs.writeFileSync(path.join(OUT, "chunk-plan.json"), JSON.stringify({ batches: nBatches, batchSize: BATCH, chunks, kappaChunk0: kappa[0], kappaLaterCount: kappa.later }, null, 1));
console.log(`دفعات: ${nBatches} · الأجزاء: ${chunks.map((c) => c.length).join("/")} · كابا الجزء الأول: ${kappa[0].join(",")}`);

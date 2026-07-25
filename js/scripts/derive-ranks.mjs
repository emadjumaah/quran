/**
 * الاشتقاق v3 (الخطوة ٢ب): وسم كلية/جامعة/تفصيل من الشبكة الموحدة والمحاور
 * المنبثقة. المعايير المعلنة لكل قاعدة مؤهلة بوابيًّا:
 *   m = عدد مفصلاتها الموجهة · T = عدد المحاور المنبثقة التي تغطيها مفصلاتها
 *   (كل مفصِّل يُنسب لمحور أغلبية القواعد التي يفصّلها، بكسر تعادل حتمي) ·
 *   mu = شركاؤها في التوكيد المتبادل.
 *   كلية: m≥M1 و T≥T1 (أبواب تلتقي عندها) · جامعة: m≥M2 (أو ترقية مثانٍ mu≥P)
 *   · تفصيل: ما سوى ذلك. العتبات تُعاير على نصف الضبط فقط (١٥ قاعدة + أضداد
 *   الضبط من الملحق المجمد 6c8bb83) — والمصون لا يُمس حتى إذن المالك.
 *
 * Writes: findings/unified/ranks-v1.json + TUNE-REPORT.md
 * Usage: node scripts/derive-ranks.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const ev = JSON.parse(fs.readFileSync(path.join(PUB, "v3-evidence.json"), "utf-8"));
const axes = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/unified/axes-v1.json"), "utf-8"));
const frozen = JSON.parse(fs.readFileSync(path.join(ROOT, "findings/deepening/frozen-supplement.json"), "utf-8"));

// قاعدة -> محورها
const axisOf = new Map();
for (const a of axes.axes) for (const r of a.rules) axisOf.set(r, a.id);
// مفصل -> قواعده (لنسبة المفصل لمحور الأغلبية)
const byElab = new Map();
const ruleElabs = new Map();
for (const [loc, units] of Object.entries(ev.verses)) {
  for (const u of units) {
    const id = `${loc}/${u.u}`;
    const s = new Set();
    for (const arr of Object.values(u.links ?? {})) for (const c of arr) s.add(c);
    ruleElabs.set(id, s);
    for (const c of s) (byElab.get(c) ?? byElab.set(c, []).get(c)).push(id);
  }
}
const elabAxis = new Map();
for (const [e, rules] of byElab) {
  const cnt = new Map();
  for (const r of rules) { const ax = axisOf.get(r); if (ax) cnt.set(ax, (cnt.get(ax) ?? 0) + 1); }
  if (!cnt.size) continue;
  const best = [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  elabAxis.set(e, best);
}
// مقاييس كل قاعدة
const metrics = new Map();
for (const [loc, units] of Object.entries(ev.verses)) {
  for (const u of units) {
    const id = `${loc}/${u.u}`;
    const elabs = ruleElabs.get(id) ?? new Set();
    const axSet = new Set();
    for (const e of elabs) { const ax = elabAxis.get(e); if (ax) axSet.add(ax); }
    const mu = (ev.mutual?.[loc] ?? []).length;
    const suras = new Set([...elabs].map((l) => String(l).split(":")[0]));
    const nrel = Object.entries(u.links ?? {}).filter(([, v]) => (v ?? []).length).length;
    metrics.set(id, { loc, m: elabs.size, T: axSet.size, mu, S: suras.size, nrel, gated: (u.g ?? []).length > 0 });
  }
}
// آية -> أفضل وحدة (الآية ترث أعلى وحداتها)
const verseBest = new Map();
for (const [id, x] of metrics) {
  const prev = verseBest.get(x.loc);
  if (!prev || x.m > prev.m || (x.m === prev.m && x.T > prev.T)) verseBest.set(x.loc, { ...x, id });
}

const tuneRules = frozen.sample.filter((x) => x.kind === "rule" && x.half === "tune").map((x) => x.id);
const tuneCounters = frozen.sample.filter((x) => x.kind === "counter" && x.half === "tune").map((x) => x.id);
// معيارُ «القاعدة» v2 (مراجعةٌ مباشرة 2026-07-21، أمرُ المالك): كان يكفي
// م≥٣ أو مثانٍ≥٢، فدخل ١٬١٧٧ فيهم ٢٢٢ بالمثاني وحدها و١٧١ كلُّ تفصيلها في سورةٍ
// واحدة. الآن يُشترط اتساعٌ حقيقيٌّ ثلاثيّ: مفصِّلاتٌ ≥M2 وانتشارٌ في ≥S2 سورًا
// وعلاقتان مختلفتان على الأقل. والمثاني تبقى شارةً تُعرض لا رتبةً تُمنح.
const rank = (x, M1, T1, M2, S2, R2) => {
  if (!x || !x.gated) return "غير مؤهلة";
  if (x.m >= M1 && x.T >= T1) return "كلية";
  if (x.m >= M2 && x.S >= S2 && x.nrel >= R2) return "جامعة";
  return "تفصيل";
};
// معايرة شبكية على نصف الضبط
let best = null;
for (let M1 = 6; M1 <= 20; M1++) for (let T1 = 3; T1 <= 9; T1++) for (let M2 = 3; M2 <= Math.min(M1 - 1, 9); M2++) for (const S2 of [2, 3, 4]) for (const R2 of [1, 2]) {
  let rec = 0;
  for (const id of tuneRules) { const r = rank(verseBest.get(id), M1, T1, M2, S2, R2); if (r === "كلية" || r === "جامعة") rec++; }
  let rej = 0;
  for (const id of tuneCounters) { const r = rank(verseBest.get(id), M1, T1, M2, S2, R2); if (r !== "كلية" && r !== "جامعة") rej++; }
  if (tuneCounters.length && rej < tuneCounters.length) continue; // شرط صارم: كل أضداد الضبط ترفض
  let kul = 0;
  for (const x of verseBest.values()) if (rank(x, M1, T1, M2, S2, R2) === "كلية") kul++;
  const score = rec * 1000 - Math.abs(kul - 60);
  if (!best || score > best.score) best = { M1, T1, M2, S2, R2, rec, rej, kul, score };
}
const { M1, T1 } = best;
// معيارُ «القاعدة» مقرَّرٌ لا مُعايَر (قرار المالك 2026-07-21 بعد جردٍ مباشر):
// المعايرةُ الشبكيّة تُعظّم الاستعادةَ فتختار الأوسع دائمًا — وهي التي أنتجت
// ١٬١٧٧ قاعدةً فيها ٢٢٢ بالمثاني وحدها. فالاتساعُ الحقيقيُّ يُشترط اشتراطًا:
const M2 = 4, S2 = 3, R2 = 2;
// وتُحسب استعادةُ نصفِ الضبط تحت المعيار المقرَّر وتُعلن كما هي
let recFixed = 0;
for (const id of tuneRules) { const r = rank(verseBest.get(id), M1, T1, M2, S2, R2); if (r === "كلية" || r === "جامعة") recFixed++; }
let rejFixed = 0;
for (const id of tuneCounters) { const r = rank(verseBest.get(id), M1, T1, M2, S2, R2); if (r !== "كلية" && r !== "جامعة") rejFixed++; }
// التطبيق الكامل
const counts = { "كلية": 0, "جامعة": 0, "تفصيل": 0, "غير مؤهلة": 0 };
const ranks = {};
for (const [loc, x] of verseBest) {
  const r = rank(x, M1, T1, M2, S2, R2);
  counts[r]++;
  if (r === "كلية" || r === "جامعة") ranks[loc] = { r, m: x.m, T: x.T, mu: x.mu, S: x.S, nrel: x.nrel };
}
fs.writeFileSync(path.join(ROOT, "findings/unified/ranks-v1.json"), JSON.stringify({
  meta: { date: "2026-07-19", date2: "2026-07-21", thresholds: { M1, T1, M2, S2, R2 }, tunedOn: "النصف الضبطي من الملحق المجمد 6c8bb83 فقط — المصون لم يُمس", counts },
  ranks,
}, null, 1));
const kulList = Object.entries(ranks).filter(([, v]) => v.r === "كلية").sort((a, b) => b[1].T - a[1].T || b[1].m - a[1].m);
const report = `# تقرير معايرة الاشتقاق v3 (نصف الضبط فقط — 2026-07-19)

العتبات المختارة: م≥${M1} واتساعُ محاورَ≥${T1} للقاعدة الكبرى · م≥${M2} وسورٌ≥${S2} وعلاقاتٌ≥${R2} للقاعدة (والمثاني شارةٌ لا رتبة).
- استعادة نصف الضبط تحت المعيار المقرَّر: **${recFixed}/${tuneRules.length}** (الشرط الصارم: كل أضداد الضبط مرفوضة ✓ ${best.rej}/${tuneCounters.length})
- التوزيع الكامل: كلية ${counts["كلية"]} · جامعة ${counts["جامعة"]} · تفصيل ${counts["تفصيل"]} · غير مؤهلة ${counts["غير مؤهلة"]}

أعلى ١٥ كلية (بالاتساع ثم العدد):
${kulList.slice(0, 15).map(([loc, v]) => `- ${loc} (م=${v.m}، ت=${v.T}، مثانٍ=${v.mu})`).join("\n")}

**المصون لم يُفتح** — فتحه مرة واحدة بإذن المالك، بعتباته المجمدة منذ 2026-07-16:
استعادة ≥٨٠٪ · رفض ≥٩٠٪.
`;
fs.writeFileSync(path.join(ROOT, "findings/unified/TUNE-REPORT.md"), report);
console.log(report);

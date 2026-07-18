/**
 * بناء الشبكة الموحدة v3 — ثمرة حملة التوحيد (2026-07-19):
 * الصلات الموجهة كلها من فحص السياق (ت١+ت٢+ت٣ على الدائرة الأقرب، + الذراع A
 * للدائرة البعيدة من الجزء الأول والموجة ١)، والطبقة المتبادلة من المسار
 * المتماثل + سرب الاسترداد. أحكام v2 القديمة تُستبدل ولا تُمس أرشيفيًّا.
 *
 * Writes: js/apps/studio/public/v3-evidence.json (خلف لـv2-evidence.json)
 *         findings/unified/NETWORK-V3.md (توثيق الأرقام للمختصين)
 * Usage: node scripts/build-unified-network.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DP = path.join(ROOT, "findings/deepening");
const read = (p) => fs.readFileSync(p, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

// ١ — الصلات الموجهة الموحدة: id -> Map(loc -> {rel, src})
const directed = new Map();
const addLink = (id, loc, rel, src) => {
  if (!directed.has(id)) directed.set(id, new Map());
  if (!directed.get(id).has(loc)) directed.get(id).set(loc, { rel, src });
};
// الدائرة الأقرب: ت١+ت٢+ت٣
for (const t of ["t1", "t2", "t3"]) {
  for (const r of read(path.join(DP, `rejudge/results-${t}.jsonl`))) {
    if (r.run !== 1) continue;
    for (const j of r.judgments) for (const l of j.links ?? []) addLink(j.id, l.loc, l.rel, t);
  }
}
const nearCount = [...directed.values()].reduce((t, m) => t + m.size, 0);
// الدائرة البعيدة: الجزء الأول (ذراع A) + الموجة ١ (أسرابها الاتجاهية ذراع A)
for (const r of read(path.join(DP, "chunk1/results-raw.jsonl"))) {
  if (r.run !== 1 || !r.file?.startsWith("dirA")) continue;
  for (const j of r.judgments ?? []) for (const l of j.links ?? []) addLink(j.id, l.loc, l.rel, "c1");
}
for (const r of read(path.join(DP, "waves/results-w1.jsonl"))) {
  if (r.run !== 1 || !r.file?.startsWith("dirA")) continue;
  for (const j of r.judgments ?? []) for (const l of j.links ?? []) addLink(j.id, l.loc, l.rel, "w1");
}
const allDirected = [...directed.values()].reduce((t, m) => t + m.size, 0);

// ٢ — الطبقة المتبادلة: أزواج فريدة {a,b} → src
const mutual = new Map();
const addMutual = (a, b, src) => {
  if (a === b || !a || !b) return;
  const k = [a, b].sort().join("|");
  if (!mutual.has(k)) mutual.set(k, src);
};
// المسار المتماثل: الجزء الأول (symB المصحح) + الموجة ١ (sym ذراع B)
for (const r of read(path.join(DP, "chunk1/results-raw.jsonl"))) {
  if (r.run !== 1 || !r.file?.startsWith("symB") || !r.corrected) continue;
  for (const v of r.verdicts ?? []) if (v.same) addMutual(v.a, v.b, "sym");
}
for (const r of read(path.join(DP, "waves/results-w1.jsonl"))) {
  if (r.run !== 1 || !r.file?.startsWith("sym")) continue;
  for (const v of r.verdicts ?? []) if (v.same) addMutual(v.a, v.b, "sym");
}
// الاسترداد
for (const r of read(path.join(DP, "recovery/results-rec.jsonl"))) {
  if (r.run !== 1) continue;
  for (const v of r.verdicts ?? []) if (v.same) addMutual(v.a, v.b, "rec");
}

// ٣ — تركيب ملف التطبيق فوق بنية v2-evidence (البوابات والتوائم كما هي)
const ev = JSON.parse(fs.readFileSync(path.join(ROOT, "js/apps/studio/public/v2-evidence.json"), "utf-8"));
let relChanged = 0, unitsWithLinks = 0;
const relCount = {};
for (const [loc, units] of Object.entries(ev.verses)) {
  for (const u of units) {
    const id = `${loc}/${u.u}`;
    const m = directed.get(id);
    const links = {};
    if (m) for (const [cand, { rel }] of m) {
      (links[rel] ??= []).push(cand);
      relCount[rel] = (relCount[rel] ?? 0) + 1;
    }
    u.links = links;
    if (Object.keys(links).length) unitsWithLinks++;
  }
}
// المتبادلة خريطة مستقلة: loc -> [شركاؤه]
const mutualMap = {};
for (const [k] of mutual) {
  const [a, b] = k.split("|");
  (mutualMap[a] ??= []).push(b);
  (mutualMap[b] ??= []).push(a);
}
ev.mutual = mutualMap;
ev.meta = {
  model: "unified-context-network v3",
  date: "2026-07-19",
  note: "الشبكة الموحدة: كل صلة فُحصت بنوافذ وحدات السياق المعتمدة؛ تُحدَّث بعد موجات التعميق",
  gates: ev.meta.gates,
  directed: allDirected,
  directedNear: nearCount,
  mutualPairs: mutual.size,
  relCount,
  provenance: "findings/deepening/{rejudge,chunk1,waves,recovery} — الأحكام الخام كاملة بمصادرها",
};
fs.writeFileSync(path.join(ROOT, "js/apps/studio/public/v3-evidence.json"), JSON.stringify(ev));

// ٤ — توثيق المختصين
fs.mkdirSync(path.join(ROOT, "findings/unified"), { recursive: true });
const doc = `# الشبكة الموحدة v3 — أرقامها ومصادرها (2026-07-19)

كل صلةٍ هنا صدرت عن فاحصٍ قرأ الزوج **بنوافذ وحدات السياق المعتمدة v1.1**
(اختبار الاستغناء والافتقار للموجهة، وسؤال وحدة المضمون للمتبادلة).

| الطبقة | العدد | المصدر |
|---|---|---|
| صلات موجهة — الدائرة الأقرب (ت١–ت٣) | ${nearCount} | rejudge/results-t{1,2,3}.jsonl |
| صلات موجهة — الدائرة البعيدة (الجزء ١ + الموجة ١) | ${allDirected - nearCount} | chunk1 + waves |
| **الموجهة كلها** | **${allDirected}** | ${Object.entries(relCount).map(([r, c]) => `${r} ${c}`).join(" · ")} |
| توكيد متبادل (متماثل + استرداد) | ${mutual.size} | sym + recovery |

- وحدات القواعد ذات الصلات: ${unitsWithLinks} من ${Object.values(ev.verses).flat().length}
- البوابات والتوائم الحتمية كما في v2 (لم تتغير — حتمية).
- أحكام v2 القديمة محفوظة أرشيفيًّا في kulliyat-v2/provenance ولا تدخل العرض.
- ملف التطبيق: \`v3-evidence.json\` — يحل محل v2-evidence عند خطوة النشر.
`;
fs.writeFileSync(path.join(ROOT, "findings/unified/NETWORK-V3.md"), doc);
console.log(`موجهة: ${allDirected} (قريبة ${nearCount}) · متبادلة: ${mutual.size} · وحدات بصلات: ${unitsWithLinks}`);
console.log(`العلاقات: ${JSON.stringify(relCount)}`);

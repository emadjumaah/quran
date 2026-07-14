/**
 * harvest-v2-judgment.mjs — حصادُ سرب أحكام v2 وحفظُ كلِّ شيءٍ خامًا في provenance.
 * Usage: node scripts/harvest-v2-judgment.mjs <workflow-journal.jsonl> [prefix]
 *   prefix: "judge" (default) أو "kappa" — أيّ الدفعات يُطابِق.
 * يكتب/يُحدّث:
 *   provenance/v2-run/<prefix>-results-raw.jsonl  — سطرٌ لكل دفعة {batch, agentId, judgments}
 *   provenance/v2-run/<prefix>-journal-copy.jsonl — نسخةُ سجلّ التشغيلة كما هو
 *   ويطبع الدفعات الناقصة (لإعادة تشغيلها) وإحصاء العلاقات.
 * قابلٌ لإعادة التشغيل (idempotent): يدمج على مفتاح batch، الأحدثُ يغلِب.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN = join(HERE, "..", "..", "findings", "kulliyat-v2", "provenance", "v2-run");
const [, , journalPath, prefix = "judge"] = process.argv;
if (!journalPath) { console.error("usage: node harvest-v2-judgment.mjs <journal.jsonl> [judge|kappa]"); process.exit(1); }

const lines = readFileSync(journalPath, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// اجمع النتائج: نتوقّع قيمة {batch, judgments:[...]} من StructuredOutput
const results = new Map(); // batch -> {batch, agentId, judgments}
for (const l of lines) {
  if (l.type !== "result") continue;
  const v = l.value ?? l.result ?? null;
  if (!v || typeof v.batch !== "number" || !Array.isArray(v.judgments)) continue;
  results.set(v.batch, { batch: v.batch, agentId: l.agentId ?? null, judgments: v.judgments });
}

// دمجٌ مع حصاد سابق إن وُجد
const outFile = join(RUN, `${prefix}-results-raw.jsonl`);
if (existsSync(outFile)) {
  for (const line of readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (!results.has(r.batch)) results.set(r.batch, r);
  }
}
const sorted = [...results.values()].sort((a, b) => a.batch - b.batch);
writeFileSync(outFile, sorted.map((r) => JSON.stringify(r)).join("\n") + "\n");
copyFileSync(journalPath, join(RUN, `${prefix}-journal-copy-${basename(dirname(journalPath))}.jsonl`));

// الفجوات وإحصاء العلاقات
const total = Number(JSON.parse(readFileSync(join(RUN, "retrieval-params.json"), "utf8"))[prefix === "judge" ? "batches" : "kappaBatches"]);
const missing = [];
for (let i = 0; i < total; i++) if (!results.has(i)) missing.push(i);
const rels = {};
let links = 0, hubsWithLinks = new Set();
for (const r of sorted)
  for (const j of r.judgments)
    for (const l of j.links ?? []) { links++; rels[l.rel] = (rels[l.rel] ?? 0) + 1; hubsWithLinks.add(j.id); }
console.log(`${prefix}: ${sorted.length}/${total} batches harvested · ${links} links · hubs with ≥1 link: ${hubsWithLinks.size}`);
console.log("relations:", JSON.stringify(rels));
if (missing.length) console.log(`MISSING batches (${missing.length}): ${missing.slice(0, 40).join(",")}${missing.length > 40 ? "…" : ""}`);
else console.log("no gaps ✓");

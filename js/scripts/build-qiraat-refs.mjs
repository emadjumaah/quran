/**
 * القراءاتُ مرجعًا في الفحص — تفعيلُ ما عندنا (2026-07-31، خطّة فاحص ١٫٧).
 *
 * لماذا هي حاسمة: كثيرٌ من الدعاوى المعاصرة تُبنى على **رسمٍ واحدٍ أو ضبطٍ
 * واحد** («هذه الكلمة لا يمكن أن تكون كذا لأنّها مرفوعة»)، فتسقط بقراءةٍ
 * متواترةٍ ثابتةٍ تنصبها. فمن لم يفحص وجوهَ الأداء لم يفحص النصّ.
 *
 * والرتبتان مقصودتان ولا يُخلط بينهما (ميثاق الفحص §ب):
 *   • **النشر لابن الجزري** — إمامُ الفنّ في القراءات العشر المتواترة، فهو من
 *     **الرتبة ١** (النصُّ ووسمُه): القراءةُ المتواترةُ قرآنٌ يُحتجّ به قطعًا.
 *   • **جامعُ القراءات** — يجمع المتواترَ والشاذَّ معًا (تُنسب فيه قراءاتٌ إلى
 *     الحسن وابن أبي عبلة وغيرِهم)، فهو من **الرتبة ٥** (حجّةُ نقلٍ تُعرض ولا
 *     يُقطع بها وحدَها). والشاذُّ يُحتجّ به في **اللغة** لا في **القرآن**،
 *     وهذا فرقٌ يُخلّ به كثيرون.
 *
 * usage: node js/scripts/build-qiraat-refs.mjs
 * out:   js/data/refs-src/qiraat/<id>.json → ثم shard-all-refs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const SRC = path.join(ROOT, "js/data/qiraat");
const OUT = path.join(ROOT, "js/data/refs-src/qiraat");

const FILES = [
  { file: "nashr.jsonl", id: "nashr", label: "النشر في القراءات العشر", by: "ابن الجزري", died: 833,
    rank: 1, role: "القراءاتُ العشرُ المتواترة — من النصّ نفسِه؛ القراءةُ المتواترةُ حجّةٌ قاطعة" },
  { file: "qiraat.jsonl", id: "qiraat-jami", label: "جامعُ وجوه القراءات", by: "جمعٌ منقول", died: null,
    rank: 5, role: "متواترٌ وشاذٌّ مجموعان — حجّةُ نقلٍ تُعرض ولا يُقطع بها وحدَها، والشاذُّ حجّةٌ في اللغة لا في القرآن" },
];

fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const p = path.join(SRC, f.file);
  if (!fs.existsSync(p)) { console.log(`✗ ${f.label}: لا ملفّ`); continue; }
  const entries = {};
  let n = 0, bad = 0;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { bad++; continue; }
    const loc = r.ref ?? r.location;
    const text = (r.text ?? "").trim();
    if (!loc || !/^\d{1,3}:\d{1,3}$/.test(loc) || text.length < 20) { bad++; continue; }
    (entries[loc] ??= []).push(text);
    n++;
  }
  fs.writeFileSync(path.join(OUT, `${f.id}.json`), JSON.stringify({
    meta: { id: f.id, label: f.label, author: f.by, died: f.died, source: `js/data/qiraat/${f.file}`,
            date: "2026-07-31", anchor: "موضعٌ مصرَّحٌ به في المصدر", rank: f.rank, role: f.role },
    entries,
  }));
  console.log(`✓ ${f.label} — ${Object.keys(entries).length} موضعًا · ${n} وجهًا (طُرح ${bad})`);
}

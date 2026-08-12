/**
 * بوّابةُ حرفيّة النقل في `WORLD-FIRSTS.md` — **المنقولُ يطابق مصدرَه أو لا يُنشر.**
 *
 * قيدُ الاستحقاق المضاف (التشغيلُ الآليّ الأعمى لمنهج الإسناد-والمتن) نصُّه
 * معتمَدٌ ومختومٌ في مستودع «التاريخ» — يُنقل ولا يُحرَّر. فهذه البوّابةُ تثبت:
 *   ١ — النصُّ في `WORLD-FIRSTS.md` يطابق §٩ من مصدره **حرفًا** بعد تطبيع
 *       المسافات وحدَها (فرقُ الحروف صفر).
 *   ٢ — القسمُ الجديد **منفصلٌ** عن قائمة الترشيحات القديمة (بعد آخر سطرٍ منها).
 *   ٣ — سطرُ السياق قائم: تاريخُ الإغلاق وموضعُ الدليل في مستودع التاريخ.
 *   ٤ — **المصدرُ لم يُمَسّ**: ملفُّه في مستودع التاريخ نظيفٌ في سجلّ نسخه
 *       (فالمستودعُ مرجعٌ يُقرأ ولا يُكتب).
 *
 * ولا `\b` مع نصٍّ عربيّ في هذا الملفّ — المقابلةُ على سلاسلَ صريحة.
 *
 * التشغيل: node js/scripts/check-world-firsts.mjs [--history <مسار>]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argH = process.argv.indexOf("--history");
const HISTORY = argH > -1 ? process.argv[argH + 1] : join(ROOT, "..", "history");
const SRC = join(HISTORY, "plan", "HOLDOUT-MOTZKI.md");
const TARGET = join(ROOT, "WORLD-FIRSTS.md");
const GATES = join(ROOT, "js", "data", "gates");
mkdirSync(GATES, { recursive: true });
const OUT = join(GATES, "GATE-WORLD-FIRSTS.json");

/** عنوانُ القسم المصدر، وعلامةُ القسم المنقول إليه */
const SRC_HEADING = "## ٩.";
const MARK_SECTION = "مستحقّات مثبتة بعد وثيقة 2026-07-10";
const MARK_QUOTE = "النصُّ المعتمد، منقولًا حرفًا من §٩";

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); return c; };

/** تطبيعُ المسافات وحدَها — لا يُمَسّ حرفٌ ولا شكلٌ ولا ترقيم */
const norm = (s) => s.replace(/\s+/gu, " ").trim();

/** سطورُ الاقتباس المتّصلة بعد موضعٍ معلوم */
function quoteAfter(text, from) {
  const lines = text.slice(from).split("\n");
  const out = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith(">")) { started = true; out.push(line.replace(/^>\s?/u, "")); continue; }
    if (started && line.trim() === "") break;
    if (started) break;
  }
  return out.join("\n");
}

/* ————————————————— أ — المصدر ————————————————— */
let srcQuote = "";
if (!ok(existsSync(SRC), `مصدرُ النقل غيرُ موجود: ${SRC} — مستودعُ التاريخ غيرُ متاح`)) {
  // بلا مصدرٍ لا فحصَ حرفيّة — تُعلن البوّابةُ إخفاقَها ولا تتساهل
} else {
  const src = readFileSync(SRC, "utf8");
  const at = src.indexOf(SRC_HEADING);
  ok(at >= 0, `عنوانُ «${SRC_HEADING}» غيرُ موجودٍ في المصدر`);
  if (at >= 0) {
    srcQuote = quoteAfter(src, at);
    ok(srcQuote.length > 200, `اقتباسُ المصدر قصيرٌ مريب (${srcQuote.length} حرفًا)`);
  }
}

/* ————————————————— ب — المنقول ————————————————— */
const tgt = readFileSync(TARGET, "utf8");
const secAt = tgt.indexOf(MARK_SECTION);
ok(secAt >= 0, `القسمُ الجديد «${MARK_SECTION}» غيرُ موجودٍ في ${TARGET}`);
const qAt = tgt.indexOf(MARK_QUOTE);
ok(qAt >= 0, `علامةُ النقل «${MARK_QUOTE}» غيرُ موجودة`);
const tgtQuote = qAt >= 0 ? quoteAfter(tgt, qAt) : "";

/* ————————————————— ج — المطابقة ————————————————— */
const a = norm(srcQuote);
const b = norm(tgtQuote);
let firstDiff = -1;
if (a !== b) { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { firstDiff = i; break; } }
ok(a.length > 0 && a === b,
  firstDiff < 0 ? "المنقولُ خالٍ أو مصدرُه خالٍ" :
    `المنقولُ يخالف مصدرَه عند الحرف ${firstDiff}:\n    مصدر: …${a.slice(Math.max(0, firstDiff - 30), firstDiff + 30)}…\n    منقول: …${b.slice(Math.max(0, firstDiff - 30), firstDiff + 30)}…`);

/* ————————————————— د — الانفصالُ عن الترشيحات وسطرُ السياق ————————————————— */
const OLD_LIST_TAIL = "\"grammar genome\" etc. are feature names only, not the project.";
const tailAt = tgt.indexOf(OLD_LIST_TAIL);
ok(tailAt >= 0 && secAt > tailAt,
  "القسمُ الجديد ليس بعد قائمة الترشيحات القديمة — النقلُ لا يُخلط بها");

const context = secAt >= 0 && qAt > secAt ? tgt.slice(secAt, qAt) : "";
ok(context.includes("٣ آب ٢٠٢٦"), "سطرُ السياق لا يذكر تاريخَ إغلاق المحكّ");
ok(context.includes("plan/HOLDOUT-MOTZKI.md") && context.includes("مستودع «التاريخ»"),
  "سطرُ السياق لا يدلّ على موضع الدليل في مستودع التاريخ");

/* ————————————————— هـ — المصدرُ لم يُمَسّ ————————————————— */
let srcClean = null;
try {
  const st = execFileSync("git", ["-C", HISTORY, "status", "--porcelain", "--", "plan/HOLDOUT-MOTZKI.md"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  srcClean = st === "";
  ok(srcClean, `مصدرُ النقل مُعدَّلٌ في مستودع التاريخ — والمستودعُ يُقرأ ولا يُكتب: «${st}»`);
} catch {
  srcClean = null; // ليس مستودعَ نسخٍ متاحًا — يُذكر ولا يُحكم به
}

/* ————————————————— التقرير ————————————————— */
const report = {
  ok: fails.length === 0,
  source: SRC, target: TARGET,
  chars: { source: a.length, target: b.length },
  identicalAfterWhitespaceNormalization: a.length > 0 && a === b,
  firstDiffAt: firstDiff,
  separateFromOldCandidates: tailAt >= 0 && secAt > tailAt,
  sourceUntouched: srcClean,
  failures: fails,
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`  المصدر ${a.length} حرفًا · المنقول ${b.length} حرفًا · الفرق: ${a === b ? "صفر" : `عند ${firstDiff}`}`);
for (const f of fails) console.log(`  · ${f}`);
console.log(`${report.ok ? "✓" : "✗"} حرفيّةُ النقل في WORLD-FIRSTS — التقرير: ${OUT}`);
process.exit(report.ok ? 0 : 1);

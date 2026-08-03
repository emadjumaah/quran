/**
 * الضبطُ السالب لبوّابة «ملفّ جمع القرآن» — بوّابةٌ لم تُجرَّب بتحريفٍ مزروعٍ
 * ليست بوّابة.
 *
 * يزرع تحريفاتٍ واحدةً واحدة في ملفّات العرض ومصدرِه وكودِ الواجهة، ويشغّل
 * `check-tarikh.mjs` بعد كلٍّ منها، ويشترط أن تلتقطها البوّابة؛ ثمّ يعيد كلَّ
 * شيءٍ إلى أصله ويثبت أنّها عادت خضراء. كلُّ زرعٍ يُكتب ويُمحى في هذه الجلسة —
 * ولا يُودَع منه شيء.
 *
 * التشغيل: node js/scripts/check-tarikh-negative.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "data", "tarikh-sources");
const PUB = join(ROOT, "js", "apps", "studio", "public");
const VIEWS = join(ROOT, "js", "apps", "studio", "src");

const P = {
  claims: join(PUB, "tarikh-claims.json"),
  rag: join(PUB, "rag-tarikh.json"),
  doc: join(SRC, "hukm", "HUKM-JAMC-v1.1.md"),
  view: join(VIEWS, "views", "Tarikh.tsx"),
  cluster: join(PUB, "tarikh-cluster-clx-jamc-0668-90fe6c.json"),
};

const read = (p) => readFileSync(p, "utf8");
const backup = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, read(p)]));
const restore = () => { for (const [k, p] of Object.entries(P)) writeFileSync(p, backup[k]); };

/** التحريفاتُ المزروعة: [اسمُها، ملفُّها، دالّةُ التحريف] */
const PLANTS = [
  ["اسمُ درجةٍ نصًّا في كود الواجهة", "view",
    (s) => s.replace("<h2>الأقوال الثمانية</h2>", "<h2>الأقوال الثمانية — ثابت وثائقيًا</h2>")],
  ["لفظُ طعنٍ في النصّ الحاضر (المنعُ الجديد)", "view",
    (s) => s.replace("بترتيب القصّة — من كتابة الوحي إلى مصاحف الصحابة.",
      "بترتيب القصّة — ومنها ما فيه ثغرة في المصحف.")],
  ["لفظُ «دعوى» عائدًا إلى الواجهة", "view",
    (s) => s.replace("<h2>الأقوال الثمانية</h2>", "<h2>الدعاوى الثماني</h2>")],
  ["تحريفُ حرفٍ في روايةٍ معروضة", "cluster",
    (s) => s.replace('"fullText":"', '"fullText":"ز')],
  ["تبديلُ درجةِ قولٍ في العرض", "claims",
    (s) => s.replace('"id":"د٤","n":4,', '"id":"د٤","n":4,').replace(/("id":"د٤"[\s\S]{0,4000}?"grade":")muhtamal/, "$1thabit")],
  ["إقحامُ جملةٍ تقويميّةٍ في تسبيبٍ معروض", "claims",
    (s) => s.replace("تتقاطع كلها على أصل القول.", "تتقاطع كلها على أصل القول، وهذا قاطعٌ بلا شكّ.")],
  ["كسرُ تبادل «يُقرأ مع»", "claims",
    (s) => s.replace(/"readWith":\[\{"id":"د٨"[^\]]*\]/, '"readWith":[]')],
  ["إحالةُ «يُقرأ مع» بلا أساسٍ في البيّنة", "claims",
    (s) => s.replace(/("id":"د٨","title":"[^"]*","route":"[^"]*","witness":")و١/, "$1و٣")],
  ["رمزُ جلسةٍ داخليّةٍ يعود إلى نسخة نبراس", "rag",
    (s) => s.replace("سجل الإحالات الخارجية", "سجل الإحالات الخارجية (خ٦/ج)")],
  ["تحريفُ رقمٍ في مصدر العرض (يخالف المختومة)", "doc",
    (s) => s.replace("٢٤٢ رواية في ٥٠ كتابًا", "٢٤٢ رواية في ٥١ كتابًا")],
  ["تبديلُ درجةٍ في مصدر العرض", "doc",
    (s) => s.replace("**الحكم: محتمل.**", "**الحكم: راجح بالتقاطع.**")],
];

const run = () => {
  try {
    execFileSync("node", [join(ROOT, "js", "scripts", "check-tarikh.mjs")],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, fails: 0 };
  } catch {
    const rep = JSON.parse(read(join(SRC, "GATE.json")));
    return { ok: false, fails: rep.failures.length };
  }
};

let escaped = 0;
console.log("• الضبطُ السالب — تحريفاتٌ مزروعةٌ واحدةً واحدة:\n");
for (const [name, key, mutate] of PLANTS) {
  restore();
  const before = read(P[key]);
  const after = mutate(before);
  if (after === before) { console.log(`  ! ${name}: لم يقع الزرعُ أصلًا — يُراجَع`); escaped++; continue; }
  writeFileSync(P[key], after);
  const r = run();
  console.log(`  ${r.ok ? "✗" : "✓"} ${name}: ${r.ok ? "أفلت" : `التُقط (${r.fails} مخالفة)`}`);
  if (r.ok) escaped++;
}
restore();
const clean = run();
console.log(`\n  ${clean.ok ? "✓" : "✗"} بعد الإعادة: ${clean.ok ? "البوّابةُ خضراء" : `حمراء (${clean.fails} مخالفة)`}`);
const ok = escaped === 0 && clean.ok;
writeFileSync(join(SRC, "GATE-NEGATIVE.json"), JSON.stringify({
  ok, planted: PLANTS.length, caught: PLANTS.length - escaped, escaped,
  plants: PLANTS.map(([n]) => n), cleanAfter: clean.ok,
}, null, 2));
console.log(`${ok ? "✓" : "✗"} الضبطُ السالب: ${PLANTS.length - escaped}/${PLANTS.length} التُقطت`);
process.exit(ok ? 0 : 1);

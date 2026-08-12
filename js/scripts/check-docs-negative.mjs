/**
 * الضبطُ السالب لبوّابتَي هذه الصيانة — **بوّابةٌ لم تُجرَّب بعيبٍ مزروعٍ
 * ليست بوّابة.**
 *
 * يزرع عيوبًا واحدًا واحدًا في قسم التوثيق الجديد (بالعربيّة والإنجليزيّة)
 * وفي نصّ الاستحقاق المنقول، ويشغّل بوّابتَه بعد كلِّ زرع، ويشترط أن تلتقطه؛
 * ثمّ يعيد كلَّ شيءٍ إلى أصله ويثبت أنّ البوّابتين عادتا خضراوين. كلُّ زرعٍ
 * يُكتب ويُمحى في هذه الجلسة — ولا يُودَع منه شيء.
 *
 * ولكلِّ نمطِ منعٍ **عيّنتان**: مفصولةٌ بفراغ، وملتصقةٌ بحرفٍ عربيّ — فالحدُّ
 * `\b` لا يعرف العربيّة، والملتصقةُ هي التي تفضح البوّابةَ المتساهلة
 * (بلاغ 2026-08-12-arabic-word-boundary).
 *
 * التشغيل: node js/scripts/check-docs-negative.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GATES = join(ROOT, "js", "data", "gates");
mkdirSync(GATES, { recursive: true });

const P = {
  ar: join(ROOT, "js", "apps", "studio", "src", "docsContent.ts"),
  en: join(ROOT, "js", "apps", "studio", "public", "docs-en.json"),
  wf: join(ROOT, "WORLD-FIRSTS.md"),
};
const GATE = {
  docs: join(ROOT, "js", "scripts", "check-docs-sections.mjs"),
  wf: join(ROOT, "js", "scripts", "check-world-firsts.mjs"),
};

const read = (p) => readFileSync(p, "utf8");
const backup = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, read(p)]));
const restore = () => { for (const [k, p] of Object.entries(P)) writeFileSync(p, backup[k]); };

/** موضعُ الزرع في العربيّة: داخلَ حقلِ «كيف أُنجز» من القسم الجديد */
const AR_ANCHOR = "ونقرتان تكفيان للتحقّق";
const EN_ANCHOR = "Two clicks suffice to verify";

/** العيوبُ المزروعة: [اسمُها، ملفُّها، بوّابتُها، دالّةُ الزرع] */
const PLANTS = [
  // ——— رمزُ جلسة: مفصولٌ وملتصقٌ بحرفٍ عربيّ ———
  ["رمزُ جلسةٍ مفصولٌ بفراغ (عربيّ)", "ar", "docs",
    (s) => s.replace(AR_ANCHOR, `وهذا من عمل خ٧. ${AR_ANCHOR}`)],
  ["رمزُ جلسةٍ **ملتصقٌ بحرفٍ عربيّ** (عربيّ)", "ar", "docs",
    (s) => s.replace(AR_ANCHOR, `وهذا بخ٧ من عملنا. ${AR_ANCHOR}`)],
  ["رمزُ جلسةٍ ملتصقٌ بآخر كلمةٍ بلا فاصل (عربيّ)", "ar", "docs",
    (s) => s.replace(AR_ANCHOR, `أنجزتها الجلسةخ٧ كاملةً. ${AR_ANCHOR}`)],
  ["رمزُ جلسةٍ برقمٍ لاتينيّ (عربيّ)", "ar", "docs",
    (s) => s.replace(AR_ANCHOR, `في الموجة م2 من العمل. ${AR_ANCHOR}`)],
  // ——— اسمُ نموذج ———
  ["اسمُ نموذجٍ بالعربيّة", "ar", "docs",
    (s) => s.replace(AR_ANCHOR, `كتبها أوبوس ٥. ${AR_ANCHOR}`)],
  ["اسمُ نموذجٍ باللاتينيّة (إنجليزيّ)", "en", "docs",
    (s) => s.replace(EN_ANCHOR, `Produced with Claude. ${EN_ANCHOR}`)],
  // ——— مسارُ ملفٍّ داخليّ ———
  ["مسارُ ملفٍّ داخليٍّ (عربيّ)", "ar", "docs",
    (s) => s.replace(AR_ANCHOR, `والتفصيلُ في findings/FAHIS-PLAN.md. ${AR_ANCHOR}`)],
  ["امتدادُ ملفٍّ داخليٍّ (إنجليزيّ)", "en", "docs",
    (s) => s.replace(EN_ANCHOR, `See HUKM-JAMC-v1.1.md for details. ${EN_ANCHOR}`)],
  // ——— التنبيهُ الثابت ———
  ["إسقاطُ التنبيه الثابت من صدر القسم", "ar", "docs",
    (s) => s.replace("وليس تنقيحًا لنصِّ القرآن — ", "")],
  ["تأخيرُ التنبيه الثابت عن صدر القسم (إنجليزيّ)", "en", "docs",
    (s) => s.replace("it is not a revision of the text of the Qurʾān", "it presents dated material evidence")],
  // ——— لسانُ الأقوال ———
  ["عودةُ لسان «الدعاوى» إلى القسم", "ar", "docs",
    (s) => s.replace("ثمانيةُ أقوالٍ في كيف وصل إلينا المصحف", "الدعاوى الثماني في كيف وصل إلينا المصحف")],
  ["إسقاطُ لسان «قولٌ يُوزن»", "ar", "docs",
    (s) => s.replace("«قولٌ يُوزن» لا دعوى تُلصَق بصاحبها", "بحثٌ محرَّرٌ لا يُلصَق بصاحبه")],
  // ——— تطابقُ اللسانين ———
  ["إسقاطُ القسم من التوثيق الإنجليزيّ", "en", "docs",
    (s) => { const d = JSON.parse(s); d.sections = d.sections.filter((x) => x.id !== "tarikh"); return JSON.stringify(d, null, 1); }],
  ["إزاحةُ ترتيب القسم بين اللسانين", "en", "docs",
    (s) => { const d = JSON.parse(s); const i = d.sections.findIndex((x) => x.id === "tarikh"); const [x] = d.sections.splice(i, 1); d.sections.unshift(x); return JSON.stringify(d, null, 1); }],
  // ——— حرفيّةُ النقل ———
  ["تحريفُ حرفٍ واحدٍ في النصّ المنقول", "wf", "wf",
    (s) => s.replace("مدوّنة ١٦٨٣ رواية", "مدوّنة ١٦٨٤ رواية")],
  ["حذفُ جملةٍ من النصّ المنقول", "wf", "wf",
    (s) => s.replace(" المعايرة موثقة بمعيار نجاح مختوم قبل التشغيل في plan/HOLDOUT-MOTZKI.md.", "")],
  ["زيادةُ تحريرٍ فوق النصّ المنقول", "wf", "wf",
    (s) => s.replace("(الزهري مدارَ حزمة الأحرف السبعة بمعيار الفروع المعتضدة)", "(الزهري مدارَ حزمة الأحرف السبعة — وهي نتيجةٌ قاطعة)")],
  ["إسقاطُ سطر السياق (موضعُ الدليل)", "wf", "wf",
    (s) => s.replace("`plan/HOLDOUT-MOTZKI.md` (§٧ المعيار · §٨ إعادة الفحص · §١٠ الإغلاق).", "الوثيقةِ المختومة.")],
  ["إسقاطُ تاريخ الإغلاق من سطر السياق", "wf", "wf",
    (s) => s.replace("السياق: أُغلق المحكُّ في ٣ آب ٢٠٢٦،", "السياق: أُغلق المحكُّ،")],
];

const run = (which) => {
  try {
    execFileSync("node", [GATE[which]], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, fails: 0 };
  } catch {
    const rep = JSON.parse(read(join(GATES, which === "docs" ? "GATE-DOCS.json" : "GATE-WORLD-FIRSTS.json")));
    return { ok: false, fails: rep.failures.length };
  }
};

let escaped = 0;
const rows = [];
console.log("• الضبطُ السالب — عيوبٌ مزروعةٌ واحدًا واحدًا:\n");
for (const [name, key, gate, mutate] of PLANTS) {
  restore();
  const before = read(P[key]);
  const after = mutate(before);
  if (after === before) { console.log(`  ! ${name}: لم يقع الزرعُ أصلًا — يُراجَع`); escaped++; rows.push({ name, gate, planted: false, caught: false }); continue; }
  writeFileSync(P[key], after);
  const r = run(gate);
  console.log(`  ${r.ok ? "✗" : "✓"} ${name}: ${r.ok ? "أفلت" : `التُقط (${r.fails} مخالفة)`}`);
  if (r.ok) escaped++;
  rows.push({ name, gate, planted: true, caught: !r.ok, failures: r.fails });
}
restore();
const clean = { docs: run("docs"), wf: run("wf") };
console.log(`\n  ${clean.docs.ok ? "✓" : "✗"} بعد الإعادة — بوّابةُ التوثيق: ${clean.docs.ok ? "خضراء" : `حمراء (${clean.docs.fails})`}`);
console.log(`  ${clean.wf.ok ? "✓" : "✗"} بعد الإعادة — بوّابةُ حرفيّة النقل: ${clean.wf.ok ? "خضراء" : `حمراء (${clean.wf.fails})`}`);

const okAll = escaped === 0 && clean.docs.ok && clean.wf.ok;
writeFileSync(join(GATES, "GATE-DOCS-NEGATIVE.json"), JSON.stringify({
  ok: okAll, planted: PLANTS.length, caught: PLANTS.length - escaped, escaped,
  cleanAfter: { docs: clean.docs.ok, worldFirsts: clean.wf.ok }, plants: rows,
}, null, 2));
console.log(`${okAll ? "✓" : "✗"} الضبطُ السالب: ${PLANTS.length - escaped}/${PLANTS.length} التُقطت`);
process.exit(okAll ? 0 : 1);

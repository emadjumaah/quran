/**
 * الضبطُ السالب لبوّابة «التتبّع بالصوت» — **بوّابةٌ لم تُجرَّب بعيبٍ مزروعٍ
 * ليست بوّابة.**
 *
 * يزرع عيوبًا واحدًا واحدًا في شيفرة المسبار (وفي محلِّل العربيّة الذي تجتزئ
 * منه البوّابةُ مطبِّعَها)، ويشغّل `check-tatabbu.mjs` بعد كلٍّ منها، ويشترط
 * أن تلتقطه البوّابةُ **بالفحص المقصود بعينه** لا بأيِّ فحصٍ اتّفق؛ ثمّ يعيد
 * كلَّ شيءٍ إلى أصله ويثبت أنّها عادت خضراء. وكلُّ زرعٍ يُكتب ويُمحى في هذه
 * الجلسة — ولا يُودَع منه شيء.
 *
 * **ونصُّ الآية المزروعُ يُجلب من القاعدة لا يُكتب بيد** — كي لا يكون في
 * سكربتاتنا حرفُ قرآنٍ مكتوبٌ بيدٍ ولو في فخٍّ للاختبار.
 *
 * التشغيل: node js/scripts/check-tatabbu-negative.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** شيفرةُ المسبار ومحلِّلُ العربيّة في الحزمة المشتركة منذ التقسيم الصامت (ف١) */
const SAWT = join(ROOT, "js", "packages", "quran-core", "src", "lib", "sawt");
const GATE = join(ROOT, "js", "scripts", "check-tatabbu.mjs");
const REPORT = join(ROOT, "js", "data", "gates", "TATABBU.json");

const P = {
  align: join(SAWT, "align.ts"),
  script: join(SAWT, "script.ts"),
  view: join(ROOT, "js", "apps", "studio", "src", "views", "Tatabbu.tsx"),
  engines: join(SAWT, "engines.ts"),
  analyzer: join(ROOT, "js", "packages", "quran-core", "src", "lib", "arabicSearch.ts"),
};

const read = (p) => readFileSync(p, "utf8");
const backup = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, read(p)]));
const restore = () => {
  for (const [k, p] of Object.entries(P)) writeFileSync(p, backup[k]);
};

/** ثلاثُ كلماتٍ متتاليةٍ من آيةٍ — تُجلب من القاعدة، ولا تُكتب بيد */
function trigramFromDb() {
  const db = new DatabaseSync(join(ROOT, "quran-app.db"), { readOnly: true });
  const rows = db
    // من آيةٍ واحدةٍ بترتيب كلماتها — فرقمُ الكلمة يُعاد في كلِّ آية، ولو
    // رُتّب على السورة كلِّها لجاءت كلماتُ أوائلِ آياتٍ شتّى لا ثلاثةٌ متتالية.
    .prepare("select data from words where surahNo = 112 and ayahNo = 1 order by wordNo limit 3")
    .all()
    .map((r) => JSON.parse(r.data).textUthmani);
  return rows.join(" ");
}

/** [اسمُ العيب، الملفُّ، دالّةُ الزرع، الفحصُ المنتظر أو رسالةُ نقصٍ منتظرة] */
const PLANTS = [
  [
    "نصُّ آيةٍ مكتوبًا في الصفحة",
    "view",
    (s) => s.replace("<h1 className=\"sawt-h1\">التتبّع</h1>", `<h1 className="sawt-h1">${trigramFromDb()}</h1>`),
    { check: "قرآنٌ في الشيفرة" },
  ],
  [
    "تحويلٌ على الرسم قبل العرض",
    "script",
    (s) => s.replace("text: w.textUthmani,", "text: w.textUthmani.trim(),"),
    { check: "حرفيّةُ المعروض" },
  ],
  [
    "تحويلٌ في موضع عرض الكلمة",
    "view",
    // صار البياضُ خارجَ وسم الكلمة (ص-م٣ §٥ج) فيُزرع على الصورة الجديدة
    (s) => s.replace("{w.text}", "{w.text.replace(\"a\", \"b\")}"),
    { check: "حرفيّةُ المعروض" },
  ],
  [
    "مطبِّعٌ ثانٍ يُنشأ في المحرّك",
    "align",
    (s) => s.replace("export const speechTokens", "const strip = (t) => t.replace(/[ً-ٰ]/g, \"\");\nexport const speechTokens"),
    { check: "مُطبِّعٌ ثانٍ" },
  ],
  [
    "قطعُ مصدر النصّ من القاعدة",
    "script",
    (s) => s.replace(/textUthmani/g, "textPlain"),
    { missing: "textUthmani" },
  ],
  [
    "قطعُ استيراد المطبِّع الواحد",
    "align",
    (s) => s.replace('import { normalizeAr, stemAr } from "../arabicSearch";', 'import { stemAr } from "../arabicSearch";\nconst normalizeAr = (x) => x;'),
    { missing: "المطبِّع" },
  ],
  [
    "تبديلُ اسم المطبِّع في مصدره الحيّ",
    "analyzer",
    (s) => s.replace("export function normalizeAr(s: string): string {", "export function normalizeArabic(s: string): string {"),
    { missing: "normalizeAr" },
  ],
  // ═══ زياداتُ ص-م٢: الاختيارُ صار على المصحف كلِّه، والتحميلُ بنافذة ═══
  [
    "ثغرةٌ في اختيار المصحف كلِّه",
    "script",
    // «المصحفُ كلُّه» يُسقط سورةً واحدة — وهي ثغرةٌ لا تُرى بالعين ولا يُنبّه
    // عليها شيءٌ في الصفحة: تُفتح الختمةُ فتنتهي دون آخرها.
    (s) => s.replace("    case \"mushaf\":\n      return true;", "    case \"mushaf\":\n      return a.surahNo !== 114;"),
    { check: "الاختيارُ يبلغ المصحف" },
  ],
  [
    "ثغرةٌ في الاختيار بالصفحة",
    "script",
    (s) => s.replace("      return a.page === spec.page;", "      return a.page === spec.page && a.ayahNo !== 1;"),
    { check: "الاختيارُ يبلغ المصحف" },
  ],
  [
    "تبديلُ اسم شرط الانتماء في مصدره الحيّ",
    "script",
    (s) => s.replace("export function inSegment(spec: SegmentSpec, a: AyahRef): boolean {", "export function inPart(spec: SegmentSpec, a: AyahRef): boolean {"),
    { missing: "inSegment" },
  ],
  [
    "مدًى يُظنّ متّصلًا حيث لا اتّصال",
    "script",
    // استعلامُ النافذة مقيَّدٌ **بسورةٍ واحدةٍ وحدَّي رقمِ آية**. فلو ظُنّ
    // الاتّصالُ حيث لا اتّصال، جاء الاستعلامُ ببعض المدى وسقط سائرُه — **ونقص
    // من نصّ المقطع ما لا يُرى نقصُه**، وهذا أخطرُ ما في التحميل بالنوافذ.
    (s) => s.replace("  return next.surahNo === prev.surahNo && next.ayahNo === prev.ayahNo + 1 && taken < MAX_RUN_AYAHS;", "  return taken < MAX_RUN_AYAHS;"),
    { check: "حرفيّةُ المقطع" },
  ],
  [
    "دعوى أنّ الصفحة تعمل بلا إنترنت",
    "view",
    (s) => s.replace("تتلو، فيجري المؤشّرُ مع صوتك في المصحف.", "تتلو، فيجري المؤشّرُ مع صوتك في المصحف بلا إنترنت."),
    { check: "دعوى استقلالٍ عن الشبكة" },
  ],
  [
    "دعوى أنّ الصوت لا يغادر الجهاز",
    "view",
    (s) => s.replace("ولا نحفظ نحن صوتًا، ولا نخزّنه", "وصوتُك لا يغادر الجهاز، ولا نحفظ نحن صوتًا، ولا نخزّنه"),
    { check: "دعوى استقلالٍ عن الشبكة" },
  ],
  [
    // صار موضعُ الإعلان `engines.ts` منذ ص-م٣: السطرُ يُكتب مع محرّكه، والصفحةُ
    // تعرضه. فيُزرع النزعُ حيث صار لا حيث كان.
    "نزعُ الإعلان من وصف المحرّك",
    "engines",
    (s) => s.replace("يرسل صوتَك إلى خادم صانع المتصفّح", "محرّكٌ للتجربة"),
    { missing: "الإعلانُ الصريح" },
  ],
  [
    "نزعُ سطر المحرّك من الإعلان قبل الميكروفون",
    "view",
    (s) => s.replace("{engine?.privacyLine}", "{null}"),
    { missing: "سطرَ صدق المحرّك" },
  ],
  [
    "تبديلُ اسم قاعدة اتّصال المدى",
    "script",
    (s) => s.replace("export function joinsRun(prev: AyahRef, next: AyahRef, taken: number): boolean {", "export function joinsSpan(prev: AyahRef, next: AyahRef, taken: number): boolean {"),
    { missing: "joinsRun" },
  ],
];

/** تشغيلُ البوّابة وقراءةُ تقريرها */
function runGate() {
  let out = "";
  try {
    out = execFileSync("node", [GATE], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out, report: JSON.parse(read(REPORT)) };
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    let report = null;
    try {
      report = JSON.parse(read(REPORT));
    } catch {
      report = null;
    }
    return { ok: false, out, report };
  }
}

const results = [];
let caught = 0;

for (const [name, key, mutate, want] of PLANTS) {
  const before = read(P[key]);
  const after = mutate(before);
  if (after === before) {
    results.push({ name, verdict: "لم يقع الزرعُ أصلًا — تغيّر موضعُه في المصدر" });
    continue;
  }
  writeFileSync(P[key], after);
  const { ok, report } = runGate();
  restore();

  const hitCheck =
    want.check && report ? report.failures.some((f) => f.check === want.check) : false;
  const hitMissing =
    want.missing && report ? report.missing.some((m) => m.includes(want.missing)) : false;
  const good = !ok && (hitCheck || hitMissing);
  if (good) caught++;
  results.push({
    name,
    verdict: good ? "التُقط" : ok ? "أفلت — مرّت البوّابةُ خضراء" : "سقطت لكن بغير فحصها المقصود",
  });
}

// وبعد كلِّ زرعٍ ومحوٍ: تعود البوّابةُ خضراءَ على الأصل — وإلّا فقد بقي أثرٌ
const final = runGate();
restore();

console.log(`الضبطُ السالب لبوّابة التتبّع: ${caught}/${PLANTS.length} التُقطت`);
for (const r of results) console.log(`  ${r.verdict === "التُقط" ? "✓" : "✗"} ${r.name} — ${r.verdict}`);
console.log(`  ${final.ok ? "✓" : "✗"} عودةُ البوّابة خضراءَ بعد المحو`);
if (caught !== PLANTS.length || !final.ok) process.exitCode = 1;

/** أصولُ القرآن المشتركةُ إلى `public` — مصدرُها `@mishkat/quran-assets` وحدَه،
 *  وما ههنا مولَّدٌ في كلّ بناءٍ لا مُودَعٌ (ف١). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AMIRI_QURAN, MUSHAF_TEXT, copyAssets, copyShared } from "@mishkat/quran-assets";
import { copyOrt } from "@mishkat/quran-core/ort-assets";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "public");
fs.mkdirSync(PUB, { recursive: true });

/* المشتركُ بين التطبيقين، **ونصُّ المصحف وخطُّه معهما**: التلاوةُ تقرأ رسمَها
   وحدودَ صفحاتها من الملفّ (ف٢ §٢) وترسمه بأميري (رخصتُه الثابتة)؛ ومشكاةُ
   تقرأ من قاعدتها وتأخذ أميري من حزمته، فلا يُنسخ إليها منهما شيء. */
const rows = [...copyShared(PUB), ...copyAssets(PUB, [...MUSHAF_TEXT, ...AMIRI_QURAN])];
const kb = (n) => (n / 1024).toFixed(0);
console.log(
  `shared assets → public/ : ${rows.map((r) => `${r.file} ${kb(r.bytes)}KB${r.copied ? " (copied)" : ""}`).join(", ")}`,
);

/** **أيقونةُ التطبيق وأحجامُها** (م٣ §١) — مُودَعةٌ في `icons/` من جذر التطبيق
 *  لا في `public` (وهو مولَّدٌ بالتجاهل)، وتُنسخ إليه في كلّ بناءٍ كسائر الأصول.
 *  والأصلُ SVG مكتوبٌ بأيدينا، والنقطيّاتُ مشتقّةٌ منه بـ`make-tilawa-icons.mjs`. */
/* **ولا تُشحن `icon-maskable.svg`**: هي أصلُ رسمٍ تُشتقّ منه النقطيّتان
   المقنَّعةُ وأيقونةُ آبل، ولا يطلبها متصفّحٌ ولا نظام — فتبقى في المستودع
   ولا تدخل التخزينَ المسبَق. */
const icons = fs
  .readdirSync(path.join(HERE, "icons"))
  .filter((f) => f !== "icon-maskable.svg")
  .sort();
for (const f of icons) fs.copyFileSync(path.join(HERE, "icons", f), path.join(PUB, f));
console.log(`icons → public/ : ${icons.join(", ")}`);

/* **عُدّةُ تشغيل المحرّك الحرّ — من الرزمة المثبَّتة إلى أصلنا** (ف٣ §٢):
   السكربتُ نفسُه الذي تنسخ به مشكاة (`ort-assets.mjs` في الحزمة)، والمقصدُ
   `public/ort/` — يجدها العاملُ على `/ort/` كما هي مكتوبةٌ في `asrWorker.ts`
   بلا تعديلِ حرف. **وما نشحنه نحن لا ما نرجوه في شبكة طرفٍ ثالث.** */
const ort = copyOrt(PUB);
const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(
  `ort runtime → public/ort/ : ${ort.map((r) => `${r.file} ${mb(r.bytes)}MB${r.copied ? " (copied)" : ""}`).join(", ")}`,
);

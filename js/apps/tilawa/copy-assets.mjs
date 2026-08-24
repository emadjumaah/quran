/** أصولُ القرآن المشتركةُ إلى `public` — مصدرُها `@mishkat/quran-assets` وحدَه،
 *  وما ههنا مولَّدٌ في كلّ بناءٍ لا مُودَعٌ (ف١). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AMIRI_QURAN, MUSHAF_TEXT, copyAssets, copyShared } from "@mishkat/quran-assets";

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

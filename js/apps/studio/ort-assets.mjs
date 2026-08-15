/**
 * **عُدّةُ تشغيل المحرّك الحرّ — تُشحن من أصلنا** (ص٣ §١أ).
 *
 * `transformers.js` — ما لم يُحدَّد غيرُه — يجلب عُدّةَ التشغيل
 * (`ort-wasm-simd-threaded*.mjs/.wasm`) من **شبكة طرفٍ ثالث** (jsdelivr).
 * وتعذُّرُ جلبِها عطبٌ صامت: لا يظهر في تنزيل النموذج ولا في الميكروفون، فيرى
 * صاحبُ الهاتف محرّكًا «لا يعمل إطلاقًا» بلا سبب. **وقاعدتُنا: ما نشحنه نحن، لا
 * ما نرجو أن يكون في الشبكة** — وبها يصير الباب بلا إنترنت حقًّا.
 *
 * فهذا الملفُّ **مصدرُ الحقيقة الواحد** لأسماء العُدّة ومواضعها: ينسخُها البناءُ
 * إلى `public/ort/`، وتقيسها بوّابةُ `check-sawt-engine` بالتجزئة نفسِها.
 *
 * **والأسماءُ مقروءةٌ من الرزمة المثبَّتة لا مظنونة**: `onnxruntime-web` يُصدّر
 * كلَّ ملفٍّ منها مسارًا في `exports`، فتُحلّ بالمُحلِّل نفسِه الذي يحلّها به
 * المتصفّح — فإن رقّت الرزمةُ أو بدّلت أسماءَها انكسر البناءُ صائحًا، ولم
 * تشِخْ نسخةٌ يدويّةٌ في صمت.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** مجلَّدُ العُدّة في الأصل — يدخل `.gitignore`: مصدرُه الرزمةُ لا المستودع */
export const ORT_DIR = path.join(HERE, "public", "ort");

/** مسارُ العُدّة على الشبكة كما يطلبه العامل — رمزٌ واحدٌ ههنا وفي `asrWorker.ts` */
export const ORT_BASE = "/ort/";

/**
 * **الأربعةُ المشحونة** — زوجان، لكلّ زوجٍ صيغتُه الجافا والثنائيّةُ التي
 * تُقرَن بها (لا يُخلط زوجٌ بزوج):
 *
 * - `ort-wasm-simd-threaded.*` — ما تختاره الرزمةُ **لسفاري** (وهاتفُ المالك منها).
 * - `ort-wasm-simd-threaded.asyncify.*` — ما تختاره **لسائر المتصفّحات**.
 *
 * ونحن **لا نُبدّل اختيارَها** — نُبدّل أصلَ الجلب وحدَه؛ فيلزم شحنُ الزوجين.
 */
export const ORT_FILES = [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

/** موضعُ الملفّ في الرزمة المثبَّتة — يُحلّ من `exports` الرزمة نفسِها */
export function ortSource(file) {
  const req = createRequire(path.join(HERE, "ort-assets.mjs"));
  const entry = req.resolve("@huggingface/transformers");
  return createRequire(entry).resolve(`onnxruntime-web/${file}`);
}

export const sha256 = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 16);

/**
 * ينسخ ما تغيّر حجمُه أو غاب — فالنسخُ يجري في كلّ بناءٍ ولا يُعيد ٣٦ م.ب بلا
 * موجب. (والمطابقةُ بالتجزئة على البوّابة لا على البناء.)
 */
export function copyOrt() {
  fs.mkdirSync(ORT_DIR, { recursive: true });
  const rows = [];
  for (const file of ORT_FILES) {
    const src = ortSource(file);
    const dst = path.join(ORT_DIR, file);
    const bytes = fs.statSync(src).size;
    const fresh = fs.existsSync(dst) && fs.statSync(dst).size === bytes;
    if (!fresh) fs.copyFileSync(src, dst);
    rows.push({ file, bytes, copied: !fresh });
  }
  return rows;
}

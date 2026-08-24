/**
 * **الأصولُ المشتركةُ بين التطبيقين — تُودَع مرّةً وتُنسخ عند البناء.**
 *
 * خطُّ المصحف وبياناتُه العامّةُ مادّةٌ واحدةٌ بين «التلاوة» و«مشكاة»؛ ونسختان
 * تتباعدان بصمتٍ ما لا يُحتمل ههنا. فالمُودَعُ في `assets/` أصلٌ واحد، وما في
 * `public/` كلِّ تطبيقٍ **منسوخٌ عنه في كلّ بناء** — ولذلك يدخل `.gitignore`.
 *
 * وهو نمطُ عُدّة المحرّك نفسُه (`ort-assets.mjs`): يُنسخ ما غاب أو تبدّل حجمُه،
 * فلا يُعاد نسخُ ما لم يتغيّر في كلّ بناء.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** مجلَّدُ الأصل — المُودَعُ في المستودع */
export const ASSETS_DIR = path.join(HERE, "assets");

/**
 * **الجردُ المشترك** — مسارُ كلِّ أصلٍ نسبيًّا إلى جذر `public`، فيُنسخ إلى
 * موضعه نفسِه عند كلِّ تطبيق ويبقى عنوانُه على الشبكة كما كان.
 */
export const SHARED_ASSETS = [
  "fonts/kfgqpc-hafs.woff2",
  "fonts/scheherazade.woff2",
  "furuq.json",
  "audio-manifest.json",
];

/**
 * **نصُّ المصحف — أصلٌ مُودَعٌ ههنا، ولا يُشحن إلّا لمن يقرأ منه.**
 *
 * مُخرَجُ `js/scripts/export-mushaf-text.mjs` من `quran-app.db` نفسِها: رسمُ
 * الآي وحدودُ المصحف. **تستهلكه التلاوةُ وحدَها** — فمشكاةُ تفتح القاعدةَ نفسَها
 * فتقرأ منها، ونسخُه إلى `public` عندها يزيد في تخزينها المسبَق ميغابايتًا
 * ونصفًا من نصٍّ تملكه. **والمصدرُ واحدٌ على الحالين**: هذا الملفُّ مولَّدٌ من
 * تلك القاعدة، لا مكتوبٌ ثانيةً بيد.
 */
export const MUSHAF_TEXT = ["mushaf-text.json"];

/** موضعُ الأصل في الحزمة — به تقرأ السكربتاتُ والبوّاباتُ المصدرَ لا المنسوخ */
export const assetPath = (rel) => path.join(ASSETS_DIR, rel);

/**
 * ينسخ جردًا بعينه إلى `public` تطبيقٍ بعينه.
 * @param {string} destPublic مجلَّدُ `public` عند التطبيق المستهلك
 * @param {string[]} list الجردُ المنسوخ
 * @returns {{file: string, bytes: number, copied: boolean}[]}
 */
export function copyAssets(destPublic, list) {
  const rows = [];
  for (const rel of list) {
    const src = assetPath(rel);
    const dst = path.join(destPublic, rel);
    const bytes = fs.statSync(src).size;
    const fresh = fs.existsSync(dst) && fs.statSync(dst).size === bytes;
    if (!fresh) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    rows.push({ file: rel, bytes, copied: !fresh });
  }
  return rows;
}

/** ينسخ الأصولَ المشتركةَ بين التطبيقين (وهي ما يستهلكه كلاهما) */
export const copyShared = (destPublic) => copyAssets(destPublic, SHARED_ASSETS);

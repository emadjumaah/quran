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

/** موضعُ الأصل في الحزمة — به تقرأ السكربتاتُ والبوّاباتُ المصدرَ لا المنسوخ */
export const assetPath = (rel) => path.join(ASSETS_DIR, rel);

/**
 * ينسخ الأصولَ المشتركةَ إلى `public` تطبيقٍ بعينه.
 * @param {string} destPublic مجلَّدُ `public` عند التطبيق المستهلك
 * @returns {{file: string, bytes: number, copied: boolean}[]}
 */
export function copyShared(destPublic) {
  const rows = [];
  for (const rel of SHARED_ASSETS) {
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

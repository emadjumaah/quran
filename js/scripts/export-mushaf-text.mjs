/**
 * **نصُّ المصحف إلى الأصول المشتركة** — مصدرٌ واحدٌ يقرأ منه التطبيقان.
 *
 * ## لِمَ هذا السكربت أصلًا
 * نصُّ المصحف في مشكاة داخلَ `quran-app.db` (monlite على SQLite، ٥٥ م.ب)،
 * وتفتحه هناك رزمةُ WASM. **والتلاوةُ لا تحتمل ذلك**: تطبيقُ عبادةٍ يوميّةٍ
 * يُفتح فيُقرأ، لا يجرّ محرّكَ قاعدةٍ لأجل نصٍّ لا يتغيّر. فيُصدَّر النصُّ
 * **من مصدر مشكاة نفسِه** إلى `quran-assets` مرّةً، **فيبقى المصدرُ واحدًا**
 * والقارئان يقرآن حرفًا واحدًا.
 *
 * ## وما يُشحن هو ما يُقرأ ولا يزيد (ف٢ §٢)
 * رسمُ الآي العثمانيُّ بترتيب المصحف · وحدودُ الصفحات والأجزاء والأرباع
 * **بمطالعها لا برقمٍ مكرَّرٍ لكلّ آية** · ومواضعُ السجدات · وبياناتُ لوحة
 * السورة. **ولا ترجمةَ ولا كلماتٍ ولا صرفَ ولا جذورًا** — تلك مادّةُ البحث في
 * مشكاة، لا مادّةُ التلاوة.
 *
 * وعددُ آي كلّ سورةٍ **لا يُكتب ههنا**: هو في `mushafIndex` من الحزمة نفسِها،
 * ولا يُكتب جدولٌ مرّتين فينحرف أحدُهما.
 *
 * ## قيدُ الآلة
 * القرصُ الخارجيُّ (`/Volumes/data`) **ينهار على القراءة العشوائيّة**، وقواعدُ
 * SQLite لا تُفتح عليه. فتُنسخ القاعدةُ إلى القرص الداخليّ نسخًا متتابعًا، ثمّ
 * تُقرأ هناك، ثمّ تُمحى النسخة.
 *
 * التشغيل: node js/scripts/export-mushaf-text.mjs
 *          → js/packages/quran-assets/assets/mushaf-text.json
 */
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DB = join(ROOT, "js", "apps", "studio", "public", "quran-app.db");
const OUT = join(ROOT, "js", "packages", "quran-assets", "assets", "mushaf-text.json");

const tmp = mkdtempSync(join(tmpdir(), "mushaf-text-"));
const local = join(tmp, "quran-app.db");
copyFileSync(DB, local);

let payload;
try {
  const db = new DatabaseSync(local, { readOnly: true });

  /** الآياتُ بترتيب المصحف — ومعرّفُها العامُّ `a<id>` هو الترتيبُ نفسُه */
  const ayahs = db
    .prepare("SELECT _id, data FROM ayahs")
    .all()
    .map((r) => ({ id: Number(r._id.slice(1)), ...JSON.parse(r.data) }))
    .sort((a, b) => a.id - b.id);

  if (ayahs.length !== 6236) throw new Error(`عددُ الآي ${ayahs.length} لا ٦٢٣٦`);
  ayahs.forEach((a, i) => {
    if (a.id !== i + 1) throw new Error(`انقطاعُ الترقيم عند ${a.location}`);
  });

  /** مطالعُ الوحدات: أوّلُ آيةٍ (بالرقم العامّ) في كلِّ صفحةٍ وجزءٍ وربع.
   *  والوحداتُ متصاعدةٌ لا تتراجع، **ويُتحقَّق من ذلك** فلا يُبنى فهرسٌ على ظنّ. */
  const startsOf = (key, expect) => {
    const starts = [];
    let prev = 0;
    for (const a of ayahs) {
      const v = a[key];
      if (v < prev) throw new Error(`«${key}» تراجع عند ${a.location}: ${v} بعد ${prev}`);
      while (starts.length < v) starts.push(a.id);
      prev = v;
    }
    if (starts.length !== expect) throw new Error(`«${key}» ${starts.length} لا ${expect}`);
    return starts;
  };

  const surahs = db
    .prepare("SELECT surahNo, nameAr, revelation, chronoOrder, data FROM surahs ORDER BY surahNo")
    .all()
    .map((s) => [
      s.nameAr,
      s.revelation === "Meccan" ? 1 : 0,
      s.chronoOrder,
      JSON.parse(s.data).hasBismillah ? 1 : 0,
    ]);
  if (surahs.length !== 114) throw new Error(`عددُ السور ${surahs.length} لا ١١٤`);

  payload = {
    tag: "منقول",
    by: "js/scripts/export-mushaf-text.mjs",
    source: "quran-app.db — قاعدةُ مشكاة نفسُها، لا نسخةٌ ثانيةٌ من مصدرٍ آخر",
    note: "الرسمُ العثمانيُّ وحدودُ المصحف؛ ولا ترجمةَ ولا مفرداتٍ ولا صرف.",
    ayat: ayahs.length,
    /** [اسمُها · مكّيّةٌ(١)/مدنيّة(٠) · ترتيبُ نزولها · أفيها بسملةٌ تُكتب] */
    surahs,
    /** رسمُ الآي بترتيب المصحف — الفهرسُ هو الرقمُ العامُّ ناقصَ واحد */
    text: ayahs.map((a) => a.textUthmani),
    pageStart: startsOf("page", 604),
    juzStart: startsOf("juz", 30),
    /** الأرباعُ ٢٤٠ — والحزبُ منها `ceil(rub / 4)` فلا يُكتب مرّتين */
    rubStart: startsOf("rub", 240),
    /** [الرقمُ العامُّ · نوعُها] — ۩ تُرسم عندها */
    sajda: ayahs.filter((a) => a.sajdaType).map((a) => [a.id, a.sajdaType]),
  };
  db.close();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

writeFileSync(OUT, JSON.stringify(payload));
const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(
  `mushaf-text.json → ${kb} KB · ${payload.ayat} آية · ${payload.surahs.length} سورة · ` +
    `${payload.pageStart.length} صفحة · ${payload.sajda.length} سجدة`,
);

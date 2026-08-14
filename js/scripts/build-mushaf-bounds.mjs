/**
 * **خريطةُ حدود الصفحة والجزء** — خطوةُ بناءٍ حتميّةٌ تُعاد بحروفها.
 *
 * علّتُها مقيسةٌ في `findings/sawt/M2-RESULTS.md` §٥‑١: الصفحةُ والجزءُ وحدَهما
 * كانا يمسحان **وثائقَ الآيات** لمعرفة حدَّيهما (٣٢٩ و٣٠١ مِث مقابل ١٥٦ للمصحف
 * كلِّه، إذ يُفهرس هذا من عِدّة السور وحدَها). فتُحفظ ههنا **أوّلُ آيةٍ من كلّ
 * صفحةٍ ومن كلّ جزء**، فيصير حدُّهما معلومًا بلا قراءةِ آيةٍ واحدة.
 *
 * والمخرَجُ **أرقامٌ لا نصّ** — لا حرفَ قرآنٍ فيه — ويُودَع في الشجرة ويُقرأ
 * استيرادًا (فلا طلبَ شبكةٍ ولا انتظار).
 *
 * **وتُحرَسُ الخريطةُ ببوّابة التتبّع**: تُقابَل بحدود القاعدة على الآيات الستّ
 * والثلاثين بعد المئتين وستّة آلاف، فإن خالفت حرفًا سقطت البوّابة.
 *
 * التشغيل: node js/scripts/build-mushaf-bounds.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "js", "apps", "studio", "src", "lib", "sawt", "mushaf-bounds.json");

const db = new DatabaseSync(join(ROOT, "quran-app.db"), { readOnly: true });
const rows = db
  .prepare("select _id, data from ayahs")
  .all()
  .map((r) => ({ ...JSON.parse(r.data), ord: Number(String(r._id).slice(1)) }))
  .sort((a, b) => a.ord - b.ord);

/** أوّلُ آيةٍ من كلّ وحدة، بترتيب المصحف — `[سورة، آية]` */
const firstOf = (key, count) => {
  const out = [];
  for (const a of rows) {
    const n = a[key];
    if (out[n - 1]) continue;
    out[n - 1] = [a.surahNo, a.ayahNo];
  }
  const gaps = [];
  for (let i = 0; i < count; i++) if (!out[i]) gaps.push(i + 1);
  if (gaps.length) {
    console.error(`وحداتٌ بلا أوّلِ آية في «${key}»: ${gaps.join(" · ")}`);
    process.exit(1);
  }
  return out;
};

const pages = firstOf("page", 604);
const juz = firstOf("juz", 30);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ pages, juz }, null, 0)}\n`);
console.log(`خريطةُ الحدود: ${pages.length} صفحةً · ${juz.length} جزءًا → ${OUT.replace(ROOT + "/", "")}`);

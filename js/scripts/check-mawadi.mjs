/**
 * **بوّابةُ المواضع** — «لكلِّ غرضٍ موضعُه» (ج٤ §٣ · `SAWT-PLAN.md` §١٢، وأمرُ
 * المالك ١٤ أغسطس: «مَن يختم القرآن، أو يقرأ في الصلاة، أو يراجع حفظه، أو
 * يتدرّب — كلُّهم يجب أن يرجعوا إلى آخر مكانٍ وصلوا إليه»).
 *
 * **والعيبُ الذي تحرسه**: علامةٌ واحدةٌ لكلّ الأحوال تكتب على الأخرى، فيعود
 * القارئُ إلى غير حيث وقف — **وهذا أسوأُ من ألّا يعود، لأنّه يثق ثمّ يُخذَل**.
 *
 * وتُقاس **الطبقةُ نفسُها** (`src/lib/mawadi.ts`) لا نسخةٌ عنها: يُستورد الملفُّ
 * بعينه (بتجريد الأنواع في نود)، ويُركَّب له تخزينٌ محلّيٌّ في الذاكرة. فما
 * يُقاس ههنا هو ما يعمل في الجهاز حرفًا.
 *
 *   ١ — **أربعةُ أحوالٍ بأربعة مواضع**: تُحفظ مختلفةً ثمّ يُشهد أنّ كلًّا منها
 *       يعود إلى موضعه هو.
 *   ٢ — **والتصفيرُ لحالٍ لا للجميع**: يُصفَّر واحدٌ فتبقى البقيّةُ كما هي.
 *   ٣ — **وميراثُ ما قبل الطبقة يُقرأ ولا يُفقَد**: مفتاحٌ قديمٌ في جهاز قارئٍ
 *       يُقرأ منه، **ولا يُكتب فيه** — فلا يفقد موضعَه في التحوّل.
 *   ٤ — **والختمةُ تقدّمٌ لا نقطة**: `recordProgress` يبقى في `bookmarks.ts`
 *       ولا تكتب هذه الطبقةُ في مفتاحه (فحصٌ نصّيّ).
 *
 * **وضبطٌ سالب**: تُوحَّد المفاتيحُ عمدًا (على صورة ما كان) فيُشهد التصادمُ —
 * أربعةُ أحوالٍ تُرجع موضعًا واحدًا — ثمّ يُردّ فيعود كلٌّ إلى موضعه.
 *
 * التشغيل: node js/scripts/check-mawadi.mjs → js/data/gates/MAWADI.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "apps", "studio", "src");
const OUT = join(ROOT, "js", "data", "gates", "MAWADI.json");

const failures = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });

/** تخزينٌ محلّيٌّ في الذاكرة — صورةُ الواجهة التي تستعملها الطبقة لا أكثر */
class MemStore {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  keys() { return [...this.map.keys()]; }
}
const store = new MemStore();
globalThis.localStorage = store;

const M = await import(join(SRC, "lib", "mawadi.ts"));

/* ═══════════ ١ — أربعةُ أحوالٍ بأربعة مواضع ═══════════ */

/** الرجلُ نفسُه: ختمتُه في الجزء الثاني عشر، ومراجعتُه في النحل، وتثبيتُه في جزء عمّ */
const CASES = [
  ["khatma", "12:40", "الختمة — هود ٤٠"],
  ["murajaa", "16:90", "المراجعة — النحل ٩٠"],
  ["tathbit", "78:1", "التثبيت — النبأ ١"],
  ["salat", "2:255", "الصلاة — البقرة ٢٥٥"],
  ["mushaf", "18:10", "قراءةُ المصحف — الكهف ١٠"],
];

store.clear();
for (const [id, loc] of CASES) M.saveMawdi(id, loc);
const back = CASES.map(([id, loc, what]) => ({ id, want: loc, got: M.readMawdi(id)?.location ?? null, what }));
const wrong = back.filter((r) => r.got !== r.want);
if (wrong.length) fail("موضعٌ يعود إلى غير حيث وقف", wrong.map((r) => `${r.what}: طُلب ${r.want} فعاد ${r.got}`).join(" · "));
else notes.push(`لكلّ حالٍ موضعُها: ${back.map((r) => r.what).join(" · ")} — خمسةٌ حُفظت فعاد كلٌّ إلى موضعه هو`);

/** ولا مفتاحَ خارجَ الفضاء الواحد */
const written = store.keys();
const stray = written.filter((k) => !k.startsWith("quran-studio:mawdi:"));
if (stray.length) fail("مفتاحٌ خارجَ فضاء المواضع", `كتبت الطبقةُ في: ${stray.join(" · ")}`);
else notes.push(`وكلُّ ما كُتب في فضاءٍ واحدٍ (${written.length} مفتاحًا) — فلا نظامان يكتبان في معنًى واحد`);

/* ═══════════ ٢ — التصفيرُ لحالٍ لا للجميع ═══════════ */

M.clearMawdi("murajaa");
if (M.readMawdi("murajaa")) fail("التصفير", "صُفّرت المراجعةُ فبقي موضعُها");
const survived = CASES.filter(([id]) => id !== "murajaa").every(([id, loc]) => M.readMawdi(id)?.location === loc);
if (!survived) fail("التصفير يمحو غيرَ حاله", "صُفّرت المراجعةُ فنقص موضعُ حالٍ أخرى");
else notes.push("والتصفيرُ لحالٍ واحدة: مُحيت المراجعةُ وحدَها وبقيت الأربعُ الباقيةُ كما هي");
M.saveMawdi("murajaa", "16:90");

/* ═══════════ ٣ — ميراثُ ما قبل الطبقة يُقرأ ولا يُفقَد ═══════════ */

store.clear();
store.setItem("quran-studio:last-read", "19:5");
store.setItem("sawt.mark.v1", JSON.stringify({ location: "36:12:3", at: "2026-08-01T00:00:00.000Z" }));
const legacyRead = M.readMawdi("mushaf")?.location ?? null;
const legacyMark = M.readMawdi("tathbit")?.location ?? null;
if (legacyRead !== "19:5") fail("ميراثُ موضع القراءة", `مفتاحٌ قديمٌ في الجهاز لم يُقرأ (عاد ${legacyRead})`);
else if (legacyMark !== "36:12:3") fail("ميراثُ علامة التتبّع", `العلامةُ القديمةُ لم تُقرأ (عاد ${legacyMark})`);
else notes.push("وميراثُ ما قبل الطبقة يُقرأ: موضعُ القراءة القديم (19:5) وعلامةُ التتبّع القديمة (36:12:3) — فلا يفقد قارئٌ موضعَه في التحوّل");
/** ولا يُكتب في القديم: من كتب مرّةً بالجديد صار الجديدُ قولَه */
M.saveMawdi("mushaf", "20:7");
if (store.getItem("quran-studio:last-read") !== "19:5") fail("الكتابةُ في القديم", "الطبقةُ كتبت في المفتاح القديم — ونظامان يكتبان في معنًى واحد");
else if (M.readMawdi("mushaf")?.location !== "20:7") fail("الجديدُ يعلو القديم", "كُتب الجديدُ فبقي القديمُ هو الجواب");
else notes.push("والجديدُ يعلو القديمَ ولا يكتب فيه: كُتب 20:7 فصار الجوابَ، والقديمُ باقٍ في مكانه لا يُمَسّ");

/* ═══════════ ٤ — الختمةُ تقدّمٌ لا نقطة (فحصٌ نصّيّ) ═══════════ */

const layer = readFileSync(join(SRC, "lib", "mawadi.ts"), "utf8");
const bookmarks = readFileSync(join(SRC, "bookmarks.ts"), "utf8");
const PROG_KEY = /PROG_KEY\s*=\s*"([^"]+)"/.exec(bookmarks)?.[1] ?? null;
if (!PROG_KEY) fail("مفتاحُ تقدّم الختمة", "لم يُقرأ `PROG_KEY` من bookmarks.ts");
else if (layer.includes(PROG_KEY)) fail("خلطُ المعنيين", `طبقةُ المواضع تكتب في مفتاح تقدّم الختمة (${PROG_KEY}) — والتقدّمُ أقصى ما بُلغ لا آخرَ وقوف`);
else if (!/only advances|لا ينقص|globalNo > progress/.test(bookmarks)) fail("تقدّمُ الختمة", "`recordProgress` لم يعد يحفظ أقصى ما بُلغ");
else notes.push(`والختمةُ تقدّمٌ لا نقطة: \`recordProgress\` باقٍ على حاله (${PROG_KEY}) ولا تكتب طبقةُ المواضع فيه`);

/* ═══════════ الضبطُ السالب: تُوحَّد المفاتيحُ فيُشهد التصادم ═══════════ */

store.clear();
/** على صورة ما كان قبل الطبقة: مفتاحٌ واحدٌ يكتب فيه الجميع */
const ONE = "sawt.mark.v1";
const single = {
  save: (_id, loc) => store.setItem(ONE, JSON.stringify({ location: loc, at: "" })),
  read: (_id) => JSON.parse(store.getItem(ONE) ?? "null")?.location ?? null,
};
for (const [id, loc] of CASES.filter(([i]) => i !== "mushaf")) single.save(id, loc);
const collided = CASES.filter(([i]) => i !== "mushaf").map(([id]) => single.read(id));
const distinct = new Set(collided).size;
if (distinct !== 1) {
  fail("ضبطٌ سالب", `وُحّدت المفاتيحُ عمدًا فلم يقع تصادم (${distinct} مواضعَ مختلفة) — والقياسُ لا يقيس`);
} else {
  notes.push(`ضبطٌ سالب: وُحّدت المفاتيحُ على صورة ما كان، فأرجعت الأحوالُ الأربعُ موضعًا واحدًا (${collided[0]}) — وهو الخذلانُ بعينه`);
}
/** ثمّ يُردّ فيعود كلٌّ إلى موضعه */
store.clear();
for (const [id, loc] of CASES) M.saveMawdi(id, loc);
const restored = CASES.every(([id, loc]) => M.readMawdi(id)?.location === loc);
if (!restored) fail("ضبطٌ سالب", "رُدّت الطبقةُ فلم يعُد كلُّ حالٍ إلى موضعه — قياسٌ غيرُ مستقرّ");
else notes.push("ورُدّت الطبقةُ فعاد كلٌّ إلى موضعه — قياسٌ مستقرّ");

/* ═══════════ الخلاصة ═══════════ */

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0;
writeFileSync(OUT, `${JSON.stringify({ gate: "mawadi", ok, cases: CASES.length, failures, notes }, null, 2)}\n`);
console.log(`بوّابةُ المواضع: ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
console.log(`  ${relative(ROOT, OUT)}`);
process.exit(ok ? 0 : 1);

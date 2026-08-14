/**
 * بوّابةُ **المحرّك الحرّ** — ثلاثةُ أبوابٍ لكلٍّ ضبطُه السالب (ص-م٣ §٦):
 *
 *   ١ — **سطرُ الصدق مع محرّكه لا مع الصفحة**: عباراتُ الاستقلال عن الشبكة
 *       («لا يغادر جهازك» وأخواتُها) لا تُكتب في الصفحة، ولا في وصف المحرّك
 *       الشبكيّ — **وإنّما في وصف المحرّك الذي يعمل على الجهاز وحدَه**. وبإزائها
 *       يلزم الإفصاحُ في وصف الشبكيّ بأنّ الصوت يخرج.
 *   ٢ — **لا يُمسَك صوت**: شجرةُ `lib/sawt/` وصفحةُ التتبّع خاليةٌ من
 *       `MediaRecorder` و`createObjectURL` وكتابةِ صوتٍ في خزانةٍ أو تخزينٍ
 *       محلّيّ. **قاعدةٌ محروسةٌ بالآلة لا موعودةٌ بالقول** (أمرُ المالك
 *       2026-08-14)، وتسري على كلّ جلسةٍ بعد هذه.
 *   ٣ — **وضعُ الصلاة بالحرّ وحدَه**: الوصفُ يقول إنّ الشبكيَّ لا يصلح لها،
 *       والصفحةُ تمنع البدءَ به فيها.
 *
 * ولا `\b` مع العربيّة (بلاغُ الحدود 2026-08-12) — بل عباراتٌ كاملة.
 *
 * التشغيل: node js/scripts/check-sawt-engine.mjs → js/data/gates/SAWT-ENGINE.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "apps", "studio", "src");
const OUT = join(ROOT, "js", "data", "gates", "SAWT-ENGINE.json");

const failures = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });
const read = (p) => readFileSync(join(SRC, p), "utf8");
/** يُسقط التعليقاتِ كي لا يُصطاد ذِكرُ الممنوع في شرحِ منعه */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/* ═══════════ ١ — سطرُ الصدق مع محرّكه ═══════════ */

/** دعاوى الاستقلال عن الشبكة — لا تصحّ إلّا لمن يعمل على الجهاز */
const CLAIMS = [
  ["لا يغادر جهازك", /لا\s+يغادر\s+جهازك/],
  ["لا يغادر الجهاز", /لا\s+يغادر\s+الجهاز/],
  ["يعمل بلا إنترنت", /بلا\s+إنترنت/],
  ["بلا اتّصال", /بلا\s+اتّصال/],
  ["على جهازك وحدَه", /على\s+جهازك\s+وحدَه/],
];
/** والإفصاحُ الذي يلزم الشبكيَّ */
const DISCLOSURE = /يرسل\s+صوتَك\s+إلى\s+خادم/;

/**
 * يُقسَّم `engines.ts` على واصفاته: كلُّ واصفةٍ من `id:` إلى ما قبل التي تليها.
 * فما في واصفةٍ لا يُحسب على أختها.
 */
function describers() {
  const src = stripComments(read("lib/sawt/engines.ts"));
  const parts = [...src.matchAll(/id:\s*"([a-z-]+)"/g)];
  const out = {};
  for (let i = 0; i < parts.length; i++) {
    const from = parts[i].index;
    const to = i + 1 < parts.length ? parts[i + 1].index : src.length;
    out[parts[i][1]] = src.slice(from, to);
  }
  return out;
}

const desc = describers();
if (!desc["on-device"] || !desc["browser-speech"]) {
  fail("واصفاتُ المحرّكات", "لم تُوجد واصفتا «على الجهاز» و«خدمة المتصفّح» في engines.ts");
} else {
  const claimedInBrowser = CLAIMS.filter(([, re]) => re.test(desc["browser-speech"]));
  if (claimedInBrowser.length) {
    fail(
      "دعوى استقلالٍ في محرّكٍ يُخرج الصوت",
      `وصفُ المحرّك الشبكيّ يقول: ${claimedInBrowser.map(([n]) => `«${n}»`).join(" · ")}`,
    );
  }
  if (!DISCLOSURE.test(desc["browser-speech"])) {
    fail("الإفصاحُ الواجب", "وصفُ المحرّك الشبكيّ لا يقول إنّ الصوت يُرسل إلى خادم");
  }
  if (!CLAIMS.some(([, re]) => re.test(desc["on-device"]))) {
    fail("سطرُ الصدق", "وصفُ المحرّك على الجهاز لا يذكر أنّ الصوت لا يغادر الجهاز");
  }
  if (DISCLOSURE.test(desc["on-device"])) {
    fail("خلطُ الأسطر", "وصفُ المحرّك على الجهاز يقول إنّ الصوت يُرسل إلى خادم");
  }
  if (!failures.length) {
    notes.push("سطرُ الصدق مع محرّكه: الدعوى في واصفة «على جهازك» وحدَها، والإفصاحُ في واصفة «خدمة المتصفّح»");
  }
}

/** والصفحةُ نفسُها لا تكتب دعوى استقلالٍ بيدها — بل تعرض سطرَ المحرّك */
const viewShown = stripComments(read("views/Tatabbu.tsx"));
for (const [name, re] of CLAIMS) {
  if (re.test(viewShown)) fail("دعوى في الصفحة", `الصفحةُ تكتب «${name}» بيدها بدل سطر المحرّك`);
}
if (!/privacyLine/.test(viewShown)) {
  fail("سطرُ المحرّك", "الصفحةُ لا تعرض `privacyLine` — فمن أين يعلم القارئُ حالَ صوته؟");
}

/* ═══════════ ٢ — لا يُمسَك صوت ═══════════ */

/**
 * الممنوعُ: تسجيلٌ أو تحويلُ صوتٍ إلى كائنٍ يُحفظ، أو كتابةٌ في خزانةٍ/تخزينٍ
 * محلّيٍّ لعيّنةٍ صوتيّة. والمسموحُ: نافذةٌ ساريةٌ في الذاكرة تُستهلك وتُترك.
 */
const CAPTURE = [
  ["MediaRecorder", /MediaRecorder/],
  ["createObjectURL", /createObjectURL/],
  ["Blob صوتيّ", /new\s+Blob\s*\([^)]*audio/i],
  ["كتابةُ صوتٍ في IndexedDB", /indexedDB[\s\S]{0,80}(audio|pcm|صوت)/i],
  ["كتابةُ صوتٍ في التخزين المحلّيّ", /localStorage\.setItem\([^)]*(audio|pcm|صوت)/i],
  ["كتابةُ صوتٍ في خزانة", /caches\.open\([^)]*(audio|pcm|صوت)/i],
];
const AUDIO_FILES = [
  "lib/sawt/onDeviceRecognizer.ts",
  "lib/sawt/asrWorker.ts",
  "lib/sawt/recognizer.ts",
  "lib/sawt/vad.ts",
  "lib/sawt/runs.ts",
  "lib/sawt/engines.ts",
  "views/Tatabbu.tsx",
];
const caught = [];
for (const f of AUDIO_FILES) {
  const body = stripComments(read(f));
  for (const [name, re] of CAPTURE) if (re.test(body)) caught.push(`${f} — ${name}`);
}
if (caught.length) fail("إمساكُ صوت", caught.join(" · "));
else notes.push(`لا إمساكَ لصوتٍ في ${AUDIO_FILES.length} ملفًّا: لا تسجيلَ ولا كائنَ صوتٍ ولا كتابةَ في خزانة`);

/* ═══════════ ٣ — وضعُ الصلاة بالحرّ وحدَه ═══════════ */

if (desc["browser-speech"] && /fitsSalat:\s*true/.test(desc["browser-speech"])) {
  fail("الصلاةُ بمحرّكٍ يُخرج الصوت", "واصفةُ المحرّك الشبكيّ تقول إنّه يصلح للصلاة");
}
if (desc["on-device"] && !/fitsSalat:\s*true/.test(desc["on-device"])) {
  fail("الصلاةُ بالحرّ", "واصفةُ المحرّك على الجهاز لا تقول إنّه يصلح للصلاة");
}
if (!/halId === "salat" && !findEngine\(engineId\)\.fitsSalat/.test(viewShown)) {
  fail("منعُ البدء", "الصفحةُ لا تمنع البدءَ في «الصلاة» بمحرّكٍ لا يصلح لها");
}
if (!failures.some((f) => f.check.includes("الصلاة"))) {
  notes.push("وضعُ الصلاة: الشبكيُّ لا يصلح لها وصفًا، والصفحةُ تمنع البدءَ به فيها");
}

/* ═══════════ ٤ — بابُ «العَرْض»: الحرُّ يُفتح، والمحبوسُ يبقى ═══════════
   فُتح من «العَرْض» ما هو حرٌّ (ص-م٤ §٥هـ): **إشعالُ الأحكام السبعة وبنكُ
   تمارينها**، مولَّدَين بمحرّكنا من رسم المصحف الذي نملك رخصتَه. **فتُحرَس
   الرخصةُ بالآلة لا بالنيّة** ببابين:

     أ — **خطُّ البناء لا يقرأ المرجعَ المحبوس**: لا `build/ipa/` ولا
         `research/qpc-hafs-tajweed.json` في مولّد البنك ولا فيما يستورده
         التطبيق. **وشحنُ مخرَجه ممنوعٌ** بنصّ `CREDITS.md` §٢.
     ب — **وسطحُ العَرْض خالٍ من كلّ حكمٍ على تلاوة**: لا «صواب» ولا «خطأ» ولا
         نسبةٌ ولا مدّةٌ بالمللي ولا رقمُ مقدارِ مدٍّ (حركتان/أربع/ستّ).
         **والفرقُ بين «هذا حكمُ الموضع» و«أنت أخطأتَ فيه» فرقُ عرضٍ ودعوى.** */

/** المرجعُ المحبوسُ ومخرجاتُه — لا يُقرأ منها حرفٌ في هذا الخطّ */
const LOCKED = [
  ["مخرجاتُ الرسم الصوتيّ", /build\/ipa\//],
  ["مرجعُ التجويد غيرُ معلَن الرخصة", /qpc-hafs-tajweed/],
  ["مولّدُ الرسم الصوتيّ", /quran_ipa/],
];
/** ملفّاتُ خطّ «العَرْض» الجديد — مولّدُه ومخرَجُه ومستهلِكُه */
const ARD_LINE = [
  ["مولّدُ البنك", readFileSync(join(ROOT, "js", "scripts", "build-tajwid-bank.mjs"), "utf8")],
  ["محرّكُ الأحكام", read("tajwid.ts")],
  ["بنكُ التمارين", read("lib/sawt/tajwid-bank.json")],
  ["الصفحة", read("views/Tatabbu.tsx")],
];
let lockedHits = 0;
for (const [name, body] of ARD_LINE) {
  const bare = stripComments(body);
  for (const [why, re] of LOCKED) {
    if (re.test(bare)) {
      lockedHits++;
      fail("خطُّ العَرْض يقرأ المرجعَ المحبوس", `${name}: ${why}`);
    }
  }
}
if (!lockedHits) {
  notes.push("خطُّ «العَرْض» لا يقرأ المرجعَ المحبوسَ ولا مخرجاتِه — أربعةُ ملفّاتٍ فُحصت");
}

/** ما لا يجوز أن يُعرض في سطح العَرْض: حكمٌ على تلاوةٍ أو رقمُ مقدار */
const VERDICT_WORDS = [
  ["أصبتَ", /أصبتَ/],
  ["أخطأتَ", /أخطأتَ/],
  ["صواب/خطأ في العرض", /صوابٌ\s+أم\s+خطأ/],
  ["نسبةُ إتقان", /نسبةُ\s+الإتقان/],
  ["مقدارُ المدّ بالحركات", /مدٌّ\s+(?:حركتان|أربعُ|ستُّ)/],
];
let verdictHits = 0;
for (const [why, re] of VERDICT_WORDS) {
  for (const [name, body] of [["الصفحة", viewShown], ["الأحوال", stripComments(read("lib/sawt/halat.ts"))]]) {
    if (re.test(body)) {
      verdictHits++;
      fail("حكمٌ على تلاوة في سطح العَرْض", `${name}: ${why}`);
    }
  }
}
if (!verdictHits) {
  notes.push("سطحُ «العَرْض» خالٍ من كلّ حكمٍ على تلاوةٍ ومن كلّ رقمِ مقدار — يَعرض ولا يَسمع أصلًا");
}
/** وبإزائه: الحدُّ يُقال بنصّه، فلا يُظنُّ الوقفُ نسيانًا */
if (!/ينتظران\s+ثبوتَ\s+رخصةِ\s+مرجعهما/.test(viewShown)) {
  fail("نصُّ الوقف", "الصفحةُ لا تقول ما الذي بقي موقوفًا ولماذا");
} else {
  notes.push("نصُّ الوقف مكتوبٌ بحدّه: تُعرض الأحكامُ محسوبةً، وتنتظر المقاديرُ رخصةَ مرجعها ومختصَّ التجويد");
}

/* ═══════════ الضبطُ السالب — زرعٌ ذهنيٌّ بلا كتابةٍ على القرص ═══════════ */

const plants = [
  ["دعوى في المحرّك الشبكيّ", CLAIMS[0][1], 'privacyLine: "صوتُك لا يغادر جهازك"', true],
  ["إفصاحٌ سليم", DISCLOSURE, 'privacyLine: "يرسل صوتَك إلى خادم صانع المتصفّح"', true],
  ["تسجيلٌ مزروع", CAPTURE[0][1], "const rec = new MediaRecorder(stream);", true],
  ["رابطُ كائنٍ مزروع", CAPTURE[1][1], "const u = URL.createObjectURL(blob);", true],
  ["ذِكرٌ في تعليق", CAPTURE[0][1], stripComments("/* لا يُستعمل MediaRecorder ههنا */\nconst a = 1;"), false],
  ["نافذةٌ ساريةٌ بريئة", CAPTURE[0][1], "this.buf.push(chunk); this.bufLen += chunk.length;", false],
  // وضبطُ بابِ «العَرْض»: يُزرع استيرادُ المرجع المحبوس وحكمٌ على تلاوة فيُصطادان
  ["استيرادُ مخرَجِ الرسم الصوتيّ", LOCKED[0][1], 'import rows from "../../build/ipa/forms.tsv";', true],
  ["استيرادُ مرجع التجويد", LOCKED[1][1], 'const t = await fetch("/research/qpc-hafs-tajweed.json");', true],
  ["حكمٌ على تلاوة", VERDICT_WORDS[1][1], "<p>أخطأتَ في هذا الموضع</p>", true],
  ["مقدارُ مدٍّ بالحركات", VERDICT_WORDS[4][1], "<span>مدٌّ ستُّ حركات</span>", true],
  ["اسمُ حكمٍ بريء", LOCKED[0][1], "const rule = TAJWID.ikhfa;", false],
  ["ذِكرُ الإخفاء بريء", VERDICT_WORDS[1][1], "موضعُ إخفاءٍ ههنا", false],
];
for (const [name, re, sample, shouldCatch] of plants) {
  if (re.test(sample) !== shouldCatch) {
    fail("ضبطُ الفحص", shouldCatch ? `زُرع «${name}» فلم يُصطَد` : `اصطاد الفاحصُ بريئًا: «${name}»`);
  }
}
notes.push("ضبطٌ سالب: ثمانيةُ مزروعاتٍ اصطيدت (منها استيرادُ المرجع المحبوس وحكمٌ على تلاوةٍ ورقمُ مقدار)، وأربعةٌ بريئةٌ لم تُصطَد");

/* ═══════════ الخلاصة ═══════════ */

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0;
writeFileSync(
  OUT,
  `${JSON.stringify({ gate: "sawt-engine", ok, files: AUDIO_FILES.length, failures, notes }, null, 2)}\n`,
);
console.log(`بوّابةُ المحرّك الحرّ: ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
console.log(`  ${relative(ROOT, OUT)}`);
process.exit(ok ? 0 : 1);

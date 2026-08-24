/**
 * بوّابةُ **المحرّك الحرّ** — أبوابٌ لكلٍّ ضبطُه السالب (ص-م٣ §٦، وزِيدت):
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
 *   ٤ — **بابُ «العَرْض»**: خطُّه لا يقرأ المرجعَ المحبوس، وسطحُه لا يحكم على تلاوة.
 *   ٥ — **ولا يُحبَس قارئٌ في خيارٍ لا يعمل** (ص-م٥، على بلاغ المالك): التبديلُ
 *       متاحٌ من موضعين · ورجوعٌ تلقائيٌّ بمهلةٍ معلَنةٍ يُخبَر به · والصلاةُ
 *       مستثناةٌ منه · والإذنُ لا يُورَّث فيه · وحالُ المحرّك معروضة.
 *   ٦ — **وعُدّةُ التشغيل من أصلنا** (ص٣ §٣): لا طرفَ ثالثًا في ضبطها ولا في
 *       ناتج البناء، والأربعةُ حاضرةٌ في `public/ort/` مطابقةً للرزمة المثبَّتة.
 *   ٧ — **وسقفُ حجم النموذج يُنشر برقمه** (ص٦ §١ج‑١): مجموعُ ما يُنزَّل إلى جهاز
 *       القارئ — مقيَّدًا في `model.json` بالبايت والتجزئة — لا يتجاوز السقفَ
 *       المعلَن، **والمجموعُ جمعُ الملفّات لا رقمٌ مكتوبٌ بيد**. وههنا علّةُ
 *       شاشةِ الانهيار على الهاتف، فالحجمُ شرطُ إقلاعٍ لا رفاهيةُ تنزيل.
 *   ٨ — **ومصدرُ النموذج مستودعُنا** (ص٦ §١ج‑٢): معرّفُ النموذج في حسابنا،
 *       **ويُقرأ من المانيفست لا يُكتب في الشيفرة بيد** — فلا يتباعد المعروضُ
 *       عمّا يُشحن، ولا يعود جلبُه من مستودعِ تصديرٍ لا يعلن رخصة.
 *
 * ولا `\b` مع العربيّة (بلاغُ الحدود 2026-08-12) — بل عباراتٌ كاملة.
 *
 * التشغيل: node js/scripts/check-sawt-engine.mjs → js/data/gates/SAWT-ENGINE.json
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ORT_FILES, ortDir, ortSource, sha256 } from "../packages/quran-core/ort-assets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "apps", "studio", "src");
/** شيفرةُ المسبار (`lib/…`) في الحزمة المشتركة منذ التقسيم الصامت (ف١)،
 *  **وسطحُه في تطبيق التلاوة منذ تصفيةِ مشكاة** (ف٤ §١) — فيُقرأ كلٌّ من موضعه */
const CORE = join(ROOT, "js", "packages", "quran-core", "src");
const TILAWA = join(ROOT, "js", "apps", "tilawa", "src");
/** وعُدّةُ التشغيل تُنسخ إلى أصل التطبيق الذي يشحنها — **وهو التلاوة وحدَها**
 *  بعد أن كفّت مشكاةُ عن شحن عُدّةٍ لا تستعملها (ف٤ §١) */
const ORT_DIR = ortDir(join(ROOT, "js", "apps", "tilawa", "public"));
const OUT = join(ROOT, "js", "data", "gates", "SAWT-ENGINE.json");

const failures = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });
/** `lib/…` من القلب · `tilawa/…` من سطح التلاوة · وما سواهما من مشكاة */
const read = (p) =>
  readFileSync(
    p.startsWith("lib/")
      ? join(CORE, p)
      : p.startsWith("tilawa/")
        ? join(TILAWA, p.slice("tilawa/".length))
        : join(SRC, p),
    "utf8",
  );
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

/**
 * **والسطحُ نفسُه لا يكتب دعوى استقلالٍ بيده** — بل يعرض سطرَ المحرّك.
 *
 * **وسطحُ التتبّع صار في تطبيق التلاوة** (ف٤ §١): خرج من مشكاة، **والحكمُ هو
 * هو، والمقيسُ يتبع المفحوصَ حيث صار**. وهو ثنائيٌّ: `Track.tsx` فيه العبارةُ
 * المعروضةُ والإعلانُ والشريط، و`tatabbu.ts` فيه تدبيرُ الحال والرجوعُ ومنعُ
 * البدء. **وفحصُ `lib/sawt/` يبقى على القلب بحرفه** — فحراسةُ «لا يُمسَك صوت»
 * لا تسقط ساعةً واحدة.
 */
const viewShown = stripComments(read("tilawa/components/Track.tsx"));
/** وتدبيرُ الحال في السطح نفسِه — منطقًا لا عبارةً */
const halShown = stripComments(read("tilawa/tatabbu.ts"));
for (const [name, re] of CLAIMS) {
  if (re.test(viewShown)) fail("دعوى في الصفحة", `السطحُ يكتب «${name}» بيده بدل سطر المحرّك`);
}
if (!/privacyLine/.test(viewShown)) {
  fail("سطرُ المحرّك", "السطحُ لا يعرض `privacyLine` — فمن أين يعلم القارئُ حالَ صوته؟");
} else {
  notes.push("سطحُ التتبّع يعرض سطرَ صدق المحرّك المختار ولا يكتب دعوى بيده");
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
  "tilawa/components/Track.tsx",
  "tilawa/tatabbu.ts",
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
if (!/halId === "salat" && !findEngine\(engineId\)\.fitsSalat/.test(halShown)) {
  fail("منعُ البدء", "السطحُ لا يمنع البدءَ في «الصلاة» بمحرّكٍ لا يصلح لها");
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
  /* **ومستهلِكُ الأحكام صار سطحَ المصحف في مشكاة** (ف٤ §٣): خرجت صفحةُ التتبّع
     ومعها بنكُ تمارينها، **وبقي تلوينُ الأحكام على متن المصحف** — وهو الموضعُ
     الذي يلزمه ألّا يقرأ المرجعَ المحبوس. */
  ["سطحُ الأحكام", read("components/AyahText.tsx")],
  ["المصحف", read("views/Reader.tsx")],
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
  notes.push(`خطُّ «العَرْض» لا يقرأ المرجعَ المحبوسَ ولا مخرجاتِه — ${ARD_LINE.length} ملفّاتٍ فُحصت`);
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
  for (const [name, body] of [
    ["سطحُ التتبّع", viewShown],
    ["سطحُ الأحكام", stripComments(read("components/AyahText.tsx"))],
    ["الأحوال", stripComments(read("lib/sawt/halat.ts"))],
  ]) {
    if (re.test(body)) {
      verdictHits++;
      fail("حكمٌ على تلاوة في سطح العَرْض", `${name}: ${why}`);
    }
  }
}
if (!verdictHits) {
  notes.push("سطحُ «العَرْض» خالٍ من كلّ حكمٍ على تلاوةٍ ومن كلّ رقمِ مقدار — يَعرض ولا يَسمع أصلًا");
}
/**
 * وبإزائه: **الحدُّ يُقال بنصّه، فلا يُظنُّ الوقفُ نسيانًا**.
 *
 * **ويُقرأ من مصدره الحيّ لا من عارضه** (ف٤ §٣): كان يُلتمس في صفحة التتبّع،
 * وهي إنّما كانت **تعرضه**؛ ونصُّه مكتوبٌ حيث كُتب حكمُه — في واصفة الحال
 * بالحزمة (`halat.ts`). **فلمّا خرجت الصفحةُ لم يخرج النصّ**، وسطحُ التلاوة
 * يعرضه من موضعه نفسِه. **والنسخةُ تشيخ في صمت، والمصدرُ لا يشيخ.**
 */
const halatSrc = stripComments(read("lib/sawt/halat.ts"));
if (!/ينتظران\s+ثبوتَ\s+رخصةِ\s+مرجعهما/.test(halatSrc)) {
  fail("نصُّ الوقف", "واصفةُ الحال لا تقول ما الذي بقي موقوفًا ولماذا");
} else if (!/hal\.suspended/.test(viewShown)) {
  fail("عرضُ الوقف", "السطحُ لا يعرض نصَّ الوقف — فيُكتب الحدُّ ولا يبلغ القارئ");
} else {
  notes.push("نصُّ الوقف مكتوبٌ بحدّه في واصفة الحال، والسطحُ يعرضه: تُعرض الأحكامُ محسوبةً، وتنتظر المقاديرُ رخصةَ مرجعها ومختصَّ التجويد");
}

/* ═══════════ ٥ — لا يُحبَس قارئٌ في خيارٍ لا يعمل (ص-م٥) ═══════════
   بلاغُ المالك في فحصٍ حيٍّ على هاتفه: سُئل مرّةً واحدةً فاختار المحرّكَ الحرّ،
   **فلم يعمل، ولم يجد سبيلًا إلى التبديل**. **وثانيهما عيبُ تصميمٍ لا عيبُ
   محرّك** — يبقى قائمًا ولو عمل المحرّكان. فثلاثةٌ تُحرَس ههنا بالآلة:

     أ — **التبديلُ متاحٌ ولا يُخبَّأ** خلف إعادةِ تثبيتٍ ولا محوِ بيانات.
         **وموضعُه في سطح التلاوة واحدٌ حاضرٌ دائمًا** لا اثنان متفرّقان: شريطُ
         الحال نفسُه زرُّ تبديلٍ ما دامت التلاوةُ لم تبدأ — فالبابُ بين يدي
         القارئ حيث هو، لا في صفحةٍ يُهتدى إليها. **وسقط الموضعُ الثاني (قسمُ
         المحرّك في إعدادات مشكاة) بخروج التتبّع منها** (ف٤ §١) — ولم يسقط
         الحكمُ: التبديلُ متاحٌ في كلّ وقت.
     ب — **ورجوعٌ تلقائيٌّ عند الإخفاق** بمهلةٍ **معلَنة**، **ويُخبَر به**
         صراحةً — **ولا يُرجَع في الصلاة إلى الشبكيّ بحال**، **ولا يُشغَّل
         محرّكٌ يُخرج الصوتَ بلا إذنٍ له**.
     ج — **وحالُ المحرّك معروضة**: أيُّهما يعمل الآن، فلا يحزر القارئ. */

/** موضعُ التبديل وحالُ المحرّك — كلٌّ بعلامته في مصدره */
const SWAP_IN_BAR = /onClick=\{t\.swapEngine\}/;
const SWAP_SAVED = /saveEngineChoice\(/;
const ENGINE_SHOWN = /data-track="engine"/;
/** الرجوعُ التلقائيُّ وخبرُه */
const FALLBACK_FN = /const fallback = useCallback\(/;
const FALLBACK_GRACE = /ENGINE_GRACE_MS/;
const FALLBACK_NOTICE = /data-track="fell"/;
/** والصلاةُ مستثناةٌ من الرجوع — بحرفها في موضع الرجوع لا في غيره */
const FALLBACK_SALAT = /=== "salat" \|\| !netUsable/;
/** والإذنُ لا يُورَّث ولو كان الرجوعُ اضطراريًّا */
const FALLBACK_CONSENT = /readConsent\("browser-speech"\) && declaredIn\(\)/;
/** و«لم يُؤذَن بالميكروفون» ليس عيبَ محرّكٍ فلا يُبدَّل له محرّك */
const FALLBACK_DENIED = /engineState === "denied"\) return/;

const doorFive = [
  ["التبديلُ من الشريط", SWAP_IN_BAR, viewShown, "لا زرَّ تبديلٍ في شريط الحال — ومن أخطأ الاختيارَ حُبس"],
  ["حالُ المحرّك معروضة", ENGINE_SHOWN, viewShown, "حالُ المحرّك ليست معروضةً في الشريط"],
  ["التبديلُ يُحفظ", SWAP_SAVED, halShown, "التبديلُ لا يُحفظ — فيُسأل القارئُ في كلّ مرّة"],
  ["الرجوعُ التلقائيّ", FALLBACK_FN, halShown, "لا رجوعَ تلقائيًّا عند إخفاق المحرّك"],
  ["المهلةُ معلَنة", FALLBACK_GRACE, halShown, "لا مهلةَ معلَنةً قبل الحكم بالإخفاق"],
  ["خبرُ الرجوع", FALLBACK_NOTICE, viewShown, "يقع الرجوعُ ولا يُخبَر به القارئ"],
  ["الصلاةُ لا يُرجَع فيها إلى الشبكيّ", FALLBACK_SALAT, halShown, "الرجوعُ التلقائيُّ لا يستثني «الصلاة»"],
  ["الإذنُ لا يُورَّث في الرجوع", FALLBACK_CONSENT, halShown, "يُرجَع إلى محرّكٍ يُخرج الصوتَ بلا إذنٍ له"],
  ["منعُ الإذن ليس عيبَ محرّك", FALLBACK_DENIED, halShown, "يُبدَّل المحرّكُ لمن لم يأذن بالميكروفون — وتبديلُه لا يصنع شيئًا"],
];
let fiveBad = 0;
for (const [name, re, body, why] of doorFive) {
  if (!re.test(body)) {
    fiveBad++;
    fail("الحبسُ في خيار", `${name}: ${why}`);
  }
}
if (!fiveBad) {
  notes.push(
    "لا حبسَ في خيار: التبديلُ من شريط الحال نفسِه في كلّ تهيئةٍ ويُحفظ · ورجوعٌ تلقائيٌّ بمهلةٍ معلَنةٍ يُخبَر به · والصلاةُ مستثناةٌ منه · والإذنُ لا يُورَّث فيه · وحالُ المحرّك معروضة — **وسقط الموضعُ الثاني بخروج التتبّع من إعدادات مشكاة، وهو قيدٌ معلَنٌ للإدارة**",
  );
}

/* ═══════════ ٦ — عُدّةُ المحرّك من أصلنا لا من شبكة طرفٍ ثالث (ص٣ §٣) ═══════════
   بلاغُ المالك المتكرّر: «المحرّك الداخلي لا يعمل». وعلّتُه المقيسة: `transformers.js`
   يجلب عُدّةَ التشغيل (`ort-wasm-simd-threaded*`) من jsdelivr ما لم يُضبط غيرُه —
   **وتعذُّرُ جلبِها عطبٌ صامت** لا يظهر في تنزيل النموذج ولا في الميكروفون. فبابان:

     أ — **لا طرفَ ثالثًا في ضبط العُدّة**: المصدرُ يضبط الملفّين من أصلنا
         (`/ort/`)، ولا مضيفَ خارجيًّا في ضبطه. **وناتجُ البناء يشهد**: أنّى ذُكرت
         العُدّةُ في حزمةٍ مبنيّةٍ فأصلُنا معها — فافتراضُ الرزمة (jsdelivr) يبقى
         نصًّا في حزمة المورّد، **وضبطُنا يعلوه**؛ فإن غاب ضبطُنا وبقي افتراضُهم
         فتلك هي العلّةُ عائدةً.
     ب — **والعُدّةُ حاضرة**: `public/ort/` بعد النسخ يحوي الأربعةَ بأسمائها،
         وتجزئتُها تطابق نظيرتَها في الرزمة المثبَّتة — **حسابٌ مباشرٌ لا ETag**. */

/** ضبطُ الملفّين من أصلنا — كلاهما من `ORT_BASE` */
const ORT_SET_OURS = /wasmPaths\s*=\s*\{[\s\S]{0,240}mjs:\s*ORT_BASE[\s\S]{0,240}wasm:\s*ORT_BASE/;
/** ومضيفٌ خارجيٌّ في ضبط العُدّة نفسِه */
const ORT_THIRD_PARTY = /wasmPaths\s*=\s*[^;]{0,400}https?:\/\//;
/** وأصلُنا معرَّفٌ بنصّه لا بالظنّ */
const ORT_BASE_DECL = /const ORT_BASE = "\/ort\/"/;

const workerSrc = stripComments(read("lib/sawt/asrWorker.ts"));
if (!ORT_BASE_DECL.test(workerSrc)) {
  fail("أصلُ العُدّة", "عاملُ التعرّف لا يعرّف `ORT_BASE = \"/ort/\"` — فمن أين تُجلب العُدّة؟");
} else if (!ORT_SET_OURS.test(workerSrc)) {
  fail("ضبطُ العُدّة", "`wasmPaths` لا يُضبط من أصلنا للملفّين معًا (mjs و wasm)");
}
if (ORT_THIRD_PARTY.test(workerSrc)) {
  fail("طرفٌ ثالثٌ في عُدّة المحرّك", "ضبطُ `wasmPaths` في العامل يحمل مضيفًا خارجيًّا");
}

/** ناتجُ البناء: كلُّ حزمةٍ تذكر العُدّةَ يجب أن يكون أصلُنا فيها */
const DIST = join(ROOT, "js", "apps", "tilawa", "dist");
let distOk = 0;
let distBad = 0;
if (existsSync(DIST)) {
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      // `dist/ort/` هي العُدّةُ المشحونةُ نفسُها — أصلُنا بعينه، لا حزمةً تطلبها
      if (e.isDirectory()) {
        if (dir === DIST && e.name === "ort") continue;
        walk(p);
      }
      else if (/\.(js|mjs)$/.test(e.name)) {
        const body = readFileSync(p, "utf8");
        if (!body.includes("ort-wasm-simd-threaded")) continue;
        if (body.includes('"/ort/') || body.includes("'/ort/") || body.includes("`/ort/")) {
          distOk++;
        } else {
          distBad++;
          fail(
            "الناتجُ يجلب العُدّةَ من طرفٍ ثالث",
            `${relative(ROOT, p)}: تُذكر العُدّةُ ولا أثرَ لأصلنا — فيسري افتراضُ الرزمة (jsdelivr)`,
          );
        }
      }
    }
  };
  walk(DIST);
  if (!distBad) {
    notes.push(
      distOk
        ? `ناتجُ البناء: ${distOk} حزمةً تذكر عُدّةَ التشغيل وأصلُنا مضبوطٌ فيها (وافتراضُ المورّد يبقى نصًّا لا يُطلب)`
        : "ناتجُ البناء: لا حزمةَ تذكر عُدّةَ التشغيل — لم يُفحص",
    );
  }
} else {
  notes.push("ناتجُ البناء لم يُفحص: لا `dist` (تُبنى ثمّ يُعاد الفحص)");
}

/** والعُدّةُ حاضرةٌ مطابقة */
const ortRows = [];
if (!existsSync(ORT_DIR)) {
  fail("عُدّةُ التشغيل غائبة", "`apps/tilawa/public/ort/` غيرُ موجود — لم يُنفَّذ نسخُ البناء (copy-assets.mjs)");
} else {
  for (const f of ORT_FILES) {
    const dst = join(ORT_DIR, f);
    if (!existsSync(dst)) {
      fail("ملفٌّ من العُدّة غائب", `${f} ليس في apps/tilawa/public/ort/`);
      continue;
    }
    const here = sha256(dst);
    const there = sha256(ortSource(f));
    if (here !== there) fail("عُدّةٌ شائخة", `${f}: تجزئتُه ${here} وتجزئةُ الرزمة ${there}`);
    else {
      const b = statSync(dst).size;
      ortRows.push(`${f} ${b >= 1048576 ? `${(b / 1048576).toFixed(1)}م.ب` : `${Math.round(b / 1024)}ك.ب`}`);
    }
  }
  if (ortRows.length === ORT_FILES.length) {
    notes.push(`عُدّةُ التشغيل من أصلنا مطابقةً للرزمة: ${ortRows.join(" · ")}`);
  }
}

/* ═══════════ ٧ — سقفُ حجم النموذج يُنشر برقمه (ص٦ §١ج‑١) ═══════════
   بلاغُ المالك: «A problem repeatedly occurred» على هاتفه — وعلّتُه المقيسة أنّ
   النموذجَ المشحونَ كان يحمل جدولَ الرموز **بدقّةٍ كاملةً ثمانين ميغابايتًا**،
   فتُغرَق ذاكرةُ سفاري. **والحجمُ من ثَمَّ ليس رفاهيةَ تنزيلٍ بل شرطَ إقلاع.**

   **والبوّابةُ لا تفتح الشبكة**: فحصٌ يتعطّل بانقطاع الشبكة ليس حارسًا. فيُقيَّد
   ما يُنزَّل في `model.json` مرّةً بيدٍ تقيس (`build-sawt-model-manifest.mjs`،
   وجردُه مقابَلٌ بما جلبه المحرّكُ فعلًا في تشغيلة المِسطرة)، **ثمّ يُحرَس ههنا
   في كلّ تشغيلة**: ألّا يتجاوز مجموعُه السقفَ المعلَن، وأن يكون المجموعُ **جمعَ
   الملفّات لا رقمًا مكتوبًا بيد**.

   ═══════════ ٨ — ومصدرُ النموذج مستودعُنا (ص٦ §١ج‑٢) ═══════════
   لا يُشحن إلى جهاز القارئ ما لا نملك أمرَه: النموذجُ في حسابنا، **ورخصتُه
   مقيَّدةٌ بحرفها** في `CREDITS.md` §١٠. وكان يُجلب من مستودعِ تصديرٍ ثالثٍ
   **لا يعلن رخصةً** (ص-م٣ §٣) — فذلك ما لا يعود. */

/** اسمُ حسابنا على مستضيف النماذج — يُكتب مرّةً ويُحرَس */
const OUR_ACCOUNT = "emadjumaah";
const MANIFEST_PATH = join(CORE, "lib", "sawt", "model.json");

/** **حكمٌ صافٍ على مانيفستٍ** — تُشغّله البوّابةُ على الحقيقيّ وعلى المزروع سواء */
function manifestVerdict(man) {
  const bad = [];
  if (!Array.isArray(man.files) || !man.files.length) {
    bad.push("لا جردَ ملفّاتٍ في المانيفست");
    return bad;
  }
  const sum = man.files.reduce((a, f) => a + (f.bytes ?? 0), 0);
  if (sum !== man.totalBytes) {
    bad.push(`المجموعُ المعلَن ${man.totalBytes} وجمعُ الملفّات ${sum} — رقمٌ لا يُجمع`);
  }
  if (+(sum / 1e6).toFixed(2) !== man.totalMB) {
    bad.push(`الميغابايتُ المعلَن ${man.totalMB} ولا يوافق البايتات ${sum}`);
  }
  if (!(man.capMB > 0)) bad.push("لا سقفَ معلَنٌ في المانيفست");
  else if (sum / 1e6 > man.capMB) {
    bad.push(`النموذجُ ${(sum / 1e6).toFixed(2)} م.ب والسقفُ المعلَن ${man.capMB} م.ب`);
  }
  if (man.files.some((f) => !/^[0-9a-f]{64}$/.test(f.sha256 ?? ""))) {
    bad.push("ملفٌّ بلا تجزئةٍ يُطابَق بها ما رُفع");
  }
  const owner = String(man.repo ?? "").split("/")[0];
  if (owner !== OUR_ACCOUNT) {
    bad.push(`مصدرُ النموذج ليس مستودعَنا: «${man.repo ?? "—"}»`);
  }
  return bad;
}

if (!existsSync(MANIFEST_PATH)) {
  fail("مانيفستُ النموذج غائب", "`lib/sawt/model.json` غيرُ موجود — فلا يُعلم ما يُنزَّل إلى جهاز القارئ");
} else {
  const man = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const bad = manifestVerdict(man);
  for (const b of bad) fail("مانيفستُ النموذج", b);
  if (!bad.length) {
    notes.push(
      `النموذجُ المشحون: ${man.files.length} ملفًّا · ${man.totalMB} م.ب من السقف ${man.capMB} · من ${man.repo} (${man.dtype})`,
    );
  }
}

/** والشيفرةُ تقرأ المانيفستَ ولا تكتب رقمًا ولا معرّفًا بيدها */
const MODEL_ID_FROM_MANIFEST = /MODEL_ID = MODEL\.repo;/;
const MODEL_DTYPE_FROM_MANIFEST = /MODEL_DTYPE = MODEL\.dtype;/;
/** معرّفُ نموذجٍ مكتوبٌ بيدٍ — أيًّا كان صاحبُه، فالمكتوبُ بيدٍ يتباعد عمّا يُشحن */
const MODEL_ID_LITERAL = /MODEL_ID\s*=\s*"[^"]*\/[^"]*"/;
/** والرقمُ المعروضُ للقارئ مشتقٌّ لا مكتوب */
const WIRE_LITERAL = /ON_DEVICE_WIRE_MB\s*=\s*[0-9]/;

const recSrc = stripComments(read("lib/sawt/onDeviceRecognizer.ts"));
const engSrc = stripComments(read("lib/sawt/engines.ts"));
if (MODEL_ID_LITERAL.test(recSrc)) {
  fail("معرّفُ نموذجٍ مكتوبٌ بيد", "`MODEL_ID` نصٌّ في الشيفرة لا قراءةٌ من المانيفست — فيتباعد عمّا يُشحن");
} else if (!MODEL_ID_FROM_MANIFEST.test(recSrc) || !MODEL_DTYPE_FROM_MANIFEST.test(recSrc)) {
  fail("معرّفُ النموذج", "`MODEL_ID`/`MODEL_DTYPE` لا يُقرآن من `model.json`");
}
if (WIRE_LITERAL.test(engSrc)) {
  fail("رقمُ التنزيل مكتوبٌ بيد", "`ON_DEVICE_WIRE_MB` عددٌ في الشيفرة — فيبقى معروضًا للقارئ بعد أن يصير كذبًا");
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
  // وضبطُ باب ص-م٥: لكلّ علامةٍ زرعٌ يُصطاد وبريءٌ يُشبهها فلا يُصطاد —
  // **فالعلامةُ تُميّز ما وُضعت له**، ولا تكتفي بأن توجد في الملفّ حيثما كان.
  ["زرُّ تبديلٍ حاضر", SWAP_IN_BAR, "<button onClick={t.swapEngine}>", true],
  ["فعلٌ آخرُ لا يُحسب تبديلًا", SWAP_IN_BAR, "<button onClick={t.dismissAsk}>", false],
  ["حالُ المحرّك معروضة", ENGINE_SHOWN, 'data-track="engine"', true],
  ["اختيارُ محرّكٍ لا يُحسب عرضًا للحال", ENGINE_SHOWN, 'data-track="engine-choice"', false],
  ["حفظُ الاختيار", SWAP_SAVED, "saveEngineChoice(id);", true],
  ["قراءةُ الاختيار وحدَها لا تكفي", SWAP_SAVED, "readEngineChoice()", false],
  ["رجوعٌ تلقائيٌّ حاضر", FALLBACK_FN, "const fallback = useCallback(", true],
  ["دالّةٌ أخرى لا تُحسب رجوعًا", FALLBACK_FN, "const finish = useCallback(", false],
  ["خبرُ الرجوع حاضر", FALLBACK_NOTICE, 'data-track="fell"', true],
  ["خبرٌ آخر لا يُحسب", FALLBACK_NOTICE, 'data-track="seek"', false],
  ["استثناءُ الصلاة في موضع الرجوع", FALLBACK_SALAT, 'if (halRef.current === "salat" || !netUsable) {', true],
  ["منعُ البدء ليس استثناءَ رجوع", FALLBACK_SALAT, 'if (halId === "salat" && !findEngine(engineId).fitsSalat) {', false],
  ["شرطُ الإذن في الرجوع", FALLBACK_CONSENT, 'if (readConsent("browser-speech") && declaredIn().includes(halRef.current)) {', true],
  ["إذنٌ مطلقٌ لا يكفي", FALLBACK_CONSENT, "if (readConsent(engineId)) {", false],
  ["استثناءُ منع الإذن", FALLBACK_DENIED, 'if (engineState === "denied") return;', true],
  ["عطبٌ لا يُستثنى", FALLBACK_DENIED, 'if (engineState === "error") return;', false],
  // وضبطُ باب العُدّة (ص٣ §٣): يُزرع ضبطٌ لمسار jsdelivr فيُصطاد، ويُبرَّأ ضبطُ أصلِنا
  [
    "ضبطُ العُدّة على طرفٍ ثالث",
    ORT_THIRD_PARTY,
    'wasm.wasmPaths = { mjs: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort-wasm-simd-threaded.mjs", wasm: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort-wasm-simd-threaded.wasm" };',
    true,
  ],
  [
    "ضبطٌ من أصلنا لا يُحسب طرفًا ثالثًا",
    ORT_THIRD_PARTY,
    'wasm.wasmPaths = {\n  mjs: ORT_BASE + ortFile(picked.mjs, "ort-wasm-simd-threaded.mjs"),\n  wasm: ORT_BASE + ortFile(picked.wasm, "ort-wasm-simd-threaded.wasm"),\n};',
    false,
  ],
  ["ذِكرُ jsdelivr في تعليقٍ ليس ضبطًا", ORT_THIRD_PARTY, stripComments("/* كانت تُجلب من jsdelivr */\nconst a = 1;"), false],
  [
    "ضبطُ الملفّين من أصلنا",
    ORT_SET_OURS,
    'wasm.wasmPaths = {\n  mjs: ORT_BASE + ortFile(picked.mjs, "a.mjs"),\n  wasm: ORT_BASE + ortFile(picked.wasm, "a.wasm"),\n};',
    true,
  ],
  ["ضبطُ ملفٍّ واحدٍ لا يكفي", ORT_SET_OURS, 'wasm.wasmPaths = { mjs: ORT_BASE + "a.mjs" };', false],
  // وضبطُ بابَي ص٦: يُزرع معرّفٌ مكتوبٌ بيدٍ ورقمٌ معروضٌ مكتوبٌ بيد، ويُبرَّأ المشتقّ
  [
    "معرّفُ طرفٍ ثالثٍ مكتوبٌ بيد",
    MODEL_ID_LITERAL,
    'export const MODEL_ID = "omartariq612/tarteel-ai-whisper-tiny-ar-quran-onnx";',
    true,
  ],
  ["ومعرّفُنا نحن مكتوبًا بيدٍ يُصطاد كذلك", MODEL_ID_LITERAL, 'export const MODEL_ID = "emadjumaah/x-onnx";', true],
  ["قراءةٌ من المانيفست ليست كتابةً بيد", MODEL_ID_LITERAL, "export const MODEL_ID = MODEL.repo;", false],
  ["ذِكرُ معرّفٍ في تعليقٍ ليس إسنادًا", MODEL_ID_LITERAL, stripComments('/* كان MODEL_ID = "a/b" */\nconst a = 1;'), false],
  ["رقمُ تنزيلٍ مكتوبٌ بيد", WIRE_LITERAL, "export const ON_DEVICE_WIRE_MB = 83;", true],
  ["رقمٌ مشتقٌّ من المانيفست", WIRE_LITERAL, "export const ON_DEVICE_WIRE_MB = Math.round(MODEL.totalMB);", false],
];

/** **وضبطُ السقف والمصدر يُزرع في مانيفستٍ ذهنيّ** — يُشغَّل عليه الحكمُ نفسُه */
const manPlants = [
  [
    "نموذجٌ فوق السقف",
    { repo: `${OUR_ACCOUNT}/x`, capMB: 45, totalBytes: 46_000_000, totalMB: 46,
      files: [{ path: "a", bytes: 46_000_000, sha256: "a".repeat(64) }] },
    true,
  ],
  [
    "سقفٌ أصغرُ من الواقع",
    { repo: `${OUR_ACCOUNT}/x`, capMB: 10, totalBytes: 43_074_381, totalMB: 43.07,
      files: [{ path: "a", bytes: 43_074_381, sha256: "b".repeat(64) }] },
    true,
  ],
  [
    "مجموعٌ لا يوافق جمعَ الملفّات",
    { repo: `${OUR_ACCOUNT}/x`, capMB: 45, totalBytes: 1000, totalMB: 0,
      files: [{ path: "a", bytes: 43_074_381, sha256: "c".repeat(64) }] },
    true,
  ],
  [
    "مصدرٌ من طرفٍ ثالث",
    { repo: "omartariq612/y", capMB: 45, totalBytes: 1_000_000, totalMB: 1,
      files: [{ path: "a", bytes: 1_000_000, sha256: "d".repeat(64) }] },
    true,
  ],
  [
    "ملفٌّ بلا تجزئة",
    { repo: `${OUR_ACCOUNT}/x`, capMB: 45, totalBytes: 1_000_000, totalMB: 1,
      files: [{ path: "a", bytes: 1_000_000 }] },
    true,
  ],
  [
    "مانيفستٌ سليمٌ عند السقف تمامًا",
    { repo: `${OUR_ACCOUNT}/x`, capMB: 45, totalBytes: 45_000_000, totalMB: 45,
      files: [{ path: "a", bytes: 45_000_000, sha256: "e".repeat(64) }] },
    false,
  ],
];
for (const [name, man, shouldCatch] of manPlants) {
  if (manifestVerdict(man).length > 0 !== shouldCatch) {
    fail("ضبطُ الفحص", shouldCatch ? `زُرع «${name}» فلم يُصطَد` : `اصطاد الفاحصُ بريئًا: «${name}»`);
  }
}
notes.push(
  `وضبطٌ سالبٌ على المانيفست: ${manPlants.filter(([, , w]) => w).length} مزروعًا اصطيدت (سقفٌ متجاوَزٌ · سقفٌ أصغرُ من الواقع · مجموعٌ لا يُجمع · مصدرٌ ثالثٌ · ملفٌّ بلا تجزئة)، وبريءٌ عند السقف تمامًا لم يُصطَد`,
);
for (const [name, re, sample, shouldCatch] of plants) {
  if (re.test(sample) !== shouldCatch) {
    fail("ضبطُ الفحص", shouldCatch ? `زُرع «${name}» فلم يُصطَد` : `اصطاد الفاحصُ بريئًا: «${name}»`);
  }
}
const wanted = plants.filter(([, , , w]) => w).length;
notes.push(
  `ضبطٌ سالب: ${wanted} مزروعًا اصطيدت (منها استيرادُ المرجع المحبوس وحكمٌ على تلاوةٍ ورقمُ مقدار وعلاماتُ التبديل والرجوع)، و${plants.length - wanted} بريئًا لم تُصطَد`,
);

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

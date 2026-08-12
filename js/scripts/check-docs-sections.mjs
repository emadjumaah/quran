/**
 * بوّابةُ صفحة التوثيق `/docs` — **لا لغةَ أداةٍ في صفحةٍ يقرؤها الناس.**
 *
 * الفحصُ الصلبُ يقع على قسم «ملفّ جمع القرآن» (`tarikh`) بالعربيّة
 * والإنجليزيّة معًا، ويثبت آليًّا:
 *   ١ — القسمُ قائمٌ في اللسانين وفي الموضع نفسِه من الفهرس (تطابقُ الترتيب).
 *   ٢ — **التنبيهُ الثابت يتقدّم الشرح**: صدرُ `lead` يحمل «الباب يعرض تاريخ
 *       جمع المصحف وتوثيقه، وليس تنقيحًا لنصّ القرآن» — قبل «ما هو» و«كيف».
 *   ٣ — **لسانُ الأقوال لا الدعاوى**: «قولٌ يُوزن» حاضرٌ، وصيغةُ الجمع
 *       «دعاوى/الدعاوى» ممنوعةٌ (تنقيحُ اللسان المعتمد في إصدارة العرض).
 *   ٤ — **لا لغةَ أداة**: لا رمزَ جلسةٍ (خ/ر/م + رقم)، ولا اسمَ نموذج،
 *       ولا مسارَ ملفٍّ داخليّ ولا امتدادَه.
 *
 * وما وراء القسم الجديد يُمسح ويُذكر **خبرًا لا حكمًا** (فالقديمُ مشحونٌ
 * منشورٌ، وتنقيحُه قرارُ إدارةٍ لا بندُ هذه البوّابة).
 *
 * وقاعدةُ العربيّة في هذا الملفّ: **لا `\b` مع نصٍّ عربيّ** — الحدُّ يُكتب
 * بمدياتِ `\uXXXX` صريحة (بلاغ 2026-08-12-arabic-word-boundary).
 *
 * التشغيل: node js/scripts/check-docs-sections.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AR_SRC = join(ROOT, "js", "apps", "studio", "src", "docsContent.ts");
const EN_SRC = join(ROOT, "js", "apps", "studio", "public", "docs-en.json");
const GATES = join(ROOT, "js", "data", "gates");
mkdirSync(GATES, { recursive: true });
const OUT = join(GATES, "GATE-DOCS.json");
const SECTION = "tarikh";

const fails = [];
const notes = [];
const ok = (c, m) => { if (!c) fails.push(m); return c; };

/** تجريدُ الشكل والتطويل — فالمقابلةُ على الحروف لا على الضبط */
const bare = (s) => s.replace(/[ً-ْـٰ]/gu, "");

/* ————————————————— أ — استخراجُ القسم من اللسانين ————————————————— */

/**
 * قراءةُ العربيّة من مصدر الواجهة نفسِه: تُلتقط حدودُ عنصرِ القسم بعدّ
 * الأقواس المعقوفة من `{ id: "tarikh"` — بلا تنفيذِ كودٍ ولا استيراد.
 */
function arSection(src) {
  const key = `id: "${SECTION}"`;
  const at = src.indexOf(key);
  if (at < 0) return null;
  let start = src.lastIndexOf("{", at);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return { text: src.slice(start, i + 1), start }; }
  }
  return null;
}
/** حقلٌ نصّيٌّ واحدٌ من نصّ العنصر (مزدوجات، ولا مزدوجَ داخلها في نصوصنا) */
const field = (block, name) => {
  const m = new RegExp(`${name}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "u").exec(block);
  return m ? m[1] : null;
};

const arRaw = readFileSync(AR_SRC, "utf8");
const en = JSON.parse(readFileSync(EN_SRC, "utf8"));

const arBlock = arSection(arRaw);
ok(!!arBlock, `قسمُ «${SECTION}» غيرُ موجودٍ في التوثيق العربيّ`);
const enSec = en.sections.find((s) => s.id === SECTION) ?? null;
ok(!!enSec, `قسمُ «${SECTION}» غيرُ موجودٍ في التوثيق الإنجليزيّ`);

/** ترتيبُ الأقسام في اللسانين — الفهرسُ يُرقَّم بالموضع، فاختلافُه اختلافُ رقم */
const arOrder = [...arRaw.matchAll(/^\s{4}id: "([a-z]+)",$/gmu)].map((m) => m[1]);
const enOrder = en.sections.map((s) => s.id);
ok(arOrder.length > 0, "تعذّر جردُ ترتيبِ الأقسام العربيّة");
ok(arOrder.join(",") === enOrder.join(","),
  `ترتيبُ الأقسام مختلفٌ بين اللسانين:\n    عربيّ: ${arOrder.join(", ")}\n    إنجليزيّ: ${enOrder.join(", ")}`);

/* ————————————————— ب — التنبيهُ الثابت يتقدّم الشرح ————————————————— */

const arLead = arBlock ? field(arBlock.text, "lead") : "";
const arWhat = arBlock ? field(arBlock.text, "what") : "";
const arHow = arBlock ? field(arBlock.text, "how") : "";
const arLimits = arBlock ? field(arBlock.text, "limits") : "";
const arTitle = arBlock ? field(arBlock.text, "title") : "";

const NOTICE_AR = ["تاريخ جمع المصحف", "وليس تنقيحا لنص القرآن"];
for (const part of NOTICE_AR) {
  ok(bare(arLead ?? "").includes(part), `صدرُ القسم لا يحمل التنبيهَ الثابت: «${part}»`);
}
ok(bare(arLead ?? "").indexOf("وليس تنقيحا لنص القرآن") < 160,
  "التنبيهُ الثابت متأخّرٌ في صدر القسم — حقُّه أن يتقدّم الشرح");

const NOTICE_EN = "not a revision of the text";
ok((enSec?.lead ?? "").toLowerCase().includes(NOTICE_EN),
  `صدرُ القسم الإنجليزيّ لا يحمل التنبيهَ الثابت: «${NOTICE_EN}»`);

/* ————————————————— ج — لسانُ الأقوال لا الدعاوى ————————————————— */

const arAll = [arTitle, arLead, arWhat, arHow, arLimits].filter(Boolean).join("\n");
ok(bare(arAll).includes("قول يوزن"), "لسانُ الباب غيرُ مصرَّحٍ به: «قولٌ يُوزن» غائبٌ عن القسم");
const plural = bare(arAll).match(/دعاوى/gu);
ok(!plural, `صيغةُ «دعاوى» عادت إلى القسم (${plural?.length ?? 0} موضعًا) — والمعتمدُ «أقوال»`);

/* ————————————————— د — لا لغةَ أداة ————————————————— */

/**
 * رمزُ الجلسة: حرفٌ من (خ ر م) يليه رقمٌ عربيٌّ أو لاتينيّ **مباشرةً**.
 *
 * **بلا حدٍّ ولا استثناءِ ما قبله عمدًا** — لا `\b` (فهو لا يعرف العربيّة)،
 * ولا حتّى نفيٌ خلفيٌّ بمدى `ء-ي`: لو نُفي ما قبله لأفلت الرمزُ الملتصقُ
 * بحرفٍ عربيّ («بخ٧» و«وخ٧» و«الوثيقةخ٧») وهو أشيعُ صور التسرّب. والثمنُ
 * المحتمل — «رقم٧» بلا فاصلة — خللٌ في نصٍّ معروضٍ يستحقّ الوقوفَ عليه
 * أصلًا. (عبرةُ بلاغ 2026-08-12-arabic-word-boundary.)
 */
const SESSION_CODE = /[خرم][٠-٩0-9]/gu;
/** ورموزٌ أخرى تُرصد خبرًا لا حكمًا (ت/ج/س/ب + رقم) */
const SESSION_SOFT = /[تجسب][٠-٩0-9]/gu;
const MODELS = /claude|anthropic|opus|sonnet|haiku|fable|(?<![a-z])gpt|llama|mistral|أوبوس|سونيت|هايكو|فابل|كلود/giu;
/** مسارُ ملفٍّ داخليٍّ أو امتدادُه — الروابطُ الظاهرة مسارات تطبيقٍ لا ملفّات */
const PATHS = /(findings|scripts|tools|plan|data|public|src)\/|\.(md|ts|tsx|mjs|json|jsonl|py|db|bin)(?![a-z])/giu;

const scan = (label, text) => {
  const codes = [...(text.match(SESSION_CODE) ?? [])];
  const models = [...(text.match(MODELS) ?? [])];
  const paths = [...(text.match(PATHS) ?? [])];
  const soft = [...(text.match(SESSION_SOFT) ?? [])];
  return { label, codes, models, paths, soft };
};

const enAll = enSec ? [enSec.title, enSec.lead, enSec.what, enSec.how, enSec.limits,
  ...(enSec.stats ?? []).map((x) => `${x.k} ${x.v}`)].filter(Boolean).join("\n") : "";
const arStats = arBlock ? [...arBlock.text.matchAll(/\{ k: "([^"]*)", v: "([^"]*)" \}/gu)].map((m) => `${m[1]} ${m[2]}`).join("\n") : "";

const hard = [scan("عربيّ", `${arAll}\n${arStats}`), scan("إنجليزيّ", enAll)];
for (const r of hard) {
  ok(r.codes.length === 0, `${r.label}: رمزُ جلسةٍ في القسم — ${JSON.stringify(r.codes)}`);
  ok(r.models.length === 0, `${r.label}: اسمُ نموذجٍ في القسم — ${JSON.stringify(r.models)}`);
  ok(r.paths.length === 0, `${r.label}: مسارُ ملفٍّ داخليٍّ في القسم — ${JSON.stringify(r.paths)}`);
  if (r.soft.length) notes.push(`${r.label}: رموزٌ محتملةٌ (ت/ج/س/ب + رقم) تُرصد خبرًا: ${JSON.stringify([...new Set(r.soft)])}`);
}

/* ——— مسحُ ما سوى القسم الجديد: خبرٌ للإدارة، لا حكمٌ على هذه الجلسة ——— */
const others = [];
for (const s of en.sections) {
  if (s.id === SECTION) continue;
  const t = [s.title, s.lead, s.what, s.how, s.limits].filter(Boolean).join("\n");
  const r = scan(`en:${s.id}`, t);
  if (r.codes.length || r.models.length || r.paths.length) others.push(r);
}
{
  // العربيّةُ كلُّها في ملفٍّ واحد: تُمسح نصوصُ الحقول وحدَها لا الكود
  const texts = [...arRaw.matchAll(/^\s{4}(?:lead|what|how|limits|title): "((?:[^"\\]|\\.)*)",$/gmu)].map((m) => m[1]);
  const r = scan("ar:كلُّ الأقسام", texts.join("\n"));
  if (r.codes.length || r.models.length || r.paths.length) others.push(r);
}
for (const r of others) {
  notes.push(`خارجَ القسم — ${r.label}: ${JSON.stringify({ codes: r.codes, models: r.models, paths: r.paths })}`);
}

/* ————————————————— التقرير ————————————————— */

const report = {
  ok: fails.length === 0,
  section: SECTION,
  order: { ar: arOrder, en: enOrder, equal: arOrder.join(",") === enOrder.join(",") },
  ar: { title: arTitle, leadHead: (arLead ?? "").slice(0, 90), lengths: { lead: arLead?.length, what: arWhat?.length, how: arHow?.length, limits: arLimits?.length } },
  en: { title: enSec?.title ?? null, leadHead: (enSec?.lead ?? "").slice(0, 90) },
  notes,
  failures: fails,
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
for (const n of notes) console.log(`  · خبر: ${n}`);
for (const f of fails) console.log(`  · ${f}`);
console.log(`${report.ok ? "✓" : "✗"} بوّابةُ قسم التوثيق «${SECTION}» — التقرير: ${OUT}`);
process.exit(report.ok ? 0 : 1);

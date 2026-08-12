/**
 * الضبطُ السالبُ للفاحص الدائم — **فاحصٌ لم يُجرَّب بعيبٍ مزروعٍ ليس فاحصًا.**
 *
 * يزرع في **سكربتات البوّابات نفسِها** عيبًا واحدًا في كلِّ دورة، يشغّل
 * `gate-selfcheck.mjs`، ويشترط أمرين لا واحدًا: أن يسقط الفاحص، **وأن يسقط
 * في فحصِه المقصود بعينه** — فسقوطٌ في غير موضعه ليس اصطيادًا. ثمّ يعيد كلَّ
 * شيءٍ إلى أصله ويثبت أنّ الفاحص عاد أخضر. لا يُودَع من الزرع حرف.
 *
 * والعيوبُ المزروعةُ تمثّل صورَ الانحراف الأربع:
 *   • **تساهلٌ**: حدٌّ يُضاف فيُفلت الملتصقُ بحرفٍ عربيّ، أو لفظٌ يسقط من قائمة.
 *   • **تشدّدٌ**: تضييقٌ موثَّقٌ يُوسَّع من غير قرار — فالفحصُ يحرس الوجهين.
 *   • **عودةُ `\b`**: نمطٌ يعمل ولا يُرى انحرافُه في سلوكه — فيُصطاد ساكنًا.
 *   • **نطاقٌ معكوسُ المخزون** في سكربتٍ وفي ملفِّ واجهةٍ معًا.
 * ومعها **فقدُ نمطٍ**: لو زال نمطٌ من مصدره فالفاحصُ يعلن فقدَه ولا يمرّ صامتًا.
 *
 * التشغيل: node js/scripts/gate-selfcheck-negative.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GATES = join(ROOT, "js", "data", "gates");
mkdirSync(GATES, { recursive: true });
const SELFCHECK = join(ROOT, "js", "scripts", "gate-selfcheck.mjs");
const REPORT = join(GATES, "GATE-SELFCHECK.json");

const P = {
  tarikh: join(ROOT, "js", "scripts", "check-tarikh.mjs"),
  docs: join(ROOT, "js", "scripts", "check-docs-sections.mjs"),
  lint: join(ROOT, "js", "scripts", "fahis-lint.mjs"),
  live: join(ROOT, "js", "scripts", "check-tarikh-nopush.mjs"),
  arch: join(ROOT, "js", "scripts", "check-tarikh-nopublish.mjs"),
  view: join(ROOT, "js", "apps", "studio", "src", "omni.ts"),
};
const read = (p) => readFileSync(p, "utf8");
const backup = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, read(p)]));
const restore = () => { for (const [k, p] of Object.entries(P)) writeFileSync(p, backup[k]); };

const C1 = "١ العيوب المزروعة", C2 = "٢ ترتيب النطاقات";
const C3 = "٣ لا حدَّ كلمةٍ في البوّابات", C4 = "٤ إعلانات الحراس";

/**
 * النطاقُ المعكوسُ يُركَّب حرفًا حرفًا ولا يُكتب حرفيًّا في هذا الملفّ: لو كُتب
 * لصار هذا السكربتُ نفسُه حاملَ نطاقٍ معكوسٍ فاصطاده الفاحصُ في كلِّ دورة —
 * وهو ما وقع فعلًا في أوّل صياغةٍ لهذا الضبط، فصحّحه الضبطُ من نفسه.
 */
const rev = (a, b) => `[${b}-${a}]`;

/** [اسمُ العيب، ملفُّه، الفحصُ المنتظرُ سقوطُه، دالّةُ الزرع] */
const PLANTS = [
  ["تساهلٌ: نفيٌ خلفيٌّ عربيٌّ يُضاف إلى رمز الجلسة فيُفلت الملتصق", "tarikh", C1,
    (s) => s.replace("const SESSION_CODE = /خ[١-٩]", "const SESSION_CODE = /(?<![ء-ي])خ[١-٩]")],
  ["عودةُ `\\b` إلى نمط المسار (سلوكُه لا يفضحه — يُصطاد ساكنًا)", "tarikh", C3,
    (s) => s.replace("[/(?<![A-Za-z0-9_])(data|plan|js|findings|scripts)\\/",
      "[/\\b(data|plan|js|findings|scripts)\\/")],
  ["تساهلٌ: يسقط «دعوى» من قائمة النبرة", "lint", C1,
    (s) => s.replace('const TONE = ["دعوى", ', "const TONE = [")],
  ["تشدّدٌ: يُوسَّع التضييقُ الموثَّقُ في النبرة إلى الاحتواء", "lint", C1,
    (s) => s.replace("for (const bad of TONE) if (toks.includes(strip(bad)))",
      "for (const bad of TONE) if (joined.includes(strip(bad)))")],
  ["تساهلٌ: يُضيَّق فحصُ التفاسير إلى الكلمة التامّة فيُفلت الملتصق", "lint", C1,
    (s) => s.replace("for (const bad of TAFSIR_HARD) if (joined.includes(bad))",
      "for (const bad of TAFSIR_HARD) if (toks.includes(bad))")],
  ["فقدُ نمطٍ من مصدره — لا يمرّ صامتًا", "docs", C1,
    (s) => s.replace("const SESSION_CODE = /[خرم]", "const CODE_OF_SESSION = /[خرم]")],
  ["نطاقٌ معكوسُ المخزون في سكربت بوّابة", "docs", C2,
    (s) => s.replace("const SESSION_SOFT = /[تجسب][٠-٩0-9]/gu",
      `const SESSION_SOFT = /[تجسب]${rev("٠", "٩").slice(0, -1)}0-9]/gu`)],
  ["نطاقٌ معكوسُ المخزون في ملفِّ واجهة (لا في السكربتات)", "view", C2,
    (s) => s.replace("[ء-ي]", rev("ء", "ي"))],
  ["المؤرشفُ يكتب نجاحًا لفحصٍ لم يقع", "arch", C4,
    (s) => s.replace("    ok: null,", "    ok: true,")],
  ["الحارسُ الحيُّ يُمنح مهربَ أرشفة", "live", C4,
    (s) => s.replace("const fails = [];", "const fails = []; // archived: true")],
];

/** يشغّل الفاحص ويعيد: أسقط؟ وأيُّ فحصٍ سقط؟ */
const run = () => {
  let ok = true;
  try { execFileSync("node", [SELFCHECK], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch { ok = false; }
  const rep = JSON.parse(read(REPORT));
  const failedIn = Object.entries(rep).filter(([, v]) => v && typeof v === "object" && !v.pass).map(([k]) => k);
  return { ok, failedIn };
};

let escaped = 0;
const rows = [];
console.log("• الضبطُ السالبُ للفاحص الدائم — عيوبٌ مزروعةٌ في البوّابات، واحدًا واحدًا:\n");
for (const [name, key, want, mutate] of PLANTS) {
  restore();
  const before = read(P[key]);
  const after = mutate(before);
  if (after === before) {
    console.log(`  ! ${name}: لم يقع الزرعُ أصلًا — يُراجَع`);
    escaped++; rows.push({ name, file: key, want, planted: false, caught: false });
    continue;
  }
  writeFileSync(P[key], after);
  const r = run();
  const caught = !r.ok && r.failedIn.includes(want);
  if (!caught) escaped++;
  console.log(`  ${caught ? "✓" : "✗"} ${name}\n      ${caught ? `التُقط في «${want}»` : r.ok ? "أفلت — الفاحصُ خضِر على عيبٍ قائم" : `سقط في غير موضعه (${r.failedIn.join(" · ")}) والمنتظرُ «${want}»`}`);
  rows.push({ name, file: key, want, planted: true, caught, failedIn: r.failedIn });
}

restore();
const clean = run();
console.log(`\n  ${clean.ok ? "✓" : "✗"} بعد الإعادة — الفاحصُ ${clean.ok ? "أخضر" : `أحمر (${clean.failedIn.join(" · ")})`}`);

const okAll = escaped === 0 && clean.ok;
writeFileSync(join(GATES, "GATE-SELFCHECK-NEGATIVE.json"), JSON.stringify({
  ok: okAll, planted: PLANTS.length, caught: PLANTS.length - escaped, escaped,
  cleanAfter: clean.ok, plants: rows,
}, null, 2));
console.log(`${okAll ? "✓" : "✗"} الضبطُ السالب: ${PLANTS.length - escaped}/${PLANTS.length} التُقطت`);
process.exit(okAll ? 0 : 1);

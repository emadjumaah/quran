/**
 * فاحصُ اللسان لبطاقات فاحص — لا نشرَ مع مخالفة.
 *
 * يفحص `js/data/fahis/cards.json` (المصدرُ الحاكم) على قواعد الميثاق المملاة:
 *   - الحقولُ الملزمةُ والقوائمُ المغلقة (الأنواعُ الثمانية · صيغُ الحكم الستّ).
 *   - لسانُ النبرة: «قولٌ» لا «دعوى»، ولا «فُنّدت» ولا «باطلة» ولا «زعم».
 *   - لا اسمَ باحثٍ في بطاقة (القائمةُ من research/roster.json إن وُجد محلّيًّا —
 *     فالسجلُّ لا يُرفع، وإن غاب أُعلن تجاوزُ هذا الفحص ولم يُسكت عنه).
 *   - لا ذكرَ للتفاسير في هذا القسم — لا نفيًا ولا إثباتًا.
 *   - سلامةُ التوكيد **…** أزواجًا، وثباتُ المعرّفات وأرقامِ الاستشهاد.
 *
 * الشدّة: الحقولُ المؤلَّفةُ حديثًا (العنوان · التيسير · النطاق) تُرفض عند
 * المخالفة، ونصوصُ البطاقات المنشورةُ من قبلُ يُبلَّغ عنها **تبليغًا** ولا
 * تُحرَّر آليًّا — تحريرُ المنشور قرارُ المالك لا قرارُ أداة.
 *
 * التشغيل:  node js/scripts/fahis-lint.mjs          فحصٌ فقط
 *           node js/scripts/fahis-lint.mjs --sync   فحصٌ ثم نشرُ نسخة العرض إلى public
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "data", "fahis", "cards.json");
const PUB = join(ROOT, "js", "apps", "studio", "public", "fahis-cards.json");
const ROSTER = join(ROOT, "research", "roster.json");

const KINDS = new Set(["kulliya", "adadiya", "sarfiya", "qiraat", "dalaliya", "irabiya", "taraduf", "kharij"]);
const VERDICTS = new Set(["tastaqim", "taqyid", "la-tastaqim", "lam-yatabayyan", "mawquf", "kharij-babina"]);
const QAWALIB = new Set(["adad", "kulliya", "iraab", "dalala", "taraduf", "sarf", "qiraat", "open"]);

/** ألفاظُ النبرة الممنوعة — تُلتمس كلماتٍ تامّةً لا أجزاءَ كلمات */
const TONE = ["دعوى", "الدعوى", "دعاوى", "الدعاوى", "دعواه", "دعواها", "زعم", "يزعم", "زعمه", "مزاعم", "الزعم", "فُنّدت", "فنّدت", "فُنِّدت", "تفنيد", "باطلة", "باطلٌ", "بطلان", "بطلانها", "بطلانه"];
/** التفاسيرُ لا تُذكر في هذا القسم — أعلامُها خطأٌ قاطع، وعمومُ اللفظ تبليغ */
const TAFSIR_HARD = ["الطبري", "القرطبي", "ابن كثير", "الكشاف", "التحرير والتنوير", "أضواء البيان", "البحر المحيط", "الرازي", "السعدي", "الشعراوي", "الظلال"];
const TAFSIR_SOFT = ["التفاسير", "المفسّرين", "المفسرين", "المفسّرون", "المفسرون", "تفاسير"];

/** أسماءُ الباحثين من السجلّ المحلّيّ: كلماتٌ مفردةٌ مميِّزة، وثنائيّاتٌ لما لا يُميَّز مفردُه
 *  (فلا يُحظر «إبراهيم» وهو اسمُ نبيّ، ولا «هداية» وهي لفظٌ شائع) */
function rosterTokens() {
  if (!existsSync(ROSTER)) return null;
  const names = JSON.parse(readFileSync(ROSTER, "utf8")).researchers.map((r) => r.name);
  const singles = new Set(), pairs = new Set();
  const COMMON = new Set(["محمد", "أحمد", "علي", "حسن", "يوسف", "إبراهيم", "منصور", "هداية", "عزّ", "الدين", "بن", "أبو", "عبد", "الدائم", "فرحان", "صبحي", "جمال", "عادل", "سامر", "ياسر", "نيازي", "عدنان"]);
  for (const n of names) {
    const parts = n.replace(/[«»]/g, "").split(/\s+/);
    for (const p of parts) if (!COMMON.has(p)) singles.add(p);
    for (let i = 0; i + 1 < parts.length; i++) pairs.add(`${parts[i]} ${parts[i + 1]}`);
  }
  return { singles: [...singles], pairs: [...pairs] };
}

/** تقطيعٌ على غير الحرف العربيّ — لالتماس الكلمة التامّة */
const tokenize = (s) => s.split(/[^ء-ي٠-٩ًٌٍَُِّْٰٓٔـ]+/u).filter(Boolean);
const strip = (s) => s.replace(/[ًٌٍَُِّْٰٓٔـ]/gu, "");

const errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const doc = JSON.parse(readFileSync(SRC, "utf8"));
const cards = doc.cards;
if (!Array.isArray(cards) || !cards.length) { console.error("لا بطاقات في المصدر"); process.exit(1); }

// ثباتُ المعرّفات والأرقام
const ids = new Set(), ns = new Set();
for (const c of cards) {
  if (!/^[a-z0-9-]+$/.test(c.id ?? "")) err(`${c.id}: المعرّفُ ليس لاتينيًّا مشبوكًا بشرطات`);
  if (ids.has(c.id)) err(`${c.id}: معرّفٌ مكرّر`);
  ids.add(c.id);
  if (!Number.isInteger(c.n) || c.n < 1) err(`${c.id}: رقمُ الاستشهاد مفقودٌ أو معتلّ`);
  if (ns.has(c.n)) err(`${c.id}: رقمُ الاستشهاد ${c.n} مكرّر`);
  ns.add(c.n);
}
if (ns.size && Math.max(...ns) !== cards.length) warn(`أرقامُ الاستشهاد ليست متّصلةً من ١ إلى ${cards.length} — يقع هذا إذا حُذفت بطاقة، ولا يُعاد استعمالُ رقمٍ أبدًا`);

for (const c of cards) {
  const at = c.id ?? `#${c.n}`;
  // الحقولُ الملزمة
  for (const f of ["id", "n", "title", "claim", "plain", "kinds", "kindDetail", "verdict", "verdictDetail", "scope", "evidence", "limit", "lemmas", "topics", "date", "batch", "revisions"])
    if (c[f] === undefined) err(`${at}: الحقلُ «${f}» مفقود`);
  if (!Array.isArray(c.kinds) || !c.kinds.length || c.kinds.some((k) => !KINDS.has(k))) err(`${at}: نوعٌ من خارج الأنواع الثمانية: ${JSON.stringify(c.kinds)}`);
  if (!VERDICTS.has(c.verdict)) err(`${at}: حالةٌ من خارج صيغ الحكم الستّ: ${c.verdict}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date ?? "")) err(`${at}: التاريخُ ليس بصيغة ISO`);
  if (!Number.isInteger(c.batch) || c.batch < 1) err(`${at}: رقمُ الدفعة معتلّ`);
  if (!Array.isArray(c.revisions)) err(`${at}: سجلُّ المراجعات ليس مصفوفة`);

  // الشواهد
  if (!Array.isArray(c.evidence) || !c.evidence.length) err(`${at}: لا شواهد — ولا بطاقةَ بلا شواهد`);
  for (const [i, e] of (c.evidence ?? []).entries()) {
    if (typeof e.text !== "string" || !e.text.trim()) err(`${at}: الشاهد ${i + 1} بلا نصّ`);
    if (!(e.rank === null || (Number.isInteger(e.rank) && e.rank >= 1 && e.rank <= 5))) err(`${at}: الشاهد ${i + 1} برتبةٍ معتلّة (${e.rank}) — رتبةٌ من ١ إلى ٥ أو null لسطر المنهج`);
    if (typeof e.counter !== "boolean") err(`${at}: الشاهد ${i + 1} بلا وسم counter`);
  }

  // الإسنادُ الداخليّ (أمرُ المالك 2026-08-01): لكلِّ بطاقةٍ مصادرُها — الباحثُ
  // ومرجعُه (كتابٌ/موقعٌ/تفريغٌ برابطه، أو النسبةُ العامّةُ من السجلّ). لا يظهر
  // في الصفحة اليوم، ويُجرَّد من نسخة العرض عند المزامنة — جاهزًا للإظهار متى قُرّر.
  if (!Array.isArray(c.sources) || !c.sources.length) err(`${at}: بلا إسنادٍ داخليّ (sources) — لكلِّ بطاقةٍ مَن أثارها ومرجعُه`);
  for (const [i, s] of (c.sources ?? []).entries()) {
    if (!s.researcher) err(`${at}: المصدر ${i + 1} بلا اسم باحث`);
    if (!["book", "site", "video", "corpus"].includes(s.kind)) err(`${at}: المصدر ${i + 1} بنوعٍ مجهول (${s.kind})`);
    if (s.kind !== "corpus" && !s.ref) err(`${at}: المصدر ${i + 1} (${s.kind}) بلا رابط`);
    if (s.kind === "corpus" && !s.note) err(`${at}: المصدر ${i + 1} العامُّ بلا بيان`);
  }

  // وصلةُ الأداة: للبطاقة المحسوبة وصلةٌ أو علّةُ غياب
  if (c.tool) {
    if (!QAWALIB.has(c.tool.qalab)) err(`${at}: قالبُ الأداة مجهول: ${c.tool.qalab}`);
  } else if (!c.toolNote) {
    const countable = c.kinds.some((k) => k === "adadiya" || k === "kulliya");
    if (countable) err(`${at}: بطاقةٌ محسوبةُ النوع بلا وصلة أداةٍ ولا علّةِ غياب (toolNote)`);
    else warn(`${at}: لا وصلةَ أداةٍ ولا علّة — يُستحسن بيانُها`);
  }

  // سلامةُ التوكيد
  for (const [f, t] of [["claim", c.claim], ["limit", c.limit], ...(c.evidence ?? []).map((e, i) => [`الشاهد ${i + 1}`, e.text])])
    if (((t ?? "").match(/\*\*/g) ?? []).length % 2) err(`${at}: توكيدٌ ** غيرُ مزدوجٍ في ${f}`);

  // لسانُ النبرة والتفاسير — الشدّةُ بحسب الحقل
  const NEW_FIELDS = [["title", c.title], ["plain", c.plain], ["scope", c.scope], ["toolNote", c.toolNote ?? ""]];
  const OLD_FIELDS = [["claim", c.claim], ["kindDetail", c.kindDetail], ["verdictDetail", c.verdictDetail], ["limit", c.limit], ...(c.evidence ?? []).map((e, i) => [`الشاهد ${i + 1}`, e.text])];
  for (const [severity, fields] of [["err", NEW_FIELDS], ["warn", OLD_FIELDS]]) {
    const report = severity === "err" ? err : warn;
    for (const [f, raw] of fields) {
      const toks = tokenize(strip(raw ?? ""));
      const joined = strip(raw ?? "");
      for (const bad of TONE) if (toks.includes(strip(bad))) report(`${at}/${f}: لفظُ نبرةٍ ممنوع «${bad}»`);
      for (const bad of TAFSIR_HARD) if (joined.includes(bad)) report(`${at}/${f}: ذكرُ تفسيرٍ أو مفسِّر «${bad}» — لا تُذكر التفاسيرُ في هذا القسم`);
      for (const bad of TAFSIR_SOFT) if (toks.includes(bad)) (severity === "err" ? err : warn)(`${at}/${f}: لفظٌ من جنس التفاسير «${bad}»`);
    }
  }

  // أسماءُ الباحثين — من السجلّ المحلّيّ
  const roster = rosterTokens();
  if (roster) {
    const all = [...NEW_FIELDS, ...OLD_FIELDS];
    for (const [f, raw] of all) {
      const toks = tokenize(strip(raw ?? ""));
      const joined = strip(raw ?? "");
      for (const s of roster.singles) if (toks.includes(strip(s))) err(`${at}/${f}: اسمُ باحثٍ في بطاقة «${s}» — الفكرةُ تُبحث لا قائلُها`);
      for (const p of roster.pairs) if (joined.includes(strip(p))) err(`${at}/${f}: اسمُ باحثٍ في بطاقة «${p}»`);
    }
  }
}
if (!rosterTokens()) warn("research/roster.json غيرُ موجودٍ هنا — فحصُ أسماء الباحثين لم يجرِ (يجري على جهاز العمل حيث السجلُّ المحلّيّ)");

// ── التقرير ──────────────────────────────────────────────────────────────────
for (const w of warns) console.log(`⚠ ${w}`);
for (const e of errors) console.log(`✗ ${e}`);
console.log(`\n${cards.length} بطاقةً · ${errors.length} خطأً · ${warns.length} تبليغًا`);
if (errors.length) process.exit(1);

if (process.argv.includes("--sync")) {
  // نسخةُ العرض تُجرَّد من الإسناد الداخليّ — «الفكرةُ تُبحث لا قائلُها» في المنشور،
  // والإسنادُ محفوظٌ في المصدر الحاكم جاهزًا للإظهار متى قرّر المالك
  const pubCards = cards.map(({ sources, ...rest }) => rest);
  writeFileSync(PUB, JSON.stringify({ date: new Date().toISOString().slice(0, 10), cards: pubCards }), "utf8");
  const raw = readFileSync(PUB, "utf8");
  const leak = ["sources", ...(rosterTokens()?.singles ?? [])].filter((t) => raw.includes(`"${t}"`) || (t !== "sources" && raw.includes(t)));
  if (leak.length) { console.error(`✗ تسرّب إلى نسخة العرض: ${leak.join("، ")}`); process.exit(1); }
  console.log(`✓ نُشرت نسخةُ العرض مجرَّدةً من الإسناد → ${PUB}`);

  // مسابرُ الفحص (الخطّة ٧٫٥/٤٫٤): أرقامٌ معلومةُ الحكم تُعاد من القاعدة قبل أيِّ نشر
  const { runProbes } = await import("./fahis-probes.mjs");
  const pr = await runProbes();
  if (pr.skipped) console.log("⚠ quran-kg.db غيرُ حاضرةٍ — المسابرُ لم تُشغَّل هنا؛ شغِّلها على جهازٍ فيه القاعدة");
  else if (pr.fail) { console.error("✗ مسبارٌ منحرفٌ — المزامنةُ لا تمرّ"); process.exit(1); }
}

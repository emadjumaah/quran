/**
 * بوّابةُ باب «ملفّ جمع القرآن» — لا عرضَ مع مخالفة.
 *
 * بنودُها الستّة:
 *   ١ — **حرفيّةُ العرض:** عيّنةُ ٢٠ روايةً ببذرةٍ ثابتة تُقابَل نصوصُها المعروضة
 *       بمصدرها في **مستودع التاريخ** حرفًا حرفًا (لا باللقطة — بالمصدر)، ثمّ
 *       الجملةُ كلُّها بعدها.
 *   ٢ — **أمانةُ الأحكام:** كلُّ مقطعٍ حكميٍّ في ملفّات العرض موجودٌ في
 *       `HUKM-JAMC-v1.1.md` حرفيًّا (وشروحُ الدرجات في `METHOD.md`)، والدرجاتُ
 *       المعروضة تطابق مسحًا مستقلًّا لنصّ v1.1 — وصفرُ جملةٍ تقويميّةٍ مضافة:
 *       لا يذكر كودُ الواجهة اسمَ درجةٍ ولا لفظَ نبرةٍ من عنده. **ويُقابَل مصدرُ
 *       العرض بالمختومة الأصل** فيثبت أنّ ما بينهما لفظٌ لا حكم.
 *   ٣ — **التتبّع:** كلُّ عقدةِ شجرةٍ → سجلٌّ → نصٌّ، صفرُ انقطاع؛ وكلُّ بطاقةٍ
 *       وثائقيّةٍ تحمل إحالتها في سجلّ §٤؛ وكلُّ إحالةِ عنقودٍ مشجَّرةٌ أو معلَنة.
 *   ٤ — **الكسل:** فهرسُ الأقوال لا يحمل حمولةَ عنقودٍ واحدة.
 *   ٥ — **نظافةُ العرض:** لا اسمَ محرِّرٍ ولا مسارَ ملفٍّ ولا بصمةَ إيداعةٍ ولا
 *       رمزَ جلسةٍ في ملفّات العرض **الأربعة** (ومنها نسخةُ نبراس)؛ والموضعُ
 *       المُعلَنُ الباقي داخلَ حكمٍ مختوم مُؤنَّسٌ بخريطةٍ مغلقةٍ تُفحص، والمصدرُ
 *       لا يُمَسّ (٥/ب — إذنُ الإدارة س١٠).
 *   ٦ — **التوجيهُ التحريريُّ للقول الثامن** (قرارُ الإدارة س٧): التمييزُ الثنائيُّ
 *       مُصدَّرٌ في بطاقته، وإحالةُ «يُقرأ مع» متبادلةٌ بأساسٍ مفحوص، ولا قوائمَ
 *       حروفٍ إفراديّة، ولا لفظَ طعنٍ في النصّ الحاضر.
 *
 * التشغيل: node js/scripts/check-tarikh.mjs [--history /path/to/history]
 * يخرج بصفرٍ إن نجحت البنود كلُّها، وبواحدٍ عند أوّل مخالفة.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "data", "tarikh-sources");
const PUB = join(ROOT, "js", "apps", "studio", "public");
const VIEWS = join(ROOT, "js", "apps", "studio", "src");
const argH = process.argv.indexOf("--history");
const HISTORY = argH > -1 ? process.argv[argH + 1] : "/Volumes/data/new-projects/history";

/** مصدرُ العرض منذ خ٧-ب: v1.1 — تنقيحُ لسانٍ للمختومة، لا مساسَ بحكم.
 *  والمختومةُ الأصلُ في اللقطة أيضًا، وتُقابَل بها v1.1 في البند ٢/د. */
const V1 = readFileSync(join(SRC, "hukm", "HUKM-JAMC-v1.1.md"), "utf8");
const V1_SEALED = readFileSync(join(SRC, "hukm", "HUKM-JAMC-v1.md"), "utf8");
const METHOD = readFileSync(join(SRC, "hukm", "METHOD.md"), "utf8");
const claims = JSON.parse(readFileSync(join(PUB, "tarikh-claims.json"), "utf8"));

const report = { gates: [], failures: [] };
let failed = 0;
const gate = (id, title) => {
  const g = { id, title, checks: 0, failures: [] };
  report.gates.push(g);
  return {
    ok(cond, msg) {
      g.checks++;
      if (!cond) { g.failures.push(msg); report.failures.push(`[${id}] ${msg}`); failed++; }
    },
    g,
  };
};

// ——————————————————————————————————————————————————————————
// ١ — حرفيّةُ العرض: عيّنةُ ٢٠ روايةً ببذرةٍ ثابتة، مقابَلةً بمستودع التاريخ
// ——————————————————————————————————————————————————————————
const g1 = gate("١", "حرفيّةُ العرض — ٢٠ روايةً ببذرةٍ ثابتة تُقابَل مصدرَها في مستودع التاريخ");
{
  // كلُّ سجلٍّ معروضٍ في ملفّات العناقيد، مرتّبًا ترتيبًا ثابتًا
  const shown = new Map();
  for (const f of readdirSync(PUB).filter((x) => /^tarikh-cluster-.*\.json$/.test(x)).sort()) {
    const cl = JSON.parse(readFileSync(join(PUB, f), "utf8"));
    for (const r of cl.records) if (!shown.has(r.id)) shown.set(r.id, r);
  }
  const ids = [...shown.keys()].sort();
  // بذرةٌ ثابتة: مولّدٌ خطّيٌّ متطابقُ التشغيل — العيّنةُ نفسُها في كلِّ مرّة
  let seed = 20260803;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = [];
  const pool = [...ids];
  while (pick.length < 20 && pool.length) pick.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
  g1.ok(pick.length === 20, `العيّنةُ ${pick.length} لا ٢٠`);

  const srcReports = join(HISTORY, "data", "jamc-quran", "reports.jsonl");
  if (!existsSync(srcReports)) {
    g1.ok(false, `مستودعُ التاريخ غيرُ متاحٍ للمقابلة: ${srcReports} — البندُ لا يُتخطّى صامتًا`);
  } else {
    const origin = new Map();
    for (const line of readFileSync(srcReports, "utf8").split("\n")) {
      if (!line) continue;
      const o = JSON.parse(line);
      if (shown.has(o.id)) origin.set(o.id, o);
    }
    let matched = 0;
    for (const id of pick) {
      const a = shown.get(id), b = origin.get(id);
      if (!b) { g1.ok(false, `${id}: ليس في مدوّنة المصدر`); continue; }
      const same = a.fullText === b.full_text
        && (a.matnOnly ?? null) === (b.matn_only ?? null)
        && (a.isnadRaw ?? null) === (b.isnad_raw ?? null)
        && (a.source.workAr ?? null) === (b.source?.work_ar ?? null)
        && (a.source.deathAh ?? null) === (b.source?.death_ah ?? null)
        && (a.source.locus ?? null) === (b.source?.locus ?? null)
        && (a.jamiRef ?? null) === (b.jami_ref ?? null);
      g1.ok(same, `${id}: نصُّ العرض لا يطابق المصدر حرفًا`);
      if (same) matched++;
    }
    g1.g.sample = { size: pick.length, matched, ids: pick };
    // ثمّ الجملةُ كلُّها — لا العيّنةَ وحدها
    let all = 0;
    for (const [id, a] of shown) {
      const b = origin.get(id);
      if (b && a.fullText === b.full_text) all++;
    }
    g1.g.allRecords = { total: shown.size, matched: all };
    g1.ok(all === shown.size, `مطابقةُ النصوص كلِّها: ${all}/${shown.size}`);
  }
}

// ——————————————————————————————————————————————————————————
// ٢ — أمانةُ الأحكام
// ——————————————————————————————————————————————————————————
const g2 = gate("٢", "أمانةُ الأحكام — كلُّ مقطعٍ حكميٍّ منقولٌ حرفًا، والدرجاتُ تطابق مسحًا مستقلًّا");
const GRADE_LABEL = {
  thabit: "ثابت وثائقيًا", rajih: "راجح بالتقاطع",
  muhtamal: "محتمل", mawquf: "موقوف", marjuh: "مرجوح",
};
{
  const inV1 = (s) => V1.includes(s);
  const inMethod = (s) => METHOD.includes(s);

  // ٢/أ — كلُّ نصٍّ في فهرس الدعاوى موجودٌ في مصدره حرفيًّا
  let lifted = 0;
  const walkStrings = (node, path, allow) => {
    if (typeof node === "string") {
      if (!node.trim()) return;
      lifted++;
      g2.ok(allow(node), `مقطعٌ ليس في مصدره حرفيًّا (${path}): «${node.slice(0, 60)}…»`);
      return;
    }
    if (Array.isArray(node)) node.forEach((x, i) => walkStrings(x, `${path}[${i}]`, allow));
  };
  for (const c of claims.claims) {
    for (const [k, f] of Object.entries(c.fields)) {
      for (const part of ["label", "note", "inline", "raw"]) {
        const s = f[part];
        if (s) { lifted++; g2.ok(inV1(s), `${c.id}.${k}.${part} ليس في v1 حرفيًّا`); }
      }
    }
    for (const [i, r] of c.rulings.entries()) {
      for (const part of ["raw", "body"]) {
        if (r[part]) { lifted++; g2.ok(inV1(r[part]), `${c.id}.ruling[${i}].${part} ليس في v1 حرفيًّا`); }
      }
    }
    lifted++; g2.ok(inV1(c.title), `${c.id}: العنوانُ ليس في v1`);
  }
  for (const w of claims.documentary.witnesses) {
    lifted += 2;
    g2.ok(inV1(w.title), `${w.id}: عنوانُ الشاهد ليس في v1`);
    g2.ok(inV1(w.raw), `${w.id}: نصُّ الشاهد ليس في v1`);
  }
  lifted++; g2.ok(inV1(claims.documentary.generalLimit), "الحدُّ العام ليس في v1");
  for (const q of claims.qoyud) { lifted++; g2.ok(inV1(q.raw), `${q.id} ليس في v1`); }
  for (const h of claims.howToRead) { lifted++; g2.ok(inV1(h.raw), `«كيف تُقرأ» ${h.n} ليس في v1`); }
  for (const it of claims.conclusion.items) { lifted++; g2.ok(inV1(it.raw), `الخلاصة ${it.n} ليست في v1`); }
  // الميثاقُ في صفحة «المصادر والمنهج»: منقولٌ حرفًا من METHOD.md
  const m = claims.method;
  lifted += 2;
  g2.ok(inMethod(m.title), "عنوانُ الميثاق ليس في METHOD.md");
  g2.ok(inMethod(m.aim), "غايةُ الميثاق ليست في METHOD.md");
  for (const part of ["ladder", "rules", "limits"]) {
    lifted++;
    g2.ok(inMethod(m[part].title), `عنوانُ «${part}» ليس في METHOD.md`);
    for (const it of m[part].items) { lifted++; g2.ok(inMethod(it), `بندٌ من «${part}» ليس في METHOD.md حرفيًّا`); }
  }
  g2.ok(m.ladder.items.length === 5, `سلّمُ الأدلّة ${m.ladder.items.length} لا ٥`);
  g2.ok(m.rules.items.length === 7, `قواعدُ الفحص ${m.rules.items.length} لا ٧`);

  // شروحُ الدرجات: من الميثاق لا من عندنا
  for (const gr of claims.grades) {
    lifted += 2;
    g2.ok(inV1(gr.label), `اسمُ الدرجة «${gr.label}» ليس في v1`);
    g2.ok(inMethod(gr.gloss), `شرحُ الدرجة «${gr.label}» ليس في الميثاق حرفيًّا`);
  }
  // مرتكزاتُ السطر الزمنيّ عباراتٌ منقولةٌ أيضًا
  const tl = JSON.parse(readFileSync(join(PUB, "tarikh-timeline.json"), "utf8"));
  for (const p of tl.points) { lifted++; g2.ok(inV1(p.phrase), `مرتكزٌ زمنيٌّ ليس في v1: ${p.key}`); }
  for (const b of tl.bands) { lifted += 2; g2.ok(inV1(b.phrase), `نطاقٌ زمنيٌّ ليس في v1`); g2.ok(inV1(b.band), `مدى ${b.witness} ليس في v1`); }
  walkStrings([], "", inV1);
  g2.g.liftedSegments = lifted;

  // ٢/ب — مسحٌ مستقلّ: درجاتُ كلِّ دعوى من نصّ v1 مباشرةً
  const blocks = V1.split(/^### /m).slice(1);
  const byId = new Map();
  for (const b of blocks) {
    const id = b.slice(0, b.indexOf(" ")).trim();
    const hukmStart = b.search(/\*\*الحكم/);
    const nextField = b.slice(hukmStart).search(/\n\*\*(حدوده|ما الذي يغيّر الدرجة)/);
    const hukm = b.slice(hukmStart, nextField > -1 ? hukmStart + nextField : b.length);
    const found = new Set();
    for (const [gid, label] of Object.entries(GRADE_LABEL)) if (hukm.includes(label)) found.add(gid);
    byId.set(id, found);
  }
  for (const c of claims.claims) {
    const scanned = byId.get(c.id);
    g2.ok(!!scanned, `${c.id}: لم يُعثر على فقرة حكمه في المسح المستقلّ`);
    if (!scanned) continue;
    const shownGrades = new Set(c.grades);
    const missing = [...scanned].filter((x) => !shownGrades.has(x));
    const extra = [...shownGrades].filter((x) => !scanned.has(x));
    g2.ok(missing.length === 0, `${c.id}: درجةٌ في v1 ولم تُعرض: ${missing.map((x) => GRADE_LABEL[x]).join("، ")}`);
    g2.ok(extra.length === 0, `${c.id}: درجةٌ معروضةٌ ليست في فقرة حكمه: ${extra.map((x) => GRADE_LABEL[x]).join("، ")}`);
    g2.ok(c.grade === c.rulings.find((r) => r.grades.length)?.grades[0], `${c.id}: شارةُ البطاقة ليست درجةَ الحكم الأوّل`);
  }

  // ٢/ج — صفرُ جملةٍ تقويميّةٍ مضافة: كودُ الواجهة لا يذكر درجةً ولا لفظَ نبرة
    // ولسانُ الباب لسانُ «ميزان الأقوال»: **قولٌ** يُوزن لا دعوى تُرمى بها فئة.
    // وأُلحقت بالقائمة (خ٧-ب، توجيهُ الإدارة س٧) ألفاظُ الطعن في النصّ الحاضر:
    // فثبوتُ **جنس** مصاحف الصحابة وثائقيًّا شاهدُ قوّةٍ لحدث التوحيد لا ثغرةٌ
    // فيه — ولا يجوز أن يوحي حرفٌ من عندنا بغير ذلك.
  const TONE = ["زعم", "يزعم", "مزاعم", "باطل", "بطلان", "فُنّدت", "فنّدت", "خرافة",
    "مؤامرة", "أكذوبة", "قطعًا", "بلا شكّ", "لا شكّ", "دعوى", "الدعوى", "دعاوى", "الدعاوى",
    "مطعن", "طعن", "ثغرة", "تحريف", "محرَّف", "مشكوك", "تشكيك", "ضائع", "ضياع", "نقص"];
  const files = ["views/TarikhMasadir.tsx", "components/TarikhTabs.tsx", "views/Tarikh.tsx", "views/TarikhClaim.tsx", "views/TarikhHukm.tsx",
    "components/TarikhTree.tsx", "components/TarikhFooter.tsx", "components/GradeChip.tsx",
    "lib/tarikhData.ts", "lib/tarikhMd.tsx", "lib/tarikhTheme.ts"];
  // التعليقاتُ تُنزع أوّلًا: شرحُ المبرمج ليس نصَّ عرض، والمفحوصُ ما يُعرض
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  // الالتماسُ كلماتٍ تامّةً لا أجزاءَ كلمات — «محتملُ الخلط» في شرح ق-ج ليس درجة
  const words = (s) => new Set(s.split(/[^ء-ي]+/u).filter(Boolean));
  const hasPhrase = (bag, phrase) => phrase.split(/\s+/).every((w) => bag.has(w.replace(/[ً-ْ]/gu, "")));
  for (const f of files) {
    const s = stripComments(readFileSync(join(VIEWS, f), "utf8"));
    const bag = new Set([...words(s)].map((w) => w.replace(/[ً-ْ]/gu, "")));
    // اسمُ الدرجة ممنوعٌ أن يكون **نصًّا معروضًا قائمًا بنفسه** في الكود (سلسلةً
    // أو عقدةَ JSX)؛ وأمّا وقوعُه صفةً داخل جملةٍ منقولةٍ (نحو «محتملُ الخلط» في
    // شرح القيد ق-ج) فليس درجةً ولا يُمنع.
    for (const label of Object.values(GRADE_LABEL)) {
      const re = new RegExp(`(["'\`>])\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[.،]?\\s*(["'\`<])`);
      g2.ok(!re.test(s), `${f}: اسمُ درجةٍ نصًّا قائمًا في الكود («${label}») — الدرجاتُ تأتي من البيانات وحدها`);
      // والدرجتان المركّبتان («ثابت وثائقيًا» و«راجح بالتقاطع») ممنوعتان **أينما
      // وقعتا** في الكود لا نصًّا قائمًا فحسب: لفظُهما لا يلتبس بصفةٍ في جملةٍ
      // منقولة — بخلاف المفردات («محتملُ الخلط» في شرح ق-ج) فتبقى على القاعدة
      // الأولى. (شدّدت في خ٧-ب بعد أن أفلت زرعٌ من الضبط السالب.)
      if (label.includes(" ")) {
        g2.ok(!s.includes(label), `${f}: اسمُ درجةٍ مركّبةٍ في الكود («${label}») — الدرجاتُ تأتي من البيانات وحدها`);
      }
    }
    for (const t of TONE) {
      g2.ok(!hasPhrase(bag, t), `${f}: لفظُ نبرةٍ ممنوع («${t}»)`);
    }
  }

  // ٢/د — **مصدرُ العرض مقابلَ المختومة الأصل**: ما بينهما لفظٌ لا حكم.
  // فحصٌ مستقلٌّ داخل مشكاة، لا يثق بفحص مستودع التاريخ ولا يغني عنه: لو زُحزح
  // حرفٌ من درجةٍ أو رقمٍ أو معرّفٍ في مصدر العرض لسقط الباب هنا.
  {
    // المقابلةُ على **متن الوثيقة** (§٠…§٤) — وهو وحدَه ما يخرج إلى العرض.
    // وسجلُّ الختم (§٥) سجلُّ تحريرٍ يختلف بينهما بالضرورة (فيه فقرةُ v1.1).
    const body = (doc) => {
      const a = doc.indexOf("## ٠."), b = doc.indexOf("## ٥.");
      if (a < 0 || b < 0) return null;
      return doc.slice(a, b);
    };
    const B_SEALED = body(V1_SEALED), B_SHOWN = body(V1);
    g2.ok(!!B_SEALED && !!B_SHOWN, "تعذّر تحديدُ متن الوثيقتين للمقابلة");
    const seq = (doc, re) => (doc ?? "").match(re) ?? [];
    const INV = [
      ["الأرقام العربية", /[٠-٩]+/g],
      ["الأرقام اللاتينية", /\d+/g],
      ["معرّفات العناقيد", /clx-jamc-\d{4}(?:-[0-9a-f]{6})?/g],
      ["رموز الشواهد", /و[١-٥](?![ء-ي])/g],
      ["رموز القيود", /ق-[أ-ي]/g],
      ["الأعلام اللاتينية", /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]+/g],
    ];
    for (const [name, re] of INV) {
      const a = seq(B_SEALED, re), b = seq(B_SHOWN, re);
      g2.ok(a.length === b.length && a.every((x, i) => x === b[i]),
        `مصدرُ العرض خالف المختومة في تسلسل «${name}» (${a.length} ← ${b.length})`);
    }
    for (const label of Object.values(GRADE_LABEL)) {
      const a = (B_SEALED ?? "").split(label).length, b = (B_SHOWN ?? "").split(label).length;
      g2.ok(a === b, `مصدرُ العرض خالف المختومة في عددِ الدرجة «${label}» (${a - 1} ← ${b - 1})`);
    }
    const claimGrades = (doc) => {
      const m = new Map();
      for (const blk of doc.split(/^### /m).slice(1)) {
        const cid = blk.slice(0, blk.indexOf(" ")).trim();
        const hs = blk.search(/\*\*الحكم/);
        if (hs < 0) continue;
        const nx = blk.slice(hs).search(/\n\*\*(حدوده|ما الذي يغيّر الدرجة)/);
        const hukm = blk.slice(hs, nx > -1 ? hs + nx : blk.length);
        m.set(cid, Object.values(GRADE_LABEL).filter((l) => hukm.includes(l)).sort().join("، "));
      }
      return m;
    };
    const ca = claimGrades(B_SEALED ?? ""), cb = claimGrades(B_SHOWN ?? "");
    g2.ok(ca.size === 8 && cb.size === 8, `أقوالُ المقابلة ${ca.size}/${cb.size} لا ٨/٨`);
    for (const [cid, gs] of ca) {
      g2.ok(cb.get(cid) === gs, `${cid}: درجاتُ فقرة الحكم اختلفت بين المختومة ومصدر العرض`);
    }
    // ولا يبقى في مصدر العرض لفظُ «دعوى» — وإلا فاللسانُ لم يُنقَّح
    g2.ok(!/دعو[ىا]|دعاوى/.test(B_SHOWN ?? ""), "بقي لفظُ «دعوى» في متن مصدر العرض");
  }
}

// ——————————————————————————————————————————————————————————
// ٣ — التتبّع: عقدة → سجل → نص، وكلُّ بطاقةٍ وثائقيّةٍ بإحالتها
// ——————————————————————————————————————————————————————————
const g3 = gate("٣", "التتبّع — عقدة ← سجل ← نصّ بلا انقطاع، وكلُّ بطاقةٍ وثائقيّةٍ بإحالتها");
{
  let nodes = 0, nodesWithRecords = 0, edges = 0, records = 0;
  const chainless = [];
  for (const f of readdirSync(PUB).filter((x) => /^tarikh-cluster-.*\.json$/.test(x)).sort()) {
    const cl = JSON.parse(readFileSync(join(PUB, f), "utf8"));
    const recIds = new Set(cl.records.map((r) => r.id));
    for (const r of cl.records) {
      records++;
      g3.ok(typeof r.fullText === "string" && r.fullText.length > 0, `${cl.id}/${r.id}: سجلٌّ بلا نصّ`);
      g3.ok(!!r.source.workAr, `${cl.id}/${r.id}: سجلٌّ بلا مصدر`);
    }
    const nodeIds = new Set(cl.nodes.map((n) => n.id));
    for (const n of cl.nodes) {
      nodes++;
      for (const rid of n.records) {
        g3.ok(recIds.has(rid), `${cl.id}/${n.id}: عقدةٌ تُحيل إلى سجلٍّ غيرِ مشحون (${rid})`);
      }
      if (n.records.length) nodesWithRecords++;
    }
    for (const e of cl.edges) {
      edges++;
      g3.ok(nodeIds.has(e.from) && nodeIds.has(e.to), `${cl.id}: حافّةٌ إلى عقدةٍ غيرِ موجودة`);
      for (const rid of e.records) g3.ok(recIds.has(rid), `${cl.id}: حافّةٌ تُحيل إلى سجلٍّ غيرِ مشحون (${rid})`);
    }
    // كلُّ سجلٍّ مشحونٍ يُبلَغ: إمّا من عقدةٍ في الشجرة، وإمّا معلَّمًا `chainless`
    // فيُعرض على حِدةٍ في صفحة الدعوى — فلا يبقى نصٌّ لا سبيلَ إليه.
    const reachable = new Set(cl.nodes.flatMap((n) => n.records));
    for (const r of cl.records) {
      const viaNode = reachable.has(r.id);
      g3.ok(viaNode !== r.chainless, `${cl.id}/${r.id}: علَمُ chainless لا يطابق بلوغَ العقد`);
      g3.ok(viaNode || r.chainless, `${cl.id}: سجلٌّ لا تبلغه عقدةٌ ولا هو معلَّم (${r.id})`);
      if (r.chainless) chainless.push(`${cl.id}/${r.id}`);
    }
  }
  g3.g.counts = { nodes, nodesWithRecords, edges, records, chainless: chainless.length };
  g3.g.chainless = chainless;
  // ما عُلّم `chainless` لا بدّ أن تعرضه صفحةُ الدعوى بنصّه — وإلا فهو مخبوء
  if (chainless.length) {
    const view = readFileSync(join(VIEWS, "views", "TarikhClaim.tsx"), "utf8");
    g3.ok(/r\.chainless/.test(view) && /fullText/.test(view),
      "سجلاتٌ بلا إسنادٍ مسنَد موجودةٌ في البيانات ولا تعرضها صفحةُ الدعوى");
  }

  // بطاقاتُ البيّنة الوثائقية: لكلِّ واحدةٍ إحالتُها المنشورة في §٤
  const refs = claims.externalRefs.raw;
  const CITE = { "و١": ["Sadeghi"], "و٢": ["van Putten"], "و٣": ["Cook", "Sidky"], "و٤": ["Déroche"], "و٥": [] };
  for (const w of claims.documentary.witnesses) {
    const need = CITE[w.id] ?? [];
    for (const token of need) {
      g3.ok(w.raw.includes(token) || refs.includes(token),
        `${w.id}: إحالتُه (${token}) غيرُ موجودةٍ لا في بطاقته ولا في سجلّ الإحالات`);
    }
    g3.ok(w.raw.length > 40, `${w.id}: بطاقةٌ بلا متن`);
  }
  g3.ok(refs.length > 200, "سجلُّ الإحالات الخارجية فارغٌ أو ناقص");

  // إحالاتُ العناقيد: إمّا مشحونةٌ ومعروضة، وإمّا معلَنةٌ خارجَ اللقطة
  const have = new Set(claims.clusterIndex.map((c) => c.id));
  for (const c of claims.claims) {
    for (const ref of c.clusters) {
      if (ref.inSnapshot) g3.ok(have.has(ref.id), `${c.id}: إحالةٌ إلى عنقودٍ غيرِ مشحون (${ref.ref})`);
      else g3.ok(ref.id === null, `${c.id}: إحالةٌ ملتبسة (${ref.ref})`);
    }
  }
  g3.g.outOfSnapshot = claims.claims.flatMap((c) => c.clusters.filter((x) => !x.inSnapshot).map((x) => `${c.id}:${x.ref}`));

  // فهرسُ الكتب المعروض: كلُّ كتابٍ فيه مشحونٌ فعلًا، والمجموعُ يطابق السجلات
  const works = new Map();
  for (const f of readdirSync(PUB).filter((x) => /^tarikh-cluster-.*\.json$/.test(x))) {
    for (const r of JSON.parse(readFileSync(join(PUB, f), "utf8")).records) {
      const k = r.source.workAr ?? "—";
      works.set(k, (works.get(k) ?? 0) + 1);
    }
  }
  for (const w of claims.corpus) {
    g3.ok(works.has(w.work), `فهرسُ الكتب يذكر كتابًا لا روايةَ له في العرض: ${w.work}`);
    g3.ok(works.get(w.work) === w.records, `${w.work}: العددُ المعروض ${w.records} والمشحونُ ${works.get(w.work)}`);
  }
  g3.ok(claims.corpus.length === works.size, `فهرسُ الكتب ${claims.corpus.length} والمشحونُ ${works.size}`);
  g3.g.corpusWorks = claims.corpus.length;
}

// ——————————————————————————————————————————————————————————
// ٤ — الكسل: الفهرسُ خفيفٌ ولا يحمل عنقودًا
// ——————————————————————————————————————————————————————————
const g4 = gate("٤", "الكسل — فهرسُ الأقوال لا يحمل حمولةَ عنقود");
{
  const raw = readFileSync(join(PUB, "tarikh-claims.json"), "utf8");
  g4.ok(!/"nodes":\s*\[/.test(raw), "فهرسُ الأقوال يحمل عقدَ شجرة");
  g4.ok(!/"fullText"/.test(raw), "فهرسُ الأقوال يحمل نصوصَ روايات");
  g4.ok(raw.length < 300_000, `فهرسُ الأقوال ثقيل: ${raw.length} بايت`);
  const clusterFiles = readdirSync(PUB).filter((x) => /^tarikh-cluster-.*\.json$/.test(x));
  g4.ok(clusterFiles.length === claims.clusterIndex.length,
    `عددُ ملفّات العناقيد (${clusterFiles.length}) لا يطابق الفهرس (${claims.clusterIndex.length})`);
  g4.g.indexBytes = raw.length;
  g4.g.clusterFiles = clusterFiles.length;
}

// ——————————————————————————————————————————————————————————
// ٥ — نظافةُ العرض: لا يخرج إلى التطبيق شأنٌ داخليٌّ لمستودع البحث
// ——————————————————————————————————————————————————————————
const g5 = gate("٥", "نظافةُ العرض — لا اسمَ محرِّرٍ ولا مسارَ ملفٍّ ولا بصمةَ إيداعةٍ في ملفّات العرض");
{
  /**
   * الحدودُ مكتوبةٌ صريحةً لا بـ`\b` (عقدُ بلاغ 2026-08-12-arabic-word-boundary،
   * وجلسة ج١): فالسكربتُ يفحص نصًّا عربيًّا، و`\b` في JS يتحقّق قبل الرمز
   * اللاتينيّ ولو التصق به حرفٌ عربيّ قبلَه — فيختلف معناه باختلاف الجوار.
   * والبديلُ **مكافئٌ حرفًا**: `\b` قبل محرفِ كلمةٍ ⟺ `(?<![A-Za-z0-9_])`،
   * وبعدَه ⟺ `(?![A-Za-z0-9_])`. وقيس ذلك قبل المساس على ٢٤٣ مليون بايتٍ من
   * المستودع (١٬٠٩١ مطابقةَ مسارٍ و١٩ بصمة): **صفرُ فرق**.
   */
  const INTERNAL = [
    [/Fable|Opus 5|Sonnet|Claude/i, "اسمُ نموذجٍ أو محرِّر"],
    [/(?<![A-Za-z0-9_])(data|plan|js|findings|scripts)\/[A-Za-z0-9_\-/]+\.(md|py|json|jsonl|mjs)/, "مسارُ ملفٍّ في مستودع البحث"],
    [/HUKM-JAMC-DRAFT|HOLDOUT-MOTZKI|SESSION-KH/, "اسمُ ملفٍّ داخليّ"],
    [/"sha256"|(?<![A-Za-z0-9_])[0-9a-f]{40}(?![A-Za-z0-9_])/, "بصمةٌ أو إيداعة"],
  ];
  /**
   * رمزُ الجلسة الداخليّة — فحصٌ **كان معطوبًا في خ٧** فمرّت أربعةُ مواضع:
   * كان الشرطُ `\bخ…` وحدُّ الكلمة اللاتينيُّ لا يقع قبل حرفٍ عربيّ فما صدَق قطّ.
   * صُحّح، فحُذف الرمزُ من ديباجة §١ وعنوان §٤ (حذفًا لا تحريرًا).
   *
   * وبقي **موضعٌ واحدٌ مُعلَنٌ لا يُحذف**: هو داخلَ تسبيب حكمِ الأعداد في القول
   * الثاني — وحذفُه من هناك تحريرٌ لحكمٍ مختوم لا تنظيفُ عرض. فيُشترط أن يكون
   * كلُّ موضعٍ باقٍ هو هذا بعينه: عددُ الرموز = عددُ الجملة المُعلَنة، لا أكثر.
   */
  const SESSION_CODE = /خ[١-٩]\/[أ-ي]/g;
  const DECLARED = "صفر — تحقق خ٦/ب";
  for (const f of ["tarikh-claims.json", "tarikh-hukm.json", "tarikh-timeline.json", "rag-tarikh.json"]) {
    const raw = readFileSync(join(PUB, f), "utf8");
    for (const [re, what] of INTERNAL) {
      const hit = raw.match(re);
      g5.ok(!hit, `${f}: ${what} — «${hit?.[0] ?? ""}»`);
    }
    const codes = (raw.match(SESSION_CODE) ?? []).length;
    const declared = raw.split(DECLARED).length - 1;
    g5.ok(codes === declared,
      `${f}: رمزُ جلسةٍ في غير الموضع المُعلَن (${codes} رمزًا · ${declared} مُعلَنًا)`);
    if (f === "tarikh-claims.json") g5.g.sessionCodes = { codes, declared };
  }
  // ومعرّفاتُ السجلات لا تُعرض لقبًا: لكلِّ عنقودٍ لقبٌ من أقدم شاهدٍ فيه
  for (const c of claims.clusterIndex) {
    g5.ok(!!c.label && !/^clx-jamc-/.test(c.label), `${c.id}: لقبٌ فنّيٌّ لا اسمُ كتاب`);
  }

  /**
   * ٥/ب — **تأنيسُ الرمز الباقي في العرض وحدَه** (إذنُ الإدارة س١٠، خ٧-ج).
   *
   * الموضعُ المُعلَنُ أعلاه بقي في الوثيقة لأنّ حذفَه تحريرُ حكمٍ مختوم. فأُذن
   * بتأنيسه **في طبقة العرض** بخريطةٍ مُعلَنةٍ مغلقة (`lib/tarikhIds.ts`)،
   * ويُشترط هنا ثلاثةٌ لا رابعَ لها:
   *   ١ — الخريطةُ تحمل الزوجَ المأذونَ بعينه، لا زوجًا سواه، وهي مُستعمَلةٌ
   *       في `humanize` لا مُعلَنةً معطَّلة.
   *   ٢ — **المصدرُ لم يُمسّ:** الأصلُ باقٍ بحرفه في مصدر العرض وفي ملفّات
   *       البيانات بعدده كما كان، ولم يتسرّب إليها لفظُ التأنيس.
   *   ٣ — الفحصُ التحتيُّ للحرفيّة (البند ٢) يبقى على النصّ الأصليّ: فلفظُ
   *       التأنيس ليس في الوثيقة أصلًا، فلو قُوبل به سقط.
   * وأمّا **عدُّ تطبيقاته في الصفحة المرسومة** فبوّابةُ المتصفّح
   * (`check-tarikh-ui.mjs`) — لا يُصدَّق التأنيسُ إلا مرئيًّا.
   */
  {
    const PHRASES = [["— تحقق خ٦/ب", "— تحقّق آليّ في مستودع البحث"]];
    const ids = readFileSync(join(VIEWS, "lib", "tarikhIds.ts"), "utf8");
    const m = ids.match(/PHRASE_MAP[^=]*=\s*(\[[\s\S]*?\n\]);/);
    g5.ok(!!m, "خريطةُ التأنيس غيرُ مُعلَنةٍ في lib/tarikhIds.ts");
    let declared = [];
    if (m) {
      try { declared = JSON.parse(m[1].replace(/,(\s*[\]}])/g, "$1")); } catch (e) { declared = null; }
    }
    g5.ok(Array.isArray(declared) && declared.length === PHRASES.length,
      `خريطةُ التأنيس ${Array.isArray(declared) ? declared.length : "غيرُ مقروءة"} زوجًا لا ${PHRASES.length}`);
    if (Array.isArray(declared)) {
      for (const [i, [from, to]] of PHRASES.entries()) {
        g5.ok(declared[i]?.[0] === from && declared[i]?.[1] === to,
          `خريطةُ التأنيس: الزوجُ ${i + 1} ليس المأذونَ به («${declared[i]?.[0] ?? ""}» ← «${declared[i]?.[1] ?? ""}»)`);
      }
    }
    g5.ok(/PHRASE_MAP\.reduce\(/.test(ids), "خريطةُ التأنيس مُعلَنةٌ ولا تُستعمل في humanize");

    const countIn = (s, needle) => s.split(needle).length - 1;
    const DATA = ["tarikh-claims.json", "tarikh-hukm.json", "tarikh-timeline.json", "rag-tarikh.json"];
    let applied = 0;
    for (const [from, to] of PHRASES) {
      g5.ok(DECLARED.includes(from), `خريطةُ التأنيس: «${from}» ليس من الموضع المُعلَن في البند ٥`);
      g5.ok(countIn(V1, from) > 0, `المصدرُ لا يحمل أصلَ التأنيس «${from}» — خريطةٌ ميّتة`);
      g5.ok(countIn(V1, to) === 0, `لفظُ التأنيس تسرّب إلى مصدر العرض — والمصدرُ لا يُمَسّ`);
      g5.ok(countIn(V1_SEALED, to) === 0, "لفظُ التأنيس تسرّب إلى المختومة الأصل");
      for (const f of DATA) {
        const raw = readFileSync(join(PUB, f), "utf8");
        g5.ok(countIn(raw, to) === 0, `${f}: لفظُ التأنيس في البيانات — التأنيسُ في العرض وحدَه`);
        applied += countIn(raw, from);
      }
    }
    g5.g.humanizedPhrases = { pairs: PHRASES.length, inSource: countIn(V1, PHRASES[0][0]), inData: applied };
  }
}

// ——————————————————————————————————————————————————————————
// ٦ — التوجيهُ التحريريُّ للقول الثامن (قرارُ الإدارة س٧، ٣ آب ٢٠٢٦)
// ——————————————————————————————————————————————————————————
const g6 = gate("٦", "القولُ الثامن — التمييزُ الثنائيُّ مُصدَّر، و«يُقرأ مع» متبادلةٌ بأساسٍ مفحوص، ولا قوائمَ ولا طعن");
{
  const d8 = claims.claims.find((c) => c.id === "د٨");
  const d5 = claims.claims.find((c) => c.id === "د٥");
  g6.ok(!!d8 && !!d5, "القولان الثامن والخامس ليسا في الفهرس");
  if (d8 && d5) {
    // أ — البطاقةُ تُصدَّر بشقّي الحكم، وشقّاه هما الجنسُ الثابتُ والأفرادُ الظنّية
    g6.ok(d8.leadWithRulings === true, "د٨: بطاقتُه لا تُصدَّر بحكميه");
    g6.ok(d8.rulings.length === 2, `د٨: أحكامُه ${d8.rulings.length} لا ٢ — التمييزُ الثنائيّ`);
    g6.ok(d8.rulings[0]?.grades[0] === "thabit", "د٨: الشقُّ الأوّل ليس «ثابت وثائقيًا»");
    g6.ok(d8.rulings[1]?.grades.includes("muhtamal") && d8.rulings[1]?.grades.includes("mawquf"),
      "د٨: الشقُّ الثاني لا يحمل درجتَي الأفراد");
    // وكلاهما منقولٌ حرفًا — لا صياغةَ تمييزٍ من عندنا
    for (const [i, r] of d8.rulings.entries()) {
      g6.ok(V1.includes(r.raw), `د٨: شقُّ الحكم ${i + 1} ليس في مصدر العرض حرفيًّا`);
    }
    // وفيه لفظُ التمييز صريحًا كما في الوثيقة
    g6.ok(d8.rulings.some((r) => r.raw.includes("فالجنس ثابت والأفراد ظنّية")),
      "د٨: عبارةُ التمييز الثنائيّ ليست في المعروض");
    // ب — «يُقرأ مع» متبادلة، وأساسُها شاهدٌ وثائقيٌّ يشترك فيه القولان
    const w8 = d8.readWith ?? [], w5 = d5.readWith ?? [];
    g6.ok(w8.some((x) => x.id === "د٥"), "د٨: لا إحالةَ «يُقرأ مع» إلى القول الخامس");
    g6.ok(w5.some((x) => x.id === "د٨"), "د٥: الإحالةُ غيرُ متبادلة");
    for (const [c, ws] of [[d8, w8], [d5, w5]]) {
      for (const w of ws) {
        const other = claims.claims.find((x) => x.id === w.id);
        g6.ok(!!other, `${c.id}: «يُقرأ مع» إلى قولٍ مجهول (${w.id})`);
        g6.ok(c.witnessRefs.includes(w.witness) && !!other?.witnessRefs.includes(w.witness),
          `${c.id}↔${w.id}: الشاهدُ ${w.witness} ليس في بيّنتَي القولين — إحالةٌ بلا أساس`);
        g6.ok(other?.route === w.route, `${c.id}: مسارُ «يُقرأ مع» لا يطابق مسارَ القول`);
      }
    }
    // ج — لا قوائمَ حروفٍ إفراديّة: `list-form` معزولةٌ في المصدر ولا تُشحن أصلًا
    let listForm = 0;
    for (const f of readdirSync(PUB).filter((x) => /^tarikh-cluster-.*\.json$/.test(x))) {
      for (const r of JSON.parse(readFileSync(join(PUB, f), "utf8")).records) {
        if ((r.flags ?? []).includes("list-form")) listForm++;
      }
    }
    g6.ok(listForm === 0, `نصوصٌ تعداديّة (list-form) مشحونةٌ في العرض: ${listForm}`);
    g6.ok(d8.clusters.length === 0, `د٨: عناقيدُ مشجَّرةٌ في بطاقته (${d8.clusters.length}) — بيّنتُه أوسامٌ وأبوابُ كتب`);
    g6.g.detail = { rulings: d8.rulings.length, readWith: w8.map((x) => `${x.id}(${x.witness})`), listForm };
  }
}

// ——————————————————————————————————————————————————————————
const out = join(ROOT, "js", "data", "tarikh-sources", "GATE.json");
report.ok = failed === 0;
writeFileSync(out, JSON.stringify(report, null, 2));
for (const g of report.gates) {
  const bad = g.failures.length;
  console.log(`${bad ? "✗" : "✓"} البند ${g.id} — ${g.title} (${g.checks} فحصًا${bad ? `، ${bad} مخالفة` : ""})`);
  for (const f of g.failures.slice(0, 10)) console.log(`    · ${f}`);
}
console.log(`\n${report.ok ? "✓ البوّابة خضراء" : `✗ ${failed} مخالفة`} — التقرير: ${out}`);
process.exit(report.ok ? 0 : 1);

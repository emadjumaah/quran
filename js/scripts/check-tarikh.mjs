/**
 * بوّابةُ باب «تاريخ النص» — لا عرضَ مع مخالفة.
 *
 * تفحص أربعةَ بنودٍ من بوابة قبول خ٧:
 *   ١ — **حرفيّةُ العرض:** عيّنةُ ٢٠ روايةً ببذرةٍ ثابتة تُقابَل نصوصُها المعروضة
 *       بمصدرها في **مستودع التاريخ** حرفًا حرفًا (لا باللقطة — بالمصدر).
 *   ٢ — **أمانةُ الأحكام:** كلُّ مقطعٍ حكميٍّ في ملفّات العرض موجودٌ في
 *       `HUKM-JAMC-v1.md` حرفيًّا (وشروحُ الدرجات في `METHOD.md`)، والدرجاتُ
 *       المعروضة تطابق مسحًا مستقلًّا لنصّ v1 — وصفرُ جملةٍ تقويميّةٍ مضافة:
 *       لا يذكر كودُ الواجهة اسمَ درجةٍ ولا لفظَ نبرةٍ من عنده.
 *   ٣ — **التتبّع:** كلُّ عقدةِ شجرةٍ → سجلٌّ → نصٌّ، صفرُ انقطاع؛ وكلُّ بطاقةٍ
 *       وثائقيّةٍ تحمل إحالتها في سجلّ §٤.
 *   ٤ — **الكسل:** فهرسُ الدعاوى لا يحمل حمولةَ عنقودٍ واحدة.
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

const V1 = readFileSync(join(SRC, "hukm", "HUKM-JAMC-v1.md"), "utf8");
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
  for (const it of claims.sealLog.items) { lifted++; g2.ok(inV1(it.raw), "سجلُّ الختم ليس في v1"); }
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
  const TONE = ["زعم", "يزعم", "مزاعم", "باطل", "بطلان", "فُنّدت", "فنّدت", "خرافة", "مؤامرة", "أكذوبة", "قطعًا", "بلا شكّ", "لا شكّ"];
  const files = ["views/Tarikh.tsx", "views/TarikhClaim.tsx", "views/TarikhHukm.tsx",
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
    }
    for (const t of TONE) {
      g2.ok(!hasPhrase(bag, t), `${f}: لفظُ نبرةٍ ممنوع («${t}»)`);
    }
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
const g4 = gate("٤", "الكسل — فهرسُ الدعاوى لا يحمل حمولةَ عنقود");
{
  const raw = readFileSync(join(PUB, "tarikh-claims.json"), "utf8");
  g4.ok(!/"nodes":\s*\[/.test(raw), "فهرسُ الدعاوى يحمل عقدَ شجرة");
  g4.ok(!/"fullText"/.test(raw), "فهرسُ الدعاوى يحمل نصوصَ روايات");
  g4.ok(raw.length < 300_000, `فهرسُ الدعاوى ثقيل: ${raw.length} بايت`);
  const clusterFiles = readdirSync(PUB).filter((x) => /^tarikh-cluster-.*\.json$/.test(x));
  g4.ok(clusterFiles.length === claims.clusterIndex.length,
    `عددُ ملفّات العناقيد (${clusterFiles.length}) لا يطابق الفهرس (${claims.clusterIndex.length})`);
  g4.g.indexBytes = raw.length;
  g4.g.clusterFiles = clusterFiles.length;
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

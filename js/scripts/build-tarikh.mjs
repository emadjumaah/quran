/**
 * خطُّ بناء باب «تاريخ النص» — من اللقطة المجمَّدة إلى ملفّات العرض.
 *
 * القاعدةُ الحاكمة: **لا جملةَ من عندنا.** كلُّ نصٍّ حكميٍّ في المخرجات مقطعٌ
 * منقولٌ حرفًا من `js/data/tarikh-sources/hukm/HUKM-JAMC-v1.md` (أو من الميثاق
 * `METHOD.md` في شرح الدرجات الخمس وحدَه) — يُقتطع بالتحليل ولا يُعاد تحريرُه،
 * ويفحص `check-tarikh.mjs` كلَّ مقطعٍ فيُثبت أنه موجودٌ في مصدره حرفيًّا.
 *
 * المخرجات في `js/apps/studio/public/`:
 *   tarikh-claims.json          الدعاوى الثماني مهيكلةً + الدرجات + البيّنات
 *   tarikh-cluster-<id>.json    عنقودٌ كسولٌ لكلٍّ من الثمانية عشر (شجرة + نصوص)
 *   tarikh-timeline.json        مرتكزات السطر الزمني الوثائقي من §١
 *   tarikh-hukm.json            الوثيقةُ الكاملة نصًّا (صفحةُ قراءة)
 *   rag-tarikh.json             نسخةُ نبراس المقروءة (بنمط كتب البيان — بلا تضمين)
 *
 * التشغيل: node js/scripts/build-tarikh.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "data", "tarikh-sources");
const PUB = join(ROOT, "js", "apps", "studio", "public");

const V1_PATH = join(SRC, "hukm", "HUKM-JAMC-v1.md");
const METHOD_PATH = join(SRC, "hukm", "METHOD.md");
const V1 = readFileSync(V1_PATH, "utf8");
const METHOD = readFileSync(METHOD_PATH, "utf8");
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
/** كلُّ مقطعٍ يخرج إلى العرض يمرّ من هنا: إمّا هو في مصدره حرفًا، أو يسقط البناء */
function lift(text, from = V1, whence = "HUKM-JAMC-v1.md") {
  const t = text.trim();
  if (!t) die(`مقطعٌ فارغ (${whence})`);
  if (!from.includes(t)) die(`مقطعٌ ليس في ${whence} حرفيًّا: «${t.slice(0, 70)}…»`);
  return t;
}

// ——————————————————————————————————————————————————————————————
// ١ — الدرجاتُ الخمس: أسماؤها من v1 §٠، وشروحُها من الميثاق §٣
// ——————————————————————————————————————————————————————————————
const GRADE_IDS = {
  "ثابت وثائقيًا": "thabit",
  "راجح بالتقاطع": "rajih",
  "محتمل": "muhtamal",
  "موقوف": "mawquf",
  "مرجوح": "marjuh",
};
const GRADE_NAMES = Object.keys(GRADE_IDS);

/** شرحُ كلِّ درجةٍ سطرًا حرفيًّا من الميثاق §٣ */
function gradeGlosses() {
  const out = [];
  for (const name of GRADE_NAMES) {
    const re = new RegExp(`^- \\*\\*${name}\\*\\* — (.+)$`, "m");
    const m = METHOD.match(re);
    if (!m) die(`لم يوجد شرحُ الدرجة «${name}» في الميثاق §٣`);
    out.push({ id: GRADE_IDS[name], label: name, gloss: lift(m[1], METHOD, "METHOD.md") });
  }
  return out;
}

/** أسماءُ الدرجات الواردةُ في مقطعٍ ما — بترتيب ظهورها، بلا تكرار */
function gradesIn(text) {
  const hits = [];
  for (const name of GRADE_NAMES) {
    let i = text.indexOf(name);
    while (i > -1) { hits.push([i, name]); i = text.indexOf(name, i + 1); }
  }
  hits.sort((a, b) => a[0] - b[0]);
  const seen = new Set(), out = [];
  for (const [, name] of hits) {
    // «ثابت وثائقيًا» يبتلع… لا شيء؛ لكنّ «موقوف» جزءٌ من لا شيء أيضًا — الترتيبُ يكفي
    if (!seen.has(name)) { seen.add(name); out.push(GRADE_IDS[name]); }
  }
  return out;
}

// ——————————————————————————————————————————————————————————————
// ٢ — تقطيعُ الوثيقة إلى أقسامها المرقّمة (## ٠ … ## ٥)
// ——————————————————————————————————————————————————————————————
const lines = V1.split("\n");
/** فهرسُ الأقسام: رقمُ القسم ← نصُّه الخام */
const sections = {};
{
  let cur = null, buf = [];
  for (const ln of lines) {
    const m = ln.match(/^## ([٠-٩]+)\. (.+)$/);
    if (m) {
      if (cur) sections[cur.n] = { title: cur.title, body: buf.join("\n") };
      cur = { n: m[1], title: m[2] };
      buf = [];
    } else if (cur) buf.push(ln);
  }
  if (cur) sections[cur.n] = { title: cur.title, body: buf.join("\n") };
}
for (const n of ["٠", "١", "٢", "٣", "٤", "٥"]) if (!sections[n]) die(`قسمٌ مفقود في v1: §${n}`);

// ——————————————————————————————————————————————————————————————
// ٣ — §٠ كيف تُقرأ + القيود المعتمَدة ق-أ…ق-د
// ——————————————————————————————————————————————————————————————
function howToRead() {
  const items = [];
  const body = sections["٠"].body;
  const re = /^(\d)\. (.+(?:\n(?![\d]\.\s|\s*-\s|##).*)*)$/gm;
  let m;
  while ((m = re.exec(body))) items.push({ n: +m[1], raw: lift(m[2]) });
  if (items.length !== 3) die(`§٠: توقّعنا ثلاثةَ بنودٍ فوجدنا ${items.length}`);
  const qoyud = [];
  const qre = /^ {3}- \*\*(ق-[أ-ي]):\*\* (.+)$/gm;
  while ((m = qre.exec(body))) qoyud.push({ id: m[1], raw: lift(m[2]) });
  if (qoyud.length !== 4) die(`§٠: توقّعنا أربعةَ قيودٍ فوجدنا ${qoyud.length}`);
  return { items, qoyud };
}

// ——————————————————————————————————————————————————————————————
// ٤ — §١ البيّنة الوثائقية و١…و٥ + الحدّ العام
// ——————————————————————————————————————————————————————————————
function documentary() {
  const body = sections["١"].body;
  const out = [];
  const re = /^- \*\*(و[١-٥]) — ([^:*]+):\*\* (.+)$/gm;
  let m;
  while ((m = re.exec(body))) out.push({ id: m[1], title: lift(m[2]), raw: lift(m[3]) });
  if (out.length !== 5) die(`§١: توقّعنا خمسَ بيّناتٍ وثائقيّةٍ فوجدنا ${out.length}`);
  const g = body.match(/^- \*\*حدّ عام:\*\* (.+)$/m);
  if (!g) die("§١: لم يوجد «حدّ عام»");
  const preamble = body.match(/^(تُذكر مرةً[^\n]+)$/m);
  return { witnesses: out, generalLimit: lift(g[1]), preamble: lift(preamble[1]) };
}

// ——————————————————————————————————————————————————————————————
// ٥ — §٢ الدعاوى الثماني
// ——————————————————————————————————————————————————————————————
/** ترتيبُ السردية كما نصّ عليه برومبت خ٧ §٣ — وهو ترتيبُ الوثيقة نفسِه */
const CLAIM_ORDER = ["د١", "د٢", "د٣", "د٤", "د٥", "د٦", "د٧", "د٨"];

/** مفاتيحُ الفقرات المعنونة داخل كلِّ دعوى — بأسمائها كما وردت في v1 */
const FIELDS = [
  { key: "claim", label: "نص الدعوى" },
  { key: "manqul", label: "البيّنة المنقولة" },
  { key: "wathaiqi", label: "البيّنة الوثائقية" },
  { key: "hukm", label: "الحكم" },
  { key: "hudud", label: "حدوده" },
  { key: "yughayyir", label: "ما الذي يغيّر الدرجة" },
];
const FIELD_BY_LABEL = new Map(FIELDS.map((f) => [f.label, f]));

function claims() {
  const body = sections["٢"].body;
  const blocks = body.split(/^### /m).slice(1);
  if (blocks.length !== 8) die(`§٢: توقّعنا ثمانيَ دعاوى فوجدنا ${blocks.length}`);
  const out = [];
  for (const [i, block] of blocks.entries()) {
    const nl = block.indexOf("\n");
    const head = block.slice(0, nl).trim();
    const hm = head.match(/^(د[١-٨]) — (.+)$/);
    if (!hm) die(`§٢: ترويسةُ دعوى غيرُ مفهومة: «${head}»`);
    const id = hm[1], title = lift(hm[2]);
    if (id !== CLAIM_ORDER[i]) die(`§٢: ترتيبُ الدعاوى تغيّر عند ${id}`);

    // مواضعُ الفقرات المعنونة: **اسم الفقرة (تعليقٌ اختياري):**
    const rest = block.slice(nl + 1);
    const marks = [];
    const lre = /^\*\*([^:*\n]+?)(\s*\([^)]*\))?:([^*\n]*)\*\*/gm;
    let m;
    while ((m = lre.exec(rest))) {
      const label = m[1].trim();
      if (!FIELD_BY_LABEL.has(label)) continue;
      marks.push({ label, note: (m[2] ?? "").trim(), inline: m[3].trim(), start: m.index, after: m.index + m[0].length });
    }
    if (!marks.length) die(`${id}: لا فقرةَ معنونة`);

    const fields = {};
    for (let k = 0; k < marks.length; k++) {
      const mk = marks[k];
      const end = k + 1 < marks.length ? marks[k + 1].start : rest.length;
      const f = FIELD_BY_LABEL.get(mk.label);
      const bodyRaw = rest.slice(mk.after, end).trim();
      fields[f.key] = {
        label: mk.label,
        note: mk.note ? lift(mk.note.replace(/^\(|\)$/g, "")) : null,
        // «الحكم: راجح بالتقاطع» — ما لصق بالعنوان جزءٌ من الحكم فيُحفظ
        inline: mk.inline ? lift(mk.inline.replace(/^\s*/, "")) : null,
        raw: bodyRaw ? lift(bodyRaw) : "",
      };
    }
    for (const need of ["claim", "manqul", "hukm", "yughayyir"]) {
      if (!fields[need]) die(`${id}: فقرةٌ ملزمةٌ مفقودة (${need})`);
    }

    // الأحكامُ: إمّا سطرُ حكمٍ واحد (لصق بالعنوان)، أو بنودٌ مرقّمة بشرطات
    const h = fields.hukm;
    const rulings = [];
    if (h.inline) {
      // «**الحكم: راجح بالتقاطع.** ثمّ التسبيب…» — الدرجةُ في العنوان والتسبيبُ بعده
      rulings.push({ raw: h.inline, grades: gradesIn(h.inline), body: h.raw ? lift(h.raw) : "" });
    } else {
      const bre = /^- (.+(?:\n(?!- |\*\*).*)*)$/gm;
      let bm;
      while ((bm = bre.exec(h.raw))) rulings.push({ raw: lift(bm[1]), grades: gradesIn(bm[1]), body: "" });
      if (!rulings.length) die(`${id}: فقرةُ الحكم بلا بنود`);
    }
    const graded = rulings.filter((r) => r.grades.length);
    if (!graded.length) die(`${id}: حكمٌ بلا درجةٍ من الخمس`);

    // معرّفاتُ العناقيد والقيود تُلتمس من كتلة الدعوى كلِّها — صيغُها لا تلتبس.
    const clusterRefs = [...new Set([...block.matchAll(/clx-jamc-\d{4}(?:-[0-9a-f]{6})?/g)].map((x) => x[0]))];
    const qaydRefs = [...new Set([...block.matchAll(/ق-[أ-ي]/g)].map((x) => x[0]))];
    // ورموزُ البيّنة الوثائقية «و١…و٥» تُلتمس من فقرتَي الوثائقيّ والحكم وما
    // يغيّر الدرجة فحسب — ففي فقرة المنقول «عند ن=٢ و٣ و٤» واوُ عطفٍ لا رمز.
    const wScan = ["wathaiqi", "hukm", "yughayyir"].map((k) => {
      const f = fields[k];
      return f ? `${f.inline ?? ""} ${f.raw}` : "";
    }).join("\n");
    const witnessRefs = [...new Set([...wScan.matchAll(/و[١-٥]/g)].map((x) => x[0]))]
      .sort((a, b) => "و١و٢و٣و٤و٥".indexOf(a) - "و١و٢و٣و٤و٥".indexOf(b));

    out.push({
      id, n: i + 1, title,
      route: `/tarikh/d/${id}`,
      grade: graded[0].grades[0],
      grades: [...new Set(rulings.flatMap((r) => r.grades))],
      rulingsCount: rulings.length,
      fields, rulings,
      clusterRefs, witnessRefs, qaydRefs,
    });
  }
  return out;
}

// ——————————————————————————————————————————————————————————————
// ٦ — §٣ الخلاصة · §٤ الإحالات · §٥ سجل الختم
// ——————————————————————————————————————————————————————————————
function numberedItems(body, expect, whence) {
  const items = [];
  const re = /^(\d)\. (.+(?:\n(?!\d\.\s|##).*)*)$/gm;
  let m;
  while ((m = re.exec(body))) items.push({ n: +m[1], raw: lift(m[2]) });
  if (expect && items.length !== expect) die(`${whence}: توقّعنا ${expect} بنودٍ فوجدنا ${items.length}`);
  return items;
}
function bulletItems(body, whence, expect) {
  const items = [];
  const re = /^- (.+(?:\n(?!- |##).*)*)$/gm;
  let m;
  while ((m = re.exec(body))) items.push({ raw: lift(m[1]) });
  if (expect && items.length !== expect) die(`${whence}: توقّعنا ${expect} بنودٍ فوجدنا ${items.length}`);
  return items;
}

// ——————————————————————————————————————————————————————————————
// ٧ — صدرُ الوثيقة (المحرِّر · المرجع · المادّة · الحالة)
// ——————————————————————————————————————————————————————————————
function docHead() {
  const head = V1.slice(0, V1.indexOf("\n---\n"));
  const title = lift(head.match(/^# (.+)$/m)[1]);
  const meta = [];
  const re = /^\*\*([^:*]+):\*\* (.+)$/gm;
  let m;
  while ((m = re.exec(head))) meta.push({ label: lift(m[1]), raw: lift(m[2]) });
  if (meta.length !== 4) die(`صدرُ الوثيقة: توقّعنا أربعةَ سطورٍ فوجدنا ${meta.length}`);
  return { title, meta };
}

// ——————————————————————————————————————————————————————————————
// ٨ — السطر الزمني: مرتكزاتٌ مقروءةٌ من عباراتِ §١ نفسِها
// ——————————————————————————————————————————————————————————————
/**
 * لكلِّ مرتكزٍ: العبارةُ الحرفيّةُ من §١ التي قُرئ منها، ومداهُ الميلاديُّ
 * للتموضع على المحور. الأرقامُ قراءةٌ ميكانيكيّةٌ للعبارة نفسِها — لا تقدير.
 */
const TIMELINE_ANCHORS = [
  { witness: "و٥", key: "zuhayr", phrase: "نقش زُهير المؤرَّخ ٢٤هـ", ah: 24, ce: [645, 645] },
  { witness: "و٤", key: "birmingham", phrase: "رقوق برمنغهام (٥٦٨–٦٤٥م بثقة ٩٥٫٤٪)", ce: [568, 645] },
  { witness: "و١", key: "sanaa", phrase: "تأريخ الرقّ كربونيًا: قبل ٦٧١م بثقة ٩٩٪", ce: [null, 671] },
  { witness: "و٥", key: "qubbat", phrase: "كتابات قبة الصخرة ٧٢هـ بنصوص قرآنية طويلة", ah: 72, ce: [691, 691] },
];
/** الشاهدان اللذان لا تاريخَ نقطيًّا لهما في §١ — يُعرضان نطاقًا بعبارتهما */
const TIMELINE_BANDS = [
  { witness: "و٢", phrase: "أصل مكتوب واحد", band: "منتصف القرن الأول", from: "د٥", bandPhrase: "في حدود منتصف القرن الأول" },
  { witness: "و٣", phrase: "حدث نسخٍ مركزي وتوزيعٍ على الأمصار وقع فعلًا", band: "منتصف القرن الأول", from: "د٥", bandPhrase: "في حدود منتصف القرن الأول" },
];

function timeline(doc) {
  const byId = new Map(doc.witnesses.map((w) => [w.id, w]));
  const points = TIMELINE_ANCHORS.map((a) => {
    const w = byId.get(a.witness);
    if (!w) die(`السطر الزمني: شاهدٌ مجهول ${a.witness}`);
    return {
      key: a.key, witness: a.witness, witnessTitle: w.title,
      phrase: lift(a.phrase), ah: a.ah ?? null, ce: a.ce,
    };
  }).sort((x, y) => (x.ce[1] ?? 0) - (y.ce[1] ?? 0));
  const bands = TIMELINE_BANDS.map((b) => {
    const w = byId.get(b.witness);
    if (!w) die(`السطر الزمني: شاهدٌ مجهول ${b.witness}`);
    return { witness: b.witness, witnessTitle: w.title, phrase: lift(b.phrase), band: lift(b.bandPhrase), from: b.from };
  });
  return { axis: { ceFrom: 550, ceTo: 700 }, points, bands };
}

// ——————————————————————————————————————————————————————————————
// ٩ — العناقيد: شجرةٌ + سجلاتٌ بنصوصها الحرفيّة
// ——————————————————————————————————————————————————————————————
function loadRecords() {
  const map = new Map();
  const raw = readFileSync(join(SRC, "records", "reports.jsonl"), "utf8").split("\n").filter(Boolean);
  for (const line of raw) { const r = JSON.parse(line); map.set(r.id, r); }
  return map;
}
function loadDatingSpans() {
  const by = new Map();
  const raw = readFileSync(join(SRC, "dating", "dating-spans.jsonl"), "utf8").split("\n").filter(Boolean);
  for (const line of raw) {
    const d = JSON.parse(line);
    if (!by.has(d.cluster)) by.set(d.cluster, []);
    by.get(d.cluster).push(d);
  }
  return by;
}

function buildClusters(recordsById, spansByCluster) {
  const files = readdirSync(join(SRC, "trees")).filter((f) => f.endsWith(".json")).sort();
  const index = [];
  for (const f of files) {
    const t = JSON.parse(readFileSync(join(SRC, "trees", f), "utf8"));
    const id = t.cluster;
    const nodes = t.nodes.map((n) => ({
      id: n.node,
      label: n.label,
      rawiId: n.rawi_id ?? null,
      deathYear: n.death_year ?? null,
      tabaka: n.tabaka ?? null,
      students: n.students, teachers: n.teachers,
      studentsCorroborated: n.students_corroborated,
      singleThreadAbove: n.single_thread_above,
      depth: n.depth,
      flags: n.flags ?? [],
      // عقدةُ اسمٍ غير مسوّاة — أساسُ القيد ق-ج، وتُعلَّم في العرض
      nameNode: String(n.node).startsWith("n:"),
      records: n.records ?? [],
    }));
    const edges = t.edges.map((e) => ({
      from: e.from, to: e.to,
      chronoSuspect: !!e.chrono_suspect,
      studentDeathYear: e.student_death_year ?? null,
      teacherDeathYear: e.teacher_death_year ?? null,
      records: e.records ?? [],
    }));
    // سجلاتٌ لا تبلغها عقدةٌ لأنّها بلا إسنادٍ مسنَد (بلاغاتٌ ونحوُها): تُعلَّم
    // كي تُعرض في الواجهة على حِدةٍ فلا يبقى نصٌّ مشحونٌ لا سبيلَ إليه.
    const inTree = new Set(t.nodes.flatMap((n) => n.records ?? []));
    const records = t.records.map((rid) => {
      const r = recordsById.get(rid);
      if (!r) die(`${id}: سجلٌّ محالٌ إليه وليس في اللقطة: ${rid}`);
      return {
        chainless: !inTree.has(rid),
        id: r.id,
        eventTags: r.event_tags ?? [],
        source: {
          workAr: r.source?.work_ar ?? null,
          authorAr: r.source?.author_ar ?? null,
          deathAh: r.source?.death_ah ?? null,
          locus: r.source?.locus ?? null,
          uri: r.source?.uri ?? null,
        },
        fullText: r.full_text,
        isnadRaw: r.isnad_raw ?? null,
        matnOnly: r.matn_only ?? null,
        jamiRef: r.jami_ref ?? null,
        flags: r.flags ?? [],
      };
    });
    const candidates = {};
    for (const [crit, v] of Object.entries(t.common_link_candidates ?? {})) {
      candidates[crit] = {
        partial: v.partial ?? null,
        minWorksPerBranch: v.min_works_per_branch ?? null,
        minCorroboratedBranches: v.min_corroborated_branches ?? null,
        candidates: (v.candidates ?? []).map((c) => ({
          node: c.node, label: c.label, deathYear: c.death_year ?? null,
          students: c.students, studentsCorroborated: c.students_corroborated,
          depth: c.depth, singleThreadAbove: c.single_thread_above,
          studentsDeathRange: c.students_death_range ?? null,
          flags: c.flags ?? [],
          records: c.records ?? [],
          branches: (c.branches ?? []).map((b) => ({
            student: b.student, studentLabel: b.student_label,
            records: b.records ?? [], works: b.works ?? [],
            worksCount: b.works_count ?? (b.works ?? []).length,
            corroborated: !!b.corroborated,
          })),
        })),
      };
    }
    const out = {
      id, mode: t.mode,
      eventTags: t.event_tags ?? [],
      works: t.works ?? [],
      chainsUsed: t.chains_used ?? null,
      representative: t.representative ?? null,
      earliestWitness: t.earliest_witness ?? null,
      earliestFullySettledRoute: t.earliest_fully_settled_route ?? null,
      edgesChronoSuspect: t.edges_chrono_suspect ?? 0,
      terminalBranching: t.terminal_branching ?? null,
      nodes, edges,
      chains: (t.chains ?? []).map((c) => ({ record: c.record, chainNo: c.chain_no, nodes: c.nodes })),
      candidates,
      datingSpans: (spansByCluster.get(id) ?? []).map((d) => ({
        criterion: d.criterion, mode: d.mode, node: d.node, label: d.label,
        deathYear: d.death_year ?? null,
        studentsDeathRange: d.students_death_range ?? null,
        earliestWitness: d.earliest_witness ?? null,
        earliestFullySettled: d.earliest_fully_settled ?? null,
        flags: d.flags ?? [],
      })),
      records,
    };
    writeFileSync(join(PUB, `tarikh-cluster-${id}.json`), JSON.stringify(out));
    index.push({
      id,
      nodes: nodes.length, edges: edges.length, records: records.length,
      works: out.works.length,
      eventTags: out.eventTags,
      earliestWitness: out.earliestWitness,
      chronoSuspect: edges.filter((e) => e.chronoSuspect).length,
      nameNodes: nodes.filter((n) => n.nameNode).length,
      withJami: records.filter((r) => r.jamiRef).length,
    });
  }
  return index;
}

// ——————————————————————————————————————————————————————————————
// التشغيل
// ——————————————————————————————————————————————————————————————
if (!existsSync(PUB)) die(`مجلّدُ العرض غيرُ موجود: ${PUB}`);
for (const f of readdirSync(PUB)) if (/^tarikh-cluster-.*\.json$/.test(f)) rmSync(join(PUB, f));

const recordsById = loadRecords();
const spansByCluster = loadDatingSpans();
const clusterIndex = buildClusters(recordsById, spansByCluster);
const clusterIds = new Set(clusterIndex.map((c) => c.id));

const head = docHead();
const { items: howItems, qoyud } = howToRead();
const doc = documentary();
const cl = claims();

// كلُّ إحالةِ عنقودٍ في الوثيقة: إمّا في اللقطة فتُربط، أو خارجَها فتُعلَن
for (const c of cl) {
  c.clusters = c.clusterRefs.map((ref) => {
    if (clusterIds.has(ref)) return { ref, id: ref, inSnapshot: true };
    const full = [...clusterIds].find((id) => id.startsWith(`${ref}-`));
    return full ? { ref, id: full, inSnapshot: true } : { ref, id: null, inSnapshot: false };
  });
  delete c.clusterRefs;
}

const claimsOut = {
  version: 1,
  source: {
    doc: "HUKM-JAMC-v1.md", rev: "2a6aba2",
    sha256: sha256(V1), method: { doc: "METHOD.md", sha256: sha256(METHOD) },
  },
  head,
  howToRead: howItems,
  qoyud,
  grades: gradeGlosses(),
  documentary: doc,
  claims: cl,
  conclusion: { title: lift(sections["٣"].title), items: numberedItems(sections["٣"].body, 3, "§٣") },
  externalRefs: { title: lift(sections["٤"].title), raw: lift(sections["٤"].body) },
  sealLog: { title: lift(sections["٥"].title), items: bulletItems(sections["٥"].body, "§٥", 4) },
  clusterIndex,
};
writeFileSync(join(PUB, "tarikh-claims.json"), JSON.stringify(claimsOut));
writeFileSync(join(PUB, "tarikh-timeline.json"), JSON.stringify(timeline(doc)));
writeFileSync(join(PUB, "tarikh-hukm.json"), JSON.stringify({
  doc: "HUKM-JAMC-v1.md", rev: "2a6aba2", sha256: sha256(V1), markdown: V1,
}));

// ——— نسخةُ نبراس: الوثيقةُ مقروءةً بمداخلَ معنونة (بنمط كتب البيان) ———
// بلا تضمين — لا ملفَّ متّجهات ولا ربطَ أدواتٍ دلاليّة (سؤالُ بوابةٍ للإدارة).
const ragEntries = [];
ragEntries.push({ ref: `${head.title} — الصدر`, text: head.meta.map((m) => `${m.label}: ${m.raw}`).join("\n") });
for (const n of ["٠", "١"]) {
  ragEntries.push({ ref: `${head.title} — §${n}. ${sections[n].title}`, text: sections[n].body.trim() });
}
for (const c of cl) {
  const parts = FIELDS.filter((f) => c.fields[f.key]).map((f) => {
    const fd = c.fields[f.key];
    return `${fd.label}${fd.note ? ` (${fd.note})` : ""}: ${fd.inline ? `${fd.inline} ` : ""}${fd.raw}`.trim();
  });
  ragEntries.push({ ref: `${head.title} — ${c.id} ${c.title}`, text: parts.join("\n\n") });
}
for (const n of ["٣", "٤", "٥"]) {
  ragEntries.push({ ref: `${head.title} — §${n}. ${sections[n].title}`, text: sections[n].body.trim() });
}
writeFileSync(join(PUB, "rag-tarikh.json"), JSON.stringify(ragEntries));

console.log(`✓ الدعاوى: ${cl.length} · العناقيد: ${clusterIndex.length} · السجلات: ${clusterIndex.reduce((a, c) => a + c.records, 0)}`);
console.log(`  الدرجات على البطاقات: ${cl.map((c) => `${c.id}:${c.grade}`).join(" · ")}`);
console.log(`  مداخلُ نبراس: ${ragEntries.length}`);

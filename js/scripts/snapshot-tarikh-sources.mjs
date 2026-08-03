/**
 * لقطةُ مصادر باب «تاريخ النص» — تجميدُ مادّةِ رائد «جمع القرآن» داخل مشكاة.
 *
 * مستودعُ التاريخ مصدرٌ للقراءة فحسب؛ فتُنسخ منه هنا — بلا تعديل حرفٍ واحد —
 * الوثيقةُ المختومة v1، وأشجارُ العناقيد الثمانية عشر بالتشغيل المستدَلّ،
 * وسجلاتُ `reports.jsonl` **المحال إليها في هذه الأشجار وحدَها**، وجداولُ
 * المدى الزمني. ثمّ يُكتب `MANIFEST.md` بتجزئات sha256 وإصدارةِ المصدر.
 *
 * التشغيل:
 *   node js/scripts/snapshot-tarikh-sources.mjs [--src /path/to/history]
 *
 * القراءةُ من مستودع التاريخ فقط، والكتابةُ في `js/data/tarikh-sources/` فقط.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argSrc = process.argv.indexOf("--src");
const SRC = argSrc > -1 ? process.argv[argSrc + 1] : "/Volumes/data/new-projects/history";
const OUT = join(ROOT, "js", "data", "tarikh-sources");

/** إصدارةُ الختم: الوثيقةُ والمادّةُ خُتمتا في خ٦/ج بهذه الإيداعة */
const SEAL_REV = "2a6aba2";

/** العناقيدُ الخمسةَ عشرَ ذواتُ حزم الأدلّة + الثلاثةُ النقيّة (برومبت خ٧ §١) */
const PACKET_CLUSTERS = [
  "clx-jamc-0006-c7f96e", "clx-jamc-0025-048506", "clx-jamc-0065-406faa",
  "clx-jamc-0092-cc914f", "clx-jamc-0902-e720d3", "clx-jamc-0907-9216d9",
  "clx-jamc-0917-871400", "clx-jamc-0920-cea6c2", "clx-jamc-0923-6dda6d",
  "clx-jamc-0928-0cece8", "clx-jamc-0952-a8c3df", "clx-jamc-1019-0013da",
  "clx-jamc-1025-5eedb8", "clx-jamc-1074-09c817", "clx-jamc-1118-5eaa21",
];
const PURE_CLUSTERS = ["clx-jamc-0998-af0cf1", "clx-jamc-0087-888016", "clx-jamc-0078-d76841"];
/**
 * عنقودُ كتلة ابن عمر: تحيل إليه الوثيقةُ في القول الخامس ولم يكن في لقطة خ٧
 * (فكان يُعرض معلَنًا «خارجَ اللقطة»). ضُمّ بقرار الإدارة س٦ في خ٧-ب، فاكتملت
 * البيّنةُ المنقولةُ للقول الخامس ولم تبقَ فيه إحالةٌ بلا شجرة.
 */
const REFERENCED_CLUSTERS = ["clx-jamc-0668-90fe6c"];
const CLUSTERS = [...PACKET_CLUSTERS, ...PURE_CLUSTERS, ...REFERENCED_CLUSTERS];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

function gitRev(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch { return "(غير متاح)"; }
}

if (!existsSync(SRC)) {
  console.error(`✗ مستودعُ التاريخ غيرُ موجود: ${SRC}`);
  process.exit(1);
}

// إعادةُ البناء من الصفر — فلا تبقى في اللقطة بقيّةُ تشغيلٍ سابق.
// **ولا يُمسح إلا ما تملكه اللقطةُ نفسُها** (المجلّدات الأربعة والمانيفست):
// فتقاريرُ البوّابات في جذر المجلّد شواهدُ جلساتٍ سابقة — كانت تُمحى ههنا
// بمسحٍ شاملٍ حتى انتُبه في خ٧-ب، وهي ممّا يُحفظ لا ممّا يُعاد توليدُه.
for (const d of ["hukm", "trees", "records", "dating"]) {
  rmSync(join(OUT, d), { recursive: true, force: true });
  mkdirSync(join(OUT, d), { recursive: true });
}

const rows = []; // سطورُ جدول المانيفست

function copy(relSrc, relOut, note) {
  const buf = readFileSync(join(SRC, relSrc));
  writeFileSync(join(OUT, relOut), buf);
  rows.push({ file: relOut, src: relSrc, bytes: buf.length, hash: sha256(buf).slice(0, 16), note });
  return buf;
}

// ١ — الوثيقة. **مصدرُ العرض منذ خ٧-ب هو v1.1** — تنقيحُ لسانٍ للوثيقة المختومة
// بقرار المالك (س٨): «الدعوى» تصير «القول» على نهج ميزان الأقوال، **بلا مساسٍ
// بحكم**. وتُنسخ معها v1 المختومةُ نفسُها كي يقابلهما الباحثُ بنفسه فيرى أنّ
// الفرق لفظيٌّ حصرًا (ويشهد بذلك فرقٌ آليٌّ في مستودع التاريخ). لا تحريرَ هنا:
// كلتاهما تُنسخ حرفًا حرفًا.
copy("findings/HUKM-JAMC-v1.1.md", "hukm/HUKM-JAMC-v1.1.md", "**مصدرُ العرض** — تنقيحُ لسانٍ للوثيقة المختومة، لا مساسَ بحكم");
copy("findings/HUKM-JAMC-v1.md", "hukm/HUKM-JAMC-v1.md", "الوثيقةُ المختومة الأصل — تُحفظ للمقابلة، ولا يُبنى منها عرض");
// والميثاقُ الحاكم الذي تحيل إليه v1 في صدرها — منه وحدَه تُنقل شروحُ الدرجات
// الخمس في تذييل الباب (برومبت خ٧ §٣)، فلا نؤلّف شرحًا من عندنا
copy("plan/METHOD.md", "hukm/METHOD.md", "الميثاقُ الحاكم — مصدرُ شرح الدرجات الخمس في تذييل الباب");

// ٢ — الأشجار (التشغيل المستدَلّ) للثمانية عشر
const recordIds = new Set();
for (const c of CLUSTERS) {
  const buf = copy(
    `data/jamc-quran/trees-inferred/${c}.json`,
    `trees/${c}.json`,
    PURE_CLUSTERS.includes(c) ? "عنقودٌ نقيّ" : "عنقودُ حزمة أدلّة",
  );
  for (const r of JSON.parse(buf).records) recordIds.add(r);
}

// ٣ — سجلاتُ reports.jsonl المحال إليها في هذه الأشجار وحدَها
const allReports = readFileSync(join(SRC, "data/jamc-quran/reports.jsonl"), "utf8").split("\n").filter(Boolean);
const kept = [];
const seen = new Set();
for (const line of allReports) {
  const id = JSON.parse(line).id;
  if (recordIds.has(id)) { kept.push(line); seen.add(id); }
}
const missing = [...recordIds].filter((r) => !seen.has(r));
if (missing.length) {
  console.error(`✗ سجلاتٌ محالٌ إليها في الأشجار ولم توجد في المدوّنة: ${missing.join("، ")}`);
  process.exit(1);
}
const reportsBuf = Buffer.from(kept.join("\n") + "\n", "utf8");
writeFileSync(join(OUT, "records/reports.jsonl"), reportsBuf);
rows.push({
  file: "records/reports.jsonl", src: "data/jamc-quran/reports.jsonl",
  bytes: reportsBuf.length, hash: sha256(reportsBuf).slice(0, 16),
  note: `${arNum(kept.length)} سجلًّا — المحالُ إليه في الأشجار ${arNum(CLUSTERS.length)} فقط (من ${arNum(allReports.length)})`,
});

// ٤ — جداولُ المدى الزمني
copy("data/jamc-quran/dating-spans.jsonl", "dating/dating-spans.jsonl", "مديات وفيات التلاميذ لكلِّ مرشَّح مدارٍ بمعاييره");
copy("data/jamc-quran/dating-spans-summary.json", "dating/dating-spans-summary.json", "خلاصةُ الجدول");

// ٥ — المانيفست
const srcRev = gitRev(SRC);
/** الختمُ محفوظٌ آليًّا: مادّةُ البيّنة والوثيقةُ الأصلُ لم يتغيّر منهما حرفٌ
 *  منذ إيداعة الختم — يُفحص لا يُدَّعى. (وv1.1 ملفٌّ جديدٌ لا تعديلٌ لـv1.) */
function sealIntact() {
  try {
    const d = execFileSync("git", ["-C", SRC, "diff", "--stat", `${SEAL_REV}..HEAD`, "--",
      "data/", "findings/HUKM-JAMC-v1.md"], { encoding: "utf8" }).trim();
    return { ok: d === "", diff: d };
  } catch (e) { return { ok: false, diff: String(e.message ?? e) }; }
}
const seal = sealIntact();
if (!seal.ok) {
  console.error(`✗ الختمُ انكسر: تغيّرت المادّةُ أو الوثيقةُ الأصلُ منذ ${SEAL_REV}\n${seal.diff}`);
  process.exit(1);
}

const manifest = `# لقطةُ مصادر «ملفّ جمع القرآن» — سجلُّ المنشأ

**المصدر:** مستودع التاريخ \`${SRC}\` — **قراءةٌ فقط، لم يُعدَّل فيه شيء.**

**إصدارةُ المصدر:** الوثيقةُ والمادّةُ مختومتان بإيداعة **\`${SEAL_REV}\`**
(«خ٦-ج: تُختَم وثيقةُ الحكم الأولى…»). ورأسُ المستودع حين أُخذت اللقطة
\`${srcRev.slice(0, 7)}\` — و**فُحص آليًّا** أن \`data/\` و\`findings/HUKM-JAMC-v1.md\`
لم يتغيّر منهما حرفٌ بين الإيداعتين (\`git diff --stat ${SEAL_REV}..HEAD\` خالٍ)،
فمادّةُ البيّنة مادّةُ الختم نفسِها.

**مصدرُ العرض v1.1 — تنقيحُ لسانٍ لا حكم:** بقرار المالك (٣ آب ٢٠٢٦) اعتُمد في
الباب لسانُ «ميزان الأقوال»: **قولٌ يُوزن**. فأُنشئت في مستودع التاريخ
\`HUKM-JAMC-v1.1.md\` من المختومة **بتبديل مصطلحٍ حصريّ** («الدعاوى الثماني»→
«الأقوال الثمانية» · «نص الدعوى»→«نص القول» · «الدعوى»→«القول» · «دعاوى»→«أقوال»
· «دعوى»→«قول») ومعه ثلاثُ مطابقاتٍ نحويّةٍ معدودة — **بلا مساسٍ بدرجةٍ ولا
بيّنةٍ ولا حدٍّ ولا بندِ «ما الذي يغيّر الدرجة»**، ويشهد بذلك فرقٌ لفظيٌّ آليّ
مسجَّل. والوثيقتان كلتاهما في هذه اللقطة ليقابل الباحثُ بنفسِه.

**ما نُسخ:** الوثيقتان (v1.1 مصدرًا للعرض وv1 أصلًا للمقابلة)؛ وأشجارُ
**التشغيل المستدَلّ** للعناقيد الخمسةَ عشرَ ذواتِ حزم الأدلّة والثلاثةِ النقيّة
وعنقودِ كتلة ابن عمر المحالِ إليه في القول الخامس؛ وسجلاتُ \`reports.jsonl\`
**المحالُ إليها في هذه الأشجار وحدَها** (لا المدوّنةُ كلُّها)؛ وجداولُ المدى
الزمني. ولم تُنسخ ملفّاتُ \`.mmd\` (رسومُ mermaid) لأنّ الواجهةَ تبني الشجرةَ
من الـ\`json\` نفسِه.

**العناقيدُ (${arNum(CLUSTERS.length)}):** ${CLUSTERS.map((c) => `\`${c}\``).join(" · ")}

**الحقوق والمنهج:** المادّةُ مستخرجةٌ من مصنّفاتٍ تراثيّةٍ ملكِ العامّ، والحكمُ
عليها بميثاق \`plan/METHOD.md\` في مستودع التاريخ. الوثيقةُ المختومة **تُعرض
كما هي**؛ وكلُّ ما في هذا الباب من نصٍّ حكميٍّ منقولٌ منها حرفًا.

| الملف | المصدر في مستودع التاريخ | البايتات | sha256(16) | ملاحظة |
|---|---|---|---|---|
${rows.map((r) => `| \`${r.file}\` | \`${r.src}\` | ${r.bytes} | \`${r.hash}\` | ${r.note} |`).join("\n")}

**المولِّد:** \`js/scripts/snapshot-tarikh-sources.mjs\` — يُعاد تشغيلُه فيُنتج
اللقطةَ نفسَها بالتجزئات نفسِها.
`;
writeFileSync(join(OUT, "MANIFEST.md"), manifest);

console.log(`✓ اللقطة: ${rows.length} ملفًّا · ${CLUSTERS.length} عنقودًا · ${kept.length} سجلًّا`);
console.log(`  ${OUT}`);
void readdirSync;

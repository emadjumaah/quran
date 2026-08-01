/**
 * فحصُ «دلالةِ الصيغة الصرفيّة» — الأصلُ الثالث في جرد الأصول.
 *
 * الدعوى (أبو عوّاد وغيرُه): للصيغة الصرفيّة **معنًى مطّردٌ** يزيد على معنى
 * الجذر — «مَفعَلة تدلّ على الكثرة» و«فَعّال على المبالغة» ونحوُ ذلك. وعليها
 * يقوم عندهم كثيرٌ من التفريق بين لفظين من مادّةٍ واحدة.
 *
 * **والآلةُ عندنا حادّةٌ في هذا**: وسمُ الصرف يعطي لكلِّ كلمةٍ جذعَها ووزنَها،
 * فيُستقرأ الوزنُ في المصحف كلِّه — فإن اطّرد المعنى ثبت، وإن تخلّف في موضعٍ
 * لزمه قيد. وهذا استقراءٌ تامٌّ لا عيّنة.
 *
 * والمقياسُ المحسوب: **أيَختصّ الوزنُ بمادّةٍ دون أخرى، أم يجري في كلِّ
 * المواد؟** فإن جرى في كلِّ مادّةٍ بلا تخصيصٍ فهو بناءٌ صرفيٌّ لا حاملُ معنًى
 * زائد. ولا يُقطع بمعنى الوزن — يُعرض ما يحتمله الاستقراءُ ويقف.
 *
 * usage: node js/scripts/fahis-sigha.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(HERE, "..", "..", "quran-kg.db"), { readOnly: true });

/** أوزانٌ يُدّعى لها معنًى زائد، وما يُدّعى */
const PATTERNS = [
  { name: "مَفعَلة", re: /^م[ء-ي]{2}[ء-ي]ة$/, claim: "الكثرةُ ومكانُ الشيء" },
  { name: "فَعّال", re: /^[ء-ي]{2}ا[ء-ي]$/, claim: "المبالغةُ في الوصف" },
  { name: "فَعيل", re: /^[ء-ي]{2}ي[ء-ي]$/, claim: "الثبوتُ والدوام" },
  { name: "فُعول", re: /^[ء-ي]{2}و[ء-ي]$/, claim: "المصدريّةُ أو الجمع" },
  { name: "مِفعال", re: /^م[ء-ي]{2}ا[ء-ي]$/, claim: "آلةٌ أو مبالغة" },
];

const norm = (s) => (s || "").replace(/[ً-ْٰـۖ-ۭ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").trim();

// الكلماتُ بجذورها وأوزانها من وسم الصرف — الاسمُ المجرّدُ من السوابق واللواحق
const rows = db.prepare(`
  SELECT s.text f, r.root_ar root, s.pos, s.number num
  FROM segment s LEFT JOIN root r ON r.root_id = s.root_id
  WHERE s.role='stem' AND s.pos_basic='N' AND r.root_ar IS NOT NULL`).all();

console.log("فحصُ دلالةِ الصيغة الصرفيّة — استقراءٌ تامٌّ على وسم الصرف\n");
console.log(`الجذوعُ الاسميّةُ المفحوصة: ${rows.length}\n`);
console.log("| الوزن | ما يُدّعى | مواضع | موادُّ مختلفة | مواد ذاتُ وزنين فأكثر | القرينة |");
console.log("|---|---|---|---|---|---|");

const byPattern = new Map();
for (const p of PATTERNS) {
  const hits = rows.filter((r) => p.re.test(norm(r.f)));
  const roots = new Set(hits.map((r) => r.root));
  byPattern.set(p.name, { p, hits, roots });
}

// مادّةٌ وردت بوزنين فأكثر: محكُّ الدعوى — أيختلف معناها باختلاف الوزن؟
for (const [, { p, hits, roots }] of byPattern) {
  const others = [...byPattern.values()].filter((x) => x.p.name !== p.name);
  const shared = [...roots].filter((rt) => others.some((o) => o.roots.has(rt)));
  const verdict = !hits.length ? "لا شواهد"
    : shared.length >= 3 ? "الوزنُ يشارك غيرَه في المادّة — فالمعنى يحتاج دليلًا خاصًّا"
    : "الوزنُ يكاد يختصّ بمادّته";
  console.log(`| ${p.name} | ${p.claim} | ${hits.length} | ${roots.size} | ${shared.length} | ${verdict} |`);
}

console.log("\n— موادُّ جاءت بوزنين مختلفين (محكُّ الدعوى) —\n");
const pairs = [];
for (const [n1, a] of byPattern) {
  for (const [n2, b] of byPattern) {
    if (n1 >= n2) continue;
    for (const rt of a.roots) {
      if (!b.roots.has(rt)) continue;
      const fa = [...new Set(a.hits.filter((h) => h.root === rt).map((h) => h.f))];
      const fb = [...new Set(b.hits.filter((h) => h.root === rt).map((h) => h.f))];
      pairs.push({ rt, n1, n2, fa, fb });
    }
  }
}
for (const x of pairs.slice(0, 14)) {
  console.log(`  «${x.rt}» — ${x.n1}: ${x.fa.slice(0, 3).join(" · ")}   |   ${x.n2}: ${x.fb.slice(0, 3).join(" · ")}`);
}
console.log(`\nالمجموع: ${pairs.length} مادّةً وردت بوزنين مختلفين — وهي التي يُفحص فيها أثرُ الوزن.`);

/**
 * كتبُ الإعراب — الدفعةُ الأولى من إكمال المراجع (2026-07-31، ميثاق الفحص §ب
 * الرتبة ٣: «حجّةٌ في الحكم النحويّ، ويُذكر الخلافُ إن وقع»).
 *
 * العلّةُ المعالَجة: كان عندنا كتابُ إعرابٍ واحدٌ فلا يظهر خلافُ المعربين —
 * فإمّا نُوهم إجماعًا ليس بموجود أو نُسقط قولًا صحيحًا. فتدخل معه ثلاثةٌ من
 * أئمّة الصنعة: النحّاس (٣٣٨) ومكّي (٤٣٧) والعكبري (٦١٦) والسمين (٧٥٦).
 *
 * المرساة: **آية**. المتونُ في مرآة OpenITI معنونةٌ بعناوينَ صريحة من نمط
 * «### | [سورة الفاتحة (1) : آية 2]» و«… : الآيات 3 الى 4» — فيُقطَّع الكتابُ
 * عليها ويُنسب كلُّ مقطعٍ لموضعه. ما لم يُعرف موضعُه (المقدّماتُ والتراجم)
 * يُطرح، فلا نحمل في بياناتنا ما لا يُسنَد.
 *
 * usage: node js/scripts/build-iraab-books.mjs
 * out:   js/apps/studio/public/iraab/<id>.json  { meta, entries: { "s:a": [نصّ…] } }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { anchorByMarkedQuote, anchorParagraph, buildQuranIndex, cleanOpenITI, pickBiggest } from "./lib/anchor-by-quote.mjs";
import { anchorSequentialBook, buildSequentialIndex } from "./lib/anchor-sequential.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const OUT = path.join(ROOT, "js/apps/studio/public/iraab");
const MIRROR = "/Volumes/data/RELEASE-master/data";

/** الكتبُ الأربعة بمعرّفاتها ونسخِها المفضّلة (الأنظفُ تقطيعًا) */
const BOOKS = [
  { id: "nahhas", author: "0338AbuJacfarNahhas", work: "IcrabQuran",
    label: "إعراب القرآن", by: "أبو جعفر النحّاس", died: 338 },
  { id: "makki", author: "0437MakkiIbnHammushQaysi", work: "MushkilIcrabQuran",
    label: "مشكل إعراب القرآن", by: "مكّي بن أبي طالب القيسي", died: 437 },
  { id: "ukbari", author: "0616MuhibbDinCukbari", work: "TibyanFiIcrabQuran",
    label: "التبيان في إعراب القرآن", by: "أبو البقاء العكبري", died: 616 },
  { id: "samin", author: "0756IbnYusufSaminHalabi", work: "DurrMasun",
    label: "الدرّ المصون في علوم الكتاب المكنون", by: "السمين الحلبي", died: 756 },
];

const clean = (s) => s
  .replace(/PageV\d+P\d+/g, " ")      // علاماتُ الصفحات
  .replace(/^[#~|]+\s?/gm, "")        // رموزُ التقطيع
  .replace(/\s+/g, " ")
  .trim();

/** يلتقط من العنوان: رقمَ السورة ومدى الآيات */
function anchorOf(head) {
  // «[سورة الفاتحة (1) : آية 2]» · «[سورة البقرة (2) : الآيات 3 الى 5]»
  const m = head.match(/سورة\s+([^\(]{2,25})\((\d{1,3})\)\s*:\s*(?:آية|الآيات|الاية|الآيه)?\s*(\d{1,3})(?:\s*(?:الى|إلى)\s*(\d{1,3}))?/);
  if (!m) return null;
  const s = Number(m[2]), a1 = Number(m[3]), a2 = Number(m[4] ?? m[3]);
  if (!s || s > 114 || !a1 || a1 > 286) return null;
  return { s, a1, a2: Math.min(a2, a1 + 20) }; // مدًى معقول
}

function pickVersion(dir) {
  const files = fs.readdirSync(dir).filter((f) => !f.endsWith(".yml") && !f.endsWith(".md"));
  // نفضّل النسخةَ التي فيها أكثرُ عناوينِ آياتٍ صريحة
  let best = null, bestScore = -1;
  for (const f of files) {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    const score = (t.match(/سورة\s+[^\(]{2,25}\(\d{1,3}\)\s*:/g) || []).length;
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return { file: best, anchors: bestScore };
}

fs.mkdirSync(OUT, { recursive: true });
console.log("يُبنى فهرسُ المصحف المقلوب…");
const { idx } = buildQuranIndex();
console.log(`  خماسيّاتٌ مميِّزة: ${idx.size}\n`);

const seqIx = buildSequentialIndex();

/**
 * الكتبُ التي لا مرساةَ صريحةَ فيها: تُجرَّب مِرساتان وتُقدَّم أوسعُهما سندًا —
 * **المتتابعة** (الاقتباسُ متّصلًا مع ترتيب المصحف) لما جرى على ترتيب السور،
 * و**التصويت** لما كان موضوعيًّا. لا يُفرض منهجٌ واحدٌ على كتابٍ لا يناسبه.
 */
function byQuote(b, dir) {
  const file = pickBiggest(dir);
  const body = fs.readFileSync(path.join(dir, file), "utf8").split("#META#Header#End#").pop();

  // ١) التصويت
  const vote = {};
  let placed = 0, dropped = 0, marked = 0;
  for (const raw of body.split(/PageV\d+P\d+|\n(?=#\s)/)) {
    if (raw.length < 120) { continue; }
    const a = anchorByMarkedQuote(raw, idx) ?? anchorParagraph(raw, idx);
    if (!a) { dropped++; continue; }
    if (a.how) marked++;
    const c = cleanOpenITI(raw);
    (vote[a.loc] ??= []).push(c.length > 4000 ? c.slice(0, 4000) + "…" : c);
    placed++;
  }

  // ٢) المتتابعة
  const { anchors } = anchorSequentialBook(body, seqIx);
  const seq = {};
  for (let i = 0; i < anchors.length; i++) {
    const text = cleanOpenITI(body.slice(anchors[i].pos, anchors[i + 1]?.pos ?? body.length));
    if (text.length < 40) continue;
    (seq[anchors[i].loc] ??= []).push(text.length > 6000 ? text.slice(0, 6000) + "…" : text);
  }

  const useSeq = Object.keys(seq).length > Object.keys(vote).length;
  return {
    entries: useSeq ? seq : vote,
    placed: useSeq ? anchors.length : placed,
    dropped: useSeq ? 0 : dropped,
    file,
    how: useSeq ? "الاقتباسُ القرآنيُّ متّصلًا + ترتيبُ المصحف"
       : marked > placed / 2 ? "الاقتباسُ القرآنيُّ المعلَّم" : "مطابقةُ النصّ المقتبَس",
  };
}

const summary = [];
for (const b of BOOKS) {
  const dir = path.join(MIRROR, b.author, `${b.author}.${b.work}`);
  if (!fs.existsSync(dir)) { console.log(`✗ ${b.id}: لا مجلد`); continue; }
  const { file, anchors } = pickVersion(dir);
  if (!file || anchors < 100) {
    // لا عناوينَ صريحة → المِرساةُ العامّة
    const r = byQuote(b, dir);
    const locs = Object.keys(r.entries).length;
    fs.writeFileSync(path.join(OUT, `${b.id}.json`), JSON.stringify({
      meta: { id: b.id, label: b.label, author: b.by, died: b.died,
              source: `OpenITI ${b.author}.${b.work} · ${r.file}`, date: "2026-07-31",
              anchor: r.how,
              role: "إعراب — حجّةٌ في الحكم النحويّ (ميثاق الفحص، الرتبة ٣)" },
      entries: r.entries,
    }));
    const kb = (fs.statSync(path.join(OUT, `${b.id}.json`)).size / 1024) | 0;
    console.log(`✓ ${b.label} — ${b.by}: ${r.placed} مقطعًا مُسنَدًا · ${locs} موضعًا · ${kb}KB (طُرح ${r.dropped}) [${r.how}]`);
    summary.push({ id: b.id, locs, placed: r.placed });
    continue;
  }

  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  const body = raw.split("#META#Header#End#").pop();
  const parts = body.split(/^###\s*\|?\s*/m);

  const entries = {};
  let placed = 0, dropped = 0;
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl < 0) continue;
    const head = part.slice(0, nl);
    const text = clean(part.slice(nl + 1));
    if (text.length < 40) { dropped++; continue; }
    const anc = anchorOf(head);
    if (!anc) { dropped++; continue; }
    for (let a = anc.a1; a <= anc.a2; a++) {
      const key = `${anc.s}:${a}`;
      (entries[key] ??= []).push(text.length > 4000 ? text.slice(0, 4000) + "…" : text);
    }
    placed++;
  }
  const locs = Object.keys(entries).length;
  fs.writeFileSync(path.join(OUT, `${b.id}.json`), JSON.stringify({
    meta: { id: b.id, label: b.label, author: b.by, died: b.died,
            source: `OpenITI ${b.author}.${b.work} · ${file}`, date: "2026-07-31",
            role: "إعراب — حجّةٌ في الحكم النحويّ (ميثاق الفحص، الرتبة ٣)" },
    entries,
  }));
  const kb = (fs.statSync(path.join(OUT, `${b.id}.json`)).size / 1024) | 0;
  console.log(`✓ ${b.label} — ${b.by}: ${placed} مقطعًا مُسنَدًا · ${locs} موضعًا · ${kb}KB (طُرح ${dropped})`);
  summary.push({ id: b.id, locs, placed });
}
console.log("\nالتغطية:", summary.map((s) => `${s.id}:${s.locs}`).join(" · "));

/**
 * معاني القرآن ومجازُه ومشكلُه — الدفعةُ الثالثة (2026-07-31، ميثاق الفحص
 * §ب الرتبة ٣).
 *
 * لماذا هذه الطبقةُ بالذات: كتبُ الفرّاء (٢٠٧) وأبي عبيدة (٢٠٩) وابن قتيبة
 * (٢٧٦) والزجّاج (٣١١) والنحّاس (٣٣٨) **أقدمُ من التفسير المدوَّن الذي
 * يُنتقد**. فحين تُطرح دعوى «التراثُ أقحم على اللفظ معنًى ليس له»، تكون هذه
 * الطبقةُ هي الحَكَم: إن وُجد المعنى عند أهل اللغة في القرن الثاني والثالث
 * فالدعوى تسقط، وإن غاب عنهم جميعًا فللدعوى وجه. وهذا ميزانٌ لا مذهبَ فيه.
 *
 * المرساة: **آية** بالمِرساة المتتابعة (lib/anchor-sequential) — فهذه متونٌ
 * جاريةٌ على ترتيب المصحف تقتبس الآيةَ ثم تشرحها، والاقتباسُ نفسُه هو
 * المِرساة. وما لم يثبت لا يُسنَد.
 *
 * usage: node js/scripts/build-maani-books.mjs
 * out:   js/apps/studio/public/maani/<id>.json  { meta, entries: { "s:a": [نصّ…] } }
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { anchorParagraph, buildQuranIndex, cleanOpenITI, pickBiggest } from "./lib/anchor-by-quote.mjs";
import { anchorSequentialBook, buildSequentialIndex } from "./lib/anchor-sequential.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const OUT = path.join(ROOT, "js/apps/studio/public/maani");
const MIRROR = "/Volumes/data/RELEASE-master/data";
const MAXLEN = 6000; // حدُّ المدخل الواحد

const BOOKS = [
  { id: "farra", uri: "0207IbnZiyadFarra.MacaniQuran", label: "معاني القرآن", by: "الفرّاء", died: 207 },
  { id: "abuubayda", uri: "0209AbuCubayda.MajazQuran", label: "مجاز القرآن", by: "أبو عبيدة معمر بن المثنّى", died: 209 },
  { id: "ibnqutayba-gharib", uri: "0276IbnQutaybaDinawari.GharibQuran", label: "غريب القرآن", by: "ابن قتيبة", died: 276 },
  { id: "ibnqutayba-mushkil", uri: "0276IbnQutaybaDinawari.TawilMushkilQuran", label: "تأويل مشكل القرآن", by: "ابن قتيبة", died: 276 },
  { id: "zajjaj", uri: "0311IbnSariZajjaj.MacaniQuran", label: "معاني القرآن وإعرابه", by: "الزجّاج", died: 311 },
  { id: "nahhas-maani", uri: "0338AbuJacfarNahhas.MacaniQuran", label: "معاني القرآن", by: "أبو جعفر النحّاس", died: 338 },
];

console.log("يُبنى فهرسُ الآيات المتتابع…");
const ix = buildSequentialIndex();
const { idx: gramIdx } = buildQuranIndex();
console.log(`  آياتٌ: ${ix.verses.length} · سورٌ معنونة: ${ix.suraByName.size} · خماسيّاتٌ مميِّزة: ${gramIdx.size}\n`);

/** المِرساةُ المتتابعة: مدخلٌ عند كلِّ اقتباسٍ ثبت، ونصُّه إلى الاقتباس التالي */
function bySequence(body) {
  const { anchors } = anchorSequentialBook(body, ix);
  const entries = {};
  for (let i = 0; i < anchors.length; i++) {
    const text = cleanOpenITI(body.slice(anchors[i].pos, anchors[i + 1]?.pos ?? body.length));
    if (text.length < 40) continue;
    (entries[anchors[i].loc] ??= []).push(text.length > MAXLEN ? text.slice(0, MAXLEN) + "…" : text);
  }
  return entries;
}

/** مِرساةُ التصويت: للكتب الموضوعيّة التي لا تجري على ترتيب المصحف */
function byVote(body) {
  const entries = {};
  for (const raw of body.split(/PageV\d+P\d+|\n(?=###?\s)/)) {
    if (raw.length < 120) continue;
    const a = anchorParagraph(raw, gramIdx);
    if (!a) continue;
    const text = cleanOpenITI(raw);
    if (text.length < 40) continue;
    (entries[a.loc] ??= []).push(text.length > MAXLEN ? text.slice(0, MAXLEN) + "…" : text);
  }
  return entries;
}

fs.mkdirSync(OUT, { recursive: true });
const summary = [];
for (const b of BOOKS) {
  const dir = path.join(MIRROR, b.uri.split(".")[0], b.uri);
  if (!fs.existsSync(dir)) { console.log(`✗ ${b.label} (${b.by}): لا مجلد`); continue; }
  const file = pickBiggest(dir);
  if (!file) { console.log(`✗ ${b.label}: لا ملفَّ نصّ`); continue; }

  const body = fs.readFileSync(path.join(dir, file), "utf8").split("#META#Header#End#").pop();

  // الكتابُ يختار مِرساتَه: المتتابعةُ لما جرى على ترتيب المصحف، والتصويتُ لما
  // كان موضوعيًّا (كتُبُ ابن قتيبة أبوابٌ لا تفسيرٌ متتابع). لا يُفرض منهجٌ واحد.
  const seq = bySequence(body), vote = byVote(body);
  const useSeq = Object.keys(seq).length >= Object.keys(vote).length;
  const entries = useSeq ? seq : vote;
  const anchorName = useSeq ? "الاقتباسُ القرآنيُّ متّصلًا + ترتيبُ المصحف" : "تصويتُ الفقرة على خماسيّات المصحف";
  const locs = Object.keys(entries).length;
  if (locs < 100) { console.log(`✗ ${b.label} (${b.by}): تغطيةٌ ضئيلة (${locs} موضعًا) — لا تُثبَّت`); continue; }

  fs.writeFileSync(path.join(OUT, `${b.id}.json`), JSON.stringify({
    meta: {
      id: b.id, label: b.label, author: b.by, died: b.died,
      source: `OpenITI ${b.uri} · ${file}`, date: "2026-07-31",
      anchor: anchorName,
      role: "معاني القرآن — حجّةٌ في الحكم الدلاليّ والنحويّ (ميثاق الفحص، الرتبة ٣)، وهي أقدمُ من التفسير المدوَّن",
      coverage: `${locs} من ${ix.verses.length} موضعًا`,
    },
    entries,
  }));
  const kb = (fs.statSync(path.join(OUT, `${b.id}.json`)).size / 1024) | 0;
  console.log(`✓ ${b.label} — ${b.by} (ت${b.died}): ${locs} موضعًا (${((locs / ix.verses.length) * 100).toFixed(0)}%) · ${kb}KB · ${anchorName}`);
  summary.push({ id: b.id, locs });
}
console.log("\nالتغطية:", summary.map((s) => `${s.id}:${s.locs}`).join(" · "));

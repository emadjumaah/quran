/**
 * فقهُ اللغة وأصولُ التفسير والبلاغة — الدفعةُ الرابعة (2026-07-31، ميثاق
 * الفحص §ب الرتبة ٤: «حجّةٌ في القاعدة لا في الجزئيّة»).
 *
 * لماذا تختلف هذه عمّا سبق: الكتبُ الثلاثةُ الماضية (إعرابٌ ومعاجمُ ومعاني)
 * تُراجَع **بموضعٍ أو بمادّة**، وهذه تُراجَع **بقاعدة**. فالدعوى من نوع «لا
 * ترادفَ في القرآن» أو «الحرفُ لا يُزاد» لا يُحكم فيها بموضعٍ بعينه، بل
 * بقاعدةٍ عند ابن جنّي أو ابن فارس أو الجرجانيّ. فبنيتُها **أبوابٌ معنونة**
 * لا مداخلُ مرساة.
 *
 * ومع ذلك تُربط بالمصحف من طرفٍ ثانٍ: كلُّ بابٍ يُستخرج ما استشهد به من آيات
 * (بالاقتباس المعلَّم أو المحصور)، فيصير للآية الواحدة جوابٌ عن سؤال: **أيُّ
 * قاعدةٍ استُشهد فيها بهذه الآية؟** — وهذا وجهٌ لا يُتاح في كتابٍ مطبوع.
 *
 * usage: node js/scripts/build-usul-books.mjs
 * out:   js/apps/studio/public/usul/<id>.json   { meta, sections:[{t,x}] }
 *        js/apps/studio/public/usul/index.json  فهرسُ الكتب وعناوينِ أبوابها
 *        js/apps/studio/public/usul/by-ayah.json  آيةٌ → أبوابٌ استشهدت بها
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildQuranIndex, cleanOpenITI, normAr } from "./lib/anchor-by-quote.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const OUT = path.join(ROOT, "js/apps/studio/public/usul");
const MIRROR = "/Volumes/data/RELEASE-master/data";
const MAXSEC = 12000;

const BOOKS = [
  { id: "khasais", uri: "0392IbnJinniMawsili.Khasais", label: "الخصائص", by: "ابن جنّي", died: 392,
    role: "أصولُ العربيّة وعللُها — أعلى مرجعٍ في قواعد اللغة الكلّيّة" },
  { id: "sahibi", uri: "0395IbnFarisQazwini.Sahibi", label: "الصاحبيّ في فقه اللغة", by: "ابن فارس", died: 395,
    role: "سننُ العرب في كلامها — وفيه أبوابُ الترادف والاشتقاق والحقيقة والمجاز" },
  { id: "sinaatayn", uri: "0395AbuHilalCaskari.Sinacatayn", label: "الصناعتان", by: "أبو هلال العسكري", died: 395,
    role: "الكتابةُ والشعر — ضبطُ الفروق البيانيّة" },
  { id: "dalail", uri: "0471CabdQahirJurjani.DalailIcjaz", label: "دلائل الإعجاز", by: "عبد القاهر الجرجاني", died: 471,
    role: "نظريّةُ النظم — أصلُ كلِّ حكمٍ على تركيبٍ قرآنيّ" },
  { id: "asrar", uri: "0471CabdQahirJurjani.AsrarBalagha", label: "أسرار البلاغة", by: "عبد القاهر الجرجاني", died: 471,
    role: "الاستعارةُ والتمثيل — مرجعُ القول في المجاز والحقيقة" },
  { id: "usul-tafsir", uri: "0728IbnTaymiyya.MuqaddimaFiUsulTafsir", label: "مقدّمة في أصول التفسير", by: "ابن تيمية", died: 728,
    role: "وفيها تقريرُ «القرآن يفسّر بعضُه بعضًا» وضوابطُه" },
  { id: "muzhir", uri: "0911Suyuti.MuzhirFiCulumLugha", label: "المزهر في علوم اللغة", by: "السيوطي", died: 911,
    role: "جامعُ مسائل فقه اللغة بالنقل عن أئمّتها — ومنها الترادفُ والوضع" },

  // أصولُ الفقه في **مباحث الألفاظ** (أُضيفت بعد سؤال المالك عن العلوم المرجعيّة):
  // وهي أدقُّ ما وضعه العربُ لضبط الدلالة — العامُّ والخاصُّ · المطلقُ والمقيّدُ ·
  // المنطوقُ والمفهومُ · النصُّ والظاهرُ والمجمل. وأكثرُ الدعاوى المعاصرة تخبط
  // في هذه المواضع بلا اصطلاحٍ ضابط، فتُقاس بها لا بالذوق.
  { id: "burhan-usul", uri: "0478ImamHaramaynJuwayni.BurhanFiUsulFiqh", label: "البرهان في أصول الفقه", by: "إمام الحرمين الجويني", died: 478,
    role: "مباحثُ الألفاظ — العامُّ والخاصُّ والمجملُ والمبيَّن" },
  { id: "mustasfa", uri: "0505Ghazali.Mustasfa", label: "المستصفى في علم الأصول", by: "الغزالي", died: 505,
    role: "أضبطُ تحريرٍ لدلالات الألفاظ ولطرق الاستدلال وشروطِ صحّتها" },
  { id: "ihkam-amidi", uri: "0631SayfDinAmidi.IhkamFiUsulAhkam", label: "الإحكام في أصول الأحكام", by: "الآمدي", died: 631,
    role: "تفصيلُ المنطوق والمفهوم ودلالاتِ الاقتضاء والإشارة" },
  { id: "ihkam-ibnhazm", uri: "0456IbnHazm.IhkamFiUsulAhkam", label: "الإحكام في أصول الأحكام", by: "ابن حزم", died: 456,
    role: "مذهبُ الظاهر — أقربُ الأصوليّين إلى «لا يُحمل اللفظُ إلا على ظاهره»" },
];

console.log("يُبنى فهرسُ المصحف المقلوب…");
const { idx } = buildQuranIndex();

/**
 * مواضعُ الآيات التي استُشهد بها في نصٍّ — من **الاقتباس المحصور** وحدَه، لا من
 * الفقرة. وطبعاتُ هذه الكتب تختلف في علامة الحصر (بعضُها لا يعلّم القرآن
 * أصلًا)، فتُقبل صيغُها كلُّها، ويُشترط في كلٍّ **خمسُ كلماتٍ متواليةٍ** تطابق
 * خماسيّةً نادرةً في المصحف — فلا يمرُّ شعرٌ ولا كلامُ نحويّ.
 */
const QUOTES = /@QB@([\s\S]{8,400}?)@QE@|\{([^}\n]{8,300})\}|﴿([^﴾\n]{8,300})﴾|«([^»\n]{8,300})»|\(([^()\n]{8,300})\)/g;
function citedVerses(raw) {
  const out = new Set();
  for (const m of raw.matchAll(QUOTES)) {
    const w = normAr(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]).split(" ").filter(Boolean);
    if (w.length < 5) continue;
    const votes = new Map();
    for (let i = 0; i + 5 <= w.length; i++) {
      const locs = idx.get(w.slice(i, i + 5).join(" "));
      if (!locs || locs.size > 3) continue;
      for (const l of locs) votes.set(l, (votes.get(l) ?? 0) + 1);
    }
    if (!votes.size) continue;
    const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    out.add(top[0]);
  }
  return [...out];
}

fs.mkdirSync(OUT, { recursive: true });
const index = [], byAyah = {};
for (const b of BOOKS) {
  const dir = path.join(MIRROR, b.uri.split(".")[0], b.uri);
  if (!fs.existsSync(dir)) { console.log(`✗ ${b.label}: لا مجلد`); continue; }

  // النسخةُ ذاتُ أكثرِ الأبواب المعنونة — فبنيةُ هذا النوع أبوابٌ لا مواضع
  let best = null, bestN = -1;
  for (const f of fs.readdirSync(dir).filter((x) => !x.endsWith(".yml") && !x.endsWith(".md"))) {
    const n = (fs.readFileSync(path.join(dir, f), "utf8").match(/^###\s*\|/gm) || []).length;
    if (n > bestN) { bestN = n; best = f; }
  }
  if (!best) { console.log(`✗ ${b.label}: لا ملفَّ نصّ`); continue; }

  const body = fs.readFileSync(path.join(dir, best), "utf8").split("#META#Header#End#").pop();
  const parts = body.split(/^###\s*\|+\s*/m).slice(1);
  const sections = [];
  let cited = 0;
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl < 0) continue;
    const t = cleanOpenITI(part.slice(0, nl)).slice(0, 200);
    const x = cleanOpenITI(part.slice(nl + 1));
    if (x.length < 120) continue;
    const si = sections.length;
    sections.push({ t, x: x.length > MAXSEC ? x.slice(0, MAXSEC) + "…" : x });
    for (const loc of citedVerses(part)) {
      (byAyah[loc] ??= []).push({ b: b.id, s: si, t });
      cited++;
    }
  }
  if (sections.length < 5) { console.log(`✗ ${b.label}: أبوابٌ غيرُ معنونة (${sections.length}) — لا تُثبَّت`); continue; }

  fs.writeFileSync(path.join(OUT, `${b.id}.json`), JSON.stringify({
    meta: { id: b.id, label: b.label, author: b.by, died: b.died, source: `OpenITI ${b.uri} · ${best}`,
            date: "2026-07-31", anchor: "بابٌ معنون (لا موضع)", note: b.role,
            rank: "الرتبة ٤ في ميثاق الفحص — حجّةٌ في القاعدة لا في الجزئيّة" },
    sections,
  }));
  const kb = (fs.statSync(path.join(OUT, `${b.id}.json`)).size / 1024) | 0;
  console.log(`✓ ${b.label} — ${b.by} (ت${b.died}): ${sections.length} بابًا · ${cited} استشهادًا بآية · ${kb}KB`);
  index.push({ id: b.id, label: b.label, author: b.by, died: b.died, note: b.role, sections: sections.length,
               titles: sections.map((s) => s.t) });
}

fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({
  date: "2026-07-31", rank: "الرتبة ٤ — حجّةٌ في القاعدة لا في الجزئيّة", books: index,
}));
fs.writeFileSync(path.join(OUT, "by-ayah.json"), JSON.stringify(byAyah));
console.log(`\nآياتٌ استُشهد بها في قاعدة: ${Object.keys(byAyah).length}`);

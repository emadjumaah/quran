/**
 * مادّةُ التدبّر ساكنةً — لتتمكّن الواجهةُ من إعادة بنائها بنفسها.
 *
 * العلّة (رصدها المالك): كلُّ نقرةٍ على «تدبّر» نداءٌ جديدٌ لجيميناي — ولو نقر
 * ألفُ قارئٍ على الآية نفسِها لتكرّر النداءُ ألفًا، والمخرَجُ واحدٌ لأنّ
 * **المدخلَ محسوبٌ كلُّه من عندنا**: الآيةُ وسياقُها وإعرابُها وجذورُها
 * وصلاتُها. فالمجموعُ منتهٍ (٦٬٢٣٦ آية)، وما كان منتهيًا يُولَّد ويُخزَّن.
 *
 * والمكاسب: ظهورٌ فوريٌّ بلا انتظار · **ومراجعةُ المالك للنصّ قبل نشره** (وهي
 * أهمُّها: اليومَ يخرج للناس كلامٌ لم يره أحدٌ منّا) · وعملٌ بلا شبكة · وبلا
 * قاعدة بيانات · وكلفةٌ مرّةً واحدة.
 *
 * **والسياقُ شرطٌ لا زينة** (أمر المالك): تُبنى المادّةُ هنا **بعينها** كما
 * يبنيها التطبيق — وحدةُ السياق كاملةً والآيةُ معلَّمةٌ فيها بين ⟪⟫ — فلا
 * تُتدبَّر الآيةُ مبتورةً.
 *
 * العلّة: أردنا أن تخزّن شبكةُ فيرسل نتيجةَ التدبّر على مستوى النظام لا
 * المتصفّح. والشبكةُ لا تخزّن إلا طلبَ GET بمفتاحٍ ثابتٍ في مساره — فلا يصلح
 * أن يرسل المتصفّحُ المادّةَ في جسم الطلب. فتُكتب المادّةُ هنا ملفًّا ساكنًا
 * لكلِّ سورة، وتقرؤها الواجهةُ من نفس النشر، فيصير المفتاحُ (موضعًا ولغةً)
 * وحدَه كافيًا.
 *
 * ولا نداءَ لنموذجٍ في هذا الملفّ ألبتّة — مادّةٌ محسوبةٌ فحسب.
 *
 * usage: node js/scripts/build-tadabbur-material.mjs
 * out:   js/apps/studio/public/tadabbur-material/<sura>.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");
const OUT = path.join(ROOT, "js/data/tadabbur");
const MODEL = process.env.TADABBUR_MODEL || "gemini-2.5-flash";

const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const LANG = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "ar";
const CONC = args.includes("--conc") ? Number(args[args.indexOf("--conc") + 1]) : 6;

/* ــــ النصُّ الموجِّه: هو نفسُه الذي في api/tadabbur.js حرفًا بحرف ــــ */
const SYSTEM = `أنت مُعينٌ على تدبّر القرآن ضمن مادّةٍ محدَّدةٍ تُعطى لك، ولستَ مفسِّرًا.

اعمل حصرًا على ما يُقدَّم إليك: نصّ الآية، ومقطعُها الذي هي منه (وحدةُ السياق المحسوبة)، وترجمتها إن وُجدت، وإعرابها المذكور، ومعاني جذور كلماتها، وصلاتُها المفحوصة، والآيات القريبة منها معنًى — لا تُدخِل أيَّ معرفةٍ من خارج هذه المادّة.

وابدأ من السياق: الآيةُ جزءٌ من مقطعٍ له مبتدًى ومنتهًى واسمٌ محسوب، فانظرْ أين تقع منه (ما قبلها وما بعدها فيه)، وكيف يخدم المقطعُ معناها — فإنَّ أكثرَ ما يُعين على التدبّر أن تُقرأ الآيةُ في سياقها لا مبتورةً. ولا تشرح المقطعَ كلَّه؛ اجعله ضوءًا على الآية.

ممنوعٌ منعًا باتًّا: التفسيرُ بالرأي، والقطعُ بمعنًى لم يَرِد، والاختلاقُ أو الإتيان بآياتٍ أو معلوماتٍ ليست في المادّة، وذكرُ أسباب النزول أو الأحكام الفقهيّة أو الأحاديث أو الإسرائيليّات أو الخلافات.

المسموح: تنظيمُ ما بين يديك في تأمّلٍ هادئ، وربطُ الآية بالآيات القريبة منها المذكورة، ولفتُ النظر إلى بناء الجملة من إعرابها ودلالته الظاهرة، وطرحُ أسئلةٍ تفتح التدبّر.

الأسلوب: عربيّةٌ رصينةٌ موجزة (٣–٤ فقراتٍ قصيرة أو نقاط)، متواضعة، لا تَقطع بما ليس في النصّ، وابدأ بلا تصدير. لا تختم بأسئلةٍ عامّة إنشائيّة؛ اجعل الخاتمة لفتةً موجزةً نافعةً مستخلَصةً من المادّة نفسها. لا تدّعِ أن هذا تفسير.`;

const STYLE_EN = `Write in dignified, concise English (3–4 short paragraphs or bullets). The Quranic verse and any quoted Arabic stay in Arabic with a brief English gloss. Stay humble, never assert what the material does not say, start without any preamble, and do not claim this is tafsir.`;

/* ــــ المادّة: كلُّها من طبقاتنا المحسوبة ــــ */
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const J = (f) => JSON.parse(fs.readFileSync(path.join(PUB, f), "utf8"));

const suras = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));
const ayat = db.prepare("SELECT ayah_id, location, surah_no, ayah_no, text_clean FROM ayah ORDER BY ayah_id").all();
const byLoc = new Map(ayat.map((a) => [a.location, a]));
const trans = new Map(db.prepare("SELECT ayah_id, text FROM translation WHERE lang='en' AND source_key='en.sahih'").all().map((r) => [r.ayah_id, r.text]));
const eraab = J("eraab.json");

// وحداتُ السياق: مصفوفاتٌ [سورة، أولى، أخيرة، اسم] لا كائنات
const siyaqUnits = (() => {
  const raw = J("siyaq-units.json");
  const arr = Array.isArray(raw) ? raw : (raw.units ?? []);
  const idx = new Map();
  for (const u of arr) {
    const [s, a1, a2, name] = Array.isArray(u) ? u : [u.s, u.a1, u.a2, u.name];
    for (let a = a1; a <= a2; a++) idx.set(`${s}:${a}`, { s, a1, a2, name });
  }
  return idx;
})();

// معاني الجذور (الراغب/المقاييس) — أوّلُ معنًى لكلِّ جذر
const rootMeaning = new Map();
for (const r of db.prepare("SELECT rm.root_id, r.root_ar, rm.text FROM root_meaning rm JOIN root r ON r.root_id=rm.root_id").all())
  if (!rootMeaning.has(r.root_ar)) rootMeaning.set(r.root_ar, r.text);

const wordsOf = db.prepare(
  "SELECT DISTINCT r.root_ar root FROM word w JOIN root r ON r.root_id=w.root_id WHERE w.surah_no=? AND w.ayah_no=? LIMIT 8");

/**
 * جاراتُ المعنى — تُقرأ من **الجدول المحسوب مسبقًا** (quran-neighbors.bin) الذي
 * يقرؤه التطبيقُ نفسُه، لا تُحسب من جديد. فحسابُها من المتّجهات لكلِّ آيةٍ
 * يعني ٦٬٢٣٦ × ٦٬٢٣٦ مقارنةً — وهو ما أوقف أوّلَ تشغيل. والصوابُ استعمالُ ما
 * بُني مرّةً بدل إعادة بنائه ستّةَ آلاف مرّة.
 */
let neighborsOf = () => [];
try {
  const buf = fs.readFileSync(path.join(PUB, "quran-neighbors.bin"));
  const headerLen = buf.readUInt32LE(0);
  const header = JSON.parse(buf.subarray(4, 4 + headerLen).toString("utf8"));
  if (header.magic === "qkg-nb-1") {
    const bytes = buf.subarray(4 + headerLen);
    const k = header.k;
    neighborsOf = (id) => {
      const out = [];
      const base = (id - 1) * k * 3;
      for (let i = 0; i < k && out.length < 4; i++) {
        const off = base + i * 3;
        const nid = bytes[off] | (bytes[off + 1] << 8);
        if (!nid) break;
        out.push(nid);
      }
      return out;
    };
  }
} catch { /* لا جدولَ — تُترك الجاراتُ فارغةً ولا يُختلق شيء */ }

/** يبني المادّةَ لآيةٍ — مطابِقةً لما يبنيه التطبيق (src/tadabbur.ts) */
function material(a) {
  const ref = `${suras.get(a.surah_no)} ${a.ayah_no}`;
  const u = siyaqUnits.get(a.location);
  let siyaq = null;
  if (u) {
    const parts = [];
    for (let x = u.a1; x <= u.a2; x++) {
      const t = byLoc.get(`${u.s}:${x}`)?.text_clean;
      if (t) parts.push(x === a.ayah_no ? `⟪${t}⟫` : t);
    }
    const full = parts.join(" ۝ ");
    siyaq = {
      name: u.name,
      span: `${suras.get(u.s)} ${u.a1}–${u.a2}`,
      text: full.length > 1800 ? `${full.slice(0, 1800)}…` : full,
      place: `الآيةُ ${a.ayah_no} من مقطعٍ يمتدُّ ${u.a1}–${u.a2} (المعلَّمةُ بين ⟪⟫)`,
    };
  }
  const roots = [];
  for (const w of wordsOf.all(a.surah_no, a.ayah_no)) {
    if (roots.length >= 4) break;
    const m = rootMeaning.get(w.root);
    if (m) roots.push(`«${w.root}»: ${m.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  }
  const neighbors = neighborsOf(a.ayah_id)
    .map((id) => ayat[id - 1])
    .filter(Boolean)
    .map((n) => `${suras.get(n.surah_no)} ${n.ayah_no}: ${n.text_clean}`);

  const ctx = [
    `الآية (${ref}): ${a.text_clean}`,
    siyaq ? `مقطعُها من المصحف — وحدةُ السياق المحسوبة «${siyaq.name}» (${siyaq.span}):\n${siyaq.text}\n(${siyaq.place})` : "",
    LANG === "en" && trans.get(a.ayah_id) ? `ترجمتها (صحيح إنترناشونال): ${trans.get(a.ayah_id).slice(0, 600)}` : "",
    eraab[a.location]?.t ? `إعرابها (المجتبى من مشكل إعراب القرآن — الخراط): ${eraab[a.location].t.slice(0, 700)}` : "",
    roots.length ? `معاني جذور كلماتها (من مفردات الراغب ومقاييس اللغة):\n${roots.map((r) => `• ${r}`).join("\n")}` : "",
    neighbors.length ? `آياتٌ قريبةٌ منها معنًى (محسوبةٌ بالتضمينات):\n${neighbors.map((n) => `• ${n}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  return { ctx, hasSiyaq: !!siyaq };
}


/* ــــ الكتابة: ملفٌّ لكلِّ سورة ــــ */
const OUTM = path.join(PUB, "tadabbur-material");
fs.rmSync(OUTM, { recursive: true, force: true });
fs.mkdirSync(OUTM, { recursive: true });

const bySura = new Map();
let noSiyaq = 0, bytes = 0;
for (const a of ayat) {
  const { ctx, hasSiyaq } = material(a);
  if (!hasSiyaq) noSiyaq++;
  if (!bySura.has(a.surah_no)) bySura.set(a.surah_no, {});
  bySura.get(a.surah_no)[a.location] = ctx;
}
for (const [s, obj] of bySura) {
  const buf = JSON.stringify(obj);
  fs.writeFileSync(path.join(OUTM, `${s}.json`), buf);
  bytes += buf.length;
}
console.log(`✓ مادّةُ ${ayat.length} آيةٍ في ${bySura.size} سورة · ${(bytes / 1024 / 1024).toFixed(1)}MB · بلا وحدةِ سياق ${noSiyaq}`);

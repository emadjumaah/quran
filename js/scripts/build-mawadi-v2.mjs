/**
 * مواضيعُ مشكاة v2 — موضوعاتٌ مفهوميّةٌ بعضويّةٍ متعدّدة (قرار المالك 2026-07-21).
 *
 * v1 كانت عنقدةَ k-means على وحدات السياق: الوحدةُ في موضوعٍ واحدٍ لا غير، فيستحيل
 * أن تكون الآيةُ في أكثر من موضوع، والأسماءُ وصفُ عنقودٍ لا عناوينَ يطلبها باحث،
 * والتوزيعُ مختلٌّ (بابٌ فيه ٤٥٤ وحدةً وبابٌ فيه ٣).
 *
 * v2 تعكس الاتجاه: الموضوعُ **مفهومٌ** يُنتقى لأنّه يهمّ الباحث (استئناسًا بما
 * تعارفت عليه الفهارس، والحسابُ كلُّه عندنا)، ثم تُحسب آياتُه حتميًّا:
 *   ١) **المرساةُ اللفظيّة**: مواضعُ جذور المفهوم من قاعدتنا الصرفيّة (يقينيّة).
 *   ٢) **مركزُ المعنى**: متوسّطُ متّجهات المراسي (من متّجهاتنا المشحونة سلفًا —
 *      بلا نداءٍ خارجيٍّ ولا تكلفة).
 *   ٣) **العضويّة**: كلُّ آيةٍ قربُها من المركز ≥ عتبةٍ معلنة، أو فيها جذرُ المفهوم.
 *      فالآيةُ تقع في كلِّ موضوعٍ يخصّها — لا قسمةَ حصريّة.
 * كلُّ آيةٍ في الموضوع موسومةٌ بسببها: «لفظ» أو «معنى» أو «كلاهما».
 *
 * usage: node js/scripts/build-mawadi-v2.mjs
 * out:   public/mawadi-v2.json + findings/unified/MAWADI-V2.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const PUB = path.join(ROOT, "js/apps/studio/public");

/** أبوابُ الباحث ومفاهيمُها — العنوانُ ما يبحث عنه، والجذورُ مرساتُه في النصّ */
const SEEDS = [
  // ── الإيمان بالله ──
  { bab: "الإيمان بالله", name: "توحيد الله ونفي الشريك", roots: ["وحد"], words: ["لا اله الا","الها واحدا","اله واحد"] },
  { bab: "الإيمان بالله", name: "أسماء الله الحسنى", roots: [], words: ["الاسماء الحسني","سبح اسم","تبارك اسم"] },
  { bab: "الإيمان بالله", name: "قدرة الله وخلقه", roots: ["خلق", "بدع"] },
  { bab: "الإيمان بالله", name: "علم الله وإحاطته", roots: [], words: ["عليم","علام الغيوب","يعلم ما","احاط بكل"] },
  { bab: "الإيمان بالله", name: "رحمة الله ومغفرته", roots: ["رحم", "غفر", "توب"] },
  { bab: "الإيمان بالله", name: "الشرك وإبطاله", roots: ["شرك", "صنم"] },

  // ── الوحي والرسالة ──
  { bab: "الوحي والرسالة", name: "القرآن ووصفه", roots: ["قرأ", "كتب", "نزل"] },
  { bab: "الوحي والرسالة", name: "الرسل والأنبياء", roots: ["رسل", "نبأ", "بلغ"] },
  { bab: "الوحي والرسالة", name: "تدبر القرآن", roots: ["دبر"], words: ["يتدبرون","تدبروا","افلا يتدبرون"] },
  { bab: "الوحي والرسالة", name: "تكذيب الرسل وجزاؤه", roots: ["كذب", "هلك", "عذب"] },
  { bab: "الوحي والرسالة", name: "الكتب السابقة وأهلها", roots: [], words: ["التورية","التوراة","الانجيل","اهل الكتاب","النصاري","اليهود"] },

  // ── العبادات ──
  { bab: "العبادات", name: "الصلاة", roots: ["صلو"] },
  { bab: "العبادات", name: "الزكاة والإنفاق", roots: ["زكو", "نفق", "صدق"] },
  { bab: "العبادات", name: "الصيام", roots: ["صوم"] },
  { bab: "العبادات", name: "الحج والبيت الحرام", roots: ["حجج", "بيت", "طوف"] },
  { bab: "العبادات", name: "الدعاء والتسبيح", roots: ["دعو", "سبح"] },
  { bab: "العبادات", name: "التقوى والخشية", roots: ["وقي", "خشي", "خوف"] },

  // ── الأخلاق ──
  { bab: "الأخلاق", name: "الصبر", roots: ["صبر"] },
  { bab: "الأخلاق", name: "الصدق والأمانة", roots: ["صدق", "وفي"], words: ["الامانه","امانات","امانتهم"] },
  { bab: "الأخلاق", name: "العدل والقسط", roots: ["عدل", "قسط"] },
  { bab: "الأخلاق", name: "الإحسان والعفو", roots: ["حسن", "عفو", "صفح"] },
  { bab: "الأخلاق", name: "الشكر والحمد", roots: ["شكر", "حمد", "نعم"] },
  { bab: "الأخلاق", name: "الكبر والغرور", roots: ["كبر", "غرر", "عجب"] },
  { bab: "الأخلاق", name: "الكذب والنفاق", roots: ["كذب", "نفق", "خدع"] },
  { bab: "الأخلاق", name: "الحسد والبغي", roots: ["حسد", "بغي", "حقد"] },
  { bab: "الأخلاق", name: "التواضع وخفض الجناح", roots: ["ذلل", "خفض", "لين"] },

  // ── الإنسان والنفس ──
  { bab: "الإنسان والنفس", name: "خلق الإنسان وأطواره", roots: ["نطف", "طين", "علق"] },
  { bab: "الإنسان والنفس", name: "النفس وتزكيتها", roots: ["نفس", "زكو", "هوي"] },
  { bab: "الإنسان والنفس", name: "القلب والعقل", roots: ["قلب", "عقل", "فقه"] },
  { bab: "الإنسان والنفس", name: "الابتلاء والفتنة", roots: ["بلو", "فتن", "مسس"] },
  { bab: "الإنسان والنفس", name: "الرزق والمال", roots: ["رزق", "مول"] },
  { bab: "الإنسان والنفس", name: "الموت والأجل", roots: ["موت", "أجل", "توف"] },

  // ── الأسرة والمجتمع ──
  { bab: "الأسرة والمجتمع", name: "الوالدان والأرحام", roots: [], words: ["الوالدين","والديه","والدي","الارحام","ذي القربي"] },
  { bab: "الأسرة والمجتمع", name: "الزواج والطلاق", roots: ["نكح", "طلق", "زوج"] },
  { bab: "الأسرة والمجتمع", name: "اليتيم والضعفاء", roots: ["يتم", "مسكن", "ضعف"] },
  { bab: "الأسرة والمجتمع", name: "الأخوة والإصلاح", roots: ["أخو", "صلح"] },
  { bab: "الأسرة والمجتمع", name: "الشورى والحكم", roots: ["شور", "حكم"] },
  { bab: "الأسرة والمجتمع", name: "الجهاد والدفاع", roots: ["جهد", "قتل", "دفع"] },
  { bab: "الأسرة والمجتمع", name: "العهود والمواثيق", roots: ["عهد", "وثق", "عقد"] },

  // ── المعاملات ──
  { bab: "المعاملات", name: "البيع والتجارة", roots: ["بيع", "تجر", "كيل"] },
  { bab: "المعاملات", name: "الربا والدين", roots: ["ربو", "دين", "قرض"] },
  { bab: "المعاملات", name: "الحلال والحرام في الطعام", roots: ["حلل", "حرم", "طعم"] },
  { bab: "المعاملات", name: "الخمر والميسر", roots: ["خمر", "يسر", "رجس"] },
  { bab: "المعاملات", name: "الشهادة والقضاء", roots: ["شهد", "قضي", "حكم"] },

  // ── الكون والآيات ──
  { bab: "الكون والآيات", name: "السماوات والأرض", roots: ["سمو", "أرض", "خلق"] },
  { bab: "الكون والآيات", name: "الشمس والقمر والليل", roots: ["شمس", "قمر", "ليل"] },
  { bab: "الكون والآيات", name: "الماء والنبات", roots: ["موه", "نبت", "زرع"] },
  { bab: "الكون والآيات", name: "الرياح والسحاب والمطر", roots: ["سحب", "مطر"], words: ["الرياح","الريح","ريحا"] },
  { bab: "الكون والآيات", name: "الدواب والأنعام والطير", roots: ["دبب", "طير"], words: ["الانعام"] },
  { bab: "الكون والآيات", name: "الجبال والبحار", roots: ["جبل", "بحر", "نهر"] },

  // ── الآخرة ──
  { bab: "الآخرة", name: "البعث والقيامة", roots: ["بعث", "حشر"], words: ["القيمه","القيامة","يوم يبعثون"] },
  { bab: "الآخرة", name: "الحساب والميزان", roots: ["حسب", "وزن"] },
  { bab: "الآخرة", name: "الجنة ونعيمها", roots: ["خلد"], words: ["الجنه","جنات","جنتان","الفردوس"] },
  { bab: "الآخرة", name: "النار وعذابها", roots: ["عذب", "جحم", "سعر"], words: ["النار","نارا","جهنم"] },
  { bab: "الآخرة", name: "الشفاعة والولاية", roots: ["شفع", "ولي"] },

  // ── القصص ──
  { bab: "القصص", name: "آدم وإبليس", roots: ["سجد"], words: ["ادم","ابليس","الشيطن","الشيطان"] },
  { bab: "القصص", name: "نوح والطوفان", roots: ["فلك"], words: ["نوح"] },
  { bab: "القصص", name: "إبراهيم وأبوه وقومه", roots: ["حنف"], words: ["ابرهيم","ابراهيم"] },
  { bab: "القصص", name: "موسى وفرعون", roots: [], words: ["موسي","موسى","فرعون"] },
  { bab: "القصص", name: "يوسف وإخوته", roots: [], words: ["يوسف"] },
  { bab: "القصص", name: "عيسى ومريم", roots: [], words: ["عيسي","عيسى","مريم"] },
  { bab: "القصص", name: "بنو إسرائيل وميثاقهم", roots: [], words: ["اسرءيل","اسرائيل"] },
];

// ── البيانات ──
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });
const AY = db.prepare("SELECT ayah_id, location, text_clean, surah_no FROM ayah ORDER BY ayah_id").all();
const NAME = new Map(db.prepare("SELECT surah_no, name_ar FROM surah").all().map((r) => [r.surah_no, r.name_ar]));
const ID_OF = new Map(AY.map((a) => [a.location, a.ayah_id]));

/** مواضعُ كلِّ جذرٍ (على مستوى الآية) */
const rootLocs = new Map();
for (const r of db.prepare(`
  SELECT rt.root_ar AS root, a.location AS loc
  FROM segment s JOIN word w ON w.word_id = s.word_id
  JOIN ayah a ON a.ayah_id = s.ayah_id JOIN root rt ON rt.root_id = s.root_id
  WHERE s.root_id IS NOT NULL`).all()) {
  (rootLocs.get(r.root) ?? rootLocs.set(r.root, new Set()).get(r.root)).add(r.loc);
}

// متّجهات الآيات (int8 + مقياسٌ لكلِّ صفّ)
const eb = fs.readFileSync(path.join(PUB, "quran-embeddings.bin"));
const ab = eb.buffer.slice(eb.byteOffset, eb.byteOffset + eb.byteLength);
const hl = new DataView(ab).getUint32(0, true);
const H = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, hl)));
const { dim, count } = H;
const so = 4 + hl;
const scales = new Float32Array(ab.slice(so, so + count * 4));
const data = new Int8Array(ab, so + count * 4, count * dim);
const vecOf = (id) => {
  const v = new Float32Array(dim);
  const off = (id - 1) * dim;
  const sc = scales[id - 1];
  for (let i = 0; i < dim; i++) v[i] = data[off + i] * sc;
  return v;
};

const norm = (v) => { let s = 0; for (const x of v) s += x * x; return Math.sqrt(s) || 1; };
const cos = (a, id) => {
  let dot = 0;
  const off = (id - 1) * dim;
  for (let i = 0; i < dim; i++) dot += a[i] * data[off + i];
  return dot * scales[id - 1];
};

// العتبةُ **نسبيّةٌ لا مطلقة**: متّجهاتُ آيات المصحف متقاربةٌ كلُّها، فعتبةُ ٠٫٧٨
// المطلقة أدخلت ٦٢٢١ آيةً في كلِّ موضوع (تجربةٌ سالبةٌ أُجريت وسُجّلت 2026-07-21).
// فالقياسُ الآن بانحرافِ الآية عن متوسّط قربِ المصحف كلِّه من هذا المركز:
// z ≥ Z_MIN، وبسقفٍ للعدد — فالموضوعُ ما تميّز عن الخلفيّة لا ما قاربها.
const Z_MIN = 2.2;
const MAX_SEM_UNITS = 25;  // سقفُ المقاطع الداخلة بالمعنى وحدَه
const MAX_UNITS = 120;     // سقفُ المقاطع المعروضة لكلِّ موضوع
const MAX_PER = 400;       // سقفُ الآيات المرساة المعروضة

// ── وحداتُ السياق ومتّجهاتُها (طبقتُنا المعتمدة: ١٤٠٤ وحدة) ──
const UNITS = JSON.parse(fs.readFileSync(path.join(PUB, "siyaq-units.json"), "utf8"))
  .units.map((u, i) => ({ i, s: u[0], a1: u[1], a2: u[2], name: u[3] }));
const ub = fs.readFileSync(path.join(PUB, "siyaq-embeddings.bin"));
const uab = ub.buffer.slice(ub.byteOffset, ub.byteOffset + ub.byteLength);
const uhl = new DataView(uab).getUint32(0, true);
const UH = JSON.parse(new TextDecoder().decode(new Uint8Array(uab, 4, uhl)));
const uso = 4 + uhl;
const uScales = new Float32Array(uab.slice(uso, uso + UH.count * 4));
const uData = new Int8Array(uab, uso + UH.count * 4, UH.count * UH.dim);
/** فهرسُ وحدةِ السياق الحاوية لموضع */
function unitIndexOf(loc) {
  const [s, a] = loc.split(":").map(Number);
  const u = UNITS.find((x) => x.s === s && x.a1 <= a && a <= x.a2);
  return u ? u.i : null;
}
/** تميّزُ كلِّ مقطعٍ عن خلفيّة المقاطع كلِّها تجاه مركزِ الموضوع (z) */
function unitZScores(centroid) {
  const sims = new Float64Array(UH.count);
  let sum = 0;
  for (let r = 0; r < UH.count; r++) {
    let dot = 0;
    const off = r * UH.dim;
    for (let i = 0; i < UH.dim; i++) dot += centroid[i] * uData[off + i];
    sims[r] = dot * uScales[r];
    sum += sims[r];
  }
  const m = sum / UH.count;
  let v = 0;
  for (const s of sims) v += (s - m) * (s - m);
  const sd = Math.sqrt(v / UH.count) || 1e-6;
  return Array.from(sims, (s) => (s - m) / sd);
}

const out = [];
for (const seed of SEEDS) {
  // ١ — المرساةُ اللفظيّة: جذورُ المفهوم، ولأعلامِ القصص ألفاظُها (لا جذورَ لها)
  const lex = new Set();
  for (const r of seed.roots ?? []) for (const loc of rootLocs.get(r) ?? []) lex.add(loc);
  if (seed.words?.length) {
    const norms = seed.words.map((w) => w.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي"));
    for (const a of AY) {
      const t = a.text_clean.replace(/[ً-ٰٟ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
      if (norms.some((w) => t.includes(w))) lex.add(a.location);
    }
  }
  if (lex.size === 0) { console.warn(`⚠︎ بلا مرسًى لفظيّ: ${seed.name} (${seed.roots.join("،")})`); continue; }

  // ٢ — مركزُ المعنى: متوسّطُ متّجهات المراسي
  const centroid = new Float32Array(dim);
  let n = 0;
  for (const loc of lex) {
    const id = ID_OF.get(loc);
    if (!id) continue;
    const v = vecOf(id);
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
    n++;
  }
  if (!n) continue;
  const nn = norm(centroid);
  for (let i = 0; i < dim; i++) centroid[i] /= nn;

  // ٣ — العضويّة: لفظًا (يقينًا) أو معنًى (تميّزًا عن خلفيّة المصحف)
  const sims = new Float64Array(AY.length);
  let sum = 0;
  for (let i = 0; i < AY.length; i++) { sims[i] = cos(centroid, AY[i].ayah_id); sum += sims[i]; }
  const mean = sum / AY.length;
  let varr = 0;
  for (const s of sims) varr += (s - mean) * (s - mean);
  const sd = Math.sqrt(varr / AY.length) || 1e-6;

  const zOf = new Map();
  for (let i = 0; i < AY.length; i++) zOf.set(AY[i].location, (sims[i] - mean) / sd);

  // ٤ — وحدةُ السياق هي الوحدةُ المعروضة (سؤال المالك: «ألا يفيدنا السياق؟»):
  //     الآيةُ المفردةُ قد يرد فيها اللفظُ عرَضًا داخل قصّة، أما المقطعُ فيُقرأ
  //     متماسكًا ويُحكم عليه بمجموع شواهده. ترتيبُ المقطع: عددُ مراسيه اللفظيّة
  //     ثم تميّزُ متّجهه هو نفسِه عن خلفيّة المقاطع كلِّها.
  const unitZ = unitZScores(centroid);
  const perUnit = new Map();
  for (const loc of lex) {
    const u = unitIndexOf(loc);
    if (u == null) continue;
    (perUnit.get(u) ?? perUnit.set(u, []).get(u)).push(loc);
  }
  const unitsOut = [];
  for (const [ui, locs] of perUnit) {
    const u = UNITS[ui];
    unitsOut.push({
      i: ui, name: u.name, span: `${u.s}:${u.a1}-${u.a2}`, s: u.s, a1: u.a1, a2: u.a2,
      hits: locs.sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1])),
      z: +(unitZ[ui] ?? 0).toFixed(2),
      why: "لفظ",
    });
  }
  // مقاطعُ لا لفظَ فيها لكنّها متميّزةٌ معنًى — تُضاف موسومةً بسببها
  const semUnits = UNITS.map((u, i) => ({ u, i, z: unitZ[i] ?? -9 }))
    .filter((x) => !perUnit.has(x.i) && x.z >= Z_MIN)
    .sort((a, b) => b.z - a.z)
    .slice(0, MAX_SEM_UNITS);
  for (const { u, i, z } of semUnits) {
    unitsOut.push({ i, name: u.name, span: `${u.s}:${u.a1}-${u.a2}`, s: u.s, a1: u.a1, a2: u.a2, hits: [], z: +z.toFixed(2), why: "معنى" });
  }
  // الترتيبُ بالتميّز لا بمجرّد التكرار: مقطعٌ ورد فيه اللفظُ عرَضًا داخل قصّةٍ
  // (الخضر ومعه «صبرًا» ثلاثًا) لا يتقدّم على مقطعٍ موضوعُه الصبرُ نفسُه.
  const rank = (u) => u.z + 1.2 * Math.log2(1 + u.hits.length);
  unitsOut.sort((a, b) => rank(b) - rank(a));

  const members = [];
  for (const loc of lex) members.push({ loc, z: +(zOf.get(loc) ?? 0).toFixed(2), why: "لفظ" });
  members.sort((x, y) => y.z - x.z);

  out.push({
    bab: seed.bab,
    name: seed.name,
    roots: (seed.roots ?? []).filter((r) => rootLocs.has(r)),
    words: seed.words ?? [],
    lex: lex.size,
    units: unitsOut.slice(0, MAX_UNITS),
    unitsTotal: unitsOut.length,
    verses: members.slice(0, MAX_PER),
  });
  console.log(`${seed.bab.padEnd(16)} ${seed.name.padEnd(26)} آياتٍ ${String(lex.size).padStart(4)} · مقاطعَ ${String(unitsOut.length).padStart(3)} (لفظًا ${String([...perUnit.keys()].length).padStart(3)} · معنًى ${String(semUnits.length).padStart(2)})`);
}

const babs = [...new Set(out.map((t) => t.bab))];
const payload = {
  meta: {
    date: "2026-07-21",
    method: "موضوعٌ مفهوميّ: مرسًى لفظيٌّ بجذور المفهوم من قاعدتنا الصرفيّة، ثم مركزُ معنًى من متوسّط متّجهات المراسي، ثم عضويّةٌ بالقرب ≥ عتبة أو بورود الجذر — بلا نداءٍ خارجيّ",
    zMin: Z_MIN,
    maxSemanticUnits: MAX_SEM_UNITS,
    topics: out.length,
    babs: babs.length,
    note: "الآيةُ تقع في كلِّ موضوعٍ يخصّها (عضويّةٌ متعدّدة). وكلُّ آيةٍ موسومةٌ بسببها: لفظٌ أو معنًى أو كلاهما.",
  },
  babs,
  topics: out,
  units: UNITS.map((u) => [u.s, u.a1, u.a2, u.name]),
};
fs.writeFileSync(path.join(PUB, "mawadi-v2.json"), JSON.stringify(payload));
console.log(`\n✓ mawadi-v2.json — ${out.length} موضوعًا في ${babs.length} أبواب · عتبةُ التميّز z≥${Z_MIN}`);
const multi = new Map();
for (const t of out) for (const u of t.units) multi.set(u.i, (multi.get(u.i) ?? 0) + 1);
const inMany = [...multi.values()].filter((n) => n > 1).length;
console.log(`مقاطعُ في أكثر من موضوع: ${inMany} من ${multi.size} مقطعًا (${((100 * multi.size) / UNITS.length).toFixed(0)}٪ من وحدات السياق)`);

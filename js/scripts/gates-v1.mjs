/**
 * gates-v1.mjs — بوابات العموم v1: وحدةُ التحليل «المقطع» (رموز الوقف) + الآية.
 * يخلُف gates-v0.mjs (المحفوظ للمصدر). Spec: findings/kulliyat-v2/GATES-SPEC.md.
 *
 * قرارات v1 المعلنة (لغوية عامة، لا رقع):
 *  ١) الوحدات = الآية كاملةً + مقاطعُها المفصولة برموز الوقف (ۖ ۗ ۘ ۙ ۚ ۛ ۜ).
 *  ٢) حواجبُ السرد الإطارية (إذ/وإذ، فلمّا، قالَ الماضية) تصبغ الآيةَ كلَّها:
 *     آيةٌ إطارُها سردٌ لا تُنتِج قاعدةً من مقاطعها.
 *  ٣) العلَمُ غيرُ الإلهي وذَلِك-بِأَنّ يخصّصان مقطعَهما فقط (لا الآية كلها).
 *  ٤) المقطعُ المفتتَح بفاء/ثمّ العاطفة يرث حواجبَ المقطع السابق (السياق متصل)؛
 *     المفتتَح بواوٍ لا يرث (واو الاستئناف مألوفة في تقرير القواعد).
 *  ٥) نزعُ «قل» يُطبَّق داخل كل وحدة على حدة.
 * الآية تتأهّل إن تأهّلت وحدةٌ واحدةٌ منها؛ وتُنشَر الوحدةُ المؤهّلة بمداها.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const db = new DatabaseSync(join(ROOT, "quran-kg.db"), { readOnly: true });

const LEM = { kull: 137, jamee: 205, allah: 3, allahumma: 1182, qala: 64, iyya: 14, laysa: 560 };
const LEGIS = new Set([197, 709, 764, 810, 578, 443, 1282, 623]);
// أعيانٌ شرعيّةٌ يسِمُها QAC أعلامًا وليست أشخاصَ وقائع — قائمةٌ مغلقةٌ معلنةٌ
// بمعرّفات lemma (كقائمة أفعال التشريع): ٩٣٪ من حجب العلَم كان بها باطلًا.
// شيطان، جهنم، قرآن، جنة، توراة، إنجيل، نصراني، مسلم، يهود، إسلام، عدن، سقر، اللهم
const EXEMPT_PN = new Set([89, 838, 753, 172, 1137, 1138, 376, 613, 559, 1176, 2363, 4208, 1182]);
// نصُّ احتياطٍ للنوادر غير الملمَّة (فردوس، سجين، عليون، تسنيم، سلسبيل، كوثر، زبور، فرقان، رمضان)
const DOCTRINAL_PN = new Set(["جنه", "جهنم", "شيطان", "قرءان", "قران", "توراه", "انجيل", "زبور", "فرقان", "اسلام", "رمضان", "فردوس", "سجين", "عليون", "تسنيم", "سلسبيل", "كوثر"]);
const normPN = (t) => (t || "").normalize("NFC").replace(/[ً-ْٰـٱ]/g, "").replace(/^ال/, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
// جذور أفعال التشريع (لاسم المفعول التشريعي: «نصيبًا مفروضًا») — تُستخرَج من القاعدة
const LEGIS_ROOTS = new Set(
  db.prepare("SELECT root_id FROM root WHERE root_ar IN ('أمر','نهي','كتب','حرم','حلل','فرض','وصي','قضي')").all().map((r) => r.root_id),
);
const WAQF = /[ۖ-ۜ]/; // ۖ ۗ ۘ ۙ ۚ ۛ ۜ

// ── data ─────────────────────────────────────────────────────────────────────
const segs = db.prepare(`
  SELECT s.ayah_id, s.text, s.pos_basic, s.role, s.pos, s.root_id, s.lemma_id,
         s.aspect, s.mood, s.voice, s.state, s.person, s.number, s.family, w.word_no
  FROM segment s JOIN word w ON w.word_id = s.word_id
  ORDER BY s.ayah_id, w.word_no, s.seg_no`).all();
const ayahs = db.prepare("SELECT ayah_id, location, text_uthmani, word_count FROM ayah").all();

const byAyah = new Map();
for (const s of segs) {
  let arr = byAyah.get(s.ayah_id);
  if (!arr) byAyah.set(s.ayah_id, (arr = []));
  arr.push(s);
}

const strip = (t) => (t || "").normalize("NFC").replace(/[ً-ْٰـ]/g, "");

// ── clause boundaries: walk the uthmani text tokens; a token whose letters are
//    Arabic counts as a word; a waqf mark closes the clause AFTER its word ─────
const AR_LETTER = /[ء-يٱ-ۓە]/;
function clauseRanges(text, wordCount) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const ranges = [];
  let start = 1, w = 0;
  for (const tok of tokens) {
    const isWord = AR_LETTER.test(tok.replace(WAQF, ""));
    if (isWord) w++;
    if (WAQF.test(tok) && w >= start) {
      ranges.push([start, w]);
      start = w + 1;
    }
  }
  if (w >= start) ranges.push([start, w]);
  // فحص المحاذاة: مجموع الوحدات = عدد كلمات القاعدة، وإلا فلا تقطيع (أمان)
  if (w !== wordCount) return null;
  return ranges;
}

// ── تجميع كلمات وحدة ─────────────────────────────────────────────────────────
function wordsView(list) {
  const W = [];
  let cur = null;
  for (const s of list) {
    if (!cur || cur.word_no !== s.word_no) W.push((cur = { word_no: s.word_no, segs: [] }));
    cur.segs.push(s);
  }
  return W;
}

// ── الحواجب ──────────────────────────────────────────────────────────────────
function frameBlockers(list) {
  // إطار السرد — يصبغ الآية كلها
  const b = new Set();
  for (const s of list) {
    const t = strip(s.text);
    if (t === "إذ" || t === "وإذ") b.add("G3:إذ");
    if (t === "فلما") b.add("G3:فلما");
    if (s.lemma_id === LEM.qala && s.aspect === "PERF") b.add("G3:قالَ-سرد");
  }
  return b;
}
function localBlockers(W) {
  // تخصيص المقطع — علَمُ شخصٍ/واقعة (لا الأعيان الشرعية)، ذلك-بأنّ افتتاحًا
  const b = new Set();
  for (const w of W)
    for (const s of w.segs)
      if (s.pos === "PN" && s.lemma_id !== LEM.allah && s.lemma_id !== LEM.allahumma &&
          !EXEMPT_PN.has(s.lemma_id) && !DOCTRINAL_PN.has(normPN(s.text))) b.add("G3:علَم");
  const w0 = W[0], w1 = W[1];
  const isDem = (w) => w && w.segs.some((s) => s.pos === "DEM");
  const isBiAnna = (w) => w && w.segs.some((s) => s.family === "إِنّ") && w.segs.some((s) => strip(s.text) === "ب");
  if (isDem(w0) && isBiAnna(w1)) b.add("G2:ذلك-بأنّ");
  return b;
}

// ── بوابات G1 على وحدة (بعد نزع قل) ─────────────────────────────────────────
function g1Gates(W) {
  const gates = new Set();
  const warnings = [];
  // نزع «قل/قولوا» الافتتاحية داخل الوحدة
  let B = W;
  const qulAt = W.findIndex((w) => w.segs.some((s) => s.lemma_id === LEM.qala && s.aspect === "IMPV"));
  if (qulAt >= 0 && qulAt <= 1) { B = W.slice(qulAt + 1); warnings.push("قل-stripped"); }
  const body = B.flatMap((w) => w.segs);
  const has = (p) => body.some(p);

  if (has((s) => s.lemma_id === LEM.kull || s.lemma_id === LEM.jamee)) gates.add("G1a:كل/جميع");

  if (has((s) => s.pos === "COND" && ["من", "ما", "مهما", "اي", "أي"].includes(strip(s.text))))
    gates.add("G1b:شرط-العموم");
  // v1.1: «إن» الشرطية بخطاب الجمع («إن تنصروا الله ينصركم») — شرطُ عمومٍ للمخاطبين
  for (let i = 0; i < B.length - 1; i++) {
    if (!B[i].segs.some((s) => s.pos === "COND" && ["ان", "إن"].includes(strip(s.text)))) continue;
    const nxt = B[i + 1];
    if (nxt && nxt.segs.some((s) => s.pos_basic === "V" && String(s.person) === "2")) { gates.add("G1b:شرط-الخطاب"); break; }
  }

  // G1c بأنماطه الثلاثة — v1.1: لا يعبر النمطُ ضميرَ غائبٍ متّصلًا («فما كان له من
  // فئة»، «فلم يجدوا لهم أنصارا» نفيٌ مرسًى على معيَّنٍ لا استغراق) — قاعدةٌ عامة
  {
    const isNegHead = (w) => w.segs.some((s) => s.pos === "NEG" || s.pos === "PRO" || s.lemma_id === LEM.laysa);
    const has3rdSuffix = (w) =>
      // v1.1b: النقض للجارّ العاري (حرف+ضمير غائب: له، لهم، بهم) لا للمضاف (كمثلِهِ)
      w.segs.some((s) => s.pos === "PRON" && s.role === "suffix" && String(s.person) === "3") &&
      !w.segs.some((s) => s.pos_basic === "N" || s.pos_basic === "V");
    outer: for (let i = 0; i < B.length; i++) {
      if (!isNegHead(B[i])) continue;
      let blocked = false;
      for (let j = i + 1; j <= Math.min(i + 3, B.length - 1); j++) {
        if (B[j].segs.some((s) => s.pos_basic === "N" && s.state === "INDEF")) {
          if (!blocked) { gates.add("G1c:نفي+نكرة"); break outer; }
          break;
        }
        if (has3rdSuffix(B[j])) blocked = true;
      }
      const nx = B[i + 1];
      if (nx && !has3rdSuffix(nx) && nx.segs.some((s) => s.pos_basic === "N" && s.role === "stem") &&
          !nx.segs.some((s) => s.pos === "DET") && !nx.segs.some((s) => s.pos === "PRON" && s.role === "suffix")) {
        gates.add("G1c:نفي+نكرة"); break;
      }
      blocked = false;
      for (let j = i + 1; j < B.length - 1; j++) {
        if (has3rdSuffix(B[j])) blocked = true;
        const isMin = B[j].segs.some((s) => s.pos_basic === "P" && ["من", "مِن"].includes(strip(s.text)));
        if (isMin && !blocked && B[j + 1].segs.some((s) => s.pos_basic === "N" && (s.state === "INDEF" ||
            (!B[j + 1].segs.some((x) => x.pos === "DET") && !B[j + 1].segs.some((x) => x.pos === "PRON" && x.role === "suffix"))))) {
          gates.add("G1c:نفي+نكرة"); break outer;
        }
      }
    }
  }

  // G1d — الحصر: RES، أو استثناءٌ مفرَّغ (EXP مسبوقٌ بنفيٍ في الوحدة: «لا إله إلا هو»)،
  // أو نمط «إنّ+ما»
  if (has((s) => s.pos === "RES")) gates.add("G1d:حصر-إلا");
  {
    let negSeen = false;
    for (const w of B) {
      if (w.segs.some((s) => s.pos === "NEG" || s.pos === "PRO" || s.lemma_id === LEM.laysa)) negSeen = true;
      if (negSeen && w.segs.some((s) => s.pos === "EXP")) { gates.add("G1d:حصر-مفرَّغ"); break; }
    }
  }
  for (let i = 0; i < body.length - 1; i++)
    if (body[i].family === "إِنّ" && body[i + 1].pos === "PREV") { gates.add("G1d:حصر-إنما"); break; }

  // G1e — v1.1: «إيّا» المتقدّمةُ فقط (رأسُ الوحدة) — «إياك نعبد» لا المعطوفة اللاحقة
  if (B.slice(0, 2).some((w) => w.segs.some((s) => s.lemma_id === LEM.iyya))) gates.add("G1e:قصر-إيّا");

  // G1f — v1.1: الإسناد إلى الله في صدر الوحدة:
  //   أ) وحدةٌ بلا فعلٍ ولفظُ الجلالة في أوّل كلمتين («اللهُ لطيفٌ بعباده»)
  //   ب) لفظُ الجلالة في الصدر (بعد إنّ/و/فـ) وخبرُه مضارعٌ استمراريّ («إنّ الله يأمر…»،
  //      «واللهُ يحبّ المحسنين») — لا الماضي (سردُ فِعالٍ ماضية)
  {
    const hasVerb = body.some((s) => s.pos_basic === "V");
    const allahAt = B.findIndex((w) => w.segs.some((s) => s.lemma_id === LEM.allah || s.lemma_id === LEM.allahumma));
    if (!hasVerb && allahAt >= 0 && allahAt <= 1 && body.length > 0) gates.add("G1f:اسمية-لله");
    if (hasVerb && allahAt >= 0 && allahAt <= 1) {
      for (let j = allahAt + 1; j <= Math.min(allahAt + 3, B.length - 1); j++)
        if (B[j].segs.some((s) => s.pos_basic === "V" && s.aspect === "IMPF" && String(s.person) === "3")) {
          gates.add("G1f:إسناد-مضارع-لله");
          break;
        }
    }
  }

  // G1g — v1.1: المبني للمفعول التشريعي يتطلّب بصمةَ الخطاب («كُتب عليكم»، «أُحلّ لكم»):
  // جارٌّ بضمير مخاطبٍ في جوار ±٢ — وإلا فالفاعلُ الإلهي القريب كما كان.
  // ويضاف اسمُ المفعول التشريعي («نصيبًا مفروضًا»): PASS_PCPL من جذور القائمة.
  for (let i = 0; i < B.length; i++) {
    const leg = B[i].segs.find((s) => LEGIS.has(s.lemma_id) && s.pos_basic === "V");
    if (!leg) continue;
    if (leg.voice === "PASS") {
      const lo = Math.max(0, i - 2), hi = Math.min(B.length - 1, i + 2);
      let addressed = false;
      for (let j = lo; j <= hi; j++)
        if (B[j].segs.some((s) => s.pos_basic === "P") &&
            B[j].segs.some((s) => s.pos === "PRON" && s.role === "suffix" && String(s.person) === "2")) addressed = true;
      if (addressed) { gates.add("G1g:تشريع"); break; }
      continue;
    }
    const lo = Math.max(0, i - 3), hi = Math.min(B.length - 1, i + 3);
    for (let j = lo; j <= hi; j++)
      if (B[j].segs.some((s) => s.lemma_id === LEM.allah || s.lemma_id === LEM.allahumma)) { gates.add("G1g:تشريع"); i = B.length; break; }
  }
  if (has((s) => s.derivation === "PASS_PCPL" && LEGIS_ROOTS.has(s.root_id))) gates.add("G1g:اسم-مفعول-تشريعي");

  // G1h — v1.1: الأمر الجمعي + النهي الجمعي (لا الناهية + مضارع مجزوم للمخاطبين)
  //   + أمرُ المفرد المذكّر (خطاب النبي ﷺ التشريعي: «خذ العفو») — المؤنّثُ المفرد
  //   يبقى خارجًا (أوامر الوقائع: «هزّي») والحواجبُ تعمل كما هي.
  if (has((s) => s.aspect === "IMPV" && String(s.person) === "2" && s.number === "P" && s.lemma_id !== LEM.qala))
    gates.add("G1h:أمر-جمعي");
  for (let i = 0; i < B.length - 1; i++) {
    if (!B[i].segs.some((s) => s.pos === "PRO")) continue;
    for (let j = i + 1; j <= Math.min(i + 1, B.length - 1); j++)
      if (B[j].segs.some((s) => s.pos_basic === "V" && s.aspect === "IMPF" && s.mood === "JUS" && String(s.person) === "2" && s.number === "P")) {
        gates.add("G1h:نهي-جمعي");
        i = B.length;
        break;
      }
  }
  if (has((s) => s.aspect === "IMPV" && String(s.person) === "2" && s.number === "S" && s.gender === "M" && s.lemma_id !== LEM.qala))
    gates.add("G1h:أمر-مفرد");
  for (let i = 0; i < body.length - 1; i++)
    if (body[i].pos === "IMPV_LAM" && body[i + 1].aspect === "IMPF" && body[i + 1].mood === "JUS") { gates.add("G1h:لام-الأمر"); break; }

  // G1i — v1.1: الموصولُ العامّ في صدر الوحدة («الذين يؤمنون…»، «مَن يعمل…» الموصولية):
  // REL في أوّل كلمتين + جملةٌ بعده (≥ ٣ كلمات) — أكبرُ فجوةٍ كشفها فحص محاور Pass A
  if (B.length >= 4 && B.slice(0, 2).some((w) => w.segs.some((s) => s.pos === "REL"))) gates.add("G1i:موصول-العموم");

  return { gates, warnings };
}

// ── التقييم الكامل لآية ──────────────────────────────────────────────────────
function evalAyah(a) {
  const list = byAyah.get(a.ayah_id) ?? [];
  if (!list.length) return { units: [], qualified: false };
  const W = wordsView(list);
  const frame = frameBlockers(list); // يصبغ الجميع
  const ranges = clauseRanges(a.text_uthmani, a.word_count);

  const units = [];
  const evalUnit = (label, ws, inheritedLocal) => {
    const { gates, warnings } = g1Gates(ws);
    const local = new Set([...localBlockers(ws), ...(inheritedLocal ?? [])]);
    const blockers = new Set([...frame, ...local]);
    const qualified = gates.size > 0 && blockers.size === 0;
    units.push({ unit: label, range: [ws[0].word_no, ws[ws.length - 1].word_no],
      gates: [...gates], blockers: [...blockers], warnings, qualified });
    return local;
  };

  // الآية كاملة
  evalUnit("aya", W, null);
  // المقاطع (إن كان تقطيعٌ سليم المحاذاة وثمّة أكثر من مقطع)
  if (ranges && ranges.length > 1) {
    let prevLocal = null;
    for (let c = 0; c < ranges.length; c++) {
      const [from, to] = ranges[c];
      const ws = W.filter((w) => w.word_no >= from && w.word_no <= to);
      if (!ws.length) continue;
      // وراثة حواجب السابق عند فاء/ثمّ العطف في رأس المقطع
      const head = ws[0].segs[0];
      const headTxt = strip(ws[0].segs.map((s) => s.text).join(""));
      const inherits = c > 0 && (headTxt.startsWith("ف") && head.pos === "REM" || strip(head.text) === "ثم");
      prevLocal = evalUnit(`c${c}`, ws, inherits ? prevLocal : null);
    }
  }
  return { units, qualified: units.some((u) => u.qualified) };
}

// ── التشغيل الكامل ───────────────────────────────────────────────────────────
const out = {};
let alignFail = 0, multiClause = 0;
for (const a of ayahs) {
  const r = evalAyah(a);
  out[a.location] = r;
  if (r.units.length > 1) multiClause++;
  const rr = clauseRanges(a.text_uthmani, a.word_count);
  if (rr === null) alignFail++;
}
writeFileSync(join(ROOT, "findings", "kulliyat-v2", "gates-v1.json"), JSON.stringify(out));
const total = Object.values(out).filter((r) => r.qualified).length;
const unitQ = Object.values(out).reduce((n, r) => n + r.units.filter((u) => u.qualified).length, 0);
console.log(`gates-v1: ${total}/6236 ayahs qualify (${((100 * total) / 6236).toFixed(1)}%) · ${unitQ} qualified units · ${multiClause} multi-clause ayahs · align-fail ${alignFail}`);

// ── القياس: نصف الضبط فقط ───────────────────────────────────────────────────
const sample = JSON.parse(readFileSync(join(ROOT, "findings", "kulliyat-v2", "sample.json"), "utf8"));
const expand = (refs) => {
  const m = refs.match(/^(\d+):(\d+)(?:-(\d+))?$/);
  const s = Number(m[1]), a1 = Number(m[2]), a2 = m[3] ? Number(m[3]) : a1;
  const L = [];
  for (let a = a1; a <= a2; a++) L.push(`${s}:${a}`);
  return L;
};
let hits = 0, misses = [], rejects = 0, leaks = [], nRule = 0, nNarr = 0, specificPassed = [];
for (const item of sample.items) {
  if (item.half !== "tune") continue;
  const locs = expand(item.refs);
  const anyQ = locs.some((l) => out[l]?.qualified);
  if (item.expected !== "tafsil") {
    // الزوج 48/70: الموجِب #48 يُقاس الآن (محرّك المقاطع موجود) — أهليّة أيّ وحدة
    nRule++;
    if (anyQ) hits++;
    else misses.push(`#${item.id} ${item.refs} (${item.evidence})`);
  } else if (item.counterType === "specific") {
    if (anyQ) specificPassed.push(`#${item.id} ${item.refs}`);
  } else {
    nNarr++;
    if (!anyQ) rejects++;
    else {
      const qu = locs.flatMap((l) => (out[l]?.units ?? []).filter((u) => u.qualified).map((u) => `${l}/${u.unit}:${u.gates.join(",")}`));
      leaks.push(`#${item.id} ${item.refs} (${item.evidence}) → ${qu.join(" · ")}`);
    }
  }
}
console.log(`\n=== TUNE half (v1, segment engine) ===`);
console.log(`rule recall:      ${hits}/${nRule}`);
console.log(`narrative reject: ${rejects}/${nNarr}`);
if (specificPassed.length) console.log(`specific counters passing gates (deferred to network): ${specificPassed.join(" · ")}`);
if (misses.length) { console.log(`\nMISSES:`); misses.forEach((m) => console.log("  " + m)); }
if (leaks.length) { console.log(`\nLEAKS:`); leaks.forEach((m) => console.log("  " + m)); }

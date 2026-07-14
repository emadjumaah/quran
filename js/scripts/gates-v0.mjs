/**
 * gates-v0.mjs — بوابات العموم الحتمية (v0, عالية الدقّة) فوق QAC.
 * Spec: findings/kulliyat-v2/GATES-SPEC.md. Eligibility test, NOT a score:
 * a verse qualifies as a rule-candidate iff (some G1 fires) AND G2 AND G3.
 * Output: findings/kulliyat-v2/gates-v0.json — per-ayah named gates/blockers.
 * Evaluation: TUNE half of the frozen sample ONLY (holdout stays sealed).
 *
 * v0 unit = the ayah (segment engine lands in v1; the #48/#70 pair is excluded
 * from scoring and every unit-related miss is reported as a definition issue).
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const db = new DatabaseSync(join(ROOT, "quran-kg.db"), { readOnly: true });

// ── lemma ids (verified against the DB) ──────────────────────────────────────
const LEM = { kull: 137, jamee: 205, allah: 3, allahumma: 1182, qala: 64, iyya: 14, laysa: 560 };
// the closed, published legislative-verb list (GATES-SPEC G1g)
const LEGIS = new Set([197 /*أمر*/, 709 /*حرّم*/, 764 /*أحلّ*/, 810 /*فرض*/, 578 /*قضى*/, 443 /*كتب*/, 1282 /*نهى*/, 623 /*وصّى*/]);

// ── load segments once, grouped per ayah in textual order ────────────────────
const segs = db.prepare(`
  SELECT s.ayah_id, s.word_id, s.seg_no, s.text, s.pos_basic, s.role, s.pos,
         s.root_id, s.lemma_id, s.aspect, s.mood, s.voice, s.state,
         s.person, s.gender, s.number, s.family, w.word_no
  FROM segment s JOIN word w ON w.word_id = s.word_id
  ORDER BY s.ayah_id, w.word_no, s.seg_no`).all();
const ayahs = db.prepare("SELECT ayah_id, surah_no, ayah_no, location FROM ayah").all();
const locOf = new Map(ayahs.map((a) => [a.ayah_id, a.location]));

const byAyah = new Map();
for (const s of segs) {
  let arr = byAyah.get(s.ayah_id);
  if (!arr) byAyah.set(s.ayah_id, (arr = []));
  arr.push(s);
}

// ── helpers ──────────────────────────────────────────────────────────────────
const bare = (t) => (t || "").replace(/[ً-ْـٰۖ-�softworkaround]/g, "");
const strip = (t) => (t || "").normalize("NFC").replace(/[ً-ْٰـ]/g, "");

function evalUnit(list) {
  const gates = new Set();
  const blockers = new Set();
  const warnings = [];
  const W = []; // word-level view: {word_no, segs}
  {
    let cur = null;
    for (const s of list) {
      if (!cur || cur.word_no !== s.word_no) W.push((cur = { word_no: s.word_no, segs: [] }));
      cur.segs.push(s);
    }
  }
  const wordIdx = (pred) => W.findIndex((w) => w.segs.some(pred));

  // ── G-قل: strip a leading قل/قولوا wrapper, evaluate the مقول ──────────────
  let body = list;
  const qulAt = wordIdx((s) => s.lemma_id === LEM.qala && s.aspect === "IMPV");
  if (qulAt >= 0 && qulAt <= 1) {
    body = W.slice(qulAt + 1).flatMap((w) => w.segs);
    warnings.push("قل-stripped");
  }

  // ── G3: narrative blockers (whole unit — a story frame poisons the unit) ──
  for (const s of list) {
    const t = strip(s.text);
    if (t === "إذ" || t === "وإذ") blockers.add("G3:إذ");
    if (t === "فلما") blockers.add("G3:فلما");
    if (s.lemma_id === LEM.qala && s.aspect === "PERF") blockers.add("G3:قالَ-سرد");
    if (s.pos === "PN" && s.lemma_id !== LEM.allah && s.lemma_id !== LEM.allahumma) {
      // non-divine proper noun → event/person specificity (الرحمن is ADJ/N, not PN here)
      blockers.add("G3:علَم");
    }
  }
  // ── G2: backward reference opening — ذلك بأنّ / كذلك بأنّ في الافتتاح ─────
  {
    const w0 = W[0], w1 = W[1];
    const isDem = (w) => w && w.segs.some((s) => s.pos === "DEM");
    const isBiAnna = (w) => w && w.segs.some((s) => s.family === "إِنّ") && w.segs.some((s) => strip(s.text) === "ب");
    if (isDem(w0) && isBiAnna(w1)) blockers.add("G2:ذلك-بأنّ");
  }

  // ── G1 disjuncts (on the قل-stripped body) ─────────────────────────────────
  const B = [];
  {
    let cur = null;
    for (const s of body) {
      if (!cur || cur.word_no !== s.word_no) B.push((cur = { word_no: s.word_no, segs: [] }));
      cur.segs.push(s);
    }
  }
  const has = (pred) => body.some(pred);

  // G1a — كلّ/جميع
  if (has((s) => s.lemma_id === LEM.kull || s.lemma_id === LEM.jamee)) gates.add("G1a:كل/جميع");

  // G1b — شرط العموم: COND من/ما/مهما/أيّ
  if (has((s) => s.pos === "COND" && ["من", "ما", "مهما", "اي", "أي"].includes(strip(s.text).replace(/^و|^ف/, ""))))
    gates.add("G1b:شرط-العموم");

  // G1c — نكرة في سياق نفي/نهي. رؤوس النفي: NEG، PRO (لا الناهية)، ولَيْسَ (فعل نفي، family=كان).
  // ثلاثة أنماط، كلٌّ لغويٌّ عام:
  //   ١) رأس نفي + اسم INDEF موسوم في نافذة ٣ كلمات («ليس كمثله شيءٌ»)
  //   ٢) لا الجنس: NEG/PRO يليه مباشرةً اسمٌ عارٍ من أداة التعريف ومن ضمير الإضافة
  //      («لا إكراهَ»، «لا تبديلَ»، «لا ريبَ») — اسمُ لا الجنس لا يحمل وسم INDEF في QAC
  //   ٣) «من» الاستغراقية: رأس نفي … ثم (مِن + اسم INDEF) («ما جعل عليكم في الدين من حرج»)
  {
    const isNegHead = (w) => w.segs.some((s) => s.pos === "NEG" || s.pos === "PRO" || s.lemma_id === LEM.laysa);
    for (let i = 0; i < B.length && !gates.has("G1c:نفي+نكرة"); i++) {
      if (!isNegHead(B[i])) continue;
      // نمط ١: INDEF موسوم في نافذة ٣
      for (let j = i + 1; j <= Math.min(i + 3, B.length - 1); j++)
        if (B[j].segs.some((s) => s.pos_basic === "N" && s.state === "INDEF")) { gates.add("G1c:نفي+نكرة"); break; }
      if (gates.has("G1c:نفي+نكرة")) break;
      // نمط ٢: لا الجنس — الكلمة التالية اسمٌ بلا DET وبلا لاحقة ضمير
      const nx = B[i + 1];
      if (nx && nx.segs.some((s) => s.pos_basic === "N" && s.role === "stem") &&
          !nx.segs.some((s) => s.pos === "DET") && !nx.segs.some((s) => s.pos === "PRON" && s.role === "suffix")) {
        gates.add("G1c:نفي+نكرة"); break;
      }
      // نمط ٣: من الاستغراقية بعد النفي
      for (let j = i + 1; j < B.length - 1; j++) {
        const isMin = B[j].segs.some((s) => s.pos_basic === "P" && ["من", "مِن"].includes(strip(s.text)));
        if (isMin && B[j + 1].segs.some((s) => s.pos_basic === "N" && (s.state === "INDEF" ||
            (!B[j + 1].segs.some((x) => x.pos === "DET") && !B[j + 1].segs.some((x) => x.pos === "PRON" && x.role === "suffix"))))) {
          gates.add("G1c:نفي+نكرة"); break;
        }
      }
    }
  }

  // G1d — الحصر: RES، أو نمط «إنّ+ما» (ACC family=إنّ يليها PREV مباشرة)
  if (has((s) => s.pos === "RES")) gates.add("G1d:حصر-إلا");
  for (let i = 0; i < body.length - 1; i++) {
    if (body[i].family === "إِنّ" && body[i + 1].pos === "PREV") { gates.add("G1d:حصر-إنما"); break; }
  }

  // G1e — قصر التقديم: إيّا المنفصلة
  if (has((s) => s.lemma_id === LEM.iyya)) gates.add("G1e:قصر-إيّا");

  // G1f — جملة اسمية مسندة إلى الله: لا فعلَ في الجسم + لفظ الجلالة فيه
  {
    const hasVerb = body.some((s) => s.pos_basic === "V");
    const hasAllah = body.some((s) => s.lemma_id === LEM.allah || s.lemma_id === LEM.allahumma);
    if (!hasVerb && hasAllah && body.length > 0) gates.add("G1f:اسمية-لله");
  }

  // G1g — أفعال التشريع الثمانية مسندةً إلى الله (فاعلًا قريبًا أو بناءً للمفعول)
  for (let i = 0; i < B.length; i++) {
    const leg = B[i].segs.find((s) => LEGIS.has(s.lemma_id) && s.pos_basic === "V");
    if (!leg) continue;
    if (leg.voice === "PASS") { gates.add("G1g:تشريع"); break; }
    const lo = Math.max(0, i - 3), hi = Math.min(B.length - 1, i + 3);
    let near = false;
    for (let j = lo; j <= hi; j++)
      if (B[j].segs.some((s) => s.lemma_id === LEM.allah || s.lemma_id === LEM.allahumma)) near = true;
    if (near) { gates.add("G1g:تشريع"); break; }
  }

  // G1h — الأمر الجمعي العام (بعد نزع «قل»؛ يُشترط سلامة G2/G3 لاحقًا)
  // ملاحظة: person عددٌ صحيح في القاعدة — تُقارَن بعد String()
  if (has((s) => s.aspect === "IMPV" && String(s.person) === "2" && s.number === "P" && s.lemma_id !== LEM.qala))
    gates.add("G1h:أمر-جمعي");
  // لام الأمر للغائب: لِ + مضارع مجزوم غائب
  for (let i = 0; i < body.length - 1; i++) {
    if (body[i].pos === "IMPV_LAM" && body[i + 1].aspect === "IMPF" && body[i + 1].mood === "JUS") {
      gates.add("G1h:لام-الأمر");
      break;
    }
  }

  const qualified = gates.size > 0 && blockers.size === 0;
  return { gates: [...gates], blockers: [...blockers], warnings, qualified };
}

// ── run over the whole mushaf ────────────────────────────────────────────────
const out = {};
for (const a of ayahs) {
  const list = byAyah.get(a.ayah_id) ?? [];
  out[a.location] = evalUnit(list);
}
writeFileSync(join(ROOT, "findings", "kulliyat-v2", "gates-v0.json"), JSON.stringify(out));
const total = Object.values(out).filter((r) => r.qualified).length;
console.log(`gates-v0: ${total}/6236 ayahs qualify (${((100 * total) / 6236).toFixed(1)}%)`);

// ── evaluation: TUNE HALF ONLY (the holdout stays sealed) ────────────────────
const sample = JSON.parse(readFileSync(join(ROOT, "findings", "kulliyat-v2", "sample.json"), "utf8"));
const expand = (refs) => {
  const m = refs.match(/^(\d+):(\d+)(?:-(\d+))?$/);
  const s = Number(m[1]), a1 = Number(m[2]), a2 = m[3] ? Number(m[3]) : a1;
  const locs = [];
  for (let a = a1; a <= a2; a++) locs.push(`${s}:${a}`);
  return locs;
};
let hits = 0, misses = [], rejects = 0, leaks = [];
let nRule = 0, nNarr = 0, specificPassed = [];
for (const item of sample.items) {
  if (item.half !== "tune") continue;
  if (item.id === 48 || item.id === 70) continue; // segment pair — needs v1 segment engine
  const locs = expand(item.refs);
  const anyQ = locs.some((l) => out[l]?.qualified);
  if (item.expected !== "tafsil") {
    nRule++;
    if (anyQ) hits++;
    else misses.push(`#${item.id} ${item.refs} (${item.evidence}) → gates:${JSON.stringify(locs.map((l) => out[l]?.gates))} blockers:${JSON.stringify(locs.map((l) => out[l]?.blockers))}`);
  } else if (item.counterType === "specific") {
    // قاعدةٌ ضيّقة: اجتيازُ البوابات مسموح — حكمُها النهائي على طبقة الشبكة
    if (anyQ) specificPassed.push(`#${item.id} ${item.refs}`);
  } else {
    nNarr++;
    if (!anyQ) rejects++;
    else leaks.push(`#${item.id} ${item.refs} (${item.evidence}) → ${JSON.stringify(locs.map((l) => out[l]?.gates))}`);
  }
}
console.log(`\n=== TUNE half (excl. segment pair) ===`);
console.log(`rule recall:        ${hits}/${nRule}`);
console.log(`narrative reject:   ${rejects}/${nNarr}`);
if (specificPassed.length) console.log(`specific counters passing gates (deferred to network tier): ${specificPassed.join(" · ")}`);
if (misses.length) { console.log(`\nMISSES (definition work, not per-verse patches):`); misses.forEach((m) => console.log("  " + m)); }
if (leaks.length) { console.log(`\nLEAKS (counter passed — tighten definitions):`); leaks.forEach((m) => console.log("  " + m)); }

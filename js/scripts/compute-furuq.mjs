/**
 * فروق التنزيل v2 — محرّك الفروق المعاد بناؤه (خطة ف١، 2026-07-14).
 *
 * ما تغيّر عن الجيل الأول (كلُّ بندٍ من كشوف مراجعةٍ متحقَّقٍ منها على الكتالوج):
 *  ١) المحاذاة على الـlemma لا سطح الكلمة: «نرزقكم/نرزقهم» تُحاذى كلمةً واحدةً
 *     بصيغتين (op جديد "frm") — كان السطحُ يجعل الزوجَ الشهير يبدو أجنبيًّا.
 *  ٢) كلُّ طبقات الكتالوج تدخل — ومنها paraphrase التي كانت مُسقطَةً بكاملها
 *     (٧١٪ من الكتالوج، وفيها ٦:١٥١↔١٧:٣١ أشهرُ فرقٍ في كتب المتشابهات).
 *  ٣) «تقديم وتأخير» باختبارٍ حقيقي: تساوي حقيبتَي الـlemmas المحذوفة والمزيدة —
 *     كان تقاطعُ كلمةٍ واحدةٍ يكفي، فكانت الفئةُ (٨٦٠ زوجًا) شبهَ كلِّها في غير موضعها.
 *  ٤) مرشّح الصيغ القالبية: زوجُ عبارةٍ تغطيتُه الكلّيةُ دون النصف وقاسمُه
 *     الأكبر مدًى شائعٌ في المصحف (يرد في ≥ FORMULA_DF آية) → يسقط.
 *  ٥) «مركّب» العشوائية لا تُبنى؛ محلَّها «فروق مركّبة» مشروطةٌ بقربٍ حقيقي
 *     (eqFrac ≥ NEAR_BAR) — فتعود أزواجُ «حطّة» وأشباهُها إلى الضوء.
 *  ٦) محاذاةٌ موضعية (نافذة): آيةٌ قصيرةٌ توافق مقطعًا من آيةٍ أطول تُحاذى على
 *     أفضل نافذةٍ فيها (كما تقتبس كتبُ الفروق موضعَ الشاهد) — فيعود ٦:١٥١↔١٧:٣١.
 *  ٧) قريبُ المعنى بلا تقابلٍ لفظيٍّ ليس فرقَ تنزيل — بابُه «مثلها» — فلا يُعرَض
 *     هنا محاذاةً قسريةً ولا قائمةً موازية.
 *
 * Reads quran-twins.json + quran-kg.db. Writes:
 *   findings/FURUQ.md                 summary + category examples (human)
 *   js/apps/studio/public/furuq.json  aligned-diff catalog (app layer)
 * Usage: node scripts/compute-furuq.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const DB = path.join(ROOT, "quran-kg.db");
const TWINS = path.join(ROOT, "quran-twins.json");
const MD = path.join(ROOT, "findings/FURUQ.md");
const APP = path.join(ROOT, "js/apps/studio/public/furuq.json");

// —— المعاملات المعلنة ——————————————————————————————————————————————
const NEAR_BAR = 0.6; // أدنى حصة تطابق lemma ليُعرَض الزوج محاذًى كلمةً كلمة
const FORMULA_DF = 10; // مدًى مشترك يرد في ≥ هذا العدد من الآيات = صيغة قالبية
const FORMULA_COV = 0.5; // مرشّح القوالب لا يعمل إذا بلغت التغطيةُ الكلّية هذه النسبة
const WIN_COV = 0.6; // المحاذاة الموضعية: أدنى تغطية للآية الأقصر داخل أفضل نافذة
const WIN_MIN = 4; // ...وأدنى عدد كلمات متوافقة فيها

// —— الكلمات: سطح + lemma + جذر ——————————————————————————————————————
const db = new DatabaseSync(DB, { readOnly: true });
const words = new Map(); // "s:a" -> [{t, lem, root}]
for (const r of db.prepare(`
  SELECT w.surah_no s, w.ayah_no a, w.text_clean t, w.lemma_id lem, rt.root_ar root
  FROM word w LEFT JOIN root rt ON rt.root_id = w.root_id
  ORDER BY w.surah_no, w.ayah_no, w.word_no`).iterate()) {
  const loc = `${r.s}:${r.a}`;
  let seq = words.get(loc);
  if (!seq) words.set(loc, (seq = []));
  // أدوات بلا lemma في المدونة تُحمل بسطحها (كما يفعل find-twins)
  seq.push({ t: r.t, lem: r.lem == null ? `T:${r.t}` : String(r.lem), root: r.root ?? null });
}
db.close();

// فهرس تواتر المدى الرباعي (لمرشّح الصيغ القالبية): كم آيةً تحوي هذا المدى
const gramDF = new Map();
for (const [, seq] of words) {
  const seen = new Set();
  for (let i = 0; i + 4 <= seq.length; i++) seen.add(seq.slice(i, i + 4).map((w) => w.lem).join("|"));
  for (const g of seen) gramDF.set(g, (gramDF.get(g) ?? 0) + 1);
}

const twins = JSON.parse(fs.readFileSync(TWINS, "utf-8"));
const arr = Array.isArray(twins) ? twins : (twins.pairs ?? Object.values(twins).find(Array.isArray));

/** lemma-level LCS diff → ops: eq (سطح مطابق) / frm (lemma واحد بصيغتين) / del / ins */
function diff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i].lem === b[j].lem ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i].lem === b[j].lem) {
      ops.push(a[i].t === b[j].t
        ? { op: "eq", t: a[i].t }
        : { op: "frm", tA: a[i].t, tB: b[j].t, root: a[i].root });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: "del", t: a[i].t, lem: a[i].lem, root: a[i].root }); i++; }
    else { ops.push({ op: "ins", t: b[j].t, lem: b[j].lem, root: b[j].root }); j++; }
  }
  while (i < n) { ops.push({ op: "del", t: a[i].t, lem: a[i].lem, root: a[i].root }); i++; }
  while (j < m) { ops.push({ op: "ins", t: b[j].t, lem: b[j].lem, root: b[j].root }); j++; }
  return ops;
}

/** أطول مدى lemma مشترك بين آيتين (للمرشّح القالبي) */
function longestRun(a, b) {
  const pos = new Map();
  b.forEach((w, i) => {
    let list = pos.get(w.lem);
    if (!list) pos.set(w.lem, (list = []));
    list.push(i);
  });
  let best = 0, bestAt = 0;
  for (let i = 0; i < a.length; i++)
    for (const j of pos.get(a[i].lem) ?? []) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k].lem === b[j + k].lem) k++;
      if (k > best) { best = k; bestAt = i; }
    }
  return { len: best, at: bestAt };
}

/** عدد الكلمات المتوافقة في ops (eq + frm) */
const matchedOf = (ops) => ops.reduce((n, o) => n + (o.op === "eq" || o.op === "frm" ? 1 : 0), 0);

/** هل القاسم الأكبر بين آيتين صيغةٌ قالبيةٌ شائعة؟ */
function isFormulaCore(A, B) {
  const { len, at } = longestRun(A, B);
  if (len < 4) return false;
  const g = A.slice(at, at + 4).map((w) => w.lem).join("|");
  return (gramDF.get(g) ?? 0) >= FORMULA_DF;
}

/**
 * المحاذاة الموضعية: حين توافق آيةٌ قصيرةٌ مقطعًا من آيةٍ أطول، تُختار أفضل
 * نافذةٍ في الأطول وتُحاذى عليها (كتبُ الفروق تقتبس موضعَ الشاهد لا الآية كلَّها).
 * ترجع {ops, win:{s,pre,post}} أو null إن لم تبلغ نافذةٌ العتبتين.
 */
function windowAlign(A, B) {
  const [S, L, side] = A.length <= B.length ? [A, B, "b"] : [B, A, "a"];
  if (L.length - S.length < 3) return null; // الطولان متقاربان — الحساب الكلي يكفي
  const wlen = Math.min(L.length, S.length + 3);
  let best = null;
  for (let start = 0; start + wlen <= L.length + 2; start++) {
    const win = L.slice(start, Math.min(start + wlen, L.length));
    if (win.length < WIN_MIN) break;
    const ops = side === "b" ? diff(S, win) : diff(win, S);
    const matched = matchedOf(ops);
    if (!best || matched > best.matched) best = { matched, start, win, ops };
  }
  if (!best || best.matched < WIN_MIN) return null;
  // شذبُ حواشي النافذة: كلماتُ الآية الأطول غير الموافقة في الطرفين تُضم إلى السياق المطويّ
  // (كلماتُ الأقصر لا تُشذب أبدًا — هي من صلب الفرق)
  const winOp = side === "a" ? "del" : "ins";
  const sOp = side === "a" ? "ins" : "del";
  const ops = [...best.ops];
  let pre = best.start;
  let post = L.length - (best.start + best.win.length);
  while (ops.length && ops[0].op === winOp) { ops.shift(); pre++; }
  while (ops.length && ops[ops.length - 1].op === winOp) { ops.pop(); post++; }

  // القبول: تغطيةُ الأقصر — وزيادةٌ طرفيةٌ كاملةٌ في الأقصر فرقٌ حقيقيٌّ لا قرينةُ
  // بُعد فتُستثنى من المقام (١٧:٣١: «إن قتلهم كان خطئا كبيرا»)، واللفظُ المنتقلُ
  // (حذفٌ هنا زيادةٌ هناك من نفس الـlemmas) حاضرٌ في الطرفين فيُحتسب
  let sEdge = 0;
  for (const o of ops) { if (o.op === sOp) sEdge++; else break; }
  for (let k = ops.length - 1; k >= 0 && ops[k].op === sOp; k--) sEdge++;
  const dm = new Map(), im = new Map();
  for (const o of ops) {
    if (o.op === "del") dm.set(o.lem, (dm.get(o.lem) ?? 0) + 1);
    else if (o.op === "ins") im.set(o.lem, (im.get(o.lem) ?? 0) + 1);
  }
  let moved = 0;
  for (const [k, v] of dm) moved += Math.min(v, im.get(k) ?? 0);
  const eff = best.matched + moved;
  const covFull = eff / S.length;
  const covCore = eff / Math.max(1, S.length - sEdge);
  if (covFull < WIN_COV && !(eff >= 6 && covCore >= 0.75)) return null;

  // رسوٌّ متصل: أطولُ مدًى موافقٍ في النافذة ≥ 3 (لا نوافذَ من كلماتٍ مبعثرة)
  let runM = 0, cur = 0;
  for (const o of ops) { cur = o.op === "eq" || o.op === "frm" ? cur + 1 : 0; if (cur > runM) runM = cur; }
  if (runM < 3) return null;

  // حارس القوالب: يسقط فقط إذا كان القالبُ الشائع هو كلَّ المشترك تقريبًا
  const lr = longestRun(S, best.win);
  if (lr.len >= 4 && lr.len >= best.matched - 2) {
    const g = S.slice(lr.at, lr.at + 4).map((w) => w.lem).join("|");
    if ((gramDF.get(g) ?? 0) >= FORMULA_DF) return null;
  }
  return { ops, win: { s: side, pre, post } };
}

/** التصنيف — سلسلةُ قواعدَ معلنةٍ على ops الـlemma. للمحاذاة الموضعية معيارُ
 *  قربٍ خاص (تغطية الأقصر، مفروضةٌ سلفًا في windowAlign) فلا يُعاد NEAR_BAR. */
function classify(ops, windowed = false) {
  const del = ops.filter((o) => o.op === "del");
  const ins = ops.filter((o) => o.op === "ins");
  const frm = ops.filter((o) => o.op === "frm");
  const eqFrac = (ops.length - del.length - ins.length) / Math.max(1, ops.length);

  if (!del.length && !ins.length && !frm.length) return { cat: windowed ? "اشتمال" : "تطابق", eqFrac: 1 };

  // اللفظُ المنتقلُ حاضرٌ في الطرفين وإن حسبه LCS حذفًا وزيادة — فيُحتسب في القرب
  const cnt = (xs) => {
    const m2 = new Map();
    for (const o of xs) m2.set(o.lem, (m2.get(o.lem) ?? 0) + 1);
    return m2;
  };
  let moved = 0;
  if (del.length && ins.length) {
    const dm = cnt(del), im = cnt(ins);
    for (const [k, v] of dm) moved += Math.min(v, im.get(k) ?? 0);
  }
  const effEq = (ops.length - del.length - ins.length + 2 * moved) / Math.max(1, ops.length);

  // عتبةُ القرب واحدةٌ على كل الفئات: دونها لا محاذاةَ تُعرَض أصلًا
  // (للمحاذاة الموضعية معيارُها الخاص — تغطيةُ الأقصر، مفروضٌ في windowAlign)
  if (!windowed && effEq < NEAR_BAR) return { cat: null, eqFrac };

  if (!del.length && !ins.length) return { cat: "اختلاف صيغة", eqFrac };

  // تقديم وتأخير حقيقي: ما حُذف هنا أُزيد هناك، مع بقيّةٍ لا تتجاوز كلمتين
  const rest = del.length + ins.length - 2 * moved;
  if (moved >= 1 && rest === 0) return { cat: "تقديم وتأخير", eqFrac, moved };
  if (moved >= 2 && rest <= 2) return { cat: "تقديم وتأخير", eqFrac, moved };

  if (!del.length || !ins.length) return { cat: "زيادة/نقص", eqFrac };

  // إبدال: كلُّ كتلةِ حذفٍ تعقبها كتلةُ زيادةٍ بنفس الطول (يشمل متعدّد الكلمات)
  if (del.length === ins.length) {
    let k = 0, ok = true;
    while (k < ops.length) {
      if (ops[k].op === "ins") { ok = false; break; } // زيادة بلا حذفٍ قبلها
      if (ops[k].op !== "del") { k++; continue; }
      let d = 0;
      while (ops[k + d]?.op === "del") d++;
      let g = 0;
      while (ops[k + d + g]?.op === "ins") g++;
      if (g !== d) { ok = false; break; }
      k += d + g;
    }
    if (ok) return { cat: "إبدال", eqFrac };
  }

  return { cat: "فروق مركّبة", eqFrac, moved }; // بلغ العتبةَ أعلاه وفيه أكثرُ من نوع فرق
}

// —— المرور على الكتالوج (كل الطبقات) ————————————————————————————————
const cats = {};
const out = [];
const dropped = { formula: 0, far: 0, missing: 0, dup: 0 };
const seenPair = new Set();
for (const p of arr) {
  const key = p.a < p.b ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
  if (seenPair.has(key)) { dropped.dup++; continue; }
  seenPair.add(key);
  const A = words.get(p.a), B = words.get(p.b);
  if (!A || !B) { dropped.missing++; continue; }

  let ops = diff(A, B);
  const shorter = Math.min(A.length, B.length);

  // مرشّح الصيغ القالبية — زوجُ عبارةٍ تغطيتُه الكلّية دون النصف وقاسمُه قالبٌ شائع
  if (p.tier === "phrase" && matchedOf(ops) / shorter < FORMULA_COV && isFormulaCore(A, B)) {
    dropped.formula++;
    continue;
  }

  let { cat, eqFrac, moved } = classify(ops);
  let win = null;
  if (cat === null) {
    // المحاذاة الموضعية: لعل الأقصر توافق مقطعًا من الأطول (٦:١٥١↔١٧:٣١)
    const w = windowAlign(A, B);
    if (w) {
      ops = w.ops;
      win = w.win;
      ({ cat, eqFrac, moved } = classify(ops, true));
    }
  }
  if (cat === null) {
    // قريبُ المعنى بلا تقابلٍ لفظي: بابُه «مثلها» لا الفروق — يُطوى هنا بلا محاذاة قسرية
    dropped.far++;
    continue;
  }
  cats[cat] = (cats[cat] ?? 0) + 1;
  // علامة «صرفي»: صيغتان من lemma واحد، أو إبدالٌ متجاور من جذرٍ واحد
  const morph = ops.some((o) => o.op === "frm") ||
    ops.some((o, k) => o.op === "del" && ops[k + 1]?.op === "ins" && o.root && o.root === ops[k + 1].root);
  const taq = cat === "فروق مركّبة" && (moved ?? 0) >= 2; // فيه لفظٌ منتقلُ الموضع
  out.push({
    a: p.a, b: p.b, tier: p.tier, cat, eqFrac: +eqFrac.toFixed(2),
    ...(morph ? { morph: 1 } : {}), ...(taq ? { taq: 1 } : {}), ...(win ? { win } : {}), ops,
  });
}

const CAT_ORDER = ["إبدال", "اختلاف صيغة", "زيادة/نقص", "تقديم وتأخير", "فروق مركّبة", "اشتمال", "تطابق"];
out.sort((x, y) =>
  (CAT_ORDER.indexOf(x.cat) - CAT_ORDER.indexOf(y.cat)) || (y.eqFrac ?? 0) - (x.eqFrac ?? 0) || x.a.localeCompare(y.a));

console.log(`furuq v2: ${out.length} زوجًا · أُسقط: قالبية ${dropped.formula} · بعيدة ${dropped.far} · مكرّرة ${dropped.dup} · مفقودة ${dropped.missing}`);
for (const c of CAT_ORDER) if (cats[c]) console.log(`  ${c.padEnd(14)} ${cats[c]}`);

// —— تحقُّق: أزواجٌ من عُمَد كتب المتشابهات يجب أن تحضر ————————————————
const FAMOUS = [
  ["6:151", "17:31"], // نرزقكم وإياهم / نرزقهم وإياكم
  ["2:58", "7:161"], // حطّة — خطاياكم/خطيئاتكم وتقديم القول
  ["2:35", "7:19"], // اسكن أنت وزوجك الجنة — موضع «رغدًا»
  ["2:173", "16:115"], // إنما حرّم عليكم الميتة
  ["6:102", "40:62"], // ذلكم الله ربكم لا إله إلا هو
];
console.log("\nتحقُّق الأزواج الشهيرة:");
let famousMiss = 0;
for (const [x, y] of FAMOUS) {
  const hit = out.find((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
  if (!hit) famousMiss++;
  console.log(`  ${x}↔${y}: ${hit ? `${hit.cat} ✓` : "غائب ✗"}`);
}

// —— حمولة التطبيق (ops رشيقة: eq نص · frm ["~",قبل,بعد] · del/ins ["-"/"+",نص]) ——
const slim = out.map((p) => ({
  a: p.a, b: p.b, tier: p.tier, cat: p.cat, eq: p.eqFrac,
  ...(p.morph ? { morph: 1 } : {}),
  ...(p.taq ? { taq: 1 } : {}),
  ...(p.win ? { win: p.win } : {}),
  ops: p.ops.map((o) =>
    o.op === "eq" ? o.t : o.op === "frm" ? ["~", o.tA, o.tB] : [o.op === "ins" ? "+" : "-", o.t]),
}));
fs.writeFileSync(APP, JSON.stringify({
  meta: { pairs: out.length, categories: cats, engine: "v2-lemma", nearBar: NEAR_BAR, formulaDF: FORMULA_DF, winCov: WIN_COV },
  furuq: slim,
}));

// —— الموجز البشري ————————————————————————————————————————————————
const render = (ops) => ops.map((o) =>
  o.op === "eq" ? o.t : o.op === "frm" ? `⟨${o.tA} ⇆ ${o.tB}⟩` : o.op === "del" ? `⟨−${o.t}⟩` : `⟨+${o.t}⟩`).join(" ");
let md = `# فروق التنزيل v2 — المصنّف المعاد بناؤه

**التاريخ:** 2026-07-14 · **المحاذاة:** على الـlemma لا السطح — فيظهر فرقُ الصيغة ⇆ صيغتين
لكلمةٍ واحدة، لا حذفًا وزيادة. **الطبقات:** كتالوج التوائم كلُّه (${arr.length} زوجًا) بما فيه
قريبُ المعنى الذي كان مُسقطًا. **تقديم وتأخير:** بشرط تساوي حقيبتَي الـlemmas لا بتقاطع كلمة.
**الصيغ القالبية** (تغطية كلّية < ${FORMULA_COV * 100}٪ وقاسمُها مدًى في ≥ ${FORMULA_DF} آيات): تُستبعد.
**المحاذاة الموضعية:** آيةٌ قصيرةٌ توافق مقطعًا من أطول (تغطية ≥ ${WIN_COV * 100}٪ من الأقصر)
تُحاذى على أفضل نافذةٍ فيها، والباقي سياقٌ مطويّ «…» — كما تقتبس كتبُ الفروق موضعَ الشاهد.
**فروق مركّبة**: لا تُعرَض محاذاةً إلا بقربٍ حقيقي (eqFrac ≥ ${NEAR_BAR}). **اشتمال**: الأطول
تتضمّن الأقصر بنصّها. وقريبُ المعنى بلا تقابلٍ لفظيٍّ بابُه «مثلها» لا الفروق.
**زيادة الآية «ب» ⟨+..⟩ · ما انفردت به «أ» ⟨−..⟩ · صيغتا كلمةٍ واحدة ⟨.. ⇆ ..⟩.**

## الإحصاء (${out.length} زوجًا)

| الفئة | العدد |
|---|---|
${CAT_ORDER.filter((c) => cats[c]).map((c) => `| ${c} | ${cats[c]} |`).join("\n")}

أُسقط: ${dropped.formula} زوجَ صيغةٍ قالبية · ${dropped.far} دون عتبتَي القرب · ${dropped.dup} مكرّر.

`;
for (const c of CAT_ORDER) {
  if (!cats[c] || c === "تطابق") continue;
  md += `\n## ${c} (${cats[c]}) — أمثلة\n\n`;
  for (const p of out.filter((x) => x.cat === c).slice(0, 12)) {
    const w = p.win ? ` · نافذة في «${p.win.s === "a" ? "أ" : "ب"}»` : "";
    md += `**${p.a} ⇄ ${p.b}**${p.morph ? " · صرفي" : ""}${w}\n\n\`${p.win ? "… " : ""}${render(p.ops)}${p.win ? " …" : ""}\`\n\n`;
  }
}
fs.writeFileSync(MD, md);
console.log(`\n→ findings/FURUQ.md (${(fs.statSync(MD).size / 1024).toFixed(0)} KB)`);
console.log(`→ public/furuq.json (${(fs.statSync(APP).size / 1024).toFixed(0)} KB)`);
if (famousMiss) console.log(`⚠ ${famousMiss} من الأزواج الشهيرة غائب — يُراجَع قبل النشر`);

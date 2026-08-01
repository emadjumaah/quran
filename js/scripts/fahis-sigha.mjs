/**
 * فحصُ «دلالةِ الصيغة الصرفيّة» — الأصلُ الثالث في جرد الأصول (ر٣).
 *
 * القول (أبو عوّاد وغيرُه): للوزن الصرفيِّ معنًى مطّردٌ يزيد على معنى الجذر —
 * «مَفعَلة للكثرة» و«فَعّال للمبالغة» و«فَعيل للثبوت» — ويقوم عليه التفريقُ
 * بين ألفاظ المادّة الواحدة.
 *
 * **قاعدةُ الوزن عندنا معلنة** (وهي أشدُّ من مطابقة الرسم التي كانت في النسخة
 * الأولى، فتلك تحسب «مدينة» على مَفعَلة): الوزنُ يُشتقّ آليًّا بمحاذاة حروف
 * الجذر الثلاثيّ داخل **الجذع المعجميّ المشكول** من وسم الصرف؛ حروفُ الجذر
 * تصير «ف ع ل» بحركاتها، وما بقي فمن حروف الزيادة المعروفة («سألتمونيها»
 * والتاءُ المربوطة) يبقى بلفظه — وما لم تستقم محاذاتُه (المعتلُّ المبدَل كـ
 * «ميزان» و«آية») يخرج من العدّ **ويُحصى ويُعلن**، فلا يُعدّ الناقصُ تامًّا.
 *
 * والمحكُّ المحسوب لا يفتي في المعنى — يُخرج الوقائع: كم قالبًا للمادّة
 * الواحدة، وأيُّ الموادّ تجري في الوزن الواحد، والقوائمُ كاملةً للنظر.
 *
 * usage: node js/scripts/fahis-sigha.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(HERE, "..", "..", "quran-kg.db"), { readOnly: true });

// ── الوحدات: حرفٌ وما يتبعه من علامات ────────────────────────────────────────
const HARAKAT = new Set(["ً", "ٌ", "ٍ", "َ", "ُ", "ِ", "ّ", "ْ", "ٰ", "ٓ", "ٔ", "ـ"]);
const AUGMENT = new Set(["س", "ء", "ل", "ت", "م", "و", "ن", "ي", "ه", "ا", "ة"]); // سألتمونيها + ة
const normLetter = (c) => ("أإآءؤئ".includes(c) ? "ء" : c === "ٱ" ? "ا" : c === "ى" ? "ي" : c);

function tokenize(word) {
  const units = [];
  // المدّةُ حرفان: همزةٌ فألف — وإلا ضاعت ألفُ «آمِن» فصار فاعِلُه فعِلًا
  for (const ch of word.replace(/آ/g, "ءا")) {
    if (HARAKAT.has(ch)) {
      if (units.length) units[units.length - 1].marks += ch;
    } else {
      units.push({ letter: ch, marks: "" });
    }
  }
  // الشدّةُ قبل الحركة في الإخراج — توحيدًا للقوالب
  for (const u of units) u.marks = [...u.marks].sort((a, b) => (a === "ّ" ? -1 : b === "ّ" ? 1 : 0)).join("");
  return units;
}

/**
 * محاذاةُ جذرٍ ثلاثيٍّ على وحدات الجذع: مواضعُ متزايدةٌ لحروف الجذر بالترتيب،
 * والمدغمُ (عينُه ولامُه سواء) يجوز في حرفٍ واحدٍ مشدَّد، والبقيّةُ زوائدُ
 * مشروعةٌ وإلا فشلت المحاذاة.
 */
function align(units, root) {
  const R = [...root].map(normLetter);
  if (R.length !== 3) return null;

  // المحاذاةُ من اليمين (أواخرُ المواضع أولى): سوابقُ الزيادة — م، است، ت —
  // تتقدّم الجذعَ، فاختيارُ أوّلِ موافقٍ يُفسد نحوَ «مستسلم» بجعل سينِ
  // الاستفعال فاءً. البحثُ نازلًا يعطي المحاذاةَ الصرفيّةَ الصحيحة.
  function search(maxI, ri, used) {
    if (ri < 0) return used;
    for (let i = maxI; i >= 0; i--) {
      const L = normLetter(units[i].letter);
      if (L !== R[ri]) continue;
      // إدغامُ المِثلين: عينٌ ولامٌ سواءٌ في حرفٍ مشدَّد
      if (ri === 2 && R[1] === R[2] && units[i].marks.includes("ّ")) {
        const r = search(i - 1, 0, [i, i, ...used]);
        if (r) return r;
      }
      const r = search(i - 1, ri - 1, [i, ...used]);
      if (r) return r;
    }
    return null;
  }
  const pos = search(units.length - 1, 2, []);
  if (!pos) return null;
  for (let i = 0; i < units.length; i++) {
    if (!pos.includes(i) && !AUGMENT.has(normLetter(units[i].letter))) return null;
  }
  return pos;
}

const FA_AYN_LAM = ["ف", "ع", "ل"];
function template(units, pos) {
  const out = [];
  for (let i = 0; i < units.length; i++) {
    const ri = pos.indexOf(i);
    if (ri >= 0) {
      const dbl = pos[1] === pos[2] && ri === 1;
      out.push((dbl ? "عّ" : FA_AYN_LAM[ri]) + units[i].marks.replace(dbl ? "ّ" : "", ""));
    } else {
      out.push(units[i].letter + units[i].marks);
    }
  }
  return out.join("");
}

// ── الجذوعُ الاسميّةُ الثلاثيّة من الوسم ─────────────────────────────────────
const rows = db.prepare(`
  SELECT l.lemma_ar lem, r.root_ar root, COUNT(*) occ, COUNT(DISTINCT s.ayah_id) ayat
  FROM segment s
  JOIN lemma l ON l.lemma_id = s.lemma_id
  JOIN root r ON r.root_id = s.root_id
  WHERE s.role = 'stem' AND s.pos_basic = 'N'
  GROUP BY l.lemma_ar, r.root_ar`).all();

const thulathi = rows.filter((r) => [...r.root].length === 3);
const skipped = [];
const weighed = [];
for (const r of thulathi) {
  const units = tokenize(r.lem);
  const pos = align(units, r.root);
  if (!pos) { skipped.push(r); continue; }
  weighed.push({ ...r, tpl: template(units, pos) });
}

console.log("فحصُ دلالة الصيغة الصرفيّة — الوزنُ مشتقٌّ بمحاذاة الجذر على الجذع المشكول\n");
console.log(`أزواجُ (جذعٍ، جذرٍ) اسميّةٌ في الوسم: ${rows.length} · ثلاثيّةُ الجذر: ${thulathi.length}`);
console.log(`وُزّن آليًّا: ${weighed.length} · خرج عن المحاذاة (معتلٌّ مبدَل ونحوُه — يُعلن): ${skipped.length}\n`);

// ── القوالبُ إجمالًا ─────────────────────────────────────────────────────────
const byTpl = new Map();
for (const w of weighed) {
  if (!byTpl.has(w.tpl)) byTpl.set(w.tpl, []);
  byTpl.get(w.tpl).push(w);
}
console.log(`القوالبُ المتمايزة: ${byTpl.size}\n`);
console.log("الأوسعُ موادَّ (١٥ الأُوَل):");
const top = [...byTpl.entries()].map(([tpl, ws]) => ({ tpl, mawad: new Set(ws.map((w) => w.root)).size, occ: ws.reduce((a, w) => a + w.occ, 0) })).sort((a, b) => b.mawad - a.mawad);
for (const t of top.slice(0, 15)) console.log(`  ${t.tpl} — ${t.mawad} مادّةً · ${t.occ} موضعًا`);

// ── الأوزانُ الخمسةُ المدّعاة ────────────────────────────────────────────────
// أعيانُ القوالب تُشتقّ من شواهدَ حيّةٍ لا تُكتب باليد — فرسمُ الوسم يُسقط
// فتحةَ ما قبل الألف، وكتابتُها يدويًّا أخرجت «فَعّال» صفرًا في نسخةٍ سابقة
function tplOf(lem, root) {
  const u = tokenize(lem);
  const p = align(u, root);
  if (!p) throw new Error(`تعذّرت محاذاةُ الشاهد ${lem}/${root}`);
  return template(u, p);
}
const CLAIMED = [
  { tpl: tplOf("مَرْحَمَة", "رحم"), name: "مَفْعَلَة", claim: "الكثرةُ ومكانُ الشيء" },
  { tpl: tplOf("عَلّام", "علم"), name: "فَعّال", claim: "المبالغةُ في الوصف" },
  { tpl: tplOf("رَحِيم", "رحم"), name: "فَعِيل", claim: "الثبوتُ والدوام" },
  { tpl: tplOf("سُجُود", "سجد"), name: "فُعُول", claim: "المصدريّةُ أو الجمع" },
  { tpl: tplOf("مِصْباح", "صبح"), name: "مِفْعال", claim: "آلةٌ أو مبالغة" },
];
console.log("\n— الأوزانُ الخمسةُ المدّعاة —");
for (const c of CLAIMED) {
  const ws = byTpl.get(c.tpl) ?? [];
  const roots = new Set(ws.map((w) => w.root));
  console.log(`\n${c.tpl} («${c.claim}») — ${ws.length} جذعًا من ${roots.size} مادّةً، ${ws.reduce((a, w) => a + w.occ, 0)} موضعًا:`);
  const list = ws.sort((a, b) => b.occ - a.occ).map((w) => `${w.lem}(${w.occ})`);
  console.log("  " + (list.length <= 30 ? list.join(" · ") : list.slice(0, 30).join(" · ") + ` · …و${list.length - 30}`));
}

// ── محكُّ الاستقلال: المادّةُ الواحدةُ بقوالبَ عدّة ──────────────────────────
const byRoot = new Map();
for (const w of weighed) {
  if (!byRoot.has(w.root)) byRoot.set(w.root, []);
  byRoot.get(w.root).push(w);
}
const multi = [...byRoot.entries()].filter(([, ws]) => new Set(ws.map((w) => w.tpl)).size >= 2);
console.log(`\n— موادُّ لها قالبان فأكثر: ${multi.length} من ${byRoot.size} (${Math.round((multi.length / byRoot.size) * 100)}٪) —`);
const rich = multi.sort((a, b) => new Set(b[1].map((w) => w.tpl)).size - new Set(a[1].map((w) => w.tpl)).size);
for (const [root, ws] of rich.slice(0, 8)) {
  const uniq = [...new Map(ws.map((w) => [w.lem, w])).values()];
  console.log(`  «${root}» (${new Set(ws.map((w) => w.tpl)).size} قوالب): ${uniq.map((w) => `${w.lem}=${w.tpl}`).join(" · ")}`);
}

// وكم مادّةً من موادّ الأوزان الخمسة تنفرد بوزنٍ واحد؟
console.log("\n— من موادّ الأوزان الخمسة: كم مادّةً لها قالبٌ آخرُ غيرُه؟ —");
for (const c of CLAIMED) {
  const roots = new Set((byTpl.get(c.tpl) ?? []).map((w) => w.root));
  const withOther = [...roots].filter((rt) => new Set(byRoot.get(rt).map((w) => w.tpl)).size >= 2);
  console.log(`  ${c.tpl}: ${withOther.length} من ${roots.size}`);
}

// عيّنةُ الخارج عن المحاذاة — ليُرى أنّه إعلالٌ لا تعمية
console.log(`\n— عيّنةُ ما خرج عن المحاذاة (${skipped.length}): ${skipped.slice(0, 12).map((s) => `${s.lem}/${s.root}`).join(" · ")} …`);

/**
 * فحصُ الدعاوى العدديّة دفعةً واحدة — كلُّ رقمٍ يُقابَل بعدٍّ من المصحف.
 *
 * الغاية: مادّةُ الإعجاز العدديِّ دعاواها **صريحةُ الرقم**، فهي أوفقُ ما
 * يُفحص آليًّا: يُلتقط من النصّ زوجٌ (لفظٌ، عدد) ثم يُعدّ اللفظُ عندنا
 * بالصيغ وبالرسم، ويُقابَل. ولا رأيَ في هذا ولا صياغة — أرقامٌ بإزاء أرقام.
 *
 * **والعدُّ بالصيغ لا بالرسم** (أمر المالك)، **والمفردُ يُفصل عن الجمع** —
 * فأكثرُ ما يُذكر من أعدادٍ إنّما هو في المفرد، ومن خلطهما ظلم القولَ أو
 * حاباه. ويُعرض الوجهان معًا فيُعرف أيُّهما وافق.
 *
 * usage: node js/scripts/fahis-numeric-batch.mjs [slug=kaheel]
 * out:   findings/FAHIS-NUMERIC.md — جدولٌ يُقرأ ثم يُحكم
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const slug = process.argv[2] ?? "kaheel";
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });

const norm = (s) => (s || "").replace(/[ً-ْٰـۖ-ۭ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي")
  .replace(/ة/g, "ه").replace(/[^؀-ۿ\s]/g, " ").replace(/\s+/g, " ").trim();

const ayat = db.prepare("SELECT location, text_clean FROM ayah").all();

/** عددُ اللفظ بالصيغ (وبالمفرد وحدَه) وبالرسم — ثلاثةُ أوجهٍ تُعرض معًا */
const stmtWord = db.prepare("SELECT lemma_id FROM word WHERE text_clean=? LIMIT 1");
const stmtLemma = db.prepare(`SELECT w.text_clean f, s.number n FROM word w
  LEFT JOIN segment s ON s.word_id=w.word_id AND s.role='stem' WHERE w.lemma_id=?`);
function countOf(word) {
  const w = String(word).trim();
  const seed = stmtWord.get(w);
  let total = 0, singular = 0, forms = new Map();
  if (seed?.lemma_id) {
    for (const r of stmtLemma.all(seed.lemma_id)) {
      total++;
      if (r.n !== "D" && r.n !== "P") singular++;
      forms.set(r.f, (forms.get(r.f) ?? 0) + 1);
    }
  }
  const nq = norm(w);
  let raw = 0;
  for (const a of ayat) raw += ` ${norm(a.text_clean)} `.split(` ${nq} `).length - 1;
  return { total, singular, raw, forms: [...forms.entries()].sort((a, b) => b[1] - a[1]) };
}

/**
 * أنماطُ الالتقاط — صيغتْ على ما يُكتب فعلًا في هذا الباب لا على ما يُتوقَّع.
 * وأنفعُها **أعدادُ السور** (آياتٍ وكلماتٍ وحروفًا)، لأنّها عمودُ الدعاوى
 * العدديّة وعندنا مقابلُها في القاعدة مضبوطًا.
 */
const WORD_PAIRS = [
  /(?:كلمةُ?|لفظُ?|اسمُ?|حرفُ?)\s*[«"']?([ء-ي]{2,15})[»"']?\s*(?:قد\s*)?(?:وردت?|تكرّ?رت?|جاءت?|ذُكرت?)\s*(?:في القرآن\s*)?(?:[:\s]*)(\d{1,4})/g,
  /(?:تتكرّ?ر|يتكرّ?ر|وردت?|تكرّ?رت?)\s*(?:كلمةُ?|لفظُ?|اسمُ?|أداةُ النداء)?\s*[«"']([ء-ي\s]{2,20})[»"']\s*[:\s]*(\d{1,4})/g,
];
const SURAH_PAIRS = /عددُ?\s*(آيات|كلمات|حروف)\s*سورة\s*([ء-ي]{2,14})\s*(?:هو\s*)?(\d{1,5})/g;

/** أسماءُ الحروف — فدعاوى هذا الباب كثيرًا ما تكون في الحروف لا الكلمات */
const LETTERS = { "الالف":"ا","الباء":"ب","التاء":"ت","الثاء":"ث","الجيم":"ج","الحاء":"ح","الخاء":"خ",
  "الدال":"د","الذال":"ذ","الراء":"ر","الزاي":"ز","السين":"س","الشين":"ش","الصاد":"ص","الضاد":"ض",
  "الطاء":"ط","الظاء":"ظ","العين":"ع","الغين":"غ","الفاء":"ف","القاف":"ق","الكاف":"ك","اللام":"ل",
  "الميم":"م","النون":"ن","الهاء":"ه","الواو":"و","الياء":"ي" };
const stmtLetter = db.prepare("SELECT COUNT(*) n FROM letter WHERE letter=?");
const stmtLetterSura = db.prepare("SELECT COUNT(*) n FROM letter WHERE letter=? AND surah_no=?");
/** الألفُ لها صورٌ، فيُعرض المجرّدُ وبالصور معًا */
const ALIF = ["ا","أ","إ","آ","ٱ"];
function letterCount(ch, sura) {
  const one = (c) => (sura ? stmtLetterSura.get(c, sura).n : stmtLetter.get(c).n);
  if (ch !== "ا") return { bare: one(ch), all: one(ch) };
  return { bare: one("ا"), all: ALIF.reduce((a, c) => a + one(c), 0) };
}

const suraByName = new Map();
for (const r of db.prepare("SELECT surah_no, name_ar, ayah_count a, word_count w, letter_count l FROM surah").all())
  suraByName.set(norm(r.name_ar), r);
const claims = JSON.parse(fs.readFileSync(path.join(ROOT, "research/claims", `${slug}.json`), "utf8"));
const found = new Map();
const suraClaims = [];
for (const c of claims.claims) {
  for (const re of WORD_PAIRS) {
    re.lastIndex = 0;
    for (const m of c.text.matchAll(re)) {
      const w = m[1].trim(), n = Number(m[2]);
      if (w.length < 2 || !Number.isFinite(n) || n < 2 || n > 9999) continue;
      found.set(`${w}|${n}`, { w, n });
    }
  }
  SURAH_PAIRS.lastIndex = 0;
  for (const m of c.text.matchAll(SURAH_PAIRS)) {
    const kind = m[1], name = m[2].trim(), n = Number(m[3]);
    const s2 = suraByName.get(norm(name));
    if (s2 && Number.isFinite(n)) suraClaims.push({ kind, name, n, sura: s2 });
  }
}

const L = [`# دعاوى عدديّةٌ قوبلت بالعدّ — ${claims.name}\n`];
L.push("كلُّ رقمٍ في العمود الأيمن **من عدِّنا على المصحف**، بثلاثة أوجهٍ تُعرض معًا:");
L.push("اللفظُ **بصيغه كلِّها** · **المفردُ** منها وحدَه · و**الرسمُ المجرّد**.");
L.push("فالاختلافُ في العدّ أكثرُه اختلافٌ في **حدِّ المعدود** لا في الحساب.\n");
L.push("| اللفظ | المذكور | بالصيغ | المفرد | بالرسم | يوافق؟ |");
L.push("|---|---|---|---|---|---|");

let agree = 0, differ = 0, absent = 0, skipped = 0;
for (const { w, n } of [...found.values()].sort((a, b) => a.w.localeCompare(b.w, "ar"))) {
  const nw = norm(w);
  if (LETTERS[nw]) {
    // دعاوى الحروف نطاقُها سورةٌ غالبًا، ولم يُلتقط النطاقُ آليًّا — فمقابلتُها
    // بالمصحف كلِّه مقابلةٌ مضلّلة، ولا تُعقد. يُعلن ذلك ولا يُتكلّف حكم.
    skipped++;
    L.push(`| حرفُ ${w} | ${n} | — | — | — | لم يُذكر نطاقُه فلا يُقابَل |`);
    continue;
  }
  const c = countOf(w);
  if (!c.total && !c.raw) { absent++; L.push(`| ${w} | ${n} | — | — | — | لا يُعرف اللفظ |`); continue; }
  const ok = c.total === n ? "بالصيغ ✓" : c.singular === n ? "بالمفرد ✓" : c.raw === n ? "بالرسم ✓" : "";
  if (ok) agree++; else differ++;
  L.push(`| ${w} | ${n} | ${c.total} | ${c.singular} | ${c.raw} | ${ok || "لا"} |`);
}
if (suraClaims.length) {
  L.push("\n## أعدادُ السور\n");
  L.push("| السورة | ما ذُكر | المذكور | عندنا | يوافق؟ |");
  L.push("|---|---|---|---|---|");
  for (const s3 of suraClaims) {
    const mine = s3.kind === "آيات" ? s3.sura.a : s3.kind === "كلمات" ? s3.sura.w : s3.sura.l;
    L.push(`| ${s3.sura.name_ar} | ${s3.kind} | ${s3.n} | ${mine} | ${mine === s3.n ? "✓" : "لا"} |`);
  }
}

L.push(`\n**الحصيلة**: ${found.size} زوجًا (لفظًا وعددًا) التُقطت آليًّا — وافق ${agree} في وجهٍ من الأوجه، وخالف ${differ}، و${absent} لم يُعرف لفظُه، و${skipped} لم يُذكر نطاقُه.\n`);
L.push("> والموافقةُ في وجهٍ لا تعني إعجازًا، والمخالفةُ لا تعني خطأً: **قاعدةُ العدّ تُعلن قبل النتيجة**.");
L.push("> فمن عدّ المفردَ وحدَه غيرُ من عدّ الجموعَ معه، وكلاهما عدٌّ صحيحٌ بشرطه.\n");
L.push("**وحدُّ هذه الأداة يُعلن**: الالتقاطُ آليٌّ بأنماطٍ، وأكثرُ ما في هذا الباب");
L.push("مكتوبٌ بأسلوبٍ لا تلتقطه الأنماطُ — فما في الجدول **عيّنةٌ لا استيعاب**.");
L.push("والباقي يُقرأ ويُفحص واحدًا واحدًا، ولا يُدَّعى أنّ الجدولَ حكمٌ على المادّة كلِّها.");

fs.writeFileSync(path.join(ROOT, "findings", "FAHIS-NUMERIC.md"), L.join("\n") + "\n");
console.log(L.slice(4).join("\n"));

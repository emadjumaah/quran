/**
 * فحصُ الدعاوى العدديّة دفعةً واحدة — كلُّ رقمٍ يُقابَل بوجهين معلنَين (ر٤).
 *
 * v2 بعد معايرة «الرسم الأوّل» (FAHIS-RASM-AWWAL): كلُّ دعوى تُختبر بوجهين:
 *   ١) **قاعدتُنا**: رسمُ المصحف، والعدُّ بالصيغ والمفردُ مفصولٌ عن الجمع.
 *   ٢) **قاعدةُ صاحبها المثبتةُ حرفيًّا**: تجريدُ الضبط وعلاماتِ التجويد،
 *      ومقاعدِ الهمز (أإآ←ا · ؤ←و · ئ←ي · ء تسقط)، والمقصورةُ ياءً — وهي
 *      التي أعادت مراسيَه المفصّلةَ حرفًا بحرف (م ٢٨٧ · ر ١٦٧ · ي ٣٤٢ في مريم).
 * فإن طابق الرقمُ وجهًا سُمّي الوجهُ، وإن لم يطابق شيئًا قيل ذلك — **والاختلافُ
 * في المقياس لا يُحوَّل اتّهامًا في الحساب**، وما لم يُعرف حدُّ معدوده أُعلن.
 *
 * الالتقاطُ بأنماطٍ على الأرقام الصريحة — والمكتوبُ نصًّا («سبع مرّات»)
 * خارجَ هذه الدفعة: حدُّ الأداة يُعلن ولا يُستر.
 *
 * usage: node js/scripts/fahis-numeric-batch.mjs [slug=kaheel]
 * out:   findings/FAHIS-NUMERIC.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const slug = process.argv[2] ?? "kaheel";
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });

// ── قاعدةُ صاحبها المثبتة ────────────────────────────────────────────────────
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g;
const rasm0 = (s) => s.replace(/ٱ/g, "ا").replace(MARKS, "")
  .replace(/[أإآ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "").replace(/ى/g, "ي");

const words = db.prepare("SELECT surah_no s, text_uthmani t FROM word ORDER BY surah_no, ayah_no, word_no").all();
const surahs = db.prepare("SELECT surah_no, name_ar, ayah_count, word_count, letter_count FROM surah").all();
const byName = new Map(surahs.map((s) => [s.name_ar.replace(/^ال/, ""), s]));
const ayat = db.prepare("SELECT surah_no s, ayah_no a, GROUP_CONCAT(text_uthmani,' ') t FROM word GROUP BY surah_no, ayah_no").all();

const surahRasm = new Map(); // s → { words, letters: Map, total }
for (const w of words) {
  if (!surahRasm.has(w.s)) surahRasm.set(w.s, { words: 0, letters: new Map(), total: 0 });
  const o = surahRasm.get(w.s);
  o.words++;
  for (const ch of rasm0(w.t)) { o.letters.set(ch, (o.letters.get(ch) ?? 0) + 1); o.total++; }
}
const BASM_W = 4, BASM_L = 19; // «بسم الله الرحمن الرحيم» بالرسم الأوّل

const LETTER = { "الألف": "ا", "الالف": "ا", "الباء": "ب", "التاء": "ت", "الثاء": "ث", "الجيم": "ج", "الحاء": "ح", "الخاء": "خ", "الدال": "د", "الذال": "ذ", "الراء": "ر", "الزاي": "ز", "السين": "س", "الشين": "ش", "الصاد": "ص", "الضاد": "ض", "الطاء": "ط", "الظاء": "ظ", "العين": "ع", "الغين": "غ", "الفاء": "ف", "القاف": "ق", "الكاف": "ك", "اللام": "ل", "الميم": "م", "النون": "ن", "الهاء": "ه", "الواو": "و", "الياء": "ي" };

// ── قاعدتُنا: العدُّ بالصيغ والرسم ───────────────────────────────────────────
const normOur = (s) => (s || "").replace(/[ً-ْٰـۖ-ۭ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
const ayatClean = db.prepare("SELECT location, text_clean FROM ayah").all();
const stmtWord = db.prepare("SELECT lemma_id FROM word WHERE text_clean=? LIMIT 1");
const stmtLemma = db.prepare(`SELECT w.text_clean f, s.number n FROM word w
  LEFT JOIN segment s ON s.word_id=w.word_id AND s.role='stem' WHERE w.lemma_id=?`);
const stmtWordLike = db.prepare("SELECT lemma_id FROM word WHERE text_clean LIKE ? LIMIT 1");
function countOurs(word) {
  const w = String(word).trim();
  const seed = stmtWord.get(w) ?? stmtWord.get(normOur(w)) ?? stmtWordLike.get("%" + w + "%") ?? stmtWordLike.get("%" + normOur(w) + "%");
  let total = 0, singular = 0, plural = 0;
  if (seed?.lemma_id) for (const r of stmtLemma.all(seed.lemma_id)) { total++; if (r.n !== "D" && r.n !== "P") singular++; if (r.n === "P") plural++; }
  const nq = normOur(w);
  let raw = 0;
  for (const a of ayatClean) raw += ` ${normOur(a.text_clean)} `.split(` ${nq} `).length - 1;
  return { total, singular, plural, raw };
}

/** عدُّ اللفظ (أو العبارة) بقاعدته: على نصّ الرسم الأوّل، مجرّدًا وبسوابقه */
const rasmAyat = ayat.map((a) => ({ s: a.s, a: a.a, toks: a.t.split(" ").map(rasm0) }));
const PRE = /^(?:و|ف)?(?:ب|ك|ل|ال|بال|كال|لل|فال|وال)?/;
function countRasm(phrase) {
  const seq = rasm0(phrase.trim()).split(/\s+/).filter(Boolean);
  let bare = 0, pref = 0;
  for (const ay of rasmAyat) {
    for (let i = 0; i + seq.length <= ay.toks.length; i++) {
      const win = ay.toks.slice(i, i + seq.length);
      if (win.every((t, j) => t === seq[j])) bare++;
      if (win.every((t, j) => (j === 0 ? t.replace(PRE, "") === seq[j] || t === seq[j] : t === seq[j]))) pref++;
    }
  }
  return { bare, pref };
}
function cooccur(a, b) {
  const strip = (t) => t.replace(PRE, "");
  const A = strip(rasm0(a)), B = strip(rasm0(b));
  let n = 0;
  for (const ay of rasmAyat) {
    const has = (x) => ay.toks.some((t) => strip(t) === x);
    if (has(A) && has(B)) n++;
  }
  return n;
}

// ── الالتقاط ─────────────────────────────────────────────────────────────────
const dir = path.join(ROOT, "research", "sites", slug);
const index = JSON.parse(fs.readFileSync(path.join(dir, "_index.json"), "utf8"));
const arDig = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const found = { surah: [], letter: [], word: [], co: [] };
const seen = new Set();

for (const page of index.pages) {
  let text;
  try { text = fs.readFileSync(path.join(dir, page.text), "utf8"); } catch { continue; }
  text = arDig(text).replace(/[یﯼﯽﯾﯿ]/g, "ي").replace(/ک/g, "ك").replace(/[ۀۃ]/g, "ة").replace(/\s+/g, " ");

  for (const m of text.matchAll(/عدد\s+(آيات|كلمات|حروف)\s+(?:سورة\s+)?(?:ال)?([\u0621-\u064A]{2,12})\s*(?:هو|هي|يساوي|=|:)?\s*(\d{1,5})/g)) {
    const su = byName.get(m[2]) ?? byName.get(m[2].replace(/^ال/, ""));
    if (!su) continue;
    const key = `s|${m[1]}|${su.surah_no}|${m[3]}`;
    if (!seen.has(key)) { seen.add(key); found.surah.push({ kind: m[1], su, n: +m[3] }); }
  }
  for (const m of text.matchAll(/حرف\s+(ال[\u0621-\u064A]{2,6})[^0-9]{0,80}?(\d{1,5})\s*مر(?:ة|ات|تين)(?:[^0-9]{0,40}?سورة\s+(?:ال)?([\u0621-\u064A]{2,12}))?/g)) {
    const L = LETTER[m[1]];
    if (!L) continue;
    const su = m[3] ? (byName.get(m[3]) ?? byName.get(m[3].replace(/^ال/, ""))) : null;
    const key = `l|${L}|${su?.surah_no ?? "all"}|${m[2]}`;
    if (!seen.has(key)) { seen.add(key); found.letter.push({ L, name: m[1], su, n: +m[2] }); }
  }
  for (const m of text.matchAll(/كلمة\s+[«("']?([\u0621-\u064A]{2,14})[»)"']?(\s+بمشتقاتها)?[^0-9]{0,60}?تكرر(?:ت)?\s+(?:بالضبط\s+)?(\d{1,4})\s*مر/g)) {
    if (["دائما","هذه","ايضا","أيضا","كذلك","تقريبا","نفسها"].includes(m[1])) continue;
    const key = `w|${m[1]}|${m[3]}`;
    if (!seen.has(key)) { seen.add(key); found.word.push({ w: m[1], mush: !!m[2], n: +m[3] }); }
  }
  for (const m of text.matchAll(/كلمة\s+[«("']?([\u0621-\u064A]{2,14})[»)"']?\s+مع\s+كلمة\s+[«("']?([\u0621-\u064A]{2,14})[»)"']?[^0-9]{0,80}?(\d{1,4})\s*مر/g)) {
    const key = `c|${m[1]}|${m[2]}|${m[3]}`;
    if (!seen.has(key)) { seen.add(key); found.co.push({ a: m[1], b: m[2], n: +m[3] }); }
  }
}

// ── الفحصُ والإخراج ──────────────────────────────────────────────────────────
const ar = (x) => String(x).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
let hits = 0, partial = 0, misses = 0, unscoped = 0;
let out = `# دعاوى عدديّةٌ قوبلت بالعدّ — دفعةُ ر٤ الموسّعة

الالتقاطُ آليٌّ بالأرقام الصريحة من ${ar(index.pages.length)} صفحةً محفوظةً بروابطها
(research/sites/${slug})، وكلُّ رقمٍ يُقابَل **بوجهين معلنَين**: قاعدتُنا (رسمُ
المصحف، العدُّ بالصيغ والمفردُ مفصول)، و**قاعدةُ صاحبها المثبتةُ بالمعايرة**
([FAHIS-RASM-AWWAL](FAHIS-RASM-AWWAL.md)): تجريدُ الهمز والمقصورة بلا بسملة —
وهي التي أعادت مراسيَه المفصّلةَ حرفًا بحرف. فإن طابق الرقمُ وجهًا سُمّي الوجه؛
**والاختلافُ في المقياس لا يُحوَّل اتّهامًا في الحساب، وما لم يُعرف حدُّ
معدوده أُعلن.**

> حدُّ الأداة يُعلن: الالتقاطُ بالأرقام الصريحة وحدَها — والمكتوبُ نصًّا
> («سبع مرّات») والمركَّبُ وصفًا خارجَ هذه الدفعة، فما هنا **عيّنةٌ موسّعةٌ
> لا استيعاب**، والباقي يُقرأ واحدًا واحدًا.

`;

if (found.surah.length) {
  out += `\n## أعدادُ السور (آياتٌ وكلماتٌ وحروف)\n\n| السورة | ما ذُكر | عندَه | بقاعدته عندنا | ومعها البسملة | بقاعدتنا | الحكم |\n|---|---|---|---|---|---|---|\n`;
  for (const f of found.surah) {
    const r = surahRasm.get(f.su.surah_no);
    let byHis, byHisB, byOurs;
    if (f.kind === "آيات") { byHis = f.su.ayah_count; byHisB = null; byOurs = f.su.ayah_count; }
    else if (f.kind === "كلمات") { byHis = r.words; byHisB = r.words + BASM_W; byOurs = f.su.word_count; }
    else { byHis = r.total; byHisB = r.total + BASM_L; byOurs = f.su.letter_count; }
    const verdict = f.n === byHis ? "**يطابق بقاعدته**" : (byHisB !== null && f.n === byHisB) ? "**يطابق بها مع البسملة**" : f.n === byOurs ? "**يطابق بقاعدتنا**" : "لا يطابق وجهًا";
    if (verdict === "لا يطابق وجهًا") misses++; else if (verdict === "**يطابق بقاعدته**") hits++; else partial++;
    out += `| ${f.su.name_ar} | ${f.kind} | ${ar(f.n)} | ${ar(byHis)} | ${byHisB === null ? "—" : ar(byHisB)} | ${ar(byOurs)} | ${verdict} |\n`;
  }
  out += `\n> **ويُثبَت للسجلّ**: في صفحته سطران لعدد ٢٬٠٨٠ — «عددُ آيات سورة النحل ٢٠٨٠» و«عددُ كلمات هذه السورة هو ٢٠٨٠ (مع اعتبار واو العطف كلمة)» — فالسطران يتنافيان في نصّه، وقاعدةُ «اعتبار الواو كلمةً» تخالف «إلحاقَ الواو بما بعدها» المعلنةَ في موضعٍ آخر. وكلماتُ النحل عندنا: بالرسم ١٬٨٤٤، ومع عدِّ واوات العطف كلماتٍ ٢٬٠٩٥ — فلا يبلغ ٢٬٠٨٠ وجهٌ معلوم.\n`;
}
if (found.letter.length) {
  out += `\n## حروفٌ في سور\n\n| الحرف | السورة | عندَه | بقاعدته عندنا | ومعها البسملة | الحكم |\n|---|---|---|---|---|---|\n`;
  for (const f of found.letter) {
    if (!f.su) {
      unscoped++;
      out += `| ${f.name} | — | ${ar(f.n)} | — | — | لم يُعرف نطاقُه فلا يُقابَل |\n`;
      continue;
    }
    const v = surahRasm.get(f.su.surah_no).letters.get(f.L) ?? 0;
    const basmAdd = [...rasm0("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")].filter((c) => c === f.L).length;
    const verdict = f.n === v ? "**يطابق بقاعدته**" : f.n === v + basmAdd ? "**يطابق بها مع البسملة**" : "لا يطابق";
    if (verdict === "لا يطابق") misses++; else if (verdict.includes("البسملة")) partial++; else hits++;
    out += `| ${f.name} (${f.L}) | ${f.su.name_ar} | ${ar(f.n)} | ${ar(v)} | ${ar(v + basmAdd)} | ${verdict} |\n`;
  }
}
if (found.word.length) {
  out += `\n## ألفاظٌ بأعدادها\n\n| اللفظ | عندَه | بالصيغ | المفرد/الجمع | برسمنا | بالرسم الأوّل (مجرّدًا/بسوابقه) | الحكم |\n|---|---|---|---|---|---|---|\n`;
  for (const f of found.word) {
    const o = countOurs(f.w);
    const r = countRasm(f.w);
    const faces = [["بالصيغ", o.total], ["بالمفرد وحدَه", o.singular], ["بالجمع وحدَه", o.plural], ["برسمنا", o.raw], ["بالرسم الأوّل مجرّدًا", r.bare], ["بالرسم الأوّل بسوابقه", r.pref]];
    const hit = faces.find(([, v]) => v === f.n && v > 0);
    if (hit) partial++; else misses++;
    out += `| ${f.w}${f.mush ? " (بمشتقّاتها)" : ""} | ${ar(f.n)} | ${ar(o.total)} | ${ar(o.singular)}/${ar(o.plural)} | ${ar(o.raw)} | ${ar(r.bare)}/${ar(r.pref)} | ${hit ? `**يطابق ${hit[0]}**` : "لا يطابق وجهًا"} |\n`;
  }
}
if (found.co.length) {
  out += `\n## اجتماعُ لفظين في آيةٍ واحدة\n\n| اللفظان | عندَه | عندنا (بسوابقهما) | الحكم |\n|---|---|---|---|\n`;
  for (const f of found.co) {
    const n = cooccur(f.a, f.b);
    if (f.n === n) hits++; else misses++;
    out += `| ${f.a} + ${f.b} | ${ar(f.n)} | ${ar(n)} | ${f.n === n ? "**يطابق**" : "لا يطابق"} |\n`;
  }
}

const total = hits + partial + misses + unscoped;
out += `\n## الحصيلة

${ar(total)} دعوى صريحةَ الرقم التُقطت: **${ar(hits)}** طابقت قاعدتَه المثبتة سواءً،
و**${ar(partial)}** طابقت وجهًا معلَنًا آخر (البسملةُ مضمومة، أو وجهٌ من أوجه عدِّنا)،
و**${ar(misses)}** لم تطابق وجهًا، و**${ar(unscoped)}** لم يُعرف نطاقُها فلا تُقابَل.

**ولا يُستنتج من عدم المطابقة خطأُ حساب**: قد يكون حدُّ المعدود عنده غيرَ
معلومٍ في الصفحة (أيُّ رسمٍ؟ أتُضمُّ البسملة؟ أيدخل المشتقُّ والمثنّى؟) —
فما لم يُعرف حدُّه قيل: لم يتبيّن، ويُطلب من نصّه قبل أيِّ بطاقة.

> **قاعدةُ العدّ تُعلن قبل النتيجة** — الميثاق §ج. والموافقةُ في وجهٍ لا
> تعني إعجازًا، والمخالفةُ لا تعني خطأً.
`;

fs.writeFileSync(path.join(ROOT, "findings", "FAHIS-NUMERIC.md"), out, "utf8");
console.log(`✓ FAHIS-NUMERIC.md — سور:${found.surah.length} حروف:${found.letter.length} ألفاظ:${found.word.length} اجتماع:${found.co.length} | قاعدته:${hits} وجه آخر:${partial} لا يطابق:${misses} بلا نطاق:${unscoped}`);

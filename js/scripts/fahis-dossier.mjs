/**
 * ملفُّ الدعوى — يُخرج **كلَّ ما تملكه مشكاة** عن لفظٍ أو موضعٍ قبل أيِّ حكم.
 *
 * القاعدةُ التي أملاها المالك 2026-07-31: «نستخدم الذكاءَ فقط للقرار الأخير،
 * حيث البياناتُ كلُّها قد برزت وتوفّرت». فهذا الملفُّ يُبرزها: العدُّ التامّ،
 * والمواضعُ بنصوصها، والصيغُ المشتقّة، والمعاجمُ الثلاثة، ومعاني القرآن،
 * وكتبُ الإعراب، والقراءات. ولا حكمَ فيه ألبتّة — الحكمُ يأتي بعدَه، ومعه
 * الملفُّ كلُّه بين اليدين فلا يُبنى على ذاكرةٍ ولا على انطباع.
 *
 * وهذا هو الفرقُ بين حكمٍ مسنَدٍ وحكمٍ مرتجَل: أن يكون الدليلُ **حاضرًا كاملًا**
 * قبل أن يُنطق بالحكم، لا أن يُلتمس بعده تصديقًا لما سبق إلى الذهن.
 *
 * usage: node js/scripts/fahis-dossier.mjs <لفظ|جذر> [--loc s:a] [--full]
 * out:   stdout — ملفٌّ مقروءٌ يُقرأ ثم يُحكم
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const SRC = path.join(ROOT, "js/data/refs-src");
const db = new DatabaseSync(path.join(ROOT, "quran-kg.db"), { readOnly: true });

const args = process.argv.slice(2);
const term = args.find((a) => !a.startsWith("--")) ?? "";
// ‎indexOf يعيد ‎-1 عند غياب الوسيط فيلتقط ما ليس له — فيُشترط وجودُه صراحةً
const locArg = args.includes("--loc") ? args[args.indexOf("--loc") + 1] : null;
const FULL = args.includes("--full");
if (!term && !locArg) { console.error("usage: fahis-dossier.mjs <لفظ|جذر> [--loc s:a] [--full]"); process.exit(1); }

const norm = (s) => (s || "").replace(/[ً-ْٰـۖ-ۭ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ؤ/g, "و")
  .replace(/ئ/g, "ي").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[^؀-ۿ\s]/g, " ").replace(/\s+/g, " ").trim();

const H = (t) => console.log(`\n${"═".repeat(2)} ${t}\n`);
/** مواضعُ الآيات التي فيها المادّة — تُملأ في الاستقراء ثمّ تُستعمل للمراجع */
const AYAH_LOCS = [];
const cut = (s, n = 900) => (s.length > n ? s.slice(0, n) + "…" : s);

console.log(`ملفُّ الدعوى — «${term || locArg}»   (بيانٌ لا حكم)`);

/* ــــ ١) الاستقراءُ التامُّ للمادّة: كلُّ ما في المصحف منها ــــ */
if (term) {
  const rootRow = db.prepare("SELECT root_ar FROM root WHERE root_ar = ?").get(term);
  let root = rootRow?.root_ar ?? null;
  if (!root) {
    // إن لم يكن جذرًا فهو لفظ: يُلتمس جذرُه من وسم الصرف
    const w = db.prepare(
      "SELECT r.root_ar AS r, COUNT(*) n FROM word w JOIN root r ON r.root_id=w.root_id WHERE w.text_clean = ? GROUP BY r.root_ar ORDER BY n DESC LIMIT 1",
    ).get(term);
    root = w?.r ?? null;
  }

  if (root) {
    const rows = db.prepare(`
      SELECT w.location loc, w.text_clean form, a.text_clean ayah
      FROM word w JOIN ayah a ON a.surah_no = CAST(substr(w.location,1,instr(w.location,':')-1) AS INT)
        AND a.ayah_no = CAST(substr(substr(w.location, instr(w.location,':')+1), 1,
              instr(substr(w.location, instr(w.location,':')+1), ':')-1) AS INT)
      JOIN root r ON r.root_id = w.root_id
      WHERE r.root_ar = ? ORDER BY w.word_id`).all(root);
    const forms = [...new Set(rows.map((r) => r.form))];
    const ayat = [...new Set(rows.map((r) => r.loc.split(":").slice(0, 2).join(":")))];
    H(`الاستقراءُ التامُّ للمادّة «${root}»`);
    console.log(`المواضع: ${rows.length} · الآيات: ${ayat.length} · الصيغ: ${forms.length}`);
    console.log(`الصيغ: ${forms.join(" · ")}`);
    console.log("");
    const seen = new Set();
    for (const r of rows) {
      const loc = r.loc.split(":").slice(0, 2).join(":");
      if (seen.has(loc)) continue;
      seen.add(loc);
      AYAH_LOCS.push(loc);
      console.log(`  ${loc}  [${r.form}]  ${cut(r.ayah, FULL ? 4000 : 200)}`);
    }
  }

  /* ــــ ٢) العدُّ اللفظيُّ ومعدّلُ الصدفة ــــ */
  const ayahs = db.prepare("SELECT location, text_clean FROM ayah").all();
  const nq = norm(term);
  let hits = 0, inAyat = 0;
  for (const a of ayahs) {
    const m = ` ${norm(a.text_clean)} `.split(` ${nq} `).length - 1;
    if (m > 0) { hits += m; inAyat++; }
  }
  const freq = new Map();
  for (const a of ayahs) for (const w of norm(a.text_clean).split(" ")) if (w) freq.set(w, (freq.get(w) ?? 0) + 1);
  const same = hits ? [...freq.values()].filter((c) => c === hits).length - 1 : 0;
  H("العدُّ اللفظيُّ ومعدّلُ الصدفة");
  console.log(`«${term}» بالصيغة المجرّدة: ${hits} موضعًا في ${inAyat} آية`);
  console.log(`ويشاركه في هذا العدد ${Math.max(0, same)} لفظًا آخرَ من ${freq.size} — فالعددُ وحدَه ${same > 3 ? "لا يدلّ" : "قد يدلّ بقرينة"}`);

  /* ــــ ٣) المعاجم (الرتبة ٢) ــــ */
  if (root) {
    H("المعاجمُ — الرتبة ٢ (حجّةٌ في المعنى الوضعيّ، والأقدمُ مقدَّم)");
    for (const f of ["sihah", "asas", "lisan"]) {
      const p = path.join(SRC, "lex", `${f}.json`);
      if (!fs.existsSync(p)) continue;
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      const e = j.entries[root];
      if (!e) { console.log(`— ${j.meta.label}: لا مدخل`); continue; }
      console.log(`▸ ${j.meta.label} — ${j.meta.author} (ت${j.meta.died})\n  ${cut(e, FULL ? 6000 : 1200)}\n`);
    }
  }
}

/* ــــ ٤) ما عند المراجع المرساةِ بالآية ــــ */
const locs = locArg ? [locArg] : AYAH_LOCS;

if (locs.length) {
  H("كتبُ المعاني والإعراب والقراءات — الرتبتان ١ و٣");
  for (const dir of ["maani", "iraab", "qiraat"]) {
    const d = path.join(SRC, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".json"))) {
      const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
      for (const loc of locs) {
        const e = j.entries?.[loc];
        if (!e) continue;
        console.log(`▸ [${loc}] ${j.meta.label} — ${j.meta.author}${j.meta.died ? ` (ت${j.meta.died})` : ""}`);
        console.log(`  ${cut(Array.isArray(e) ? e.join(" ") : e, FULL ? 6000 : 1000)}\n`);
      }
    }
  }
}

console.log("\n" + "─".repeat(60));
console.log("انتهى الملفّ. لا حكمَ فيه — الحكمُ يُبنى عليه بعدَ قراءته كاملًا.");

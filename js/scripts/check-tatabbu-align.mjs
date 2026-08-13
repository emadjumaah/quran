/**
 * مسابرُ محرّك المحاذاة — **ما يمكن إثباتُه آليًّا قبل أن يتلوَ أحدٌ بصوته.**
 *
 * المسبارُ الميدانيُّ (ص-م١) يقيس **المحرّكَ والمحاذاةَ والقارئَ والجهاز** معًا،
 * ولا يقع إلّا بصوتٍ حقيقيّ. وهذه السكربتُ تفصل عن ذلك ما **يُقاس بلا صوت**:
 * سلوكَ المحاذاة وحدَها إذا وصلها نصٌّ من محرّكٍ متعثّر. فتُغذّى بنصّ المصحف
 * نفسِه بعد تشويشٍ **حتميٍّ معلَن** يحاكي ما تُخرجه محرّكاتُ التعرّف: إسقاطَ
 * الكلمات القصيرة، وجمعَ كلمتين في رمز، وإبدالَ حرفٍ، وقفزَ آيةٍ، والبدءَ من
 * وسط النصّ، والترجيعَ والتكرار.
 *
 * **وحدُّ ما تثبته هذه السكربت**: أنّ المحاذاةَ تحتمل هذه العوارض. **ولا تثبت
 * البتّةَ** أنّ محرّكَ المتصفّح يسمع تلاوةَ قارئٍ حقيقيّ — فذاك مجهولُ ص-م١
 * التجريبيّ، ولا يُقضى فيه إلّا بصوت المالك على جهازه.
 *
 * **ولا عشوائيّةَ فيها**: مولّدٌ خطّيٌّ ببذرةٍ ثابتة، فالنتيجةُ تُعاد بحروفها،
 * وأيُّ تغيّرٍ فيها تغيّرٌ في المحاذاة لا في الحظّ.
 *
 * التشغيل: node js/scripts/check-tatabbu-align.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "apps", "studio", "src");
const SAWT = join(SRC, "lib", "sawt");

/* ═══════════ تحميلُ المحاذاة الحيّة كما هي ═══════════
   يُنسخ المصدرُ الحيُّ بحروفه إلى مجلّدٍ مؤقّت، ولا يُبدَّل منه إلّا **لاحقةُ
   المستورَد** (فمُحمّلُ العقد يشترط الامتداد صريحًا) — فالمفحوصُ هو الشيفرةُ
   العاملةُ نفسُها لا نسخةٌ عنها. */
const tmp = mkdtempSync(join(tmpdir(), "tatabbu-align-"));
try {
  copyFileSync(join(SRC, "lib", "arabicSearch.ts"), join(tmp, "arabicSearch.ts"));
  for (const f of ["align.ts", "metrics.ts"]) {
    const body = readFileSync(join(SAWT, f), "utf8")
      .replaceAll('from "../arabicSearch"', 'from "./arabicSearch.ts"')
      .replaceAll('from "./align"', 'from "./align.ts"')
      .replaceAll('from "./script"', 'from "./script.ts"');
    writeFileSync(join(tmp, f), body);
  }
  // `script.ts` يمسّ قاعدةَ المتصفّح فلا يُحمَّل ههنا؛ ومستوردُه في `metrics`
  // مستوردُ نوعٍ يُمحى عند التجريد — فيُكتفى بجذعٍ فارغٍ يرضي المحلّل.
  writeFileSync(join(tmp, "script.ts"), "export type SawtScript = { id: string; title: string; words: { location: string }[] };\n");

  const align = await import(pathToFileURL(join(tmp, "align.ts")).href);
  const metrics = await import(pathToFileURL(join(tmp, "metrics.ts")).href);
  await run(align, metrics);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

async function run(align, metrics) {
  const { DEFAULT_ALIGN, alignUtterance, speechTokens } = align;
  const { SawtMeter } = metrics;

  /* ═══════════ المقاطعُ من القاعدة ═══════════ */
  const db = new DatabaseSync(join(ROOT, "quran-app.db"), { readOnly: true });
  const ayahRows = db.prepare("select data from ayahs").all().map((r) => JSON.parse(r.data));
  const wordRows = db
    .prepare("select surahNo, ayahNo, wordNo, data from words order by surahNo, ayahNo, wordNo")
    .all()
    .map((w) => ({ ...w, text: JSON.parse(w.data).textUthmani }));

  const wordsOf = (filter) =>
    wordRows
      .filter(filter)
      .map((w) => ({ location: `${w.surahNo}:${w.ayahNo}:${w.wordNo}`, text: w.text, surahNo: w.surahNo, ayahNo: w.ayahNo }));

  const pageAyahs = new Set(
    ayahRows.filter((a) => a.page === 42).map((a) => `${a.surahNo}:${a.ayahNo}`),
  );

  const SEGMENTS = [
    { id: "qisar", title: "القصار الثلاث", words: [109, 112, 97].flatMap((s) => wordsOf((w) => w.surahNo === s)) },
    { id: "safha-42", title: "صفحة ٤٢", words: wordsOf((w) => pageAyahs.has(`${w.surahNo}:${w.ayahNo}`)) },
  ];

  /* ═══════════ مولّدٌ حتميّ ═══════════ */
  const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  /** حروفٌ يُبدَل بها حرفٌ واحدٌ محاكاةً لخطأ المحرّك */
  const SWAP = "دذسشصضطظعغفقكلمنهوي";

  /**
   * محاكاةُ ما يُخرجه محرّكُ تعرّفٍ متعثّر: نصٌّ معياريٌّ بلا ضبط، تسقط منه
   * كلماتٌ قصيرة، وتلتحم كلمتان، ويُبدَّل حرفٌ. ثمّ يُبثُّ جُملًا كما تُبثّ
   * نتائجُ المحرّك: تنمو جزئيّةً ثمّ تُختم.
   */
  function fakeEngine(words, opts) {
    const r = rng(opts.seed ?? 7);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      let t = speechTokens(words[i].text)[0];
      if (!t) continue;
      if (opts.dropShort && t.length <= 3 && r() < opts.dropShort) continue;
      if (opts.swap && r() < opts.swap && t.length > 3) {
        const at = 1 + Math.floor(r() * (t.length - 2));
        t = t.slice(0, at) + SWAP[Math.floor(r() * SWAP.length)] + t.slice(at + 1);
      }
      if (opts.merge && out.length && r() < opts.merge) out[out.length - 1] += t;
      else out.push(t);
    }
    return out;
  }

  /** بثُّ الرموز جُملًا: كلُّ جملةٍ تنمو جزئيّةً ثمّ تُختم — كما يفعل المحرّك */
  function feed(script, tokens, startAt, chunk = 5) {
    const norms = script.map((w) => w.norm);
    const meter = new SawtMeter({ id: "x", title: "x", words: script });
    let anchor = startAt;
    let cursor = startAt;
    for (let i = 0; i < tokens.length; i += chunk) {
      const utter = tokens.slice(i, i + chunk);
      for (let k = 1; k <= utter.length; k++) {
        const step = alignUtterance(norms, utter.slice(0, k), anchor, DEFAULT_ALIGN);
        cursor = step.cursor;
        if (k === utter.length) {
          meter.commit(step, anchor);
          anchor = step.cursor;
        }
      }
    }
    const report = meter.finish({
      condition: "محاكاة",
      engineLabel: "محاكاة",
      restarts: 0,
      manualSkips: 0,
      autoAdvances: 0,
      waqfMeasured: false,
      longestSilenceMs: null,
    });
    return { report, cursor };
  }

  const withNorm = (words) => words.map((w) => ({ ...w, norm: speechTokens(w.text)[0] ?? "" }));

  /* ═══════════ المشاهدُ ═══════════ */
  const cases = [];
  const check = (name, want, got, ok) => cases.push({ name, want, got, ok });

  for (const seg of SEGMENTS) {
    const script = withNorm(seg.words);

    // ١ — نصٌّ نظيف: لا عذرَ للمحاذاة ههنا
    {
      const toks = fakeEngine(seg.words, {});
      const { report } = feed(script, toks, 0);
      const pct = Math.round(report.hits.rate * 1000) / 10;
      check(`${seg.title} · نصٌّ نظيف`, "إصابة ١٠٠٪ · قفزٌ كاذب ٠", `${pct}٪ · ${report.falseJumps}`, pct === 100 && report.falseJumps === 0);
    }

    // ٢ — إسقاطُ نصف الكلمات القصيرة (المحرّكاتُ تُسقطها كثيرًا)
    {
      const toks = fakeEngine(seg.words, { dropShort: 0.5, seed: 11 });
      const { report } = feed(script, toks, 0);
      const pct = Math.round(report.hits.rate * 1000) / 10;
      check(`${seg.title} · إسقاطُ القصار`, "إصابة ≥ ٩٠٪ · قفزٌ كاذب ≤ ١", `${pct}٪ · ${report.falseJumps}`, pct >= 90 && report.falseJumps <= 1);
    }

    // ٣ — تشويشٌ حرفيّ والتحامُ كلمتين
    {
      const toks = fakeEngine(seg.words, { swap: 0.15, merge: 0.08, seed: 23 });
      const { report } = feed(script, toks, 0);
      const pct = Math.round(report.hits.rate * 1000) / 10;
      check(`${seg.title} · تشويشٌ والتحام`, "إصابة ≥ ٩٠٪ · قفزٌ كاذب ≤ ١", `${pct}٪ · ${report.falseJumps}`, pct >= 90 && report.falseJumps <= 1);
    }
  }

  // ٤ — فخُّ التشابه: الكافرون فيها موضعان متطابقان. المؤشّرُ لا يقفز بينهما.
  {
    const script = withNorm(wordsOf((w) => w.surahNo === 109));
    const toks = fakeEngine(script, {});
    const { report, cursor } = feed(script, toks, 0);
    const pct = Math.round(report.hits.rate * 1000) / 10;
    check("فخُّ التشابه (الكافرون)", "بلوغُ آخر السورة · قفزٌ كاذب ٠", `الموضع ${cursor}/${script.length} · ${report.falseJumps}`, cursor === script.length && report.falseJumps === 0 && pct === 100);
  }

  // ٥ — قفزُ آيةٍ عمدًا: تمرينُ الاسترداد المنصوصُ في المحكّ
  {
    const all = wordsOf((w) => pageAyahs.has(`${w.surahNo}:${w.ayahNo}`));
    const script = withNorm(all);
    const skipAyah = all[0].ayahNo + 1;
    const recited = all.filter((w) => w.ayahNo !== skipAyah);
    const toks = fakeEngine(recited, {});
    const { report, cursor } = feed(script, toks, 0);
    const worst = report.losses.worst;
    check("قفزُ آيةٍ عمدًا", "استردادٌ ≤ ٣ كلمات · وبلوغُ الآخر", `أبعدُ استرداد ${worst ?? "بلا فقد"} · الموضع ${cursor}/${script.length}`, (worst == null || worst <= 3) && cursor === script.length);
  }

  // ٦ — قفزٌ بعيدٌ يتجاوز النافذة: هنا وحدَه يُستدعى الاستردادُ الواسع.
  //     (وقفزُ الآية القصيرة تبتلعه النافذةُ فلا يقع فقدٌ أصلًا — وذلك أحسنُ
  //      للقارئ، لكنّه لا يجرّب الاسترداد. فيُجرَّب ههنا صريحًا.)
  {
    const all = wordsOf((w) => pageAyahs.has(`${w.surahNo}:${w.ayahNo}`));
    const script = withNorm(all);
    const recited = [...all.slice(0, 20), ...all.slice(55)];
    const toks = fakeEngine(recited, {});
    const { report, cursor } = feed(script, toks, 0);
    const worst = report.losses.worst;
    check(
      "قفزٌ بعيدٌ يتجاوز النافذة",
      "يقع فقدٌ · ويُستردّ في ≤ ٣ كلمات · ويبلغ الآخر",
      `فقد ${report.losses.count} · أبعدُ استرداد ${worst ?? "—"} · بلا عودة ${report.losses.unresolved} · الموضع ${cursor}/${script.length}`,
      report.losses.count >= 1 && report.losses.unresolved === 0 && worst != null && worst <= 3 && cursor === script.length,
    );
  }

  // ٧ — بدءٌ من وسط النصّ: القارئُ لا يبدأ من أوّل الصفحة دائمًا
  {
    const all = wordsOf((w) => pageAyahs.has(`${w.surahNo}:${w.ayahNo}`));
    const script = withNorm(all);
    const from = 40;
    const toks = fakeEngine(all.slice(from), {});
    const { cursor } = feed(script, toks, 0);
    check("بدءٌ من وسط النصّ", "يلتقط الموضعَ ويبلغ الآخر", `الموضع ${cursor}/${script.length}`, cursor === script.length);
  }

  // ٧ — ترجيعٌ وتكرار: المؤشّرُ لا يقهقر
  {
    const all = wordsOf((w) => w.surahNo === 97);
    const script = withNorm(all);
    const repeated = [...all.slice(0, 8), ...all.slice(4, 8), ...all.slice(8)];
    const toks = fakeEngine(repeated, {});
    const { cursor, report } = feed(script, toks, 0);
    check("ترجيعٌ وتكرار", "لا قهقرة · وبلوغُ الآخر", `الموضع ${cursor}/${script.length} · قفزٌ كاذب ${report.falseJumps}`, cursor === script.length && report.falseJumps === 0);
  }

  /* ═══════════ الخلاصة ═══════════ */
  const passed = cases.filter((c) => c.ok).length;
  console.log(`مسابرُ المحاذاة: ${passed}/${cases.length} سليمة`);
  for (const c of cases) console.log(`  ${c.ok ? "✓" : "✗"} ${c.name} — المنتظر: ${c.want} · الواقع: ${c.got}`);
  console.log("  (هذه تقيس المحاذاةَ وحدَها بنصٍّ مشوَّشٍ حتميّ — ولا تقول شيئًا عن سمع المحرّك لصوتٍ حقيقيّ)");
  if (passed !== cases.length) process.exitCode = 1;
}

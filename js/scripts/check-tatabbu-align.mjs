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
/** شيفرةُ المسبار ومحلِّلُ العربيّة في الحزمة المشتركة منذ التقسيم الصامت (ف١) */
const SRC = join(ROOT, "js", "packages", "quran-core", "src");
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
  writeFileSync(join(tmp, "script.ts"), "export type SawtScript = { id: string; title: string; words: { location: string }[] };\nexport type AyahRef = { surahNo: number; ayahNo: number; juz: number; page: number };\n");
  // **وفهرسُ الالتقاط يُحمَّل حيًّا كما هو** — ولا يُبدَّل منه إلّا مستوردُ
  // القاعدة (فهي شأنُ المتصفّح)، وبانيه `IltiqatIndex` صافٍ لا يمسّها.
  writeFileSync(join(tmp, "db.ts"), "export async function allAyahs() { return []; }\n");
  writeFileSync(
    join(tmp, "iltiqat.ts"),
    readFileSync(join(SAWT, "iltiqat.ts"), "utf8")
      .replaceAll('from "../../db"', 'from "./db.ts"')
      .replaceAll('from "../arabicSearch"', 'from "./arabicSearch.ts"')
      .replaceAll('from "./script"', 'from "./script.ts"'),
  );

  const align = await import(pathToFileURL(join(tmp, "align.ts")).href);
  const metrics = await import(pathToFileURL(join(tmp, "metrics.ts")).href);
  const iltiqat = await import(pathToFileURL(join(tmp, "iltiqat.ts")).href);
  await run(align, metrics, iltiqat);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

async function run(align, metrics, iltiqat) {
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
  /** رموزُ نصٍّ بالمطبِّع الحيّ نفسِه — تُستعمل في مسابر الالتقاط */
  const tokensOf = (t) => speechTokens(t);

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

  /* ═══════════ ٨ — الالتقاطُ من أيّ آية (ص-م٤ §٢) ═══════════
     **مسابرُ بدءٍ من مواضعَ بعيدةٍ متفرّقة** والمؤشّرُ في أوّل المصحف: يُوجَد
     الصحيحُ ولا قفزَ كاذب · **وثلاثيّةٌ مكرّرةٌ عمدًا** فلا يُقفَز حتّى تنحصر ·
     **وضبطٌ سالبٌ**: ثلاثيّةٌ مضلِّلةٌ تُزرع فيُشهد أنّ الحارسَ يمنع القفز.
     والفهرسُ **الحيُّ نفسُه** يُبنى ههنا على المصحف كلِّه من القاعدة. */
  {
    const { IltiqatIndex, judge, NEAR_WORDS } = iltiqat;
    const t0 = Date.now();
    const index = new IltiqatIndex(
      ayahRows
        .slice()
        .sort((a, b) => a.surahNo - b.surahNo || a.ayahNo - b.ayahNo)
        .map((a) => ({ surahNo: a.surahNo, ayahNo: a.ayahNo, juz: a.juz, page: a.page, text: a.textUthmani })),
    );
    const buildMs = Date.now() - t0;
    const all = () => true;
    /** رموزُ مدًى من كلمات المصحف كما يخرجها المحرّكُ (بلا تشويش) */
    const say = (s, a, from, count) =>
      wordRows
        .filter((w) => w.surahNo === s && w.ayahNo === a && w.wordNo >= from && w.wordNo < from + count)
        .map((w) => speechTokens(w.text)[0])
        .filter(Boolean);

    /** المنتظرُ يُحسب من القاعدة نفسِها لا يُكتب رقمًا — والكلماتُ تُعدّ من نصّ
        الآيات لا من جدول المفردات، فبينهما خمسةُ مواضعَ تختلف قسمتُها (وهي
        المستثناةُ المعلَنةُ في بوّابة التتبّع). */
    const wantWords = ayahRows.reduce((n, a) => n + tokensOf(a.textUthmani).length, 0);
    const wantTri = (() => {
      const set = new Set();
      for (const a of ayahRows) {
        const t = tokensOf(a.textUthmani);
        for (let i = 0; i + 2 < t.length; i++) set.add(t.slice(i, i + 3).join(" "));
      }
      return set.size;
    })();
    check(
      "فهرسُ الالتقاط يُبنى على المصحف كلِّه",
      `كلماتٌ ${wantWords} · ثلاثيّاتٌ ${wantTri}`,
      `كلمات ${index.wordCount} · ثلاثيّات ${index.trigramCount} · بُني في ${buildMs} مِث`,
      index.wordCount === wantWords && index.trigramCount === wantTri,
    );

    // مواضعُ بعيدةٌ متفرّقة — والمؤشّرُ في أوّل المصحف (الفاتحة، الموضع ٠)
    for (const [name, s, a] of [["أوّلُ الكهف", 18, 1], ["وسطُ النساء", 4, 90], ["آخرُ الملك", 67, 30]]) {
      const toks = say(s, a, 1, 7);
      const v = judge(index, toks, all, 0);
      check(
        `التقاطٌ من ${name}`,
        `قفزٌ إلى ${s}:${a}:1`,
        v.kind === "jump" ? `${v.hit.location}` : `الحكم: ${v.kind}${v.kind === "many" ? ` (${v.count})` : ""}`,
        v.kind === "jump" && v.hit.surahNo === s && v.hit.ayahNo === a && v.hit.wordNo === 1,
      );
    }

    // **ثلاثيّةٌ مكرّرةٌ عمدًا**: مطلعُ آيةٍ تتكرّر بحروفها في سورةٍ واحدة —
    // تُخرج مواضعَ فلا يُقفَز؛ ثمّ تُضمّ كلماتٌ تالية فتنحصر بواحد.
    {
      const repeated = ayahRows.filter((x) => x.surahNo === 55);
      const counts = new Map();
      for (const x of repeated) {
        const k = tokensOf(x.textUthmani).slice(0, 3).join(" ");
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const [key, times] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
      const v = judge(index, key.split(" "), all, 0);
      check(
        "ثلاثيّةٌ مكرّرةٌ لا يُقفَز عليها",
        `مواضعُ لا تنحصر (تكرّرت ${times} مرّة)`,
        `الحكم: ${v.kind}${v.kind === "many" ? ` (${v.count})` : ""}`,
        v.kind === "many" && v.count > 1,
      );
      // **وبضمّ ما بعدها تنحصر بواحد**: والآيةُ المكرّرةُ مكرّرةٌ بتمامها، فلا
      // يضيّقها إلّا ما **يليها** في المصحف — وهو ما يفعله القارئُ إذ يمضي.
      const one = repeated.find((x) => tokensOf(x.textUthmani).slice(0, 3).join(" ") === key);
      const after = repeated.find((x) => x.ayahNo === one.ayahNo + 1);
      const wide = [...tokensOf(one.textUthmani), ...tokensOf(after.textUthmani).slice(0, 5)];
      const v2 = judge(index, wide, all, 0);
      check(
        "ثمّ تنحصر بضمّ ما بعدها",
        `قفزٌ إلى ${one.location}:1`,
        v2.kind === "jump" ? v2.hit.location : `الحكم: ${v2.kind}${v2.kind === "many" ? ` (${v2.count})` : ""}`,
        v2.kind === "jump" && v2.hit.surahNo === one.surahNo && v2.hit.ayahNo === one.ayahNo,
      );
    }

    // **الترجيعُ لا يُلتقَط**: ما وقع في جوار المؤشّر يتولّاه المحلّيُّ
    {
      const near = say(18, 1, 1, 7);
      const at = index.flatOf("18:1:1");
      const v = judge(index, near, all, at + 3);
      check(
        "ترجيعٌ في الجوار لا يُقفَز عليه",
        `الحكم: قريب (دون ${NEAR_WORDS} كلمة)`,
        `الحكم: ${v.kind}`,
        v.kind === "near",
      );
    }

    // **ويعمل داخل المقطع المختار**: موضعٌ خارجَه لا يُلتقَط
    {
      const toks = say(18, 1, 1, 7);
      const v = judge(index, toks, (a) => a.surahNo === 2, 0);
      check("لا يُلتقَط ما خرج عن المقطع", "الحكم: لا شيء", `الحكم: ${v.kind}`, v.kind === "none");
    }

    // **الضبطُ السالب**: ثلاثيّةٌ مضلِّلةٌ تُزرع — رموزٌ ليست من المصحف تُلحق
    // بثلاثيّةٍ صحيحة، فيُشهد أنّ التحقّقَ من الكلمات كلِّها يمنع القفز.
    {
      const toks = [...say(18, 1, 1, 3), "زعموا", "كذبا", "مفترى", "ليس", "منه"];
      const v = judge(index, toks, all, 0);
      check(
        "ضبطٌ سالب: ثلاثيّةٌ مضلِّلة",
        "لا قفزَ — الرموزُ لا تطابق موضعًا",
        `الحكم: ${v.kind}`,
        v.kind === "none",
      );
      // وبإزائه بريءٌ لا يُصطاد: الرموزُ الصحيحةُ نفسُها تُلتقَط
      const clean = say(18, 1, 1, 8);
      const v2 = judge(index, clean, all, 0);
      check("وبريءٌ لا يُمنع", "قفزٌ إلى 18:1:1", v2.kind === "jump" ? v2.hit.location : v2.kind, v2.kind === "jump");
    }
  }

  /* ═══════════ الخلاصة ═══════════ */
  const passed = cases.filter((c) => c.ok).length;
  console.log(`مسابرُ المحاذاة: ${passed}/${cases.length} سليمة`);
  for (const c of cases) console.log(`  ${c.ok ? "✓" : "✗"} ${c.name} — المنتظر: ${c.want} · الواقع: ${c.got}`);
  console.log("  (هذه تقيس المحاذاةَ وحدَها بنصٍّ مشوَّشٍ حتميّ — ولا تقول شيئًا عن سمع المحرّك لصوتٍ حقيقيّ)");
  if (passed !== cases.length) process.exitCode = 1;
}

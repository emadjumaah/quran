/**
 * مسابرُ **الاصطياد الصوتيّ** — التسميعُ يمسك الانزلاقَ إلى النظيرة (ن٢).
 *
 * أختٌ لـ`check-tatabbu-align.mjs` على نمطها نفسِه: **نصٌّ حتميٌّ لا صوت**، وشيفرةٌ
 * حيّةٌ تُحمَّل كما هي لا نسخةٌ عنها. وأُفردت في ملفٍّ لأنّ مسابرَ المحاذاة القائمةَ
 * **تبقى إحدى وعشرين بحروفها** فلا يختلط عددٌ بعدد.
 *
 * وخمسةُ أبوابٍ تُفحص، ولكلٍّ إزاؤه:
 *
 *   أ — **الانزلاقُ يُصطاد بزوجه الصحيح**: يُصطنع من المادّة نفسِها أن يتلوَ
 *       الحافظُ آيةً إلى مفرقها ثمّ يمضيَ في **فرع النظيرة** — فيُشترط أن يُصطاد،
 *       وأن يكون المفتاحُ **مفتاحَ زوجه** لا مفتاحَ غيره.
 *   ب — **المستقيمُ لا يُتَّهم**: تُتلى كلُّ آيةٍ ذاتِ نظيرٍ مستقيمةً تامّةً —
 *       **فصفرُ اتّهامٍ شرطٌ لا نسبة**.
 *   ج — **حيادٌ عابرٌ دون العتبة**: كلمتان من النظيرة ثمّ عودةٌ — **صفرُ اتّهام**.
 *   د — **آيةٌ بلا نظير**: تُتلى وتُحاد فيها حيدةً واسعة — **المسارُ لا يعمل
 *       أصلًا** (ولا موضعَ لها في الفهرس).
 *   هـ — **البابُ مغلق**: تُعاد صورةُ (أ) نفسُها **بلا إعدادِ اصطياد** — فلا يخرج
 *       حدثٌ ألبتّة؛ وهو الشاهدُ على أنّ القارئَ والمصلّيَ لا يمسّهما شيء.
 *
 * **والضبطُ السالب**: تُحمَّل المحاذاةُ الحيّةُ **بعتبةٍ مزروعةٍ واحدةً** بدل
 * الثلاث، ثمّ يُعاد بابُ (ب) بحروفه — **فيُشترط أن يُتَّهم المستقيمُ حينئذٍ**.
 * فإن لم يُتّهم فليست العتبةُ هي التي تحميه، والدعوى في وصفها لا في عملها.
 * **وزرعٌ لا أثرَ له ليس ضبطًا**: يُشترط وقوعُ الاستبدال في المصدر المنسوخ.
 *
 * **وما تجتزئه هذه السكربتُ من الحيّ**: المحاذاةُ وثوابتُ الاصطياد من
 * `lib/sawt/align.ts`، وبناءُ الفهرس وقراءةُ المفارق والتحقّقُ من المحاذاة من
 * `apps/tilawa/src/furuq.ts`، والمطبِّعُ من محلِّل العربيّة، وقاعدةُ علامات الوقف
 * من `apps/tilawa/src/mushaf.ts`، وعِدّةُ السور من فهرس المصحف. **وشقُّ الآية
 * كلماتٍ يُعاد ههنا سطرًا واحدًا** على القاعدة الحيّة نفسِها (كما في
 * `check-tathbit.mjs`) — وهو المُجتزأُ الوحيدُ الذي يُكتب، وحرفيّةُ الشقّ محروسةٌ
 * في بوّابتها لا ههنا.
 *
 * وحدُّ ما تثبته: أنّ الآلةَ تمسك انزلاقًا مصطنَعًا من نصٍّ حتميّ. **ولا تقول
 * شيئًا** عن سمع المحرّك لتلاوةِ إنسانٍ بصوته.
 *
 * التشغيل: node js/scripts/check-tatabbu-hunt.mjs
 */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORE = join(ROOT, "js", "packages", "quran-core", "src");
const SAWT = join(CORE, "lib", "sawt");
const APP = join(ROOT, "js", "apps", "tilawa", "src");
const ASSETS = join(ROOT, "js", "packages", "quran-assets", "assets");

const read = (p) => readFileSync(p, "utf8");
const missing = [];

/* ═══════════ اجتزاءُ القواعد الصغيرة من مصادرها الحيّة ═══════════ */

const waqfRe = read(join(APP, "mushaf.ts")).match(/const WAQF_ONLY = (\/.*\/);/);
if (!waqfRe) missing.push("WAQF_ONLY — تعذّرت من نصّ المصحف الحيّ");
const WAQF_ONLY = waqfRe ? eval(waqfRe[1]) : /^$/;

const countsRe = read(join(SAWT, "mushafIndex.ts")).match(/export const AYAH_COUNTS = \[([\s\S]*?)\];/);
if (!countsRe) missing.push("AYAH_COUNTS — تعذّرت من فهرس المصحف");
const AYAH_COUNTS = countsRe
  ? countsRe[1].split(",").map((x) => Number(x.trim())).filter(Number.isFinite)
  : [];
const OFFSET = [0];
for (let i = 0; i < AYAH_COUNTS.length; i++) OFFSET.push(OFFSET[i] + AYAH_COUNTS[i]);
const LAST = OFFSET[OFFSET.length - 1];
const globalIdOf = (s, a) => OFFSET[s - 1] + a;
const locationOf = (id) => {
  let s = 1;
  while (s < 114 && id > OFFSET[s]) s++;
  return [s, id - OFFSET[s - 1]];
};

/* ═══════════ تحميلُ الشيفرة الحيّة كما هي ═══════════
   تُنسخ المصادرُ بحروفها إلى مجلّدٍ مؤقّت، ولا يُبدَّل منها إلّا **لاحقةُ
   المستورَد ووجهةُ ما يمسّ المتصفّح** — فالمفحوصُ هو العاملُ نفسُه. */

/** يُجهّز مجلّدًا مؤقّتًا فيه المحاذاةُ الحيّةُ وبانيةُ الفهرس، ويعيدهما */
async function liveModules(dir, mutate) {
  copyFileSync(join(CORE, "lib", "arabicSearch.ts"), join(dir, "arabicSearch.ts"));
  let align = read(join(SAWT, "align.ts")).replaceAll('from "../arabicSearch"', 'from "./arabicSearch.ts"');
  if (mutate) align = mutate(align);
  writeFileSync(join(dir, "align.ts"), align);
  /* شقُّ الآية كلماتٍ — **بالقاعدة الحيّة نفسِها** (`WAQF_ONLY` أعلاه) */
  writeFileSync(
    join(dir, "mushafShim.ts"),
    "const WAQF_ONLY = " + (waqfRe ? waqfRe[1] : "/^$/") + ";\n" +
      "export interface Mushaf { ayahs: { text: string }[] }\n" +
      "export function ayahTokens(_id: number, text: string) {\n" +
      "  let no = 0;\n" +
      "  return text.split(\" \").map((t) => {\n" +
      "    const word = !WAQF_ONLY.test(t);\n" +
      "    if (word) no++;\n" +
      "    return { text: t, no: word ? no : 0, ord: no };\n" +
      "  });\n" +
      "}\n",
  );
  writeFileSync(
    join(dir, "coreShim.ts"),
    "export { normalizeAr, stemAr } from \"./arabicSearch.ts\";\n" +
      `export const LAST_AYAH = ${LAST};\n` +
      `const OFFSET = ${JSON.stringify(OFFSET)};\n` +
      "export const globalIdOf = (s: number, a: number): number => OFFSET[s - 1] + a;\n",
  );
  writeFileSync(
    join(dir, "furuq.ts"),
    read(join(APP, "furuq.ts"))
      .replaceAll('from "@mishkat/quran-core/lib/sawt/align"', 'from "./align.ts"')
      .replaceAll('from "@mishkat/quran-core"', 'from "./coreShim.ts"')
      .replaceAll('from "./mushaf"', 'from "./mushafShim.ts"'),
  );
  return {
    align: await import(pathToFileURL(join(dir, "align.ts")).href),
    furuq: await import(pathToFileURL(join(dir, "furuq.ts")).href),
  };
}

const tmp = mkdtempSync(join(tmpdir(), "tatabbu-hunt-"));
const tmpNeg = mkdtempSync(join(tmpdir(), "tatabbu-hunt-neg-"));
try {
  const live = await liveModules(tmp, null);
  /** **الزرعُ**: العتبةُ تُخفَّض إلى كلمةٍ واحدة — ويُشترط وقوعُه */
  let planted = false;
  const neg = await liveModules(tmpNeg, (src) => {
    const out = src.replace("export const HUNT_RUN = 3;", "export const HUNT_RUN = 1;");
    planted = out !== src;
    return out;
  });
  await run(live, neg, planted);
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(tmpNeg, { recursive: true, force: true });
}

async function run(live, neg, planted) {
  const { DEFAULT_ALIGN, alignUtterance, HUNT_RUN, HUNT_STEP, HUNT_CLEAR } = live.align;
  const { normalizeAr } = await import(pathToFileURL(join(tmp, "arabicSearch.ts")).href);

  /* ═══════════ نصُّ المصحف والمادّة — من أصلهما المشحون ═══════════ */
  const mushafText = JSON.parse(read(join(ASSETS, "mushaf-text.json"))).text;
  const raw = JSON.parse(read(join(ASSETS, "furuq.json")));

  /** كلماتُ آيةٍ من رسمها — علاماتُ الوقف مطروحة (قسمةُ الصفحة نفسُها) */
  const cut = new Map();
  const wordsAt = (id) => {
    let w = cut.get(id);
    if (!w) cut.set(id, (w = mushafText[id - 1].split(" ").filter((x) => !WAQF_ONLY.test(x))));
    return w;
  };
  const normCut = new Map();
  const normsAt = (id) => {
    let w = normCut.get(id);
    if (!w) normCut.set(id, (w = wordsAt(id).map(normalizeAr)));
    return w;
  };

  /* ═══════════ المادّةُ كما يبنيها التطبيق ═══════════ */
  const idOf = (loc) => {
    const [s, a] = loc.split(":").map(Number);
    return globalIdOf(s, a);
  };
  const pairs = [];
  for (const p of raw.furuq) {
    const idA = idOf(p.a);
    const idB = idOf(p.b);
    if (!live.furuq.alignsWith(p, wordsAt(idA), wordsAt(idB))) continue;
    if (!p.ops.some((o) => typeof o !== "string")) continue; // توأمٌ تامّ — لا مفرقَ فيه
    const forks = live.furuq.forksOf(p.ops, p.win ?? null).filter((f) => f.lead >= live.furuq.MIN_LEAD);
    if (!forks.length) continue;
    pairs.push({
      key: idA <= idB ? `${p.a}|${p.b}` : `${p.b}|${p.a}`,
      a: p.a, b: p.b, idA, idB, ops: p.ops, win: p.win ?? null, forks,
    });
  }
  const index = live.furuq.huntIndexOf(pairs, wordsAt);

  /* ═══════════ مسرحُ التلاوة ═══════════ */
  /** نصٌّ متّصلٌ من آيةٍ فما بعدها — كما تفتحه نافذةُ العمل في التطبيق */
  const stage = (id, ayahs = 10) => {
    const script = [];
    const locs = [];
    for (let n = id; n <= Math.min(LAST, id + ayahs - 1); n++) {
      const [s, a] = locationOf(n);
      normsAt(n).forEach((w, i) => {
        script.push(w);
        locs.push(`${s}:${a}:${i + 1}`);
      });
    }
    return { script, locs };
  };

  /**
   * **يُبثُّ الكلامُ كما يبثّه المحرّك** — جُملًا تنمو جزئيّةً ثمّ تُختم، وتُعاد
   * محاذاةُ الجملة من مرساتها في كلّ مرّة (وهو عينُ ما يفعله سطحُ التتبّع).
   * ويُجمع ما اصطيد **بمفتاحه وموضعه** فلا يتكرّر الخبرُ الواحد.
   */
  const recite = (mod, { script, locs }, tokens, hunted) => {
    const out = [];
    const cfg = hunted ? { index, locOf: (i) => locs[i] } : undefined;
    let anchor = 0;
    for (let i = 0; i < tokens.length; i += 5) {
      const utter = tokens.slice(i, i + 5);
      for (let k = 1; k <= utter.length; k++) {
        const step = mod.alignUtterance(script, utter.slice(0, k), anchor, mod.DEFAULT_ALIGN, cfg);
        for (const e of step.hunts) {
          if (!out.some((x) => x.key === e.key && x.at === e.at)) out.push(e);
        }
        if (k === utter.length) anchor = step.cursor;
      }
    }
    return out;
  };

  /**
   * **محرّكٌ متعثّر** — بمولّدٍ حتميٍّ ببذرةٍ ثابتة، على نمط المسبار الأخت
   * (`check-tatabbu-align.mjs`) وبأرقامه: إسقاطُ القصار وإبدالُ حرفٍ والتحامُ
   * كلمتين. **ولا عشوائيّةَ فيه** فالنتيجةُ تُعاد بحروفها.
   */
  const SWAP = "دذسشصضطظعغفقكلمنهوي";
  const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const garble = (toks, seed) => {
    const r = rng(seed);
    const out = [];
    for (let t of toks) {
      if (t.length <= 3 && r() < 0.4) continue;
      if (r() < 0.15 && t.length > 3) {
        const at = 1 + Math.floor(r() * (t.length - 2));
        t = t.slice(0, at) + SWAP[Math.floor(r() * SWAP.length)] + t.slice(at + 1);
      }
      if (out.length && r() < 0.08) out[out.length - 1] += t;
      else out.push(t);
    }
    return out;
  };

  /** كم كلمةً من الفرع يمضي فيها المنزلق في المسبار */
  const SLIP_WORDS = 8;
  /** كم كلمةً يمضي فيها المستقيمُ بعد آيته */
  const AFTER_WORDS = 6;

  /** كلُّ الوجوه: زوجٌ · مفرقٌ · جهةٌ — وهي مادّةُ الأبواب (أ) و(ب) و(ج) */
  const faces = [];
  for (const p of pairs) {
    for (const f of p.forks) {
      faces.push({ p, f, hereLoc: p.a, hereId: p.idA, here: f.atA, there: f.atB, otherId: p.idB });
      faces.push({ p, f, hereLoc: p.b, hereId: p.idB, here: f.atB, there: f.atA, otherId: p.idA });
    }
  }

  /** فرعُ النظيرة مطبَّعًا — كلماتُها وما يليها في المصحف (كما يبنيه التطبيق) */
  const branchCache = new Map();
  const branchOf = (id) => {
    let b = branchCache.get(id);
    if (b) return b;
    const own = normsAt(id);
    b = own.slice();
    for (let n = id + 1; n <= LAST && b.length < own.length + live.furuq.BRANCH_TAIL; n++) {
      for (const w of normsAt(n)) b.push(w);
    }
    branchCache.set(id, b);
    return b;
  };

  const cases = [];
  const check = (name, want, got, ok) => cases.push({ name, want, got, ok });

  /* ═══════════ أ — الانزلاقُ يُصطاد بزوجه ═══════════ */
  let slipTried = 0;
  let slipCaught = 0;
  /** اصطيدَ بمفتاح **نظيرةٍ أخرى للآية نفسِها** — التباسٌ في المادّة لا خطأٌ في الحكم */
  let slipKin = 0;
  /** اصطيدَ بمفتاحٍ **ليس من نظائر الآية أصلًا** — وهذا وحدَه خطأ */
  let slipAlien = 0;
  let sample = null;
  for (const x of faces) {
    const lead = normsAt(x.hereId).slice(0, x.here - 1);
    const branch = branchOf(x.otherId).slice(x.there - 1, x.there - 1 + SLIP_WORDS);
    if (!lead.length || !branch.length) continue;
    slipTried++;
    const evs = recite(live.align, stage(x.hereId), [...lead, ...branch], true);
    const kin = index.get(x.hereLoc) ?? [];
    for (const e of evs) {
      if (e.key === x.p.key) continue;
      if (kin.some((k) => k.key === e.key)) slipKin++;
      else slipAlien++;
    }
    const mine = evs.filter((e) => e.key === x.p.key);
    if (!mine.length) continue;
    slipCaught++;
    /* المثالُ يُنتقى بموضعه المسمّى لا بأوّل ما وقع — فلا يتبدّل بتبدّل الترتيب */
    if (!sample && x.hereLoc === "26:160") sample = { x, e: mine[0] };
  }
  const rate = Math.round((slipCaught / slipTried) * 1000) / 10;
  /* **والحدُّ نصفٌ لا أكثرُ عن قصد**: العتبةُ تُسقط كلَّ زوجٍ تعود آيتاه إلى
     الاتّفاق بعد المفرق (﴿يُذَبِّحُونَ﴾/﴿يُقَتِّلُونَ﴾ ثمّ ﴿أَبْنَآءَكُمْ﴾ فيهما سواء)،
     وذلك قريبٌ من نصف المادّة. **وهو مقتضى «لا يُتَّهم مصيب» لا نقصٌ فيه.** */
  check(
    "الانزلاقُ يُصطاد",
    "يُصطاد ≥ ٥٠٪ من الانزلاقات المصطنعة",
    `${slipCaught}/${slipTried} = ${rate}٪`,
    rate >= 50,
  );
  check(
    "ولا يُصطاد بمفتاحٍ أجنبيٍّ عن الآية",
    "صفرُ اصطيادٍ بزوجٍ ليس من نظائر الآية",
    `أجنبيٌّ ${slipAlien} · ومن نظائرها ${slipKin}`,
    slipAlien === 0,
  );

  /* ═══════════ ب — المستقيمُ لا يُتَّهم ═══════════ */
  const straight = (x) => {
    const mine = normsAt(x.hereId);
    const after = [];
    for (let n = x.hereId + 1; n <= LAST && after.length < AFTER_WORDS; n++) {
      for (const w of normsAt(n)) after.push(w);
    }
    return [...mine, ...after.slice(0, AFTER_WORDS)];
  };
  let falseAcc = 0;
  let noisyAcc = 0;
  const falseSay = [];
  faces.forEach((x, i) => {
    const clean = straight(x);
    const evs = recite(live.align, stage(x.hereId), clean, true);
    if (evs.length) {
      falseAcc++;
      if (falseSay.length < 3) falseSay.push(`${x.hereLoc}⇐${evs[0].there}`);
    }
    /* **ومحرّكٌ متعثّرٌ لا يصنع تهمة**: هذا موضعُ الخطر الحقيقيّ — لا يُميَّز في
       هذه الطبقة خطأُ القارئ من خطأ الآلة، فيجب أن يمرّ التعثّرُ بلا اتّهام. */
    if (recite(live.align, stage(x.hereId), garble(clean, 7 + i), true).length) noisyAcc++;
  });
  check(
    "المستقيمُ لا يُتَّهم",
    `صفرُ اتّهامٍ في ${faces.length} وجهًا`,
    falseAcc === 0 ? "٠" : `${falseAcc} (${falseSay.join(" · ")})`,
    falseAcc === 0,
  );
  check(
    "ولا يُتَّهم ومحرّكُه متعثّر",
    "إسقاطُ قصارٍ وإبدالُ حرفٍ والتحامُ كلمتين ⇒ صفرُ اتّهام",
    `${noisyAcc}`,
    noisyAcc === 0,
  );

  /* ═══════════ ج — حيادٌ عابرٌ دون العتبة (كلمتان) ═══════════ */
  const brush = [];
  for (const x of faces) {
    const lead = normsAt(x.hereId).slice(0, x.here - 1);
    const two = branchOf(x.otherId).slice(x.there - 1, x.there + 1);
    const back = normsAt(x.hereId).slice(x.here - 1);
    if (two.length < 2 || !lead.length) continue;
    /* **والنظيرةُ المجاورةُ مستثناةٌ معلَنةً**: زوجٌ آيتاه متجاورتان في المصحف
       (٢٤:٣٢~٢٤:٣٣) لا يُفرَّق فيه **الحيادُ إلى النظيرة** من **المضيِّ إليها**
       — فكلماتُها أمامَ المؤشّر في النصّ نفسِه، والمحاذاةُ تراه ماضيًا بحقّ.
       فالمشهدُ نفسُه متناقضٌ فيها، لا الحكم. */
    brush.push({ x, toks: [...lead, ...two, ...back], near: Math.abs(x.hereId - x.otherId) <= 1 });
  }
  let brushAcc = 0;
  let brushNear = 0;
  for (const b of brush) {
    if (!recite(live.align, stage(b.x.hereId), b.toks, true).length) continue;
    if (b.near) brushNear++;
    else brushAcc++;
  }
  check(
    "حيادٌ عابرٌ دون العتبة",
    `كلمتان ثمّ عودةٌ ⇒ صفرُ اتّهام في ${brush.filter((b) => !b.near).length} وجهًا`,
    `${brushAcc} · والمجاورةُ المستثناةُ ${brushNear} من ${brush.filter((b) => b.near).length}`,
    brushAcc === 0,
  );

  /* ═══════════ د — آيةٌ بلا نظيرٍ: المسارُ لا يعمل أصلًا ═══════════ */
  {
    /** أوّلُ عشر آياتٍ لا موضعَ لها في الفهرس — بترتيب المصحف لا بانتقاء */
    const bare = [];
    for (let id = 1; id <= LAST && bare.length < 10; id++) {
      const [s, a] = locationOf(id);
      if (!index.has(`${s}:${a}`) && normsAt(id).length >= 5) bare.push(id);
    }
    let fired = 0;
    for (const id of bare) {
      /* حيدةٌ واسعةٌ عمدًا: تُتلى الآيةُ ثمّ يُمضى في كلام آيةٍ بعيدةٍ من سورةٍ أخرى */
      const away = normsAt(globalIdOf(18, 1)).slice(0, 8);
      if (recite(live.align, stage(id), [...normsAt(id), ...away], true).length) fired++;
    }
    check(
      "آيةٌ بلا نظيرٍ",
      `${bare.length} آياتٍ لا موضعَ لها في الفهرس ⇒ لا يعمل المسار`,
      `${fired} حدثًا`,
      fired === 0 && bare.length === 10,
    );
  }

  /* ═══════════ هـ — البابُ مغلقٌ ما لم يُفتح ═══════════ */
  {
    let fired = 0;
    let tried = 0;
    for (const x of faces) {
      const lead = normsAt(x.hereId).slice(0, x.here - 1);
      const branch = branchOf(x.otherId).slice(x.there - 1, x.there - 1 + SLIP_WORDS);
      if (!lead.length || !branch.length) continue;
      tried++;
      if (recite(live.align, stage(x.hereId), [...lead, ...branch], false).length) fired++;
    }
    check(
      "بابٌ مغلقٌ بلا إعداد",
      `${tried} انزلاقًا بلا إعدادِ اصطياد ⇒ صفرُ أحداث`,
      `${fired}`,
      fired === 0,
    );
  }

  /* ═══════════ و — الميثاقُ ساكنًا: بابٌ بحالاتٍ مسمّاة، وصمتُ الصلاة، وحلقةٌ تُقفل ═══════════
     المسابرُ أعلاه تشهد للآلة، وهذه تشهد **لموضع الإعلان**: أنّ البابَ لا يُفتح
     إلّا في حالاتٍ مسمّاة، وأنّ الصلاةَ ليست منها في العرض، وأنّ ما يُصطاد يُقيَّد
     في سجلّ المفارق، وأنّ سطرَ الصدق مكتوبٌ حيث يُقال الاصطياد. */
  {
    const hook = read(join(APP, "tatabbu.ts"));
    const view = read(join(APP, "components", "Track.tsx"));
    const inLine = hook.match(/const HUNT_IN: HalId\[\] = \[([^\]]*)\]/);
    const shownLine = hook.match(/const HUNT_SHOWN: HalId\[\] = \[([^\]]*)\]/);
    const named = inLine ? inLine[1] : "";
    const shown = shownLine ? shownLine[1] : "";
    const wanted = ["murajaa", "tathbit", "salat"];
    check(
      "بابٌ بحالاتٍ مسمّاة",
      "الاصطيادُ في المراجعة والتثبيت والصلاة وحدَها — والختمةُ والعَرْضُ خارجَه",
      inLine ? named.trim() : "لم تُوجد الحالاتُ المسمّاة",
      !!inLine && wanted.every((h) => named.includes(`"${h}"`)) && !named.includes('"khatma"') && !named.includes('"ard"'),
    );
    check(
      "وفي الصلاة صمتٌ تامّ",
      "الصلاةُ خارجَ ما يُعرض — لا وميضَ ولا بيان",
      shownLine ? shown.trim() : "لم يُوجد المعروضُ فيه",
      !!shownLine && !shown.includes('"salat"') && shown.includes('"murajaa"') && shown.includes('"tathbit"'),
    );
    check(
      "الحلقةُ تُقفل في السجلّ",
      "ما يُصطاد يُقيَّد بمفتاح الزوج في سجلّ المفارق عند الختام",
      hook.includes("noteSlips(") && read(join(APP, "tathbit.ts")).includes("export function noteSlips")
        ? "يُقيَّد"
        : "لم يُقيَّد",
      hook.includes("noteSlips(") && read(join(APP, "tathbit.ts")).includes("export function noteSlips"),
    );
    check(
      "سطرُ الصدق في واجهة الاصطياد",
      "«محسوبٌ … وقد يفوته انزلاقٌ ولا يُتّهم مصيب»",
      view.includes("وقد يفوته انزلاقٌ ولا يُتّهم مصيب") ? "مكتوب" : "مفقود",
      view.includes("محسوبٌ من محاذاة صوتك") && view.includes("وقد يفوته انزلاقٌ ولا يُتّهم مصيب"),
    );
  }

  /* ═══════════ الضبطُ السالب: العتبةُ كلمةٌ واحدة ═══════════ */
  {
    /* **العتبةُ هي التي تفصل العابرَ من المنزلق** — فتُخفَّض إلى كلمةٍ ويُعاد
       بابُ (ج) بحروفه: من لم يزلّ (كلمتان ثمّ عودة) يجب أن يُتَّهم حينئذٍ. */
    let acc = 0;
    for (const b of brush) {
      if (b.near) continue;
      if (recite(neg.align, stage(b.x.hereId), b.toks, true).length) acc++;
    }
    /* **وحارسٌ ثانٍ دونها**: الالتماسُ لا يقع إلّا عند حيدة، فالمستقيمُ التامُّ
       لا يُتَّهم **ولو خُفّضت العتبة** — يُقاس ويُنشر ولا يُدَّعى. */
    let accStraight = 0;
    for (const x of faces) {
      if (recite(neg.align, stage(x.hereId), straight(x), true).length) accStraight++;
    }
    check(
      "ضبطٌ سالب: العتبةُ كلمةٌ واحدة",
      "يُتَّهم صاحبُ الحياد العابر فيُصطاد الاتّهام",
      planted
        ? `${acc} من ${brush.filter((b) => !b.near).length} اتُّهم (وبالعتبة الحيّة ٠) · والمستقيمُ التامُّ ${accStraight}`
        : "لم يقع الزرعُ أصلًا",
      planted && acc > 0,
    );
  }

  /* ═══════════ الخلاصة ═══════════ */
  const passed = cases.filter((c) => c.ok).length;
  console.log(`مسابرُ الاصطياد: ${passed}/${cases.length} سليمة`);
  for (const c of cases) console.log(`  ${c.ok ? "✓" : "✗"} ${c.name} — المنتظر: ${c.want} · الواقع: ${c.got}`);
  console.log(
    `  العتبةُ ${HUNT_RUN} كلماتٍ حصريّةٍ متتالية · خطوةُ الفرع ${HUNT_STEP} · نافذةُ البراءة ${HUNT_CLEAR} · ذيلُ الفرع ${live.furuq.BRANCH_TAIL}`,
  );
  console.log(`  الفهرس: ${index.size} آيةً لها نظائر · ${pairs.length} زوجًا · ${faces.length} وجهًا`);
  console.log(
    `  وما لم يُصطَد ${slipTried - slipCaught} وجهًا — لا تبلغ فيه الحصريّةُ ${HUNT_RUN} لأنّ الآيتين تعودان إلى الاتّفاق بعد المفرق`,
  );
  if (sample) {
    console.log(
      `  مثالٌ: ${sample.x.hereLoc} ⇐ ${sample.e.there} — هنا «${sample.e.faceHere ?? "تنتهي الآية"}» وهناك «${sample.e.faceThere ?? "تنتهي الآية"}» (${sample.e.run} كلماتٍ حصريّة · موضعُ الوميض ${sample.e.at})`,
    );
  }
  for (const m of missing) console.log(`  ✗ مفقود: ${m}`);
  console.log("  (نصٌّ حتميٌّ لا صوت — ولا تقول شيئًا عن سمع المحرّك لتلاوةٍ حقيقيّة)");
  if (passed !== cases.length || missing.length) process.exitCode = 1;
}

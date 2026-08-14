#!/usr/bin/env node
/**
 * **بوّابةُ التلاوة المنزَّلة ولوحةِ الجاهزيّة** — فحصٌ ساكنٌ لما لا يُحتمل فيه
 * الخطأ، **ومُدقَّقٌ بضبطٍ سالبٍ في نفسه** (`--selfcheck`).
 *
 *     node tools/check_sawt_tilawa.mjs
 *     node tools/check_sawt_tilawa.mjs --selfcheck    # يفسد المصدرَ في الذاكرة فيجب أن يُصطاد
 *
 * ## ولماذا هذه الفحوصُ بعينها
 *
 * ثلاثةُ أخطاءٍ في هذا الباب تقطع على قارئٍ صلاتَه أو مراجعتَه، أو تُخلّ برخصةٍ:
 *
 * 1. **أن تدّعيَ اللوحةُ جاهزيّةً لا تملكها** — فتُشترط قراءةُ الخزانة، ويُمنع
 *    أن تُبنى الجاهزيّةُ على سجلٍّ عندنا.
 * 2. **أن يُقبل ملفٌّ لم تُطابَق تجزئتُه** — فتُشترط الحوسبةُ والمقابلةُ ورفضُ
 *    المخالف قبل التخزين.
 * 3. **أن يُسمع الصوتُ بلا إسناده الواجب** — `quran-align` (CC BY 4.0) والتلاوةُ
 *    عبر everyayah؛ ويُشترط حضورُهما حيث يُسمع وحيث يُختار القارئ.
 *
 * ومعها: **لا تنزيلَ تلقائيّ** · **ولا وعدَ بثبات التخزين** · **ولا لغةَ أدواتٍ
 * في نصٍّ يُعرض للقارئ** · **ولا `\b` مع نصٍّ عربيّ** (بلاغ الحدود العربيّة).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = `${ROOT}/js/apps/studio/src`;

const FILES = {
  tilawa: `${SRC}/lib/sawt/tilawa.ts`,
  panel: `${SRC}/components/OfflineReadiness.tsx`,
  credit: `${SRC}/components/RecitationCredit.tsx`,
  audio: `${SRC}/components/AudioButton.tsx`,
  settings: `${SRC}/components/SettingsPanel.tsx`,
  index: `${SRC}/lib/sawt/mushafIndex.ts`,
};

/** لغةُ الأدوات — لا تظهر في نصٍّ يقرؤه القارئ */
const TOOL_WORDS = [
  "huggingface", "hugging face", "HF_TOKEN", "onnx", "whisper", "transformers",
  "localStorage", "Cache API", "sha256", "SHA-256", "manifest", "المانيفست",
  "js/data", "tools/", "SESSION-", "Opus", "Sonnet",
];
/** إسنادٌ واجبٌ — يُستثنى من منع لغة الأدوات لأنّه شرطُ رخصة */
const CREDIT_ALLOW = ["quran-align", "everyayah", "cpfair", "Collin Fair", "CC BY 4.0"];

const checks = [];
const check = (name, why, fn) => checks.push({ name, why, fn });

/** نصوصُ الواجهة: ما بين علامتَي اقتباسٍ في سطرٍ عربيّ — تقريبٌ يكفي للرصد */
function readerStrings(src) {
  const out = [];
  for (const m of src.matchAll(/["'`]([^"'`\n]{8,})["'`]/g)) {
    if (/[؀-ۿ]/.test(m[1])) out.push(m[1]);
  }
  return out;
}

/* ── ١) الجاهزيّةُ من الخزانة لا من سجلٍّ عندنا ──────────────────────────── */

check(
  "الجاهزيّةُ محسوبةٌ من الخزانة",
  "لو بُنيت على سجلٍّ عندنا لقالت «جاهز» بعد أن يمحو النظامُ الملفّات",
  (s) => {
    if (!/caches\.open\(CACHE\)/.test(s.tilawa)) return "لا تُفتح خزانةُ التلاوة";
    if (!/ready:\s*have === ayat\.length/.test(s.tilawa))
      return "الجاهزيّةُ ليست «كلُّ آياتها حاضرة» — أو غُيّر شرطُها";
    if (/ready:\s*true/.test(s.tilawa)) return "جاهزيّةٌ مكتوبةٌ بيدٍ لا محسوبة";
    return null;
  },
);

check(
  "اللوحةُ تقرأ الحالَ من `unitStates` وتُعيد القراءة",
  "الضبطُ السالب: تُمحى وحدةٌ فتقول اللوحةُ «غير جاهز»",
  (s) => {
    if (!/unitStates\(/.test(s.panel)) return "اللوحةُ لا تسأل الخزانة";
    if (!/tlw-recheck|Re-check/.test(s.panel)) return "لا سبيلَ لإعادة القراءة بيد القارئ";
    return null;
  },
);

/* ── ٢) التجزئةُ تُحسب وتُقابَل، والمخالفُ يُرفض ────────────────────────── */

check(
  "تجزئةُ كلِّ ملفٍّ تُحسب وتُقابَل",
  "«عرفُ خادمٍ لا عقد» — ولا يُكتفى بترويسة الخادم",
  (s) => {
    if (!/crypto\.subtle\.digest\("SHA-256"/.test(s.tilawa)) return "لا تُحسب تجزئةٌ";
    if (!/got !== want/.test(s.tilawa)) return "لا تُقابَل التجزئةُ بالمانيفست";
    const body = s.tilawa.slice(s.tilawa.indexOf("if (got !== want)"));
    const put = body.indexOf("c.put(");
    const ret = body.indexOf("return");
    if (put !== -1 && ret !== -1 && put < ret) return "يُخزَّن قبل أن يُرفض المخالف";
    return null;
  },
);

/* ── ٣) الإسنادُ الواجبُ حيث يُسمع الصوت ────────────────────────────────── */

check(
  "الإسنادُ حاضرٌ حيث يُسمع الصوت وحيث يُختار القارئ",
  "CC BY 4.0 توجب إسنادًا ظاهرًا — وهو شرطُ رخصةٍ لا تحسين",
  (s) => {
    for (const w of ["quran-align", "Collin Fair", "CC BY 4.0", "everyayah"])
      if (!s.credit.includes(w)) return `الإسنادُ ينقصه: ${w}`;
    if (!/الحصري|Ḥuṣarī/.test(s.credit)) return "لا اسمَ للقارئ في الإسناد";
    if (!/RecitationCredit/.test(s.audio)) return "لا إسنادَ في موضع السماع";
    if (!/RecitationCredit/.test(s.settings)) return "لا إسنادَ حيث يُختار القارئ";
    return null;
  },
);

/* ── ٤) لا تنزيلَ صامتٌ ولا تلقائيّ ─────────────────────────────────────── */

check(
  "لا تنزيلَ يبدأ من نفسه",
  "«ولا تنزيلَ صامتٌ ولا تلقائيّ» — ولا على شبكةٍ محدودةٍ بلا إذن",
  (s) => {
    for (const m of s.panel.matchAll(/useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\n  \}/g))
      if (/downloadUnit\(/.test(m[1])) return "تنزيلٌ داخل أثرٍ يعمل من تلقائه";
    if (!/metered\(\)/.test(s.panel)) return "لا يُسأل عن الشبكة المحدودة";
    return null;
  },
);

/* ── ٥) ولا يُوعَد بثبات التخزين ────────────────────────────────────────── */

check(
  "ثباتُ التخزين يُعرض بجوابه لا بوعد",
  "«ولا يُوعَد بما لا نملك» — وإن لم يُمنح قيل إنّ النظام قد يمحو المنزَّل",
  (s) => {
    if (!/persisted === true/.test(s.panel)) return "لا يُفرَّق بين الممنوح وغيره";
    if (!/قد يمحو النظامُ/.test(s.panel)) return "لا يُقال للقارئ إنّ النظام قد يمحو المنزَّل";
    if (!/askPersist/.test(s.panel)) return "لا يُطلب الثباتُ أصلًا";
    return null;
  },
);

/* ── ٦) ولا لغةَ أدواتٍ في نصٍّ يُعرض ──────────────────────────────────── */

check(
  "لا لغةَ أدواتٍ في المعروض",
  "قاعدةُ المشروع: لا أسماءَ نماذجَ ولا مساراتٍ داخليّةٍ في صفحات القارئ",
  (s) => {
    const bad = [];
    for (const file of ["panel", "credit", "audio"])
      for (const str of readerStrings(s[file]))
        for (const w of TOOL_WORDS)
          if (str.toLowerCase().includes(w.toLowerCase()) && !CREDIT_ALLOW.some((a) => str.includes(a)))
            bad.push(`${file}: «${str.slice(0, 48)}» ⊃ ${w}`);
    return bad.length ? bad.join(" · ") : null;
  },
);

/* ── ٧) ولا `\b` مع نصٍّ عربيّ ─────────────────────────────────────────── */

check(
  "لا حدَّ كلمةٍ لاتينيًّا على نصٍّ عربيّ",
  "بلاغُ 2026-08-12: `\\b` لا يعمل مع العربيّة فيمرّ ما يجب أن يُصطاد",
  (s) => {
    for (const [name, src] of Object.entries(s))
      for (const m of src.matchAll(/\/[^/\n]*\\b[^/\n]*\//g))
        if (/[؀-ۿ]/.test(m[0])) return `${name}: ${m[0]}`;
    return null;
  },
);

/* ── ٨) وفهرسُ المصحف لا يُكتب مرّتين ──────────────────────────────────── */

check(
  "جدولُ عدد الآي واحدٌ لا يتكرّر",
  "جدولان ينحرف أحدُهما عن الآخر، والانحرافُ ههنا آيةٌ لا تُسمع",
  (s) => {
    // الفاصلةُ الأخيرةُ تُخلّف حقلًا فارغًا، و`Number("")` صفرٌ لا NaN —
    // فيُصفّى النصُّ قبل التحويل لا بعده (اصطاده الضبطُ السالبُ نفسُه)
    const nums = s.index.match(/AYAH_COUNTS = \[([\s\S]*?)\]/)[1]
      .split(",").map((x) => x.trim()).filter(Boolean).map(Number);
    if (nums.length !== 114) return `عددُ السور ${nums.length} لا ١١٤`;
    const sum = nums.reduce((a, b) => a + b, 0);
    if (sum !== 6236) return `مجموعُ الآي ${sum} لا ٦٢٣٦`;
    if (/const AYAH_COUNTS/.test(s.audio)) return "الجدولُ مكتوبٌ ثانيةً في زرّ التلاوة";
    return null;
  },
);

/* ── التشغيل ───────────────────────────────────────────────────────────── */

function load() {
  const s = {};
  for (const [k, p] of Object.entries(FILES)) s[k] = readFileSync(p, "utf8");
  return s;
}

function run(sources, quiet = false) {
  let bad = 0;
  for (const c of checks) {
    const fail = c.fn(sources);
    if (fail) bad++;
    if (!quiet) console.log(`${fail ? "✗" : "✓"} ${c.name}${fail ? ` — ${fail}` : ""}`);
  }
  return bad;
}

/** **الضبطُ السالب**: يُفسد المصدرُ في الذاكرة، فما لم يُصطَد فحصُه أعمى */
const SABOTAGE = [
  ["الجاهزيّةُ محسوبةٌ من الخزانة", (s) => ({ ...s, tilawa: s.tilawa.replace("ready: have === ayat.length", "ready: true") })],
  ["تجزئةُ كلِّ ملفٍّ تُحسب وتُقابَل", (s) => ({ ...s, tilawa: s.tilawa.replace(/crypto\.subtle\.digest\("SHA-256"/, 'noop("SHA-256"') })],
  ["الإسنادُ حاضرٌ حيث يُسمع الصوت وحيث يُختار القارئ", (s) => ({ ...s, audio: s.audio.replaceAll("RecitationCredit", "Nothing") })],
  ["ثباتُ التخزين يُعرض بجوابه لا بوعد", (s) => ({ ...s, panel: s.panel.replace(/قد يمحو النظامُ/g, "لا يمحو") })],
  ["لا لغةَ أدواتٍ في المعروض", (s) => ({ ...s, panel: s.panel.replace('className="tlw">', 'className="tlw">{"يُنزَّل النموذجُ من huggingface الآن"}') })],
  ["جدولُ عدد الآي واحدٌ لا يتكرّر", (s) => ({ ...s, index: s.index.replace("7, 286,", "7, 285,") })],
];

const base = load();
if (process.argv.includes("--selfcheck")) {
  let blind = 0;
  for (const [name, spoil] of SABOTAGE) {
    const c = checks.find((x) => x.name === name);
    const caught = Boolean(c.fn(spoil(base)));
    console.log(`${caught ? "✓" : "✗"} ضبطٌ سالب: ${name}${caught ? " — اصطيد" : " — مرّ! الفحصُ أعمى"}`);
    if (!caught) blind++;
  }
  console.log(blind ? `\n✗ ${blind} فحصًا أعمى` : "\n✓ كلُّ الفحوص ترى ما وُضعت له");
  process.exit(blind ? 1 : 0);
}

const bad = run(base);
console.log(bad ? `\n✗ ${bad} إخفاقًا` : "\n✓ بوّابةُ التلاوة المنزَّلة سليمة");
process.exit(bad ? 1 : 0);

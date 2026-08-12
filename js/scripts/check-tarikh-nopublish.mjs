/**
 * بندُ البوّابة الصلب: **لا نشرَ ولا دمج.**
 *
 * ——— بوّابةٌ تاريخيّةٌ مؤرشفة (١٢ آب ٢٠٢٦) ———
 * هذه **بوّابةُ فرع النشر التاريخيّة**: بُنيت لحجرٍ بعينه على فرعٍ بعينه، وقد
 * انقضى الحجرُ وزال الفرع. ولا تُحذف — فهي سجلُّ ذلك الحجر وقالبٌ جاهزٌ لأيّ
 * فرعِ عرضٍ محجورٍ قادم. وخَلَفُها الحيُّ العامُّ الذي لا يتعلّق بفرع:
 * `js/scripts/check-tarikh-nopush.mjs` (يُثبت أنّ الجلسة الجارية لم تدفع شيئًا،
 * على أيِّ فرعٍ كانت).
 *
 * كان قرارُ المالك في صدر خ٧: يُبنى الباب على فرع `tarikh-v1` محليًّا فلا يُدمج
 * ولا يُدفع حتى يرى النتيجة. **ثمّ أذِن بالنشر صراحةً في ٣ آب ٢٠٢٦** بعد مراجعة
 * ما بُني، فرُفع الحجر. ويبقى هذا السكربت وتقاريرُه شاهدَين على أنّ شيئًا لم
 * يغادر الجهاز قبل إذنه — وأداةً جاهزةً لأيّ حجرٍ لاحق. ثمّ **دُمج الفرعُ في
 * `main` وحُذف في ١٢ آب ٢٠٢٦** (صيانةٌ إداريّة، بلا إيداعةٍ ضائعة: كان
 * `main..tarikh-v1` صفرًا) — فإن غاب الفرعُ لم يبقَ ما يُفحص، وتُعلن البوّابةُ
 * أنّها مؤرشفةٌ ولا تدّعي فحصًا لم يقع.
 *
 * يفحص آليًّا (حين يكون فرعُه قائمًا):
 *   ١ — الفرعُ الحاليّ `tarikh-v1`.
 *   ٢ — مراجعُ البعيد لم تتغيّر عن خطّ الأساس المسجَّل (`NOPUBLISH-BASELINE.json`)
 *       — وأوّلُ تشغيلٍ يسجّل خطّ الأساس نفسَه.
 *   ٣ — `main` لم تتقدّم: رأسُها هو رأسُ `origin/main` نفسُه.
 *   ٤ — الفرعُ غيرُ مدموجٍ في `main`، وإيداعاتُه كلُّها فوقها.
 *   ٥ — سجلُّ الفرع (`reflog`) خالٍ من أثر دفعٍ، ولا فرعَ تتبّعٍ بعيدٍ له.
 *
 * التشغيل: node js/scripts/check-tarikh-nopublish.mjs
 * لا يتّصل بالشبكة إطلاقًا — الفحصُ على مراجعِ المستودع المحليّة وحدها.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = join(ROOT, "js", "data", "tarikh-sources", "NOPUBLISH-BASELINE.json");
const BRANCH = "tarikh-v1";

const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
/** آخرُ قيدِ دفعٍ في سجلّ المراجع — يتغيّر رأسُه إن وقع دفعٌ جديد */
const lastPushEntry = () => {
  try { return git("reflog", "show", "--all", "--grep-reflog=push", "-n", "1"); } catch { return ""; }
};
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); return c; };

/**
 * الفرعُ المحجورُ زال (حُذف بعد دمجه في ١٢ آب ٢٠٢٦) — فلا مادّةَ لهذه البوّابة.
 * تُعلن أنّها مؤرشفةٌ **ولا تكتب نجاحًا**: `ok: null` لا `true`، فلا يُقرأ
 * سكوتُها إجازةً. والحيُّ الذي يحرس الجلسةَ الجارية هو `check-tarikh-nopush`.
 */
const branchExists = (() => {
  try { git("rev-parse", "--verify", "--quiet", `refs/heads/${BRANCH}`); return true; } catch { return false; }
})();
if (!branchExists) {
  const out0 = join(ROOT, "js", "data", "tarikh-sources", "GATE-NOPUBLISH.json");
  const prev = existsSync(out0) ? JSON.parse(readFileSync(out0, "utf8")) : null;
  writeFileSync(out0, JSON.stringify({
    ok: null,
    archived: true,
    branch: BRANCH,
    note: `بوّابةُ فرعِ النشر التاريخيّة: فرعُ «${BRANCH}» دُمج في main وحُذف (١٢ آب ٢٠٢٦)، فلا فحصَ يجري. الحارسُ الحيُّ العامّ: check-tarikh-nopush.mjs`,
    lastLiveReport: prev?.archived ? (prev.lastLiveReport ?? null) : prev,
  }, null, 2));
  console.log(`• بوّابةٌ مؤرشفة: لا فرعَ «${BRANCH}» في المستودع — **لم يُجرَ فحص** (لا نجاحَ ولا إخفاق).`);
  console.log(`  آخرُ تشغيلٍ حيٍّ محفوظٌ في التقرير، والحارسُ الحيُّ اليومَ: js/scripts/check-tarikh-nopush.mjs`);
  process.exit(0);
}

const current = git("rev-parse", "--abbrev-ref", "HEAD");
ok(current === BRANCH, `الفرعُ الحاليّ «${current}» لا «${BRANCH}»`);

/** مراجعُ البعيد المحليّة — يتغيّر أحدُها عند الدفع أو الجلب */
const remoteRefs = Object.fromEntries(
  git("for-each-ref", "--format=%(refname) %(objectname)", "refs/remotes")
    .split("\n").filter(Boolean).map((l) => l.split(" ")),
);

let baseline;
if (existsSync(BASELINE)) {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const keys = new Set([...Object.keys(baseline.remoteRefs), ...Object.keys(remoteRefs)]);
  for (const k of keys) {
    ok(baseline.remoteRefs[k] === remoteRefs[k],
      `مرجعٌ بعيدٌ تغيّر: ${k} — كان ${baseline.remoteRefs[k] ?? "غير موجود"} وصار ${remoteRefs[k] ?? "محذوفًا"}`);
  }
} else {
  baseline = { recorded: "أوّلُ تشغيل", remoteRefs, lastPush: lastPushEntry() };
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 2));
  console.log(`• سُجّل خطُّ الأساس لمراجع البعيد: ${BASELINE}`);
}

// لا فرعَ تتبّعٍ بعيدٍ لفرعنا، ولا مسارَ دفعٍ مضبوط
ok(!Object.keys(remoteRefs).some((r) => r.endsWith(`/${BRANCH}`)), `للفرع «${BRANCH}» مرجعٌ بعيد — أي أنّه دُفع`);
let upstream = "";
try { upstream = git("rev-parse", "--abbrev-ref", `${BRANCH}@{upstream}`); } catch { /* لا مجرى أعلى: المطلوب */ }
ok(!upstream, `للفرع مجرًى أعلى مضبوط: ${upstream}`);

// main لم تتحرّك عن origin/main، والفرعُ غيرُ مدموجٍ فيها
const main = git("rev-parse", "main");
const originMain = remoteRefs["refs/remotes/origin/main"];
ok(main === originMain, `main تقدّمت عن origin/main (${main.slice(0, 7)} ≠ ${String(originMain).slice(0, 7)})`);
const merged = git("branch", "--merged", "main").split("\n").map((s) => s.replace(/^\*?\s*/, ""));
ok(!merged.includes(BRANCH), `الفرع «${BRANCH}» مدموجٌ في main`);
const ahead = git("rev-list", "--count", `main..${BRANCH}`);
const behind = git("rev-list", "--count", `${BRANCH}..main`);

// أثرُ دفعٍ **جديد** في سجلّ المراجع — الدفعاتُ السابقةُ لخطّ الأساس تاريخٌ لا مخالفة
const pushNow = lastPushEntry();
ok(pushNow === (baseline.lastPush ?? pushNow),
  `وقع دفعٌ بعد خطّ الأساس: «${pushNow}» (كان «${baseline.lastPush}»)`);

const out = join(ROOT, "js", "data", "tarikh-sources", "GATE-NOPUBLISH.json");
const report = {
  ok: fails.length === 0,
  branch: current, head: git("rev-parse", "HEAD"),
  main, originMain, ahead: +ahead, behind: +behind,
  remoteRefs, lastPush: pushNow, baselineLastPush: baseline.lastPush ?? null,
  failures: fails,
};
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`  الفرع: ${current} · إيداعاتٌ فوق main: ${ahead} · main = origin/main: ${main === originMain ? "نعم" : "لا"}`);
for (const f of fails) console.log(`  · ${f}`);
console.log(`${report.ok ? "✓" : "✗"} بندُ «لا نشر» — التقرير: ${out}`);
process.exit(report.ok ? 0 : 1);

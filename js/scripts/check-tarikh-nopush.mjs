/**
 * بندُ بوّابة خ٧-ب: **الإيداعُ على `main` محلّيًّا، ولا دفعَ ولا نشر.**
 *
 * قرارُ المالك في خ٧-ب: يجري العملُ على مجرى مشكاة المعتاد — إيداعاتٌ على
 * `main` — لكنّ **الدفعَ والنشرَ بيده هو** عند مراجعته. فيفحص هذا السكربتُ آليًّا
 * أنّ شيئًا لم يغادر الجهاز:
 *
 *   ١ — الفرعُ الحاليّ `main` (لا فرعَ جانبيًّا يُنسى).
 *   ٢ — مراجعُ البعيد لم يتغيّر منها مرجعٌ واحدٌ عن خطّ الأساس المسجَّل
 *       (`NOPUSH-BASELINE.json`) — وأوّلُ تشغيلٍ يسجّل خطَّ الأساس نفسَه.
 *   ٣ — `origin/main` هو هو: لم يتقدّم، أي لم يُدفع إليه شيء.
 *   ٤ — `main` المحلّيّة **متقدّمةٌ** على `origin/main` بإيداعات الجلسة، ولا
 *       إيداعةَ من البعيد لم تُدمَج (فالتقدّمُ من جهةٍ واحدة).
 *   ٥ — سجلُّ المراجع (`reflog`) خالٍ من أثر دفعٍ جديدٍ بعد خطّ الأساس.
 *
 * لا يتّصل بالشبكة إطلاقًا — الفحصُ على مراجعِ المستودع المحليّة وحدها.
 * التشغيل: node js/scripts/check-tarikh-nopush.mjs
 *
 * **وخطُّ الأساس يُعاد تثبيتُه يدويًّا — لا آليًّا — حين يدفع المالكُ بنفسه**
 * بعد قبول جلسةٍ سابقة (فدفعُه حقُّه لا مخالفة). حينئذٍ يُكتب خطُّ أساسٍ جديدٌ
 * للجلسة الجارية **ويُحفظ سابقُه في `previous`** فيبقى السجلُّ كلُّه مقروءًا.
 * فالمُثبَتُ بهذه البوّابة أنّ **هذه الجلسة** لم تدفع شيئًا، لا إنكارُ ما دفعه
 * المالك. ولو أُعيد التثبيتُ آليًّا لبطلت البوّابةُ من أصلها.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = join(ROOT, "js", "data", "tarikh-sources", "NOPUSH-BASELINE.json");
const BRANCH = "main";

const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const lastPushEntry = () => {
  try { return git("reflog", "show", "--all", "--grep-reflog=push", "-n", "1"); } catch { return ""; }
};
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); return c; };

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
  baseline = { recorded: "أوّلُ تشغيل (خ٧-ب)", branch: current, remoteRefs, lastPush: lastPushEntry() };
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 2));
  console.log(`• سُجّل خطُّ الأساس لمراجع البعيد: ${BASELINE}`);
}

const main = git("rev-parse", BRANCH);
const originMain = remoteRefs["refs/remotes/origin/main"];
ok(!!originMain, "لا مرجعَ محلّيًّا لـ origin/main");
ok(originMain === (baseline.remoteRefs["refs/remotes/origin/main"] ?? originMain),
   "origin/main تقدّم — أي أنّ دفعًا وقع");

const ahead = +git("rev-list", "--count", `${originMain}..${BRANCH}`);
const behind = +git("rev-list", "--count", `${BRANCH}..${originMain}`);
ok(behind === 0, `main خلفَ origin/main بـ${behind} إيداعة — جلبٌ لم يُدمج`);
ok(ahead > 0, "لا إيداعةَ محلّيّةً فوق origin/main — لم يُودَع شيءٌ بعد");

// أثرُ دفعٍ **جديد** في سجلّ المراجع — الدفعاتُ السابقةُ لخطّ الأساس تاريخٌ لا مخالفة
const pushNow = lastPushEntry();
ok(pushNow === (baseline.lastPush ?? pushNow),
  `وقع دفعٌ بعد خطّ الأساس: «${pushNow}» (كان «${baseline.lastPush}»)`);

const out = join(ROOT, "js", "data", "tarikh-sources", "GATE-NOPUSH.json");
const report = {
  ok: fails.length === 0,
  branch: current, head: git("rev-parse", "HEAD"),
  main, originMain, ahead, behind,
  localCommits: ahead ? git("log", "--oneline", `${originMain}..${BRANCH}`).split("\n") : [],
  remoteRefs, lastPush: pushNow, baselineLastPush: baseline.lastPush ?? null,
  failures: fails,
};
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`  الفرع: ${current} · إيداعاتٌ محلّيّةٌ فوق origin/main: ${ahead} · origin/main ثابت: ${originMain === (baseline.remoteRefs["refs/remotes/origin/main"] ?? originMain) ? "نعم" : "لا"}`);
for (const f of fails) console.log(`  · ${f}`);
console.log(`${report.ok ? "✓" : "✗"} بندُ «لا دفع» — التقرير: ${out}`);
process.exit(report.ok ? 0 : 1);

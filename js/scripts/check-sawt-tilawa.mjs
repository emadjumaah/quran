/**
 * **وصلُ فاحصَي ص٠ بسويتة البوّابات** — بندٌ موروثٌ نُفّذ في ص-م٥ §٤.
 *
 * بنَت جلسةُ ص٠ فاحصَين صحيحَين وتركتهما **خارجَ السويتة** في `tools/`: يُشغَّلان
 * بأمرٍ يُتذكَّر، ولا يكتبان في `js/data/gates/` كأخواتهما، ولا يقعان تحت الحظر
 * الساكن الذي يمسح `js/scripts/check-*`. **وحارسٌ لا يُشغَّل مع أخواته حارسٌ
 * يُنسى** — فوُصلا ههنا بلا نسخِ سطرٍ من منطقهما: يُستدعَيان كما هما، ويُجمع
 * حكمُهما في بوّابةٍ واحدةٍ لها مخرَجٌ كالمخرَجات.
 *
 * وثلاثةٌ تُجمع:
 *   ١ — **بوّابةُ التلاوة المنزَّلة ولوحةِ الجاهزيّة** (`tools/check_sawt_tilawa.mjs`):
 *       الجاهزيّةُ محسوبةٌ من الخزانة لا من سجلٍّ عندنا · وتجزئةُ كلِّ ملفٍّ
 *       تُقابَل قبل التخزين · والإسنادُ حاضرٌ حيث يُسمع الصوتُ وحيث يُختار القارئ.
 *   ٢ — **وضبطُها السالبُ في نفسها** (`--selfcheck`): يُفسَد المصدرُ في الذاكرة
 *       فيجب أن يُصطاد — **فبوّابةٌ لم تُدقَّق هي نفسُها ليست ببوّابة**.
 *   ٣ — **ولا صوتَ في git** (`tools/check_no_audio_in_git.py`): لا ملفَّ تلاوةٍ
 *       متتبَّعًا ولا في المرحلة، و`audio/` متجاهَلٌ بسؤال git نفسِه.
 *
 * ولا `\b` مع العربيّة (بلاغُ الحدود 2026-08-12) — ولا نمطَ ههنا أصلًا: هذه
 * وصلةُ تسييرٍ لا فحصٌ ثانٍ، **فلا يُنسخ منطقُ فاحصٍ فيشيخ في صمت**.
 *
 * التشغيل: node js/scripts/check-sawt-tilawa.mjs → js/data/gates/SAWT-TILAWA.json
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "js", "data", "gates", "SAWT-TILAWA.json");

/** الفاحصون كما هم في مواضعهم — يُستدعَون ولا يُنسخون */
const RUNS = [
  {
    key: "التلاوةُ المنزَّلةُ ولوحةُ الجاهزيّة",
    file: "tools/check_sawt_tilawa.mjs",
    cmd: process.execPath,
    args: [join(ROOT, "tools", "check_sawt_tilawa.mjs")],
  },
  {
    key: "وضبطُها السالبُ في نفسها",
    file: "tools/check_sawt_tilawa.mjs",
    cmd: process.execPath,
    args: [join(ROOT, "tools", "check_sawt_tilawa.mjs"), "--selfcheck"],
  },
  {
    key: "لا صوتَ في git",
    file: "tools/check_no_audio_in_git.py",
    cmd: "python3",
    args: [join(ROOT, "tools", "check_no_audio_in_git.py")],
  },
];

const failures = [];
const missing = [];
const notes = [];
const rows = [];

for (const r of RUNS) {
  if (!existsSync(join(ROOT, r.file))) {
    missing.push(`${r.key}: لم يُوجد ${r.file}`);
    rows.push({ فحص: r.key, ملف: r.file, حكم: null, سببٌ: "الملفُّ غيرُ موجود" });
    continue;
  }
  const p = spawnSync(r.cmd, r.args, { cwd: ROOT, encoding: "utf8" });
  if (p.error) {
    // **لا يُكتب نجاحٌ لفحصٍ لم يقع** — وغيابُ عُدّةِ تشغيلٍ يُعلَن ولا يُبتلع
    missing.push(`${r.key}: تعذّر تشغيلُه (${p.error.message})`);
    rows.push({ فحص: r.key, ملف: r.file, حكم: null, سببٌ: p.error.message });
    continue;
  }
  const out = `${p.stdout ?? ""}${p.stderr ?? ""}`.trim();
  const tail = out.split("\n").filter(Boolean).slice(-1)[0] ?? "";
  const ok = p.status === 0;
  rows.push({ فحص: r.key, ملف: r.file, حكم: ok, خلاصة: tail.slice(0, 160) });
  if (ok) notes.push(`${r.key} — ${tail.slice(0, 120)}`);
  else failures.push({ check: r.key, detail: out.split("\n").filter((l) => l.includes("✗")).join(" · ").slice(0, 400) || tail });
}

mkdirSync(dirname(OUT), { recursive: true });
const ok = failures.length === 0 && missing.length === 0;
writeFileSync(`${OUT}`, `${JSON.stringify({ gate: "sawt-tilawa", ok, runs: rows, failures, missing, notes }, null, 2)}\n`);
console.log(`بوّابةُ التلاوة المنزَّلة (فاحصا ص٠ موصولَين): ${ok ? "خضراء" : "حمراء"}`);
for (const n of notes) console.log(`  ✓ ${n}`);
for (const f of failures) console.log(`  ✗ [${f.check}] ${f.detail}`);
for (const m of missing) console.log(`  ؟ ${m}`);
console.log(`  ${relative(ROOT, OUT)}`);
process.exit(ok ? 0 : 1);

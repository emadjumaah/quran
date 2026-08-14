/**
 * **بنكُ تمارينَ مفهرسٌ بالحكم** — «أين يقع الإخفاء؟ وأيسرُ مواضعه للتمرين؟»
 *
 * **يُولَّد بمحرّكنا الحرّ نفسِه** (`js/apps/studio/src/tajwid.ts`) على رسم المصحف
 * الذي نملك رخصتَه، في خطوة بناءٍ حتميّةٍ تُعاد بحروفها. **ولا يُشتقّ من
 * `build/ipa/*.tsv` ولا من `research/qpc-hafs-tajweed.json`** — فتلك مخرجاتٌ
 * مشتقّةٌ من مرجعٍ غيرِ معلَن الرخصة (`CREDITS.md` §٢)، وشحنُ مخرَجها ممنوع.
 * وهذا الملفُّ **لا يحمل من ذلك المرجع شيئًا**، ولا حرفَ قرآنٍ فيه أصلًا:
 * **مواضعُ وأرقامٌ لا نصّ**.
 *
 * **والحدُّ الذي لا يُتجاوز**: هذه مواضعُ **في نصّ المصحف** (هذا موضعُ إخفاء،
 * وهذا موضعُ قلقلة) — **ولا حكمَ على تلاوة قارئ** ولا قياسَ نطق. والفرقُ بين
 * «هذا حكمُ الموضع» و«أنت أخطأتَ فيه» هو الفرقُ بين عرضٍ ودعوى.
 *
 * و«أيسرُ المواضع للتمرين» **معرَّفٌ لا مذوَّق**: الآيةُ الأقلُّ كلماتٍ التي فيها
 * الحكمُ مرّةً واحدةً لا مرارًا (فيتميّز الموضعُ)، والأقربُ إلى آخر المصحف عند
 * التساوي (فقصارُ المفصّل أحفظُ للناس). ويُنشر مع كلٍّ عددُ كلماتها.
 *
 * التشغيل: node js/scripts/build-tajwid-bank.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "js", "apps", "studio", "src");
const OUT = join(SRC, "lib", "sawt", "tajwid-bank.json");

/** كم موضعًا يُنشر لكلّ حكم */
const PER_RULE = 12;

/* ═══ المحرّكُ الحيُّ نفسُه يُحمَّل بحروفه — لا نسخةٌ عنه ═══ */
const tmp = mkdtempSync(join(tmpdir(), "tajwid-bank-"));
let TAJ;
try {
  copyFileSync(join(SRC, "tajwid.ts"), join(tmp, "tajwid.ts"));
  TAJ = await import(pathToFileURL(join(tmp, "tajwid.ts")).href);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const db = new DatabaseSync(join(ROOT, "quran-app.db"), { readOnly: true });
const ayahs = db
  .prepare("select _id, data from ayahs")
  .all()
  .map((r) => ({ ...JSON.parse(r.data), ord: Number(String(r._id).slice(1)) }))
  .sort((a, b) => a.ord - b.ord);
const words = db
  .prepare("select surahNo, ayahNo, wordNo, data from words order by surahNo, ayahNo, wordNo")
  .all();

const byAyah = new Map();
for (const w of words) {
  const key = `${w.surahNo}:${w.ayahNo}`;
  const arr = byAyah.get(key);
  const t = JSON.parse(w.data).textUthmani;
  if (arr) arr.push(t);
  else byAyah.set(key, [t]);
}

/** لكلّ حكمٍ: جملةُ مواضعه في المصحف، وقائمةُ مرشَّحي التمرين */
const rules = Object.keys(TAJ.TAJWID);
const total = Object.fromEntries(rules.map((r) => [r, 0]));
const cand = Object.fromEntries(rules.map((r) => [r, []]));

for (const a of ayahs) {
  const ws = byAyah.get(a.location);
  if (!ws) continue;
  const spans = TAJ.tajwidWords(ws);
  /** كم مرّةً وقع كلُّ حكمٍ في هذه الآية، وفي أيّ كلمةٍ أوّلَ مرّة */
  const hits = new Map();
  spans.forEach((word, wi) => {
    for (const s of word) {
      if (!s.rule) continue;
      const h = hits.get(s.rule);
      if (h) h.n++;
      else hits.set(s.rule, { n: 1, wordNo: wi + 1 });
    }
  });
  for (const [rule, h] of hits) {
    total[rule] += h.n;
    // المرشَّحُ: الحكمُ فيها **مرّةً واحدةً** فيتميّز موضعُه
    if (h.n === 1) {
      cand[rule].push({ loc: a.location, wordNo: h.wordNo, words: ws.length, ord: a.ord });
    }
  }
}

const bank = {};
for (const rule of rules) {
  cand[rule].sort((x, y) => x.words - y.words || y.ord - x.ord);
  bank[rule] = {
    total: total[rule],
    easiest: cand[rule].slice(0, PER_RULE).map((c) => ({ at: c.loc, word: c.wordNo, words: c.words })),
  };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ generatedBy: "tajwid.ts", source: "رسمُ المصحف في قاعدتنا", rules: bank }, null, 1)}\n`,
);

console.log(`بنكُ تمارين الأحكام: ${rules.length} أحكامٍ · ${ayahs.length} آية`);
for (const r of rules) {
  console.log(`  ${TAJ.TAJWID[r].ar}: ${total[r]} موضعًا · مرشَّحو التمرين ${cand[r].length} · نُشر ${bank[r].easiest.length}`);
}

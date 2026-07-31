/**
 * المِرساةُ العامّة — ربطُ أيِّ كتابٍ تراثيٍّ بمواضع المصحف عبر **النصِّ
 * المقتبَس نفسِه** (2026-07-31).
 *
 * العلّة: كتبُ التراث لا تتّفق على تعليمٍ للمواضع — بعضُها معنونٌ بأرقام
 * الآيات (النحّاس) وأكثرُها متونٌ متّصلةٌ تقتبس الآيةَ ثم تتكلّم عليها
 * (مكّي · العكبري · السمين · الفرّاء · الزجّاج…). فبدل انتظار مِرساةٍ
 * خارجيّة نستعمل ما نملكه ولا يملكه غيرُنا: **نصُّ المصحف نفسُه**.
 *
 * الطريقة (حتميّةٌ بلا تخمين):
 *   ١) يُبنى فهرسٌ مقلوبٌ من كلِّ خُماسيّاتِ كلماتِ المصحف (٦٢٣٦ آية) بعد
 *      تطبيعٍ متماثلٍ (تطبيعُ البحث نفسُه: همزاتٌ وتاءٌ ومقصورةٌ وضبط).
 *   ٢) يُقطَّع الكتابُ فقراتٍ، ويُلتقط من كلِّ فقرةٍ خماسيّاتُها.
 *   ٣) تُصوَّت المواضع: الموضعُ الذي طابقت أكثرُ خماسيّاتِ الفقرة يفوز،
 *      بشرطِ حدٍّ أدنى من الأصوات ونسبةِ تفوّقٍ على الثاني — وإلا **تُطرح
 *      الفقرة**. لا نُسنِد ما لا يثبت.
 *
 * الخماسيّةُ (٥ كلمات) نادرةُ التكرار في المصحف، فالمطابقةُ عليها دقيقة؛
 * والتصويتُ يمنع أن تجرَّ إحالةٌ عابرةٌ فقرةً كاملةً إلى موضعٍ ليس لها.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const MARKS = /[ً-ْٰـۖ-ۭ]/g;
export const normAr = (s) =>
  (s || "")
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const N = 5; // طولُ المقطع المطابَق

/** يبني الفهرسَ المقلوب: خماسيّةٌ → مواضعُها */
export function buildQuranIndex(dbPath = "/Volumes/data/new-projects/quran/quran-kg.db") {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare("SELECT location, text_clean, text_uthmani FROM ayah").all();
  const idx = new Map();
  for (const r of rows) {
    const w = normAr(r.text_clean || r.text_uthmani).split(" ").filter(Boolean);
    for (let i = 0; i + N <= w.length; i++) {
      const g = w.slice(i, i + N).join(" ");
      const set = idx.get(g);
      if (set) set.add(r.location);
      else idx.set(g, new Set([r.location]));
    }
  }
  return { idx, verses: rows.length };
}

/**
 * يُرسي فقرةً واحدة. يعيد { loc, votes, margin } أو null إن لم يثبت.
 * @param minVotes أدنى عددِ خماسيّاتٍ مطابِقة (٢ = مقطعان مستقلّان)
 * @param minMargin نسبةُ تفوّق الفائز على الثاني (١٫٥ = يزيد النصف)
 */
export function anchorParagraph(text, idx, { minVotes = 2, minMargin = 1.5 } = {}) {
  const w = normAr(text).split(" ").filter(Boolean);
  if (w.length < N) return null;
  const votes = new Map();
  for (let i = 0; i + N <= w.length; i++) {
    const locs = idx.get(w.slice(i, i + N).join(" "));
    if (!locs || locs.size > 4) continue; // خماسيّةٌ شائعةٌ جدًّا لا تُميِّز
    for (const l of locs) votes.set(l, (votes.get(l) ?? 0) + 1);
  }
  if (!votes.size) return null;
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [loc, n] = sorted[0];
  const second = sorted[1]?.[1] ?? 0;
  if (n < minVotes) return null;
  if (second > 0 && n / second < minMargin) return null;
  return { loc, votes: n, margin: second ? n / second : Infinity };
}

/**
 * إرساءٌ بالاقتباس المعلَّم: بعضُ متون OpenITI تحصر الآيةَ بين @QB@ و@QE@ —
 * وهذا أدقُّ من تصويت الفقرة كلِّها، لأنّه يُرسي على ما اقتبسه المؤلّفُ نفسُه
 * لا على ما جاورَه. يُجرَّب أولًا، فإن غاب رجعنا إلى التصويت.
 */
export function anchorByMarkedQuote(rawChunk, idx, { minWords = 4 } = {}) {
  const quotes = [...rawChunk.matchAll(/@QB@([\s\S]{6,300}?)@QE@/g)].map((m) => normAr(m[1]));
  const votes = new Map();
  for (const q of quotes) {
    const w = q.split(" ").filter(Boolean);
    if (w.length < minWords) continue;
    for (let i = 0; i + N <= w.length; i++) {
      const locs = idx.get(w.slice(i, i + N).join(" "));
      if (!locs || locs.size > 4) continue;
      for (const l of locs) votes.set(l, (votes.get(l) ?? 0) + 1);
    }
  }
  if (!votes.size) return null;
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  return { loc: sorted[0][0], votes: sorted[0][1], margin: sorted[1] ? sorted[0][1] / sorted[1][1] : Infinity, how: "الاقتباسُ المعلَّم" };
}

/** تنظيفُ متن OpenITI من رموز التقطيع وعلامات الصفحات */
export const cleanOpenITI = (s) =>
  s
    .replace(/PageV\d+P\d+/g, " ")
    .replace(/@QB@|@QE@/g, "")
    .replace(/^[#~|]+\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();

/** يختار أضخمَ نسخةٍ نصيّةٍ في مجلد الكتاب */
export function pickBiggest(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => !f.endsWith(".yml") && !f.endsWith(".md"))
    .map((f) => ({ f, size: fs.statSync(path.join(dir, f)).size }))
    .sort((a, b) => b.size - a.size);
  return files[0]?.f ?? null;
}

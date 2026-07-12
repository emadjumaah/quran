/**
 * تدريب الإعراب — a checkable grammar drill generated straight from the QAC
 * morphology we already ship. A word is shown in its ayah; you name its class
 * (اسم/فعل/حرف), a verb's tense, or a noun's case, and the answer is the corpus
 * tag itself — no interpretation, just the grammar. The reveal shows the full
 * morphology so every question teaches even when missed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { listSurahs, listWords } from "../db";
import { getUILang, num, useUILang } from "../i18n";
import type { SurahDoc, WordDoc, SegmentDoc } from "../types";

const CLASS_OF: Record<string, string> = {
  V: "فعل", N: "اسم", PN: "اسم", ADJ: "اسم", DEM: "اسم", PRON: "اسم", REL: "اسم", LOC: "اسم", T: "اسم",
};
const wordClass = (pos: string) => CLASS_OF[pos] ?? "حرف";
const TENSE: Record<string, string> = { PERF: "ماضٍ", IMPF: "مضارع", IMPV: "أمر" };
const CASE: Record<string, string> = { NOM: "مرفوع", ACC: "منصوب", GEN: "مجرور" };
const VOICE: Record<string, string> = { ACT: "معلوم", PASS: "مجهول" };
const FORM = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

type Q = {
  words: WordDoc[]; // the ayah, for context
  target: WordDoc;
  stem: SegmentDoc;
  ref: string;
  prompt: string;
  options: string[];
  answer: string;
};

function buildQuestion(words: WordDoc[], surahName: string): Q | null {
  const cands = words.filter((w) => w.segments?.some((g) => g.role === "stem" && g.pos !== "INL"));
  if (!cands.length) return null;
  const target = cands[Math.floor(Math.random() * cands.length)];
  const stem = target.segments.find((g) => g.role === "stem")!;
  const types: string[] = ["class"];
  if (stem.aspect && TENSE[stem.aspect]) types.push("tense");
  if (stem.caseMark && CASE[stem.caseMark]) types.push("case");
  const type = types[Math.floor(Math.random() * types.length)];
  const ref = `${surahName} ${num(target.ayahNo)}`;
  if (type === "tense")
    return { words, target, stem, ref, prompt: "ما زمنُ هذا الفعل؟", options: ["ماضٍ", "مضارع", "أمر"], answer: TENSE[stem.aspect!] };
  if (type === "case")
    return { words, target, stem, ref, prompt: "ما موقعُها من الإعراب؟", options: ["مرفوع", "منصوب", "مجرور"], answer: CASE[stem.caseMark!] };
  return { words, target, stem, ref, prompt: "ما نوعُ هذه الكلمة؟", options: ["اسم", "فعل", "حرف"], answer: wordClass(stem.pos) };
}

export default function EraabDrill() {
  useUILang();
  const ar = getUILang() === "ar";
  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const cache = useRef<Map<number, WordDoc[]>>(new Map());
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0, best: 0 });

  useEffect(() => { listSurahs().then(setSurahs).catch(() => setSurahs([])); }, []);

  const next = useCallback(async () => {
    setPicked(null);
    setQ(null);
    if (!surahs.length) return;
    for (let tries = 0; tries < 25; tries++) {
      const s = surahs[Math.floor(Math.random() * surahs.length)];
      let words = cache.current.get(s.surahNo);
      if (!words) { words = await listWords(s.surahNo); cache.current.set(s.surahNo, words); }
      const a = 1 + Math.floor(Math.random() * s.ayahCount);
      const ayahWords = words.filter((w) => w.ayahNo === a);
      const built = ayahWords.length ? buildQuestion(ayahWords, s.nameAr) : null;
      if (built) { setQ(built); return; }
    }
  }, [surahs]);

  useEffect(() => { if (surahs.length && !q) void next(); }, [surahs, q, next]);

  const choose = (opt: string) => {
    if (picked || !q) return;
    setPicked(opt);
    const ok = opt === q.answer;
    setScore((s) => ({
      right: s.right + (ok ? 1 : 0),
      total: s.total + 1,
      streak: ok ? s.streak + 1 : 0,
      best: Math.max(s.best, ok ? s.streak + 1 : s.best),
    }));
  };

  const g = q?.stem;
  const feats = g
    ? [
        g.verbForm ? `الوزن ${FORM[g.verbForm] || g.verbForm}` : "",
        g.aspect ? TENSE[g.aspect] : "",
        g.voice ? VOICE[g.voice] : "",
        g.caseMark ? CASE[g.caseMark] : "",
        g.root ? `الجذر ${g.root}` : "",
      ].filter(Boolean)
    : [];

  return (
    <div className="page">
      <div className="iq-wrap">
        <header className="iq-head">
          <h1 className="iq-title">{ar ? "تدريب الإعراب" : "Grammar drill"}</h1>
          <p className="iq-lead">
            {ar
              ? "سمِّ نوعَ الكلمة، أو زمنَ الفعل، أو موقعَها من الإعراب — والجوابُ وسمُها في مدوّنة الصرف، لا تفسير. عند الكشف يظهر تحليلُها كاملًا."
              : "Name the word's class, a verb's tense, or a noun's case — the answer is the corpus grammar tag itself. The reveal shows the full analysis."}
          </p>
          <div className="iq-score">
            <span><b>{num(score.right)}</b>/{num(score.total)} {ar ? "صحيحة" : "correct"}</span>
            <span>{ar ? "متتالية" : "streak"} <b>{num(score.streak)}</b></span>
            {score.best > 0 && <span className="muted">{ar ? "الأفضل" : "best"} {num(score.best)}</span>}
          </div>
        </header>

        {!q ? (
          <p className="muted" style={{ textAlign: "center", padding: 30 }}>{ar ? "جارٍ التحضير…" : "Preparing…"}</p>
        ) : (
          <div className="iq-card">
            <div className="iq-ref muted">{q.ref}</div>
            <div className="quran iq-ayah">
              {q.words.map((w) => (
                <span key={w.location} className={w.location === q.target.location ? "iq-target" : ""}>{w.textUthmani} </span>
              ))}
            </div>
            <div className="iq-prompt">{q.prompt}</div>
            <div className="iq-options">
              {q.options.map((opt) => {
                const state = !picked ? "" : opt === q.answer ? " right" : opt === picked ? " wrong" : "";
                return (
                  <button key={opt} className={`iq-opt${state}`} onClick={() => choose(opt)} disabled={!!picked}>
                    {opt}
                  </button>
                );
              })}
            </div>

            {picked && (
              <div className="iq-reveal">
                <div className={picked === q.answer ? "iq-verdict ok" : "iq-verdict no"}>
                  {picked === q.answer ? (ar ? "✓ أحسنت" : "✓ Correct") : `✗ ${ar ? "الصواب" : "Answer"}: ${q.answer}`}
                </div>
                <div className="iq-morph">
                  <span className="quran iq-morph-w">{q.target.textUthmani}</span>
                  <span className="iq-morph-pos">{g!.posAr}</span>
                  {feats.map((f) => <span key={f} className="chip iq-feat">{f}</span>)}
                </div>
                <button className="primary iq-next" onClick={() => void next()}>{ar ? "التالي ←" : "Next →"}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

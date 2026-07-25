/**
 * «العدُّ الدقيق» — تفصيلُ مواضع الجذر بالصيغة (2026-07-21، سؤال المالك:
 * «كيف أعرف ورودَ الكلمة مفردًا أو مثنًّى أو جمعًا حتى أُقدّم عدًّا متقنًا؟»).
 *
 * ثلاثةُ أعدادٍ تُعلَن صريحةً كي لا يلتبس عدٌّ بعدّ:
 *   • عدُّ الجذر — المادّةُ كلُّها بكلِّ مشتقّاتها.
 *   • عدُّ اللَّـمّة بصيغتها — «شَهْر مفردًا» غيرُ «شَهْر جمعًا».
 *   • عدُّ الرسم — صورةُ الكلمة كما تُكتب («شهر» غير «أشهر» غير «شهرين»).
 * كلُّ رقمٍ يفتح مواضعَه، ومصدرُه الوسمُ الصرفيُّ QAC لا تقديرَ فيه.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUILang, num } from "../i18n";
import { readPathOf } from "../types";
import { surahNameAr } from "../db";

interface Form { lemma: string; pos: string; form: string; n: number; locs: string[] }
interface Rasm { w: string; n: number; locs: string[] }
interface RootCounts { n: number; forms: Form[]; rasm: Rasm[] }
interface Payload { meta: { source: string; note: string }; roots: Record<string, RootCounts> }

let cache: Payload | null = null;
let loading: Promise<Payload | null> | null = null;
function load(): Promise<Payload | null> {
  if (cache) return Promise.resolve(cache);
  loading ??= fetch(`${import.meta.env.BASE_URL}sarf-counts.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: Payload | null) => (cache = j))
    .catch(() => null);
  return loading;
}

const refName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

export default function SarfCounts({ root }: { root: string }) {
  const ar = getUILang() === "ar";
  const [data, setData] = useState<RootCounts | null | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"form" | "rasm">("form");
  useEffect(() => {
    let live = true;
    load().then((p) => live && setData(p?.roots[root] ?? null));
    return () => { live = false; };
  }, [root]);
  if (data === undefined || data === null) return null;

  const rows: { key: string; head: string; sub?: string; n: number; locs: string[] }[] =
    tab === "form"
      ? data.forms.map((f) => ({ key: `f${f.lemma}${f.form}`, head: f.lemma, sub: f.form, n: f.n, locs: f.locs }))
      : data.rasm.map((r) => ({ key: `r${r.w}`, head: r.w, n: r.n, locs: r.locs }));

  return (
    <div className="card sc-card">
      <div className="sc-head">
        <h3 className="sc-title">{ar ? "العدُّ الدقيق" : "Exact counts"}</h3>
        <div className="sc-tabs">
          <button className={tab === "form" ? "on" : ""} onClick={() => { setTab("form"); setOpen(null); }}>
            {ar ? "بالصيغة" : "by form"}
          </button>
          <button className={tab === "rasm" ? "on" : ""} onClick={() => { setTab("rasm"); setOpen(null); }}>
            {ar ? "بالرسم" : "by spelling"}
          </button>
        </div>
      </div>
      <p className="sc-note muted">
        {ar
          ? `للسؤال الواحد ثلاثةُ أجوبةٍ صحيحةٍ مختلفة: مادّةُ الجذر كلُّها ${num(data.n)} جذعًا، ثم اللَّـمّةُ بصيغتها، ثم صورةُ الكلمة كما تُكتب. المصدرُ الوسمُ الصرفيُّ للمدوّنة — لا تقديرَ فيه.`
          : `One question, three correct answers: the whole root (${data.n} stems), the lemma in a given form, and the written spelling. Source: the corpus morphology.`}
      </p>
      <div className="sc-rows">
        {rows.map((r) => (
          <div key={r.key} className="sc-row">
            <button className="sc-row-head" onClick={() => setOpen(open === r.key ? null : r.key)}>
              <span className="quran sc-lemma">{r.head}</span>
              {r.sub && <span className="sc-form">{r.sub}</span>}
              <span className="sc-n">{num(r.n)}</span>
              <span className="sc-caret" aria-hidden>{open === r.key ? "▴" : "▾"}</span>
            </button>
            {open === r.key && (
              <div className="sc-locs">
                {r.locs.map((l, i) => (
                  <Link key={`${l}-${i}`} to={readPathOf(l)} className="sc-loc">{refName(l)}</Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

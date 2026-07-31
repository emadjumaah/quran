/**
 * «افحص فكرة» — قلبُ قسم فاحص: يكتب الزائرُ دعواه فيُجاب **بحسابٍ على المصحف**
 * لا برأي. بلا ذكاءٍ اصطناعيّ في هذا المسار: كلُّ رقمٍ هنا يُعاد فيُطابق.
 *
 * والفرقُ الذي يبرّر وجودَ الأداة: أن يُسأل نموذجٌ لغويٌّ فيُجيب بكلامٍ معقولٍ
 * أمرٌ متاحٌ للجميع. أمّا أن يُقال في نقرةٍ «لفظُك ورد ٤٣ مرّةً، وهذه مواضعُها،
 * ويشاركه في هذا العدد ١٢٧ لفظًا آخرَ فلا دلالةَ في العدد» — فهذا ما لا يُتاح
 * إلا لمن يملك النصَّ موسومًا.
 *
 * ثلاثةُ قوالبَ في هذه الدفعة: **العدد** و**الكلّيّة** — وهما محسوبان تمامًا —
 * و**الإعراب**، وهو جلبٌ بالمرساة: لا يُعطي قولًا واحدًا بل يضع أهلَ الصنعة
 * متجاورين بالأقدميّة، فإن اختلفوا رأى القارئُ الخلافَ وحكم عليه.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allAyahs } from "../db";
import { normalizeAr } from "../lib/arabicSearch";
import { type RefHit, refsForAyah } from "../lib/refs";
import { num } from "../i18n";
import type { AyahDoc } from "../types";

type Qalab = "adad" | "kulliya" | "iraab";

/** نصُّ الآيات مطبَّعًا ومحاطًا بفراغٍ — ليُطابَق المتّصلُ متّصلًا لا مبعثرًا */
interface Corpus {
  rows: { loc: string; n: string; t: string }[];
  /** لفظٌ مطبَّع → كم مرّةً ورد في المصحف (لحساب معدّل الصدفة) */
  freq: Map<string, number>;
}

let corpusPromise: Promise<Corpus> | null = null;
function loadCorpus(): Promise<Corpus> {
  corpusPromise ??= allAyahs().then((ayahs: AyahDoc[]) => {
    const rows = ayahs.map((a) => ({ loc: a.location, n: ` ${normalizeAr(a.textClean || a.textUthmani)} `, t: a.textClean }));
    const freq = new Map<string, number>();
    for (const r of rows) for (const w of r.n.trim().split(" ")) if (w) freq.set(w, (freq.get(w) ?? 0) + 1);
    return { rows, freq };
  });
  return corpusPromise;
}

/** السوابقُ التي تلتصق بأوّل الكلمة فلا تُعدّ لفظًا آخر */
const PREFIX = "(?:[وف]?(?:ب|ك|ل|ال|بال|كال|لل)?)";

interface Hit { loc: string; t: string; n: number }
interface Result {
  phrase: string;
  bare: { hits: Hit[]; total: number };
  withPrefix: { hits: Hit[]; total: number };
  /** كم لفظًا آخرَ في المصحف يرد بالعدد نفسِه — معدّلُ الصدفة */
  sameCount: number | null;
  distinctWords: number;
}

function examine(corpus: Corpus, raw: string): Result | null {
  const q = normalizeAr(raw).trim();
  if (!q) return null;
  const words = q.split(" ").filter(Boolean);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bareRe = new RegExp(` ${words.map(esc).join(" ")} `, "g");
  const preRe = new RegExp(` ${PREFIX}${esc(words[0])}${words.slice(1).map((w) => ` ${esc(w)}`).join("")} `, "g");

  const count = (re: RegExp) => {
    const hits: Hit[] = [];
    let total = 0;
    for (const r of corpus.rows) {
      re.lastIndex = 0;
      const m = r.n.match(re);
      if (!m?.length) continue;
      hits.push({ loc: r.loc, t: r.t, n: m.length });
      total += m.length;
    }
    return { hits, total };
  };

  const bare = count(bareRe);
  const withPrefix = count(preRe);

  // معدّلُ الصدفة يُحسب للّفظ المفرد وحدَه — فالعبارةُ المركّبة لا نظيرَ لها يُعدّ
  let sameCount: number | null = null;
  if (words.length === 1 && bare.total > 0) {
    sameCount = 0;
    for (const c of corpus.freq.values()) if (c === bare.total) sameCount++;
    sameCount = Math.max(0, sameCount - 1); // لا يُعدّ اللفظُ نفسُه
  }
  return { phrase: q, bare, withPrefix, sameCount, distinctWords: corpus.freq.size };
}

/**
 * لوحُ الإعراب — الأربعةُ متجاورين ومعهم طبقةُ المعاني، مرتَّبين بالأقدميّة.
 * والمقصودُ إظهارُ **خلافهم** لا إخفاؤه: أوّلُ بطاقةٍ عندنا حُسمت به، إذ خالف
 * الزجّاجُ (ت٣١١) مكّيًّا والعكبريَّ في ٦:٢٠ فسقط إطلاقُ الدعوى.
 */
function IraabPanel({ loc }: { loc: string }) {
  const [hits, setHits] = useState<RefHit[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setHits(null);
    refsForAyah(loc, { ranks: [1, 3, 5] }).then((h) => { setHits(h); setOpen(h[0]?.book.id ?? null); });
  }, [loc]);

  if (!hits) return <p className="hint">…</p>;
  if (!hits.length) return <p className="hint">لا مدخلَ لهذا الموضع عند المراجع المرساةِ بالآية. وهذا يقع: التغطيةُ ٩٠٪ لا ١٠٠٪، والنقصُ يُعلن ولا يُستر.</p>;

  return (
    <div className="iraab">
      <p className="hint" style={{ margin: "0 0 10px" }}>
        {num(hits.length)} مرجعًا لهذا الموضع، بالأقدميّة. وإذا اختلفوا فالخلافُ
        نفسُه هو الحكم — يُعرض ولا يُكتم.
      </p>
      {hits.map((h) => (
        <div className="bk-open" key={h.book.id}>
          <button onClick={() => setOpen(open === h.book.id ? null : h.book.id)}>
            <span className="nm">{h.book.label}</span>
            <span className="au">{h.book.author}{h.book.died ? ` (ت ${num(h.book.died)})` : ""}</span>
            <span className="rk">الرتبة {num(h.book.rank)}</span>
          </button>
          {open === h.book.id && (
            <div className="body">{h.texts.map((t, i) => <p key={i}>{t}</p>)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FahisTool() {
  const [qalab, setQalab] = useState<Qalab>("adad");
  const [word, setWord] = useState("");
  const [loc, setLoc] = useState("");
  const [claimed, setClaimed] = useState("");
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [ran, setRan] = useState<string | null>(null);

  useEffect(() => { loadCorpus().then(setCorpus).catch(() => {}); }, []);
  const res = useMemo(() => (corpus && ran ? examine(corpus, ran) : null), [corpus, ran]);

  const run = () => setRan(word.trim());
  const n = Number(claimed.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const claimN = Number.isFinite(n) && claimed.trim() ? n : null;

  /** الحكمُ يُشتقّ من الحساب لا يُكتب: وهذا شرطُ أن يكون فاحصًا لا رأيًا */
  let verdict: { k: "دُعمت" | "تُصوَّب" | "فُنّدت"; why: string } | null = null;
  if (res) {
    if (qalab === "adad" && claimN !== null) {
      if (res.bare.total === claimN) verdict = { k: "دُعمت", why: `العدُّ التامُّ على المصحف يعطي ${num(res.bare.total)} — مطابقٌ لما ادُّعي.` };
      else if (res.withPrefix.total === claimN) verdict = { k: "تُصوَّب", why: `العددُ يصحّ إذا عُدَّت المواضعُ بسوابقها (${num(res.withPrefix.total)})، أمّا الصيغةُ المجرّدةُ فـ${num(res.bare.total)}. فالعددُ صحيحٌ والتسميةُ تحتاج ضبطًا.` };
      else verdict = { k: "فُنّدت", why: `العدُّ التامُّ يعطي ${num(res.bare.total)} مجرّدةً و${num(res.withPrefix.total)} بالسوابق — وكلاهما يخالف ${num(claimN)}.` };
    } else if (qalab === "kulliya") {
      verdict = res.withPrefix.total === 0
        ? { k: "دُعمت", why: "لم يرد هذا اللفظُ في المصحف في أيِّ موضعٍ — والدعوى السالبةُ تثبت بهذا، ما لم يكن للّفظ رسمٌ آخر." }
        : { k: "فُنّدت", why: `ورد في ${num(res.withPrefix.hits.length)} آيةً — ويكفي في نقض الكلّيّة موضعٌ واحد، وأوّلُه ${res.withPrefix.hits[0].loc}.` };
    }
  }

  const shown = qalab === "kulliya" ? res?.withPrefix : res?.bare;

  return (
    <div className="fahis-tool">
      <style>{`
        .fahis-tool { border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
        .fahis-tool .tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .fahis-tool .tabs button { border: 1px solid var(--line); background: none; color: inherit;
          border-radius: 999px; padding: 5px 14px; cursor: pointer; font: inherit; font-size: .9rem; }
        .fahis-tool .tabs button[data-on="1"] { background: currentColor; }
        .fahis-tool .tabs button[data-on="1"] span { color: var(--bg, #fff); mix-blend-mode: difference; }
        .fahis-tool .form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .fahis-tool input { font: inherit; font-size: 16px; padding: 9px 12px; border-radius: 9px;
          border: 1px solid var(--line); background: transparent; color: inherit; }
        .fahis-tool input.w { flex: 1 1 220px; min-width: 0; }
        .fahis-tool input.n { width: 110px; }
        .fahis-tool .go { border: 0; border-radius: 9px; padding: 10px 20px; cursor: pointer; font: inherit;
          font-weight: 600; background: var(--gold, #c9a227); color: #1a1a1a; }
        .fahis-tool .go:disabled { opacity: .45; cursor: default; }
        .fahis-tool .hint { font-size: .84rem; opacity: .58; margin: 8px 0 0; line-height: 1.7; }
        .fahis-tool .out { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
        .fahis-tool .nums { display: flex; gap: 22px; flex-wrap: wrap; margin-bottom: 14px; }
        .fahis-tool .nums b { display: block; font-size: 1.6rem; font-variant-numeric: tabular-nums; line-height: 1.2; }
        .fahis-tool .nums span { font-size: .82rem; opacity: .62; }
        .fahis-tool .vd { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 14px; }
        .fahis-tool .vd b { font-size: 1.05rem; }
        .fahis-tool .vd p { margin: 5px 0 0; opacity: .82; line-height: 1.8; }
        .fahis-tool .locs { display: flex; flex-wrap: wrap; gap: 6px; }
        .fahis-tool .locs a { font-size: .84rem; font-variant-numeric: tabular-nums; text-decoration: none;
          border: 1px solid var(--line); border-radius: 7px; padding: 2px 8px; opacity: .85; }
        .fahis-tool .sample { margin-top: 12px; font-size: .92rem; line-height: 2.1; opacity: .9; }
        .fahis-tool .sample div { padding: 5px 0; border-bottom: 1px dotted var(--line); }
        .fahis-tool .bk-open { border-bottom: 1px solid var(--line); }
        .fahis-tool .bk-open:last-child { border-bottom: 0; }
        .fahis-tool .bk-open > button { display: flex; align-items: baseline; gap: 9px; width: 100%;
          background: none; border: 0; color: inherit; font: inherit; text-align: start;
          padding: 11px 2px; cursor: pointer; flex-wrap: wrap; }
        .fahis-tool .bk-open .nm { font-weight: 600; }
        .fahis-tool .bk-open .au { opacity: .6; font-size: .88rem; }
        .fahis-tool .bk-open .rk { margin-inline-start: auto; opacity: .5; font-size: .78rem; white-space: nowrap; }
        .fahis-tool .bk-open .body { padding: 0 2px 14px; }
        .fahis-tool .bk-open .body p { margin: 0 0 9px; line-height: 2.05; opacity: .88; font-size: .95rem; }
      `}</style>

      <div className="tabs">
        <button data-on={qalab === "adad" ? 1 : 0} onClick={() => { setQalab("adad"); setRan(null); }}><span>قالبُ العدد</span></button>
        <button data-on={qalab === "kulliya" ? 1 : 0} onClick={() => { setQalab("kulliya"); setRan(null); }}><span>قالبُ الكلّيّة</span></button>
        <button data-on={qalab === "iraab" ? 1 : 0} onClick={() => { setQalab("iraab"); setRan(null); }}><span>قالبُ الإعراب</span></button>
      </div>

      <div className="form">
        {qalab === "iraab" ? (
          <input
            className="w" value={loc} onChange={(e) => setLoc(e.target.value)} dir="ltr"
            placeholder="الموضع — مثل: 6:20" inputMode="text"
          />
        ) : (
          <input
            className="w" value={word} onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder={qalab === "adad" ? "اللفظُ أو العبارة — مثل: الصلاة" : "اللفظُ الذي تقول إنّه ليس في القرآن"}
            dir="rtl" lang="ar"
          />
        )}
        {qalab === "adad" && (
          <input className="n" value={claimed} onChange={(e) => setClaimed(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()} placeholder="العددُ المدَّعى" inputMode="numeric" />
        )}
        {qalab !== "iraab" && (
          <button className="go" onClick={run} disabled={!corpus || !word.trim()}>
            {corpus ? "افحص" : "…"}
          </button>
        )}
      </div>
      <p className="hint">
        {qalab === "adad"
          ? "يُحسب العددُ على وجهين: الصيغةُ المجرّدة، وهي مع سوابقها (وَ فَ بِ كَ لِ الـ) — فأكثرُ الخلاف في العدّ سببُه هذا. ويُحسب معه معدّلُ الصدفة."
          : qalab === "kulliya"
          ? "الدعوى السالبة («لا يوجد في القرآن كذا») تُنقض بموضعٍ واحد. ويُبحث باللفظ وسوابقِه."
          : "لا يُعطيك فاحصٌ قولًا واحدًا في الإعراب — بل يضع أهلَ الصنعة متجاورين بالأقدميّة، فإن اختلفوا رأيتَ الخلافَ وحكمتَ عليه."}
      </p>

      {qalab === "iraab" && /^\d{1,3}\s*:\s*\d{1,3}$/.test(loc.trim()) && (
        <div className="out"><IraabPanel loc={loc.trim().replace(/\s/g, "")} /></div>
      )}

      {qalab !== "iraab" && res && shown && (
        <div className="out">
          <div className="nums">
            <div><b>{num(res.bare.total)}</b><span>موضعًا بالصيغة المجرّدة</span></div>
            <div><b>{num(res.withPrefix.total)}</b><span>بالسوابق</span></div>
            <div><b>{num(shown.hits.length)}</b><span>آيةً</span></div>
            {res.sameCount !== null && (
              <div><b>{num(res.sameCount)}</b><span>لفظًا آخرَ يرد بالعدد نفسِه</span></div>
            )}
          </div>

          {verdict && (
            <div className="vd">
              <b>{verdict.k}</b>
              <p>{verdict.why}</p>
              {res.sameCount !== null && res.sameCount > 0 && (
                <p style={{ fontSize: ".88rem", opacity: .68 }}>
                  ومعدّلُ الصدفة: يشارك هذا اللفظَ في عدده {num(res.sameCount)} لفظًا آخرَ من {num(res.distinctWords)} —
                  فالعددُ وحدَه لا يدلّ على مقصدٍ ما لم يُضَمَّ إليه دليلٌ من اللفظ أو التركيب.
                </p>
              )}
            </div>
          )}

          {shown.hits.length > 0 && (
            <>
              <div className="locs">
                {shown.hits.slice(0, 60).map((h) => (
                  <Link key={h.loc} to={`/aya/${h.loc.replace(":", "/")}`}>{h.loc}</Link>
                ))}
                {shown.hits.length > 60 && <span style={{ opacity: .6, fontSize: ".84rem" }}>…و{num(shown.hits.length - 60)} غيرُها</span>}
              </div>
              <div className="sample">
                {shown.hits.slice(0, 3).map((h) => (
                  <div key={h.loc}><b style={{ opacity: .6, fontSize: ".8rem" }}>{h.loc}</b> — {h.t}</div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

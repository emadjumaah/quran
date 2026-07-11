/**
 * فروق التنزيل — visual comparison of the Qur'an's near-identical verse pairs.
 * For each twin pair we align the two verses word by word and show exactly what
 * differs (reorder / form / substitution / addition / composite). Computed from
 * the text + roots alone; the reader judges. See findings/FURUQ.md.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { surahNameAr } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import { readPathOf } from "../types";
import { CAT_INFO, CAT_ORDER, sides, useFuruq, type Furq } from "../furuq";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

/** One verse row, its unique words highlighted. `side` picks the accent. */
function VerseLine({ segs, side }: { segs: { text: string; diff: boolean }[]; side: "a" | "b" }) {
  return (
    <div className="fr-line quran">
      <span className="fr-tag">{side === "a" ? "أ" : "ب"}</span>
      {segs.map((s, i) => (
        <span key={i} className={s.diff ? `fr-diff fr-diff-${side}` : undefined}>
          {s.text}{" "}
        </span>
      ))}
    </div>
  );
}

function Pair({ f }: { f: Furq }) {
  const { a, b } = useMemo(() => sides(f.ops), [f]);
  const identical = f.cat === "تطابق";
  return (
    <div className="fr-card">
      <div className="fr-head">
        <Link to={readPathOf(f.a)} className="fr-ref">{arName(f.a)}</Link>
        <span className="fr-vs">↔</span>
        <Link to={readPathOf(f.b)} className="fr-ref">{arName(f.b)}</Link>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="chip gold" title={CAT_INFO[f.cat]?.note}>{f.cat}</span>
      </div>
      {identical ? (
        <div className="fr-line quran">
          <span className="fr-tag">≡</span>
          {a.map((s, i) => <span key={i}>{s.text}{" "}</span>)}
        </div>
      ) : (
        <>
          <VerseLine segs={a} side="a" />
          <VerseLine segs={b} side="b" />
        </>
      )}
    </div>
  );
}

export default function Furuq() {
  useUILang();
  const data = useFuruq();
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const ar = getUILang() === "ar";

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim();
    return data.furuq.filter((f) => {
      if (cat && f.cat !== cat) return false;
      if (needle) {
        const hay = `${arName(f.a)} ${arName(f.b)} ${f.a} ${f.b}`;
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, cat, q]);

  // reset paging when the filter changes
  useEffect(() => setLimit(40), [cat, q]);

  if (!data) {
    return (
      <div className="page page-narrow">
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div>
      </div>
    );
  }

  const cats = data.meta.categories;
  return (
    <div className="page">
      <div className="fr-wrap">
        <header className="jw-header">
          <h1 className="jw-title">{ar ? "فروق التنزيل" : "Furūq al-Tanzīl"}</h1>
          <p className="jw-lead">
            {ar
              ? "المتشابهات اللفظية في القرآن: آيتان تكادان تتطابقان، فنحاذيهما كلمةً بكلمة ونُبيّن ما اختلف بالضبط — من نصّ القرآن وصرفه وحدهما."
              : "The Qur'an's near-identical verses: two verses that almost match, aligned word by word to show exactly what differs — from the text and its morphology alone."}
          </p>
          <div className="jw-stats">
            <span className="chip"><b>{num(data.meta.pairs)}</b> {ar ? "زوجًا" : "pairs"}</span>
            <span className="chip"><b>{num(CAT_ORDER.length)}</b> {ar ? "فئات محسوبة" : "computed categories"}</span>
          </div>
        </header>

        <div className="jw-filters">
          <input
            placeholder={ar ? "رشِّح بالسورة أو الموضع (مثل: البقرة · ٢:٢٥)…" : "filter by surah or ref…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="jw-chipset">
            <button className={cat === "" ? "on" : ""} onClick={() => setCat("")} title={ar ? "كل الفئات" : "all"}>
              {ar ? "الكل" : "all"} <span className="muted">· {num(data.meta.pairs)}</span>
            </button>
            {CAT_ORDER.map((c) => (
              <button
                key={c}
                className={cat === c ? "on" : ""}
                onClick={() => setCat(cat === c ? "" : c)}
                title={CAT_INFO[c]?.note}
              >
                {c} <span className="muted">· {num(cats[c] ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="muted jw-resultcount">
          {num(rows.length)} {ar ? "زوجًا" : "pairs"}
          {cat && CAT_INFO[cat] && <span> · {ar ? CAT_INFO[cat].note : CAT_INFO[cat].en}</span>}
        </div>

        <div className="fr-list">
          {rows.slice(0, limit).map((f, i) => (
            <Pair key={`${f.a}|${f.b}|${i}`} f={f} />
          ))}
        </div>
        {rows.length > limit && (
          <div style={{ textAlign: "center", margin: "18px 0" }}>
            <button onClick={() => setLimit(limit + 60)}>
              {ar ? `عرض المزيد (${num(rows.length - limit)})` : `show more (${rows.length - limit})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

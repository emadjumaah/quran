/**
 * رحلة الجذر — a root's path through the REVELATION order (not the mushaf order).
 * Using each surah's chronoOrder + Meccan/Medinan tag, we plot where a root first
 * appears, how it recurs across the timeline, and whether it belongs to the
 * Meccan or Medinan phase. A computed narrative from the text's own structure —
 * an axis no other view here touches — with no interpretation.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fuzzyRoots, getRoot, listSurahs } from "../db";
import { getUILang, num, useUILang } from "../i18n";
import type { RootDoc, SurahDoc } from "../types";

export default function RootJourney() {
  useUILang();
  const ar = getUILang() === "ar";
  const navigate = useNavigate();
  const { root: routeRoot } = useParams();
  const root = routeRoot ? decodeURIComponent(routeRoot) : "رحم";
  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const [doc, setDoc] = useState<RootDoc | null>(null);
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<RootDoc[]>([]);

  useEffect(() => { listSurahs().then(setSurahs).catch(() => setSurahs([])); }, []);
  useEffect(() => { setDoc(null); getRoot(root).then(setDoc).catch(() => setDoc(null)); }, [root]);
  useEffect(() => {
    if (!q.trim()) { setSugs([]); return; }
    let live = true;
    fuzzyRoots(q.trim(), 8).then((rs) => live && setSugs(rs.map((x) => x.doc))).catch(() => {});
    return () => { live = false; };
  }, [q]);

  const chrono = useMemo(() => [...surahs].sort((a, b) => a.chronoOrder - b.chronoOrder), [surahs]);
  const info = useMemo(() => {
    if (!doc || !chrono.length) return null;
    const per = new Map<number, number>();
    for (const loc of doc.locations ?? []) {
      const s = Number(String(loc).split(":")[0]);
      per.set(s, (per.get(s) ?? 0) + 1);
    }
    const cmap = new Map(surahs.map((s) => [s.surahNo, s]));
    let meccan = 0, medinan = 0;
    for (const [s, c] of per) (cmap.get(s)?.revelation === "Meccan" ? (meccan += c) : (medinan += c));
    const timeline = chrono.map((s) => ({ s, count: per.get(s.surahNo) ?? 0 }));
    const present = timeline.filter((t) => t.count > 0);
    const max = Math.max(1, ...present.map((t) => t.count));
    return {
      per, meccan, medinan, timeline, max,
      first: present[0]?.s, last: present[present.length - 1]?.s,
      surahCount: per.size, total: doc.occurrences ?? 0,
    };
  }, [doc, chrono, surahs]);

  const era = info ? (info.medinan === 0 ? "مكّيّ خالص" : info.meccan === 0 ? "مدنيّ خالص" : info.meccan >= info.medinan * 2 ? "مكّيّ الغالب" : info.medinan >= info.meccan * 2 ? "مدنيّ الغالب" : "موزّعٌ بين العهدين") : "";
  const eraEn = info ? (info.medinan === 0 ? "purely Meccan" : info.meccan === 0 ? "purely Medinan" : info.meccan >= info.medinan ? "mostly Meccan" : "mostly Medinan") : "";

  const pick = (r: string) => { setQ(""); setSugs([]); navigate(`/journey/${encodeURIComponent(r)}`); };

  return (
    <div className="page">
      <div className="rj-wrap">
        <header className="rj-head">
          <h1 className="rj-title">{ar ? "رحلة الجذر" : "The Root's Journey"}</h1>
          <p className="rj-lead">
            {ar
              ? "أين يظهر الجذر عبر ترتيب النزول؟ نرسم مواضعه من أوّل ما نزل إلى آخره — من بنية النصّ وحدها، لا تفسير."
              : "Where does a root appear across the order of revelation? Its path from the earliest revealed surah to the latest — from the text's structure alone."}
          </p>
          <div className="rj-search page-search">
            <span className="page-search-icon" aria-hidden>⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث عن جذر…" : "search a root…"} aria-label={ar ? "ابحث عن جذر" : "search a root"} />
            {sugs.length > 0 && (
              <div className="rj-sugs">
                {sugs.map((r) => (
                  <button key={r.root} className="rj-sug quran" onClick={() => pick(r.root)}>
                    {r.root} <span className="muted">{num(r.occurrences)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {!info ? (
          <p className="muted" style={{ textAlign: "center", padding: 30 }}>{ar ? "جارٍ التحميل…" : "Loading…"}</p>
        ) : info.total === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 30 }}>{ar ? "لا مواضع لهذا الجذر." : "No occurrences."}</p>
        ) : (
          <>
            <div className="rj-hero">
              <div className="rj-root quran">{root}</div>
              <div className="rj-facts">
                <span className="rj-fact"><b>{num(info.total)}</b> {ar ? "مرّة" : "occ."}</span>
                <span className="rj-fact"><b>{num(info.surahCount)}</b> {ar ? "سورة" : "suras"}</span>
                <span className={`rj-badge ${info.meccan >= info.medinan ? "mecc" : "med"}`}>{ar ? era : eraEn}</span>
              </div>
            </div>

            {/* the timeline — earliest revelation on the left → latest on the right */}
            <div className="rj-timeline-box">
              <div className="rj-axis"><span>{ar ? "الأقدم نزولًا ←" : "← earliest"}</span><span>{ar ? "→ الأحدث" : "latest →"}</span></div>
              <div className="rj-timeline">
                {info.timeline.map(({ s, count }) => (
                  <div
                    key={s.surahNo}
                    className={`rj-bar ${s.revelation === "Meccan" ? "mecc" : "med"}${count === 0 ? " empty" : ""}`}
                    style={{ height: count === 0 ? 3 : 6 + Math.round((Math.sqrt(count) / Math.sqrt(info.max)) * 64) }}
                    title={`${s.nameAr} — ${count ? `${num(count)} ${ar ? "مرّة" : ""}` : ar ? "لا يرد" : "absent"} · ${s.revelation === "Meccan" ? (ar ? "مكّية" : "Meccan") : (ar ? "مدنية" : "Medinan")}`}
                  />
                ))}
              </div>
              <div className="rj-legend">
                <span><i className="rj-dot mecc" /> {ar ? "مكّية" : "Meccan"} {num(info.meccan)}</span>
                <span><i className="rj-dot med" /> {ar ? "مدنية" : "Medinan"} {num(info.medinan)}</span>
              </div>
            </div>

            {info.first && info.last && (
              <p className="rj-narr">
                {ar ? (
                  <>ظهر أوّلَ ما ظهر في <Link to={`/read/${info.first.surahNo}`} className="rj-link">{info.first.nameAr}</Link> (الترتيب {num(info.first.chronoOrder)} نزولًا)، وآخرُ وروده في <Link to={`/read/${info.last.surahNo}`} className="rj-link">{info.last.nameAr}</Link> (الترتيب {num(info.last.chronoOrder)}). وهو {era}.</>
                ) : (
                  <>First appears in <Link to={`/read/${info.first.surahNo}`} className="rj-link">{info.first.nameAr}</Link> (revelation #{info.first.chronoOrder}), last in <Link to={`/read/${info.last.surahNo}`} className="rj-link">{info.last.nameAr}</Link> (#{info.last.chronoOrder}) — {eraEn}.</>
                )}
              </p>
            )}

            <div className="rj-links">
              <Link to={`/roots/${encodeURIComponent(root)}`} className="chip link">{ar ? "مواضعه ومشتقّاته ←" : "occurrences & derivations →"}</Link>
              <Link to={`/learn`} className="chip link">{ar ? "احفظه في مسار الجذور ←" : "learn it →"}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

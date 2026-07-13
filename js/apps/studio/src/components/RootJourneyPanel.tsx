/**
 * رحلة الجذر — a root's path through the REVELATION order (not mushaf order),
 * embedded inside the root page. Each surah is a bar (Meccan/Medinan), placed by
 * chronoOrder; tap a bar to see the root's verses there. A computed narrative from
 * the text's own structure — no interpretation. (Was the standalone /journey page.)
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getRoot, listAyahs, listSurahs } from "../db";
import { getUILang, num } from "../i18n";
import type { AyahDoc, RootDoc, SurahDoc } from "../types";

export default function RootJourneyPanel({ root }: { root: string }) {
  const ar = getUILang() === "ar";
  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const [doc, setDoc] = useState<RootDoc | null>(null);
  const [selBar, setSelBar] = useState<{ surah: SurahDoc; ayahs: AyahDoc[] } | null>(null);

  useEffect(() => { listSurahs().then(setSurahs).catch(() => setSurahs([])); }, []);
  useEffect(() => { setDoc(null); getRoot(root).then(setDoc).catch(() => setDoc(null)); }, [root]);

  const openBar = async (s: SurahDoc, count: number) => {
    if (!count || !doc) return;
    const nos = new Set<number>();
    for (const loc of doc.locations ?? []) {
      const [ss, aa] = String(loc).split(":").map(Number);
      if (ss === s.surahNo) nos.add(aa);
    }
    const all = await listAyahs(s.surahNo).catch(() => [] as AyahDoc[]);
    setSelBar({ surah: s, ayahs: all.filter((a) => nos.has(a.ayahNo)) });
  };

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
    return { per, meccan, medinan, timeline, max, first: present[0]?.s, last: present[present.length - 1]?.s, surahCount: per.size, total: doc.occurrences ?? 0 };
  }, [doc, chrono, surahs]);

  const era = info ? (info.medinan === 0 ? "مكّيّ خالص" : info.meccan === 0 ? "مدنيّ خالص" : info.meccan >= info.medinan * 2 ? "مكّيّ الغالب" : info.medinan >= info.meccan * 2 ? "مدنيّ الغالب" : "موزّعٌ بين العهدين") : "";
  const eraEn = info ? (info.medinan === 0 ? "purely Meccan" : info.meccan === 0 ? "purely Medinan" : info.meccan >= info.medinan ? "mostly Meccan" : "mostly Medinan") : "";

  if (!info || info.total === 0) return null;

  return (
    <div className="card rj-panel" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>{ar ? "رحلة الجذر عبر النزول" : "The root's journey through revelation"}</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {ar ? "أين يظهر الجذر عبر ترتيب النزول — من أوّل ما نزل إلى آخره. انقُرْ عمودًا لترى مواضعه في تلك السورة." : "Where the root appears across the order of revelation — earliest to latest. Tap a bar for its verses there."}
      </p>

      <div className="rj-hero" style={{ marginTop: 6 }}>
        <div className="rj-facts">
          <span className="rj-fact"><b>{num(info.total)}</b> {ar ? "مرّة" : "occ."}</span>
          <span className="rj-fact"><b>{num(info.surahCount)}</b> {ar ? "سورة" : "suras"}</span>
          <span className={`rj-badge ${info.meccan >= info.medinan ? "mecc" : "med"}`}>{ar ? era : eraEn}</span>
        </div>
      </div>

      <div className="rj-timeline-box">
        <div className="rj-axis"><span>{ar ? "الأقدم نزولًا ←" : "← earliest"}</span><span>{ar ? "→ الأحدث" : "latest →"}</span></div>
        <div className="rj-timeline">
          {info.timeline.map(({ s, count }) => (
            <div
              key={s.surahNo}
              className={`rj-bar ${s.revelation === "Meccan" ? "mecc" : "med"}${count === 0 ? " empty" : ""}`}
              style={{ height: count === 0 ? 3 : 6 + Math.round((Math.sqrt(count) / Math.sqrt(info.max)) * 64) }}
              title={`${s.nameAr} — ${count ? `${num(count)} ${ar ? "مرّة" : ""}` : ar ? "لا يرد" : "absent"} · ${s.revelation === "Meccan" ? (ar ? "مكّية" : "Meccan") : (ar ? "مدنية" : "Medinan")}`}
              onClick={() => void openBar(s, count)}
              role={count ? "button" : undefined}
              aria-label={count ? `${s.nameAr} · ${num(count)}` : undefined}
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

      {selBar && (
        <div className="rj-modal-bg" onClick={() => setSelBar(null)}>
          <div className="rj-modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="rj-modal-head">
              <span className="quran rj-modal-title">
                {selBar.surah.nameAr}
                <span className="muted"> · {selBar.surah.revelation === "Meccan" ? (ar ? "مكّية" : "Meccan") : (ar ? "مدنية" : "Medinan")} · {ar ? `${num(selBar.ayahs.length)} موضعًا` : `${selBar.ayahs.length} verses`}</span>
              </span>
              <button className="rj-modal-x" onClick={() => setSelBar(null)} aria-label={ar ? "إغلاق" : "close"}>✕</button>
            </div>
            <div className="rj-modal-body">
              {selBar.ayahs.map((a) => (
                <Link key={a.ayahNo} to={`/read/${a.surahNo}/${a.ayahNo}`} className="rj-verse" onClick={() => setSelBar(null)}>
                  <span className="quran rj-verse-text">{a.textUthmani}<span className="ayah-marker"> ﴿{num(a.ayahNo)}﴾</span></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

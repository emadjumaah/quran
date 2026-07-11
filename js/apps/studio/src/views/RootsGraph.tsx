/**
 * توارد الجذور — النسيج — an INTERACTIVE map of root co-occurrence. A root sits
 * at the centre; the roots that most often share an ayah with it fan out, each
 * thread as thick as the bond is strong (عدد الآيات المشتركة). Tap a node to
 * glide the fabric onto it and walk the Qur'an's vocabulary outward; drag to
 * pan, pinch / buttons to zoom. Radial + one hub at a time, so it stays legible
 * on a phone. The companions list beneath links to «آيات اللقاء» — the shared
 * ayahs themselves, the evidence. Route: /fabric and /fabric/:root.
 *
 * Purely computed from the precomputed rootEdges — «نحسب ونعرض».
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getRoot, neighborsOfRoot, searchRoots, topRoots } from "../db";
import type { NeighborRoot } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import { usePanZoom } from "../panzoom";
import type { RootDoc } from "../types";

const MAX_NODES = 12; // legible on a phone

/** First sentence-ish of a root's classical gloss (الراغب / مقاييس). */
const glossOf = (doc: RootDoc | null | undefined): string | null => {
  const text = doc?.meanings?.[0]?.text;
  if (!text) return null;
  const cut = text.slice(0, 120);
  return cut.length < text.length ? `${cut}…` : cut;
};

/** A tiny root-search so the fabric is self-sufficient (jump the hub). */
function HubSearch({ onPick }: { onPick: (root: string) => void }) {
  useUILang();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RootDoc[]>([]);
  useEffect(() => {
    const s = q.trim();
    if (!s) { setHits([]); return; }
    let alive = true;
    searchRoots(s, 10).then((rs) => alive && setHits(rs)).catch(() => alive && setHits([]));
    return () => { alive = false; };
  }, [q]);
  const ar = getUILang() === "ar";
  return (
    <div className="rg-search">
      <input
        dir="rtl"
        value={q}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        placeholder={ar ? "ابحث عن جذر لتوسيطه…" : "search a root to centre…"}
        style={{ width: "100%", fontFamily: "var(--font-quran)" }}
      />
      {hits.length > 0 && (
        <div className="rg-hits">
          {hits.map((r) => (
            <button
              key={r._id}
              className="chip link"
              onClick={() => { setQ(""); setHits([]); onPick(r.root); }}
            >
              <span className="quran" style={{ fontSize: 18, lineHeight: 1.3 }}>{r.root}</span>
              <b>{num(r.occurrences)}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RootsGraph() {
  useUILang();
  const ar = getUILang() === "ar";
  const navigate = useNavigate();
  const { root: paramRoot } = useParams<{ root?: string }>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // a sensible default hub: the commonest root in the corpus
  const [defaultRoot, setDefaultRoot] = useState<string | null>(null);
  useEffect(() => {
    topRoots(1).then((rs) => setDefaultRoot(rs[0]?.root ?? null)).catch(() => {});
  }, []);

  // the current centre lives in state so re-centring is instant + animatable
  const [center, setCenter] = useState<string | null>(null);
  useEffect(() => {
    const p = paramRoot ? decodeURIComponent(paramRoot) : null;
    setCenter(p ?? defaultRoot);
  }, [paramRoot, defaultRoot]);

  // pan/zoom transform over a 0..100 viewBox (shared engine)
  const { view, reset, zoomAt, svgHandlers } = usePanZoom(svgRef);
  useEffect(() => reset(), [center]); // re-centre → reset the pan/zoom onto it

  // load the hub + its companions; keep the previous graph on screen while the
  // next loads (rootEdges are indexed → near-instant), so re-centring glides.
  const [data, setData] = useState<{ center: string; doc: RootDoc | null; neighbors: NeighborRoot[] } | null>(null);
  useEffect(() => {
    if (!center) return;
    let alive = true;
    Promise.all([getRoot(center), neighborsOfRoot(center, 40).catch((): NeighborRoot[] => [])])
      .then(([doc, ns]) => alive && setData({ center, doc, neighbors: ns }))
      .catch(() => alive && setData({ center, doc: null, neighbors: [] }));
    return () => { alive = false; };
  }, [center]);

  const nodes = useMemo(() => {
    const ns = (data?.neighbors ?? []).slice(0, MAX_NODES);
    const maxW = ns[0]?.w ?? 1;
    const R = 37;
    const N = Math.max(ns.length, 1);
    return ns.map((nb, i) => {
      const ang = (i / N) * 2 * Math.PI - Math.PI / 2;
      const t01 = nb.w / maxW;
      return {
        ...nb,
        x: 50 + R * Math.cos(ang),
        y: 50 + R * Math.sin(ang),
        t01,
        r: 1.8 + 1.7 * t01,
      };
    });
  }, [data]);

  const recenter = (root: string) => {
    setCenter(root);
    navigate(`/fabric/${encodeURIComponent(root)}`, { replace: true });
  };

  if (!data) {
    return (
      <div className="page page-narrow">
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div>
      </div>
    );
  }

  const { doc, neighbors } = data;
  const maxW = neighbors[0]?.w ?? 1;
  const gloss = glossOf(doc);

  return (
    <div className="page">
      <div className="jw-wrap">
        <header className="jw-header">
          <h1 className="jw-title">{ar ? "توارد الجذور — النسيج" : "Roots Fabric"}</h1>
          <p className="jw-lead">
            {ar
              ? "شبكةُ الجذور التي تلتقي في الآيات نفسها، تفاعليّةً: انقر أيّ جذرٍ ليتوسّط النسيجُ حوله وتمشيَ في مفردات القرآن، واسحب للتحريك، وقرِّب بأصبعين. غِلَظُ الخيط وحجمُ العقدة بمقدار قوّة التوارد — محسوبٌ من نصّ القرآن وحده."
              : "The network of roots that meet in the same ayahs, interactive: tap a root to re-centre and walk the Qur'an's vocabulary, drag to pan, pinch to zoom. Thicker threads = stronger co-occurrence — computed from the text alone."}
          </p>
        </header>

        <HubSearch onPick={recenter} />

        <div className="graph-center-bar">
          <span className="quran graph-center-ref" style={{ fontSize: 22 }}>{data.center}</span>
          {doc && <span className="muted">{num(doc.occurrences)} {ar ? "مرّة" : "×"}</span>}
          <span style={{ flex: 1 }} />
          <Link to={`/roots/${encodeURIComponent(data.center)}`} className="chip link" style={{ textDecoration: "none" }}>
            {ar ? "صفحة الجذر ↗" : "root ↗"}
          </Link>
        </div>

        {gloss && (
          <p className="muted" dir="rtl" style={{ lineHeight: 1.95, margin: "0 0 12px", fontSize: 14 }}>
            {gloss}
          </p>
        )}

        <div className="graph-stage">
          <svg
            ref={svgRef}
            className="graph-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            {...svgHandlers}
            role="img"
            aria-label={ar ? "شبكة توارد الجذر" : "root co-occurrence network"}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              <g key={data.center} className="graph-content">
                {nodes.map((nd) => (
                  <line
                    key={`e${nd.root}`}
                    className="graph-edge"
                    x1={50} y1={50} x2={nd.x} y2={nd.y}
                    stroke="var(--accent)"
                    strokeWidth={0.35 + 1.0 * nd.t01}
                    strokeOpacity={0.3 + 0.5 * nd.t01}
                  />
                ))}
                {nodes.map((nd) => (
                  <g
                    key={`n${nd.root}`}
                    className="graph-node"
                    transform={`translate(${nd.x} ${nd.y})`}
                    onClick={() => recenter(nd.root)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{`${nd.root} — ${num(nd.w)} ${ar ? "آية مشتركة" : "shared ayahs"}`}</title>
                    <circle r={nd.r} fill="var(--accent)" fillOpacity={0.85} />
                    <text y={-nd.r - 1.6} textAnchor="middle" className="rg-node-label quran">{nd.root}</text>
                  </g>
                ))}
                <g transform="translate(50 50)">
                  <circle r={6} className="graph-hub" />
                  <text y={2} textAnchor="middle" className="rg-hub-label quran">{data.center}</text>
                </g>
              </g>
            </g>
          </svg>
          <div className="graph-ctrls">
            <button onClick={() => zoomAt(50, 50, 1.25)} aria-label={ar ? "تقريب" : "zoom in"}>＋</button>
            <button onClick={() => zoomAt(50, 50, 1 / 1.25)} aria-label={ar ? "تبعيد" : "zoom out"}>－</button>
            <button onClick={reset} aria-label={ar ? "توسيط" : "reset"}>⟳</button>
          </div>
        </div>

        <div className="graph-legend">
          <span className="muted">
            {ar ? "غِلَظُ الخيط وحجمُ العقدة بمقدار عدد الآيات التي يلتقي فيها الجذران — والعددُ بجانب كلِّ جذرٍ في القائمة أدناه" : "thread & node size = ayahs the two roots share; exact counts in the list below"}
          </span>
        </div>

        {neighbors.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", margin: "16px 0" }}>{t("notFound")}</p>
        ) : (
          <div className="rg-list">
            {neighbors.slice(0, MAX_NODES).map((n) => (
              <div key={n.root} className="rg-row">
                <button className="rg-root quran" onClick={() => recenter(n.root)} title={ar ? "توسيط النسيج على هذا الجذر" : "centre on this root"}>
                  {n.root}
                </button>
                <span className="rg-bar"><span style={{ width: `${(n.w / maxW) * 100}%` }} /></span>
                <span className="rg-meet">
                  <b style={{ color: "var(--ink)" }}>{num(n.w)}</b> {ar ? "آية" : "ayahs"}
                </span>
                <Link
                  to={`/network/${encodeURIComponent(data.center)}/${encodeURIComponent(n.root)}`}
                  className="chip link"
                  style={{ textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  {ar ? "آيات اللقاء ←" : "shared ayahs ←"}
                </Link>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "20px 0", flexWrap: "wrap" }}>
          <Link to={`/network/${encodeURIComponent(data.center)}`} className="chip link" style={{ textDecoration: "none" }}>
            {ar ? "عرض الشواهد كاملةً ←" : "full evidence list ←"}
          </Link>
          <Link to="/roots" className="chip" style={{ textDecoration: "none" }}>
            ← {ar ? "الجذور" : "Roots"}
          </Link>
        </div>
      </div>
    </div>
  );
}

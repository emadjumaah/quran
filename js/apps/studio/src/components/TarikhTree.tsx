/**
 * شجرةُ الطرق التفاعليّة — تحريكٌ وتقريب، والنقرةُ على العقدة تفتح لوحتَها.
 *
 * التخطيط: الطبقاتُ بعمق العقدة (`depth`) — منتهى الطريق (الصحابيّ فالنبيّ ﷺ)
 * أعلى، والمصنِّفون أسفل — ثم ترتيبٌ أفقيٌّ بمركز ثقل الجيران (كنسٍ صاعدٍ
 * ونازل) كي تقلّ التقاطعات. عقدةُ الاسم غير المسوّاة (`n:`) تُرسم مربّعةً
 * مخطَّطة — وهي أساسُ القيد ق-ج، والحافّةُ المشبوهةُ زمنيًّا (`chrono_suspect`)
 * تُرسم متقطّعةً بلون التنبيه الهادئ. كلاهما مشروحٌ في مفتاح الرسم أسفلَه.
 */
import { useMemo, useRef, useState } from "react";
import { usePanZoom } from "../panzoom";
import { arNum, count, COUNTS, FLAG_GLOSS, jamiHref, type TarikhCluster, type TarikhNode } from "../lib/tarikhData";

/** فاصلةٌ معزولةُ الاتجاه — لا تلتصق بالأرقام فتُقرأ رقمًا */
const Sep = () => <span className="sep">·</span>;

const W = 100, H = 100;

interface Placed { n: TarikhNode; x: number; y: number }

function layout(cluster: TarikhCluster): { placed: Placed[]; byId: Map<string, Placed> } {
  const nodes = cluster.nodes;
  const maxDepth = Math.max(1, ...nodes.map((n) => n.depth));
  const layers = new Map<number, TarikhNode[]>();
  for (const n of nodes) {
    const d = n.depth;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  }
  const order = new Map<string, number>();
  for (const [, arr] of layers) {
    arr.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    arr.forEach((n, i) => order.set(n.id, i));
  }
  // كنسُ مركز الثقل: يُقرّب كلَّ عقدةٍ من متوسّط مواضع جيرانها
  const nbrs = new Map<string, string[]>();
  const link = (k: string, v: string) => {
    const a = nbrs.get(k);
    if (a) a.push(v); else nbrs.set(k, [v]);
  };
  for (const e of cluster.edges) { link(e.from, e.to); link(e.to, e.from); }
  const pos = new Map<string, number>();
  for (const [, arr] of layers) arr.forEach((n, i) => pos.set(n.id, arr.length > 1 ? i / (arr.length - 1) : 0.5));
  for (let sweep = 0; sweep < 6; sweep++) {
    for (const [, arr] of layers) {
      const scored = arr.map((n) => {
        const ns = nbrs.get(n.id) ?? [];
        const vals = ns.map((m) => pos.get(m)).filter((x): x is number => x !== undefined);
        return { n, k: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : pos.get(n.id) ?? 0.5 };
      });
      scored.sort((a, b) => a.k - b.k || a.n.label.localeCompare(b.n.label, "ar"));
      scored.forEach((s, i) => pos.set(s.n.id, arr.length > 1 ? i / (arr.length - 1) : 0.5));
      scored.forEach((s, i) => order.set(s.n.id, i));
    }
  }
  const placed: Placed[] = [];
  for (const [d, arr] of layers) {
    const sorted = [...arr].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    sorted.forEach((n, i) => {
      const t = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
      placed.push({
        n,
        x: 6 + t * (W - 12),
        y: H - 6 - (d / maxDepth) * (H - 12), // العمقُ الأكبر (المنتهى) أعلى
      });
    });
  }
  return { placed, byId: new Map(placed.map((p) => [p.n.id, p])) };
}

const short = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n)}…` : s);

export default function TarikhTree({ cluster }: { cluster: TarikhCluster }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pz = usePanZoom(svgRef);
  const [open, setOpen] = useState<string | null>(null);
  const { placed, byId } = useMemo(() => layout(cluster), [cluster]);
  const recordsById = useMemo(() => new Map(cluster.records.map((r) => [r.id, r])), [cluster]);
  const node = open ? cluster.nodes.find((n) => n.id === open) ?? null : null;

  return (
    <>
      <div className="tree">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`شجرةُ طرق العنقود ${cluster.id}`}
          {...pz.svgHandlers}
        >
          <g transform={`translate(${pz.view.x} ${pz.view.y}) scale(${pz.view.k})`}>
            {cluster.edges.map((e, i) => {
              const a = byId.get(e.from), b = byId.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={e.chronoSuspect ? "var(--gold, #a97e2f)" : "currentColor"}
                  strokeOpacity={e.chronoSuspect ? 0.85 : 0.28}
                  strokeWidth={e.chronoSuspect ? 0.42 : 0.28}
                  strokeDasharray={e.chronoSuspect ? "1 0.8" : undefined}
                />
              );
            })}
            {placed.map((p) => {
              const on = p.n.id === open;
              const r = 0.95 + Math.min(1.5, p.n.students * 0.18);
              return (
                <g key={p.n.id} className="tnode" onClick={() => setOpen(p.n.id)}>
                  {p.n.nameNode ? (
                    <rect
                      x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={0.3}
                      fill="none" stroke={on ? "var(--accent, #0b6e56)" : "currentColor"}
                      strokeOpacity={on ? 1 : 0.6} strokeWidth={0.3} strokeDasharray="0.7 0.5"
                    />
                  ) : (
                    <circle
                      cx={p.x} cy={p.y} r={r}
                      fill={on ? "var(--accent, #0b6e56)" : "currentColor"}
                      fillOpacity={on ? 1 : 0.55}
                    />
                  )}
                  <text
                    x={p.x} y={p.y - r - 0.8} textAnchor="middle"
                    fontSize={1.75} fill="currentColor" fillOpacity={on ? 0.95 : 0.68}
                  >
                    {short(p.n.label, 15)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="zoom">
          <button onClick={() => pz.zoomAt(50, 50, 1.3)} aria-label="تقريب">+</button>
          <button onClick={() => pz.zoomAt(50, 50, 1 / 1.3)} aria-label="تبعيد">−</button>
          <button onClick={pz.reset} aria-label="إعادة الضبط" title="إعادة الضبط">⟲</button>
        </div>
        <div className="stat">
          {count(cluster.nodes.length, COUNTS.node)}<Sep />
          {count(cluster.edges.length, COUNTS.edge)}<Sep />
          {count(cluster.records.length, COUNTS.record)}
        </div>
      </div>

      <div className="legend">
        <span><i style={{ background: "currentColor", opacity: 0.55, borderRadius: "50%" }} /> راوٍ مسوّى الهويّة — وحجمُ الدائرة بعدد تلاميذه</span>
        <span><i style={{ border: "1.5px dashed currentColor", opacity: 0.7 }} /> عقدةُ اسمٍ غير مسوّاة — مرشَّحُها «منقوصُ العدّ محتملُ الخلط» (القيد ق-ج)</span>
        <span><i style={{ background: "var(--gold, #a97e2f)", height: 3, borderRadius: 2, marginBlock: 4 }} /> حافّةٌ مشبوهةٌ زمنيًّا — وفاةُ التلميذ لا تلائم وفاةَ شيخه</span>
      </div>
      <p className="note" style={{ margin: "6px 2px 0" }}>
        اسحب لتحريك الشجرة، وقرّبها بالعجلة أو بالزرّين — والمنتهى أعلاها والمصنِّفون أسفلَها.
        انقر عقدةً ترَ نصوصَ رواياتها حرفًا.
      </p>

      {node && (
        <>
          <div className="np-back" onClick={() => setOpen(null)} />
          <aside className="np" role="dialog" aria-label={`لوحةُ العقدة ${node.label}`}>
            <div className="np-h">
              <b>{node.label}</b>
              <button onClick={() => setOpen(null)} aria-label="إغلاق">✕</button>
            </div>
            <div className="np-b">
              <div className="facts">
                {node.deathYear != null && <span>ت{arNum(node.deathYear)}هـ</span>}
                <span>تلاميذُه {arNum(node.students)}</span>
                {node.studentsCorroborated > 0 && <span>{count(node.studentsCorroborated, COUNTS.branch)}</span>}
                {node.singleThreadAbove > 0 && <span>مقاطعُ مفردةٌ فوقه {arNum(node.singleThreadAbove)}</span>}
                {node.nameNode && <span className="flag">عقدةُ اسمٍ غير مسوّاة — القيد ق-ج</span>}
                {node.flags.map((f) => (
                  <span key={f} className="flag" title={FLAG_GLOSS[f] ?? f}>{FLAG_GLOSS[f] ?? f}</span>
                ))}
              </div>
              {node.records.length === 0 && <p className="note">لا سجلَّ معلَّقًا بهذه العقدة بعينها.</p>}
              {node.records.map((rid) => {
                const r = recordsById.get(rid);
                if (!r) return null;
                const href = r.jamiRef ? jamiHref(r.jamiRef) : null;
                return (
                  <div className="rec" key={rid}>
                    <div className="src">
                      <b>{r.source.workAr ?? "—"}</b>
                      {r.source.authorAr ? ` — ${r.source.authorAr}` : ""}
                      {r.source.deathAh != null ? ` (ت${arNum(r.source.deathAh)})` : ""}
                      {r.source.locus ? <><Sep /><bdi>{r.source.locus}</bdi></> : null}
                      <Sep /><bdi style={{ opacity: 0.7 }}>{r.id}</bdi>
                    </div>
                    <div className="txt" dir="rtl" lang="ar">{r.fullText}</div>
                    {r.jamiRef && (
                      href
                        ? <a className="jami" href={href} target="_blank" rel="noreferrer">في «الجامع»: {arNum(r.jamiRef)}</a>
                        : <span className="jami" title="معرّفُ الرواية في موسوعة «الجامع»">في «الجامع»: {arNum(r.jamiRef)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

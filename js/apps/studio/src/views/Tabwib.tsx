/**
 * مواضيع مشكاة — التبويب الموضوعي المحسوب بالكامل من إصدار مشكاة، على شكل
 * التقليدي وبنياننا: أبوابٌ كبرى (عنقدة حتمية لمراكز المحاور) ← مواضيع (المحاور
 * المنبثقة بأسمائها) ← وحدات السياق المسمّاة (تغطي المصحف كله) ← المصحف.
 *   /tabwib        → الأبواب
 *   /tabwib/:bab   → باب ← مواضيعه (أكورديون) ← وحداته
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { surahNameAr } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import { themeName, useKulliyat } from "../kulliyat";
import { loadSiyaq, type SiyaqUnit } from "../siyaq";
import { loadTabwib, unitsOfAxis, loadAbwab, babsList, babOf, type Bab } from "../tabwib";
import TopicLayerToggle from "../components/TopicLayerToggle";

function useTabwibReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([loadTabwib(), loadAbwab(), loadSiyaq()]).then(() => live && setReady(true));
    return () => { live = false; };
  }, []);
  return ready;
}

function BabsView() {
  const ar = getUILang() === "ar";
  const babs = babsList();
  return (
    <>
      <header className="mw-head">
        <h1 className="mw-title">{ar ? "مواضيع مشكاة" : "Mishkat Topics"}</h1>
        <p className="mw-lead">
          {ar
            ? "تبويبٌ موضوعيٌّ محسوبٌ بالكامل من إصدار مشكاة: أبوابٌ كبرى انعقدت حسابيًّا من محاور الشبكة الموحّدة، تحتها المواضيعُ (المحاور المنبثقة بأسمائها)، ثم مقاطعُ المصحف كلِّه — وحداتُ السياق المسمّاة وحدةً وحدة. لا قائمةَ موضوعاتٍ جاهزة — حسبنا وعرضنا."
            : "A fully computed topical index from Mishkat: major chapters clustered from the unified network's axes, then the topics (the named emergent axes), then the whole muṣḥaf's passages — the named context units, one by one. No preset topic list — computed and shown."}
        </p>
        <div className="muted" style={{ fontSize: 13 }}>{num(babs.length)} {ar ? "بابًا" : "chapters"} · {num(206)} {ar ? "موضوعًا" : "topics"} · {num(1325)} {ar ? "وحدة تغطي المصحف كله" : "units covering the whole muṣḥaf"}</div>
        <TopicLayerToggle />
      </header>
      <div className="mw-topics mw-topics-lg">
        {babs.map((b) => (
          <Link key={b.id} to={`/tabwib/${b.id}`} className="mw-topic-card">
            <span className="mw-topic-name">{b.name}</span>
            <span className="mw-topic-count">{num(b.axes.length)} {ar ? "موضوعًا" : "topics"} · {num(b.units)} {ar ? "وحدة" : "units"}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function BabView({ bab }: { bab: Bab }) {
  const ar = getUILang() === "ar";
  const [open, setOpen] = useState<number | null>(bab.axes[0] ?? null);
  const [units, setUnits] = useState<Map<number, { unit: SiyaqUnit; approx: boolean }[]>>(new Map());
  useEffect(() => {
    let live = true;
    loadSiyaq().then((sy) => {
      if (!live || !sy) return;
      const m = new Map<number, { unit: SiyaqUnit; approx: boolean }[]>();
      for (const ax of bab.axes) {
        m.set(ax, unitsOfAxis(ax).map(({ u, approx }) => ({ unit: (sy as { units: SiyaqUnit[] }).units[u], approx })).filter((x) => x.unit));
      }
      setUnits(m);
    });
    return () => { live = false; };
  }, [bab]);
  return (
    <>
      <nav className="mw-crumb" aria-label="مسار">
        <Link to="/tabwib">{ar ? "مواضيع مشكاة" : "Topics"}</Link>
        <span className="mw-sep">›</span>
        <span className="mw-here">{bab.name}</span>
      </nav>
      <header className="mw-head">
        <h1 className="mw-title">{bab.name}</h1>
        <div className="muted" style={{ fontSize: 13 }}>{num(bab.axes.length)} {ar ? "موضوعًا" : "topics"} · {num(bab.units)} {ar ? "وحدة" : "units"}</div>
      </header>
      <div className="trad-topics">
        {bab.axes.map((ax) => {
          const isOpen = open === ax;
          const list = units.get(ax) ?? [];
          return (
            <div key={ax} className="trad-topic">
              <button className="trad-topic-h" onClick={() => setOpen(isOpen ? null : ax)} aria-expanded={isOpen}>
                <span>{themeName(ax) || `${ar ? "موضوع" : "topic"} ${num(ax)}`}</span>
                <span className="muted" style={{ fontSize: 12 }}>{num(list.length)} {ar ? "وحدة" : "units"} · <Link to={`/mawdui/${ax}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 12 }}>{ar ? "المحور ←" : "axis ←"}</Link></span>
              </button>
              {isOpen && (
                <div className="mw-verses" style={{ padding: "6px 10px 12px" }}>
                  {list.map(({ unit, approx }) => (
                    <Link key={unit.i} to={`/read/${unit.s}/${unit.a1}`} className="mw-verse" title={ar ? "افتح في المصحف" : "open in the reader"}>
                      <span className="mw-verse-ref">{surahNameAr(unit.s)} {num(unit.a1)}–{num(unit.a2)}</span>
                      {approx && <span className="chip" style={{ flex: "none", fontSize: 11 }}>{ar ? "بتقارب المعنى" : "by proximity"}</span>}
                      <span className="mw-verse-text">{unit.name}</span>
                    </Link>
                  ))}
                  {list.length === 0 && <div className="muted" style={{ padding: 8 }}>{ar ? "لا وحدات مسندة لهذا الموضوع بعد." : "No units assigned yet."}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function Tabwib() {
  useUILang();
  const ready = useTabwibReady();
  const kReady = useKulliyat();
  const params = useParams<{ bab?: string }>();
  const babId = params.bab != null ? Number(params.bab) : null;
  const bab = useMemo(() => (ready && babId != null ? babOf(babId) : null), [ready, babId]);
  if (!ready || !kReady) {
    return <div className="page page-narrow"><div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div></div>;
  }
  return (
    <div className="page">
      <div className="mw-wrap">
        {babId == null ? <BabsView /> : bab ? <BabView bab={bab} /> : <p className="muted">{t("notFound")}</p>}
      </div>
    </div>
  );
}

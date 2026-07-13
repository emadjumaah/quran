/**
 * المواضيع — the Qur'an's TRADITIONAL thematic index (متوارث, not computed). The
 * retained hand-organized tree: 12 أبواب → topics → verses. It sits in its own
 * section beside the computed المحاور (/mawdui), clearly labelled as curated, and
 * never mixed into the computed graph. Two levels:
 *   /mawadi        → the 12 أبواب
 *   /mawadi/:sec   → one باب → its topics (accordion) → verses (tap → reader)
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ayahByLocationMap, surahNameAr } from "../db";
import { tradSection, tradSections, useVerseIndex } from "../mawdui";
import TierBadge from "../components/TierBadge";
import TopicLayerToggle from "../components/TopicLayerToggle";
import type { AyahDoc } from "../types";
import { ayahsCount, getUILang, num, t, useUILang } from "../i18n";
import { readPathOf } from "../types";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

/* ---------- level 0: the 12 أبواب ---------- */
function Sections() {
  const ar = getUILang() === "ar";
  const sections = useMemo(() => tradSections(), []);
  const totalVerses = useMemo(() => sections.reduce((n, s) => n + s.verses, 0), [sections]);
  return (
    <>
      <header className="mw-head">
        <h1 className="mw-title">{ar ? "مواضيع القرآن" : "Topics of the Qur'an"}</h1>
        <p className="mw-lead">
          {ar
            ? "تصنيفٌ موضوعيٌّ متوارَث: اثنا عشرَ بابًا كبيرًا تنتظمُ تحتها موضوعاتُ القرآن كما رتّبها أهلُ العلم — طريقةُ التصفّح المألوفة. وهو تصنيفٌ منقولٌ لا محسوب؛ للطبقة المحسوبة انظُر «المحاور»."
            : "A traditional thematic index: twelve chapters under which the Qur'an's themes are arranged as scholars organized them — the familiar way to browse. This layer is curated, not computed; for the computed layer see «Axes»."}
        </p>
        <div className="muted" style={{ fontSize: 13 }}>{num(sections.length)} {ar ? "بابًا" : "chapters"} · {ayahsCount(totalVerses)}</div>
        <div className="mw-onenote trad-note" title={ar ? "تصنيفٌ منقولٌ عن أهل العلم، يُعرَض كما هو" : "a curated classification, shown as-is"}>
          ◆ {ar ? "تصنيفٌ متوارَثٌ منقول — يُعرَض كما هو، لا يُحسَب." : "A traditional, curated classification — shown as-is, not computed."}
        </div>
      </header>
      <TopicLayerToggle />
      <div className="mw-topics">
        {sections.map((s) => (
          <Link key={s.idx} to={`/mawadi/${s.idx}`} className="mw-topic-card">
            <span className="mw-topic-name">{s.title}</span>
            <span className="mw-topic-count">{num(s.topics)} {ar ? "موضوعًا" : "topics"} · {ayahsCount(s.verses)}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ---------- level 1: one باب → topics (accordion) → verses ---------- */
function SectionView({ sec, texts }: { sec: number; texts: Map<string, AyahDoc> }) {
  const ar = getUILang() === "ar";
  const data = useMemo(() => tradSection(sec), [sec]);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  if (!data) return <p className="muted">{t("notFound")}</p>;
  const totalVerses = data.topics.reduce((n, tp) => n + tp.verses.length, 0);
  const toggle = (id: number) =>
    setOpen((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <>
      <nav className="mw-crumb" aria-label="مسار">
        <Link to="/mawadi" title={ar ? "كل الأبواب" : "all chapters"}>{ar ? "المواضيع" : "Topics"}</Link>
        <span className="mw-sep">›</span>
        <span className="mw-here">{data.title}</span>
      </nav>
      <header className="mw-head">
        <h1 className="mw-title">{data.title}</h1>
        <div className="muted" style={{ fontSize: 13 }}>{num(data.topics.length)} {ar ? "موضوعًا" : "topics"} · {ayahsCount(totalVerses)} · {ar ? "تصنيفٌ متوارَث" : "traditional"}</div>
      </header>
      <div className="trad-topics">
        {data.topics.map((tp) => {
          const isOpen = open.has(tp.id);
          return (
            <div key={tp.id} className="trad-topic">
              <button className="trad-topic-h" onClick={() => toggle(tp.id)} aria-expanded={isOpen}>
                <span className="trad-topic-name">{tp.title}</span>
                <span className="trad-topic-count">{ayahsCount(tp.verses.length)} <span aria-hidden>{isOpen ? "▾" : "▸"}</span></span>
              </button>
              {isOpen && (
                <div className="trad-topic-body">
                  <div className="mw-verses">
                    {tp.verses.map((loc) => (
                      <Link key={loc} to={readPathOf(loc)} className="mw-verse" title={ar ? "افتح في المصحف" : "open in the reader"}>
                        <span className="mw-verse-ref">{arName(loc)}</span>
                        <TierBadge loc={loc} style={{ flex: "none" }} />
                        <span className="mw-verse-text quran">{texts.get(loc)?.textUthmani ?? loc}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const MAWADI_LAST = "quran-studio:mawadi-last";

export default function Mawadi() {
  useUILang();
  const ready = useVerseIndex();
  const params = useParams<{ sec?: string }>();
  const sec = params.sec != null ? Number(params.sec) : null;
  const ar = getUILang() === "ar";
  const [texts, setTexts] = useState<Map<string, AyahDoc>>(new Map());
  useEffect(() => { ayahByLocationMap().then(setTexts); }, []);
  useEffect(() => {
    localStorage.setItem(MAWADI_LAST, `/mawadi${sec != null ? `/${sec}` : ""}`);
  }, [sec]);

  if (!ready) {
    return <div className="page page-narrow"><div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div></div>;
  }
  return (
    <div className="page">
      <div className="mw-wrap">
        {sec != null && (
          <Link to="/mawadi" className="mw-back" title={ar ? "كل الأبواب" : "all chapters"}>
            <span aria-hidden="true">{ar ? "→" : "←"}</span> {ar ? "رجوع" : "Back"}
          </Link>
        )}
        {sec == null ? <Sections /> : <SectionView sec={sec} texts={texts} />}
      </div>
    </div>
  );
}

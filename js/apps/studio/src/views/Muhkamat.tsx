/**
 * المحكمات — the 88 آياتٌ محكمة (roots that gather تفصيل, and are not themselves
 * تفصيل of any other). Browse them grouped by their own kind (عناوين) or one
 * verse at a time; each verse opens its تفصيل, drillable across levels. From the
 * Qur'anic text and its morphology alone — نُفصِّل القرآنَ بالقرآن.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ayahByLocationMap, surahNameAr } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import type { AyahDoc } from "../types";
import PageSearch from "../components/PageSearch";
import MushafLink from "../components/MushafLink";
import { TafsilPanel } from "../components/TafsilChip";
import { tafsilOf, isRootPrinciple, useJawami } from "../jawami";
import { fuzzyMatch } from "../lib/fuzzy";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

/** one آية محكمة (root) in the flat «آيات» view: its kind tag · the verse ·
 *  its تفصيل on tap. Tapping the verse opens تفصيل; ↗ opens the mushaf. */
function RootAyah({ loc, kindLabel, texts }: { loc: string; kindLabel: string | null; texts: Map<string, AyahDoc> }) {
  const [open, setOpen] = useState(false);
  const ar = getUILang() === "ar";
  const deg = tafsilOf(loc).length;
  const d = texts.get(loc);
  const toggle = () => deg > 0 && setOpen((v) => !v);
  return (
    <div className={`jw-card${open ? " open" : ""}`}>
      {kindLabel && <div className="mk-ayah-tag" title={ar ? "نوع المحكمة" : "kind"}>{kindLabel}</div>}
      <div className="jw-cardhead-row">
        <button className="jw-cardhead" onClick={toggle} aria-expanded={open}>
          <span className="jw-ref">{arName(loc)}</span>
          <span className="spacer" />
          {deg > 0 && <span className="jw-deg">{num(deg)} {ar ? "تفصيل" : "tafsil"}</span>}
          <span className="jw-caret">{open ? "▾" : "◂"}</span>
        </button>
        <MushafLink loc={loc} compact />
      </div>
      <div
        className="jw-cardtext quran"
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
        style={{ cursor: deg > 0 ? "pointer" : "default" }}
      >
        {d?.textUthmani ?? loc}
        <span className="ayah-marker"> ﴿{num(loc.split(":")[1])}﴾</span>
      </div>
      <TafsilPanel location={loc} open={open} />
    </div>
  );
}

// the محكمات's own kinds — a data-derived grouping of the roots (each root
// carries its kind), far cleaner than the retired 40-كبرى clustering.
const KIND_NOTE: Record<string, string> = {
  "عقيدة": "التوحيد وأسماء الله وصفاته واليوم الآخر",
  "أخلاق": "أخلاق المؤمن وآدابه ومعاملاته",
  "سنة": "سنن الله في الخلق والأمم",
  "حكم": "الأحكام العمليّة",
  "وعد": "الوعد والوعيد والجزاء",
};
const gpos = (loc: string) => {
  const [s, a] = loc.split(":").map(Number);
  return s * 1000 + a;
};

/* --------- the one unified home: عناوين (kinds) OR آيات (88 roots) ------------ */
function Index({ texts }: { texts: Map<string, AyahDoc> }) {
  const ar = getUILang() === "ar";
  const jw = useJawami();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"titles" | "ayat">("ayat");
  const [sort, setSort] = useState<"quran" | "tafsil">("quran"); // mushaf order by default
  const [kind, setKind] = useState<string>(""); // filter the آيات by kind (عنوان)
  const [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [q, view, sort, kind]);

  const kindOf = (loc: string) => jw?.principles[loc]?.kind ?? "";

  // the 88 آيات محكمة (roots WITH تفصيل); default order = المصحف, optional = الأوسع تفصيلًا
  const roots = useMemo(() => {
    if (!jw) return [];
    const rs = Object.keys(jw.principles).filter((l) => isRootPrinciple(l));
    rs.sort(sort === "quran" ? (a, b) => gpos(a) - gpos(b) : (a, b) => tafsilOf(b).length - tafsilOf(a).length);
    return rs;
  }, [jw, sort]);

  // the عناوين: the roots grouped by their own kind (5 clean sections)
  const kinds = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const loc of roots) {
      const k = kindOf(loc) || (ar ? "أخرى" : "other");
      (m.get(k) ?? m.set(k, []).get(k)!).push(loc);
    }
    return [...m.entries()]
      .map(([name, locs]) => ({ name, locs, tafsil: locs.reduce((s, l) => s + tafsilOf(l).length, 0) }))
      .sort((a, b) => b.locs.length - a.locs.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, jw]);

  // connected تفصيل fabric — only verses joined by a تفصيل edge (research-honest)
  const networkSize = useMemo(() => {
    if (!jw) return 0;
    const s = new Set<string>();
    for (const loc of Object.keys(jw.principles)) {
      const fwd = tafsilOf(loc);
      if (fwd.length === 0) continue;
      s.add(loc);
      for (const l of fwd) s.add(l.loc);
    }
    return s.size;
  }, [jw]);

  const filteredRoots = useMemo(
    () =>
      roots.filter(
        (loc) =>
          (!kind || kindOf(loc) === kind) &&
          fuzzyMatch(q, arName(loc), texts.get(loc)?.textClean, kindOf(loc)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roots, q, texts, kind, jw],
  );

  const pickKind = (name: string) => {
    setKind(name);
    setView("ayat");
  };

  return (
    <>
      <header className="jw-header">
        <h1 className="jw-title">{ar ? "المحكمات" : "Muḥkamāt"}</h1>
        <p className="jw-lead">
          {ar
            ? "الآياتُ المحكمة: أصولٌ تجمع معاني القرآن، وتحتها تفصيلُها من نصّ القرآن وصرفه وحدهما. تصفّحها مُجمَّعةً في عناوين حسب نوعها، أو آيةً آية مع تفصيل كلٍّ منها."
            : "The muḥkam verses: roots that gather the Qur'an's meanings, each with its تفصيل — from the Qur'anic text alone. Browse them grouped by kind, or one verse at a time."}
        </p>
        <div className="jw-stats">
          <span className="chip"><b>{num(kinds.length)}</b> {ar ? "عنوان" : "kinds"}</span>
          <span className="chip"><b>{num(roots.length)}</b> {ar ? "آية محكمة" : "muḥkam verses"}</span>
          <span className="chip"><b>{num(networkSize)}</b> {ar ? "في شبكة تفصيلها" : "in its tafsīl network"}</span>
          <Link to="/jawami/lenses" className="chip link" style={{ textDecoration: "none" }} title={ar ? "تحليلاتٌ متقدّمة لبنية الشبكة (للباحثين)" : "advanced network analytics"}>
            {ar ? "تحليلات الشبكة ←" : "network analytics →"}
          </Link>
        </div>
      </header>

      <PageSearch value={q} onChange={setQ} placeholder={ar ? "ابحث في المحكمات وتفصيلها…" : "search…"} />

      {/* one consolidated controls row (view · sort · active kind) */}
      <div className="jw-filters">
        <div className="jw-chipset" style={{ justifyContent: "center" }}>
          <button className={view === "ayat" ? "on" : ""} onClick={() => setView("ayat")}>
            {ar ? `آيات (${num(roots.length)})` : `verses (${num(roots.length)})`}
          </button>
          <button className={view === "titles" ? "on" : ""} onClick={() => setView("titles")}>
            {ar ? `عناوين (${num(kinds.length)})` : `kinds (${num(kinds.length)})`}
          </button>
          {view === "ayat" && (
            <>
              <span className="jw-filter-lbl" style={{ marginInlineStart: 10 }}>{ar ? "الترتيب" : "sort"}</span>
              <button className={sort === "quran" ? "on" : ""} onClick={() => setSort("quran")}>
                {ar ? "المصحف" : "mushaf"}
              </button>
              <button className={sort === "tafsil" ? "on" : ""} onClick={() => setSort("tafsil")}>
                {ar ? "الأوسع تفصيلًا" : "most tafsīl"}
              </button>
              {kind && (
                <button className="on gold" onClick={() => setKind("")} title={ar ? "أزل تصفية العنوان" : "clear kind filter"}>
                  {kind} ✕
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {view === "titles" ? (
        <div className="mk-kubra-grid">
          {kinds.map((k) => (
            <button key={k.name} className="mk-kubra-card" onClick={() => pickKind(k.name)} style={{ cursor: "pointer", textAlign: "start" }}>
              <span className="mk-kubra-title">{k.name}</span>
              <span className="mk-kubra-preview">{KIND_NOTE[k.name] ?? ""}</span>
              <span className="mk-kubra-meta">
                {num(k.locs.length)} {ar ? "آية محكمة" : "verses"} · {num(k.tafsil)} {ar ? "تفصيل" : "tafsīl"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="muted jw-resultcount">{num(filteredRoots.length)} {ar ? "آية محكمة" : "verses"}</div>
          <div className="jw-list">
            {filteredRoots.slice(0, limit).map((loc) => (
              <RootAyah key={loc} loc={loc} kindLabel={kindOf(loc) || null} texts={texts} />
            ))}
          </div>
          {filteredRoots.length > limit && (
            <div style={{ textAlign: "center", margin: "18px 0" }}>
              <button onClick={() => setLimit(limit + 100)}>{ar ? `عرض المزيد (${num(filteredRoots.length - limit)})` : `show more`}</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function Muhkamat() {
  useUILang();
  const jw = useJawami();
  const [texts, setTexts] = useState<Map<string, AyahDoc>>(new Map());

  useEffect(() => {
    ayahByLocationMap().then(setTexts);
  }, []);

  if (!jw) {
    return (
      <div className="page page-narrow">
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="jw-wrap">
        <Index texts={texts} />
      </div>
    </div>
  );
}

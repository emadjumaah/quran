/**
 * الكلّيّاتُ المختارة — «اختيارٌ مراجَعٌ بأدلّةٍ محسوبة».
 *
 * بعد النتيجة السالبة المنشورة (findings/unified/KULLIYAT-CEILING-2026-07-21.md):
 * لا مقياسَ متّجهيًّا يقيس الاندراج، فالحكمُ للقارئ والحاسوبُ يتحقّق ويُسنِد.
 * فهذه قائمةٌ مرتَّبةٌ أبوابًا، كلُّ كلّيّةٍ بنصِّها من قاعدتنا وأدلّتِها المحسوبة:
 * بوّاباتُ صيغة القاعدة، وصلاتُها المفحوصة في الشبكة إن وُجدت، ووحدةُ سياقها.
 * الوسمُ صريحٌ في الصدر: ليست حسابًا آليًّا كاملًا، ولا حكمًا على ما سواها.
 * المسار /kulliyat — والطبقةُ الشبكيّةُ المحسوبة انتقلت إلى /qawaid.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getUILang, num, t, useUILang } from "../i18n";
import { readPathOf } from "../types";
import { ayahByLocationMap, surahNameAr } from "../db";
import type { AyahDoc } from "../types";
import PageSearch from "../components/PageSearch";
import { fuzzyMatch } from "../lib/fuzzy";

interface Kulliya {
  loc: string;
  bab: string;
  title: string;
  ref: string;
  text: string;
  gates: string[];
  m: number;
  T: number;
  rels: Record<string, string[]>;
  netTier: string;
  unit: { name: string; span: string } | null;
}
interface Payload {
  meta: { date: string; grade: string; note: string; count: number };
  kulliyat: Kulliya[];
}

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

function Card({ k, texts }: { k: Kulliya; texts: Map<string, AyahDoc> | null }) {
  const ar = getUILang() === "ar";
  const [open, setOpen] = useState(false);
  const relEntries = Object.entries(k.rels ?? {}).filter(([, v]) => v.length);
  return (
    <article className="km-card">
      <div className="km-head">
        <h3 className="km-title">{k.title}</h3>
        <Link to={readPathOf(k.loc)} className="km-ref">{k.ref}</Link>
      </div>
      <p className="quran km-text">{k.text}</p>
      <button className={`km-why${open ? " on" : ""}`} onClick={() => setOpen((v) => !v)}>
        {ar ? "أدلّتُها المحسوبة" : "computed evidence"} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="km-ev">
          {k.gates.length > 0 && (
            <div className="km-ev-row">
              <span className="km-ev-k">{ar ? "صيغةُ قاعدة" : "rule form"}</span>
              <span>{k.gates.join(" · ")}</span>
            </div>
          )}
          {k.unit && (
            <div className="km-ev-row">
              <span className="km-ev-k">{ar ? "مقطعُها" : "passage"}</span>
              <span>
                {k.unit.name} <span className="muted">({k.unit.span})</span>
              </span>
            </div>
          )}
          <div className="km-ev-row">
            <span className="km-ev-k">{ar ? "في الشبكة المفحوصة" : "examined network"}</span>
            <span>
              {k.m > 0
                ? `${num(k.m)} ${ar ? "صلةً مفحوصة" : "examined links"} · ${ar ? "مرتبتُها" : "tier"}: ${k.netTier}`
                : ar ? "لا صلاتِ فحصٍ عندها (لم يُولِّد الجوارُ لها أزواجًا)" : "no examined links"}
            </span>
          </div>
          {relEntries.map(([rel, locs]) => (
            <div className="km-ev-row" key={rel}>
              <span className="km-ev-k">{rel}</span>
              <span className="km-ev-locs">
                {locs.slice(0, 8).map((l) => (
                  <Link key={l} to={readPathOf(l)} className="km-loc" title={texts?.get(l)?.textClean ?? ""}>
                    {arName(l)}
                  </Link>
                ))}
                {locs.length > 8 && <span className="muted"> …</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function KulliyatMukhtara() {
  useUILang();
  const ar = getUILang() === "ar";
  const [data, setData] = useState<Payload | null>(null);
  const [texts, setTexts] = useState<Map<string, AyahDoc> | null>(null);
  const [q, setQ] = useState("");
  const [bab, setBab] = useState<string>("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}kulliyat-curated.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ meta: { date: "", grade: "", note: "", count: 0 }, kulliyat: [] }));
    ayahByLocationMap().then(setTexts).catch(() => {});
  }, []);

  const babs = useMemo(() => [...new Set((data?.kulliyat ?? []).map((k) => k.bab))], [data]);
  const shown = useMemo(() => {
    const list = (data?.kulliyat ?? []).filter((k) => (!bab || k.bab === bab));
    return q.trim() ? list.filter((k) => fuzzyMatch(q, k.title, k.text, k.ref, k.bab)) : list;
  }, [data, bab, q]);

  if (!data) return <div className="page page-narrow"><div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div></div>;

  const grouped = babs
    .map((b) => ({ bab: b, items: shown.filter((k) => k.bab === b) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="page">
      <div className="jw-wrap">
        <header className="jw-header">
          <h1 className="jw-title">{ar ? "الكلّيّاتُ المختارة" : "Selected kulliyāt"}</h1>
          <p className="jw-lead">
            {ar
              ? "آياتٌ جامعةٌ تنضوي تحتها معانٍ كثيرة، مرتَّبةٌ أبوابًا. كلُّ واحدةٍ بنصّها من قاعدتنا وأدلّتِها المحسوبة: صيغةُ القاعدة الصرفيّة، ومقطعُها من المصحف، وصلاتُها المفحوصة في شبكتنا إن وُجدت."
              : "Gathering verses under which many meanings fall, arranged by chapter — each with its text from our database and its computed evidence: rule form, passage, and examined links where they exist."}
          </p>
          <p className="kl-disclaimer">
            {ar
              ? "درجةُ السند: اختيارٌ مراجَعٌ بأدلّةٍ محسوبة — الترشيحُ بالمعنى (بمراجعة صاحب المشروع)، والنصوصُ والبوّاباتُ والصلاتُ والمقاطعُ محسوبةٌ من بياناتنا. ليست حسابًا آليًّا كاملًا، ولا حكمًا على ما لم يُذكر فيها. وسببُ اختيار هذا الطريق منشورٌ بنتيجته السالبة في مستودع البحث: قربُ المتّجهات لا يقيس الاندراج."
              : "Sanad grade: a reviewed selection with computed evidence — nominated by meaning (owner-reviewed); texts, gates, links and passages computed from our data. Not a full automatic computation, and not a judgment on what it omits."}
          </p>
          <div className="jw-stats">
            <span className="chip"><b>{num(data.meta.count)}</b> {ar ? "كلّيّة" : "kulliyāt"}</span>
            <span className="chip"><b>{num(babs.length)}</b> {ar ? "أبواب" : "chapters"}</span>
            <Link to="/qawaid" className="chip link">{ar ? "الطبقةُ المحسوبة: القواعدُ وتفصيلُها ←" : "computed layer →"}</Link>
          </div>
        </header>

        <div className="jw-filters">
          <div className="jw-chipset">
            <span className="jw-filter-lbl">{ar ? "الباب" : "chapter"}</span>
            <button className={bab === "" ? "on" : ""} onClick={() => setBab("")}>{ar ? "الكل" : "all"}</button>
            {babs.map((b) => (
              <button key={b} className={bab === b ? "on" : ""} onClick={() => setBab(b)}>{b}</button>
            ))}
          </div>
        </div>
        <PageSearch value={q} onChange={setQ} placeholder={ar ? "ابحث في الكلّيّات…" : "search…"} />

        {grouped.map((g) => (
          <section key={g.bab} className="km-bab">
            <h2 className="km-bab-h">{g.bab} <span className="muted">{num(g.items.length)}</span></h2>
            <div className="km-grid">
              {g.items.map((k) => <Card key={k.loc} k={k} texts={texts} />)}
            </div>
          </section>
        ))}
        {grouped.length === 0 && <div className="muted" style={{ padding: 30, textAlign: "center" }}>{t("notFound")}</div>}
      </div>
    </div>
  );
}

/**
 * مواضيعُ مشكاة — موضوعاتٌ مفهوميّةٌ محسوبةٌ بوحدات السياق (v2، 2026-07-21).
 *
 * الموضوعُ مفهومٌ يهمُّ الباحث، وآياتُه محسوبةٌ حتميًّا: مرسًى لفظيٌّ بجذور المفهوم
 * وألفاظِه من قاعدتنا، ثم مركزُ معنًى من متّجهات المراسي، ثم **وحدةُ السياق** هي
 * المعروضة — فالباحثُ يقرأ مقطعًا متماسكًا لا آيةً منتزعة (سؤال المالك: «ألا
 * يفيدنا السياق؟» — بلى، وهو الفيصل). والمقطعُ يقع في كلِّ موضوعٍ يخصّه.
 *
 * العرضُ صفحةً لكلِّ موضوع كما اعتُمد: أبوابٌ ← موضوعٌ ← مقاطعُه بآياتها.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ayahByLocationMap, surahNameAr } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import type { AyahDoc } from "../types";
import { readPathOf } from "../types";
import PageSearch from "../components/PageSearch";
import { fuzzyMatch } from "../lib/fuzzy";

interface Unit { i: number; name: string; span: string; s: number; a1: number; a2: number; hits: string[]; z: number; why: string }
interface Topic { bab: string; name: string; roots: string[]; words: string[]; lex: number; units: Unit[]; unitsTotal: number }
interface Payload { meta: { date: string; method: string; zMin: number; topics: number; babs: number; note: string }; babs: string[]; topics: Topic[] }

let cache: Payload | null = null;

function useMawadi(): Payload | null {
  const [data, setData] = useState<Payload | null>(cache);
  useEffect(() => {
    if (cache) return;
    fetch(`${import.meta.env.BASE_URL}mawadi-v2.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then((j: Payload) => { cache = j; setData(j); })
      .catch(() => setData({ meta: { date: "", method: "", zMin: 0, topics: 0, babs: 0, note: "" }, babs: [], topics: [] }));
  }, []);
  return data;
}

const slug = (s: string) => encodeURIComponent(s);

/* ── مستوى ٠: الأبواب ومواضيعُها ── */
function TopicIndex({ data }: { data: Payload }) {
  const ar = getUILang() === "ar";
  const [q, setQ] = useState("");
  const shown = useMemo(
    () => (q.trim() ? data.topics.filter((x) => fuzzyMatch(q, x.name, x.bab)) : data.topics),
    [data, q],
  );
  return (
    <>
      <header className="mw-head">
        <h1 className="mw-title">{ar ? "مواضيعُ مشكاة" : "Mishkāt topics"}</h1>
        <p className="mw-lead">
          {ar
            ? "موضوعاتٌ محسوبةٌ من نصّ المصحف: لكلِّ موضوعٍ مرسًى لفظيٌّ يقينيٌّ من جذوره وألفاظه، ثم مركزُ معنًى تُقاس إليه وحداتُ السياق — فتُعرض المقاطعُ المتماسكةُ لا الآياتُ المنتزعة. والمقطعُ الواحد يقع في كلِّ موضوعٍ يخصّه."
            : "Computed topics: each has a certain lexical anchor from its roots and words, then a meaning-centre against which the computed context units are measured — coherent passages, not isolated verses. A passage can belong to several topics."}
        </p>
        <div className="jw-stats">
          <span className="chip"><b>{num(data.meta.topics)}</b> {ar ? "موضوعًا" : "topics"}</span>
          <span className="chip"><b>{num(data.babs.length)}</b> {ar ? "أبواب" : "chapters"}</span>
        </div>
      </header>
      <PageSearch value={q} onChange={setQ} placeholder={ar ? "ابحث في المواضيع…" : "search topics…"} />
      {data.babs.map((b) => {
        const items = shown.filter((x) => x.bab === b);
        if (!items.length) return null;
        return (
          <section key={b} className="tf-genre">
            <h2 className="tf-genre-h">{b}</h2>
            <div className="mw-topics">
              {items.map((x) => (
                <Link key={x.name} to={`/mawadi/${slug(x.name)}`} className="mw-topic-card">
                  <span className="mw-topic-name">{x.name}</span>
                  <span className="mw-topic-count">{num(x.unitsTotal)} {ar ? "مقطعًا" : "passages"}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ── مستوى ١: موضوعٌ واحد بمقاطعه وآياتها ── */
function TopicView({ data, name }: { data: Payload; name: string }) {
  const ar = getUILang() === "ar";
  const topic = data.topics.find((x) => x.name === name);
  const [texts, setTexts] = useState<Map<string, AyahDoc> | null>(null);
  const [limit, setLimit] = useState(12);
  useEffect(() => { ayahByLocationMap().then(setTexts).catch(() => {}); }, []);
  useEffect(() => { setLimit(12); }, [name]);
  if (!topic) return <p className="muted">{t("notFound")}</p>;
  return (
    <>
      <nav className="mw-crumb" aria-label="مسار">
        <Link to="/mawadi">{ar ? "المواضيع" : "Topics"}</Link>
        <span className="mw-sep">›</span>
        <span className="muted">{topic.bab}</span>
        <span className="mw-sep">›</span>
        <span className="mw-here">{topic.name}</span>
      </nav>
      <header className="mw-head">
        <h1 className="mw-title">{topic.name}</h1>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.9 }}>
          {num(topic.unitsTotal)} {ar ? "مقطعًا" : "passages"} · {num(topic.lex)} {ar ? "آيةً فيها لفظُ الموضوع" : "anchor verses"}
          {topic.roots.length > 0 && <> · {ar ? "الجذور: " : "roots: "}{topic.roots.map((r) => (
            <Link key={r} to={`/roots/${encodeURIComponent(r)}`} className="km-loc" style={{ marginInlineStart: 5 }}>{r}</Link>
          ))}</>}
        </div>
      </header>
      <div className="mv-units">
        {topic.units.slice(0, limit).map((u) => {
          const verses: string[] = [];
          for (let a = u.a1; a <= u.a2; a++) verses.push(`${u.s}:${a}`);
          return (
            <section key={u.i} className="mv-unit">
              <div className="mv-unit-head">
                <h3 className="mv-unit-name">{u.name}</h3>
                <Link to={readPathOf(`${u.s}:${u.a1}`)} className="mv-unit-span">
                  {surahNameAr(u.s)} {num(u.a1)}–{num(u.a2)}
                </Link>
                <span className={`chip mv-why ${u.why === "لفظ" ? "lex" : "sem"}`}>
                  {u.why === "لفظ" ? (ar ? `فيه ${num(u.hits.length)} شاهدًا لفظيًّا` : `${u.hits.length} lexical`) : (ar ? "قربَ معنًى" : "by meaning")}
                </span>
              </div>
              <div className="mv-verses">
                {verses.map((loc) => {
                  const a = texts?.get(loc);
                  if (!a) return null;
                  const isHit = u.hits.includes(loc);
                  return (
                    <div key={loc} className={`mv-v${isHit ? " hit" : ""}`}>
                      <Link to={readPathOf(loc)} className="mv-v-ref">{surahNameAr(u.s)} {num(loc.split(":")[1])}</Link>
                      <span className="quran mv-v-text">{a.textUthmani ?? a.textClean}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {topic.units.length > limit && (
        <div style={{ textAlign: "center", margin: "18px 0" }}>
          <button onClick={() => setLimit(limit + 15)}>{ar ? `عرض المزيد (${num(topic.units.length - limit)})` : "show more"}</button>
        </div>
      )}
    </>
  );
}

export default function MawadiV2() {
  useUILang();
  const { name } = useParams<{ name?: string }>();
  const data = useMawadi();
  const ar = getUILang() === "ar";
  if (!data) return <div className="page page-narrow"><div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div></div>;
  return (
    <div className="page">
      <div className="mw-wrap">
        {name && (
          <Link to="/mawadi" className="mw-back" title={ar ? "كل المواضيع" : "all topics"}>
            <span aria-hidden="true">{ar ? "→" : "←"}</span> {ar ? "رجوع" : "Back"}
          </Link>
        )}
        {name ? <TopicView data={data} name={decodeURIComponent(name)} /> : <TopicIndex data={data} />}
      </div>
    </div>
  );
}

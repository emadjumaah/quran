/**
 * خريطةُ المصحف — every one of the 6236 āyāt as a small cell, in mushaf order,
 * grouped by sūra, coloured by its computed مرتبة (كلّيّة / جامعة / تفصيل). One
 * glance shows WHERE the foundational verses fall across the whole Qur'an — the
 * skeleton of the الكلّيّات mechanism. Tap a cell for the verse. Route: /shabaka.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ayahByLocationMap, surahNameAr } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import type { AyahDoc } from "../types";
import { classOf, kulliyatMeta, loadKulliyat, themeName, tierCounts, useKulliyat } from "../kulliyat";

const HAFS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const tierCls = (loc: string) => { const t = classOf(loc)?.tier; return t === "كلّية" ? "k" : t === "جامعة" ? "j" : t === "تفصيل" ? "t" : "n"; };

export default function MushafMap() {
  useUILang();
  const ar = getUILang() === "ar";
  const ready = useKulliyat();
  const [texts, setTexts] = useState<Map<string, AyahDoc>>(new Map());
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { ayahByLocationMap().then(setTexts); }, []);

  // المصحف كله: كل سورة بكامل آياتها (الموسومة بلونها وسائرها بلا لون)
  const suras = useMemo(() => {
    if (!ready) return [];
    const out: [number, string[]][] = [];
    for (let su = 1; su <= 114; su++) {
      const locs: string[] = [];
      for (let a = 1; a <= HAFS[su - 1]; a++) locs.push(`${su}:${a}`);
      out.push([su, locs]);
    }
    return out;
  }, [ready]);

  // فهرس الاتصال المفحوص (صادر ووارد + المثاني) — يُبنى مرة واحدة
  const linkIndex = useMemo(() => {
    if (!ready) return new Map<string, { loc: string; rel: string }[]>();
    const idx = new Map<string, { loc: string; rel: string }[]>();
    const add = (a: string, b: string, rel: string) => {
      const l = idx.get(a) ?? [];
      if (!l.some((x) => x.loc === b)) l.push({ loc: b, rel });
      idx.set(a, l);
    };
    loadKulliyat().then(() => {});
    const meta = kulliyatMeta();
    void meta;
    // نمر على كل الآيات الموسومة
    for (let su = 1; su <= 114; su++) for (let a = 1; a <= HAFS[su - 1]; a++) {
      const loc = `${su}:${a}`;
      const c = classOf(loc);
      if (!c) continue;
      for (const [rel, locs] of Object.entries(c.rels ?? {})) for (const b of locs) { add(loc, b, rel); add(b, loc, rel); }
      for (const b of c.mutual ?? []) { add(loc, b, "مثانٍ"); add(b, loc, "مثانٍ"); }
    }
    return idx;
  }, [ready]);

  const counts = ready ? tierCounts() : { kulliya: 0, jamia: 0, tafsil: 0 };
  const meta = ready ? kulliyatMeta() : null;
  const selCls = sel ? classOf(sel) : null;
  const selLinks = sel ? linkIndex.get(sel) ?? [] : [];
  const linkedSet = useMemo(() => new Set(selLinks.map((x) => x.loc)), [selLinks]);

  if (!ready) return <div className="page page-narrow"><div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div></div>;

  return (
    <div className="page">
      <div className="jw-wrap">
        <header className="jw-header">
          <h1 className="jw-title">{ar ? "خريطةُ المصحف" : "The mushaf map"}</h1>
          <p className="jw-lead">
            {ar
              ? "كلُّ آيةٍ في القرآن خليّةٌ ملوّنةٌ بمرتبتها من وسمِ الشبكةِ الموحّدة (نسخةٌ أولى قبل التعميق)، بترتيب المصحف — فترى في نظرةٍ واحدةٍ كيف تتوزّعُ المراتبُ عبر السور. انقُرْ خليّةً لترى آيتَها وأدلتَها في بطاقتها."
              : "Every verse as a cell coloured by its unified-network tier (first edition, pre-deepening), in mushaf order — see at a glance how the tiers fall across the sūras. Tap a cell for its verse and evidence."}
          </p>
          <div className="mm-legend">
            <span><i className="mm-lg k" /> {ar ? "كلّيّة" : "kulliyya"} <b>{num(counts.kulliya)}</b></span>
            <span><i className="mm-lg j" /> {ar ? "جامعة" : "jāmiʿa"} <b>{num(counts.jamia)}</b></span>
            <span><i className="mm-lg t" /> {ar ? "تفصيل" : "tafṣīl"} <b>{num(counts.tafsil)}</b></span>
            <span className="muted">{num(meta?.verses ?? 6236)} {ar ? "آية" : "verses"}</span>
          </div>
        </header>

        <div className="mm-grid" onClick={(e) => { const l = (e.target as HTMLElement).dataset.loc; if (l) setSel(l); }}>
          {suras.map(([s, locs]) => (
            <div className="mm-sura" key={s}>
              <div className="mm-sura-h">{surahNameAr(s)} <span className="muted">{num(locs.length)}</span></div>
              <div className="mm-cells">
                {locs.map((loc) => (
                  <span key={loc} data-loc={loc} className={`mm-cell ${tierCls(loc)}${loc === sel ? " on" : ""}${linkedSet.has(loc) ? " lnk" : ""}`} title={`${surahNameAr(s)} ${loc.split(":")[1]}${classOf(loc) ? ` — ${classOf(loc)!.tier}` : ""}`} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {sel && (
          <div className="mm-modal" onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }} role="dialog" aria-modal="true">
          <div className="mm-panel card">
            <button className="gx-close" onClick={() => setSel(null)} aria-label="close">✕</button>
            <div className="gx-panel-h">
              <Link to={`/read/${sel.split(":")[0]}/${sel.split(":")[1]}`} className="gx-root" style={{ textDecoration: "none" }}>{surahNameAr(Number(sel.split(":")[0]))} {num(sel.split(":")[1])}</Link>
              {selCls && <span className={`kl-badge ${tierCls(sel)}`}>{selCls.tier}</span>}
              {selLinks.length > 0 && <span className="chip">{num(selLinks.length)} {ar ? "صلة مفحوصة" : "examined links"}</span>}
            </div>
            {texts.get(sel) && <p className="gx-mean quran" dir="rtl">{texts.get(sel)!.textClean}</p>}
            {selCls && themeName(selCls.theme) && <div className="muted gx-nb-h">◇ {themeName(selCls.theme)}</div>}
            {selLinks.length > 0 && (
              <div className="gx-links" style={{ flexWrap: "wrap", gap: 6 }}>
                {selLinks.slice(0, 14).map(({ loc, rel }) => (
                  <button key={loc} className="chip" onClick={() => setSel(loc)} title={rel}>
                    {rel} · {surahNameAr(Number(loc.split(":")[0]))} {num(loc.split(":")[1])}
                  </button>
                ))}
                {selLinks.length > 14 && <span className="chip">+{num(selLinks.length - 14)}</span>}
              </div>
            )}
            {!selCls && selLinks.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{ar ? "ليست في طبقة القواعد — بحوث الطبقات الأخرى تصلها من بطاقة الآية." : "Not in the rules layer."}</div>}
            <div className="gx-links">
              <Link to={`/aya/${sel.split(":")[0]}/${sel.split(":")[1]}`} className="chip link">{ar ? "بطاقةُ الآية ←" : "verse card ←"}</Link>
              <Link to={`/read/${sel.split(":")[0]}/${sel.split(":")[1]}`} className="chip link">{ar ? "اقرأ الآية ←" : "read ←"}</Link>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

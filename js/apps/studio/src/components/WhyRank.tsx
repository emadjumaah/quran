/**
 * «لماذا هذه المرتبة؟» — أدلة v3 المعلنة وراء وسم الآية: بواباتُ صيغة القاعدة،
 * وعددُ المفصِّلات الموجهة بعلاقاتها الأربع، واتساعُ المحاور، وشركاءُ التوكيد
 * المتبادل. كل رقمٍ محسوبٌ من الشبكة الموحدة المفحوصة بالسياق — «نحسب ونعرض».
 * نسخة أولى قبل موجات التعميق؛ تقارير المعايرة والامتحان منشورة في المستودع.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { classOf } from "../kulliyat";
import { ayahByLocationMap, surahNameAr } from "../db";
import { getUILang, num } from "../i18n";
import { readPathOf, type AyahDoc } from "../types";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

const RELS: { key: string; ar: string; en: string }[] = [
  { key: "بيان", ar: "بيان", en: "exposition" },
  { key: "مثال", ar: "مثال", en: "instance" },
  { key: "جزاء", ar: "جزاء", en: "recompense" },
  { key: "توكيد", ar: "توكيد", en: "affirmation" },
];

export default function WhyRank({ location }: { location: string }) {
  const cls = classOf(location);
  const ar = getUILang() === "ar";
  const rels = cls?.rels ?? {};
  const mutual = cls?.mutual ?? [];
  // الشواهد بنصوصها: كل آيات الأدلة أعلاه، كلٌّ بوصف علاقتها بآية البطاقة
  const [open, setOpen] = useState(false);
  const [texts, setTexts] = useState<Map<string, AyahDoc> | null>(null);
  useEffect(() => {
    if (!open || texts) return;
    let live = true;
    void ayahByLocationMap().then((m) => live && setTexts(m));
    return () => { live = false; };
  }, [open, texts]);
  const shawahid = useMemo(() => {
    const out: { loc: string; rel: string }[] = [];
    for (const { key, ar: la, en } of RELS) for (const l of rels[key] ?? []) out.push({ loc: l, rel: ar ? la : en });
    for (const l of mutual) out.push({ loc: l, rel: ar ? "توكيدٌ متبادل" : "mutual" });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, ar]);
  if (!cls) return null;

  return (
    <div className="why">
      <div className="why-head">
        <span>{ar ? "لماذا هذه المرتبة؟" : "Why this tier?"}</span>
        <span className="why-score">{cls.tier}</span>
      </div>
      <p className="why-note">
        {ar
          ? "الوسمُ من الشبكةِ الموحّدة: كلُّ صلةٍ أدناهُ فحصَها قارئٌ مستقلٌّ رأى الزوجَ بمقطعَي سياقِه (اختبارُ الاستغناءِ والافتقار). نسخةٌ أولى قبلَ موجاتِ التعميق — تُحدَّثُ بعدَها، وتقاريرُها منشورة."
          : "The tier comes from the unified network: every link below was examined independently with both passages' context in view. First edition, before the deepening waves — it will be updated, and its reports are published."}
      </p>
      <div className="why-rows">
        {(cls.gates ?? []).length > 0 && (
          <div className="why-row">
            <span className="why-name">{ar ? "صيغةُ قاعدة" : "rule form"}</span>
            <span className="why-val" style={{ flex: 1, textAlign: "start" }}>{(cls.gates ?? []).map((g) => g.split(":")[1] ?? g).join(" · ")}</span>
          </div>
        )}
        {RELS.filter(({ key }) => (rels[key] ?? []).length > 0).map(({ key, ar: la, en }) => (
          <div className="why-row" key={key}>
            <span className="why-name">{ar ? la : en}</span>
            <span className="why-val" style={{ flex: 1, textAlign: "start" }}>
              {num((rels[key] ?? []).length)} — {(rels[key] ?? []).slice(0, 6).map((l) => arName(l)).join("، ")}
              {(rels[key] ?? []).length > 6 ? "…" : ""}
            </span>
          </div>
        ))}
        {mutual.length > 0 && (
          <div className="why-row">
            <span className="why-name">{ar ? "توكيدٌ متبادل" : "mutual affirmation"}</span>
            <span className="why-val" style={{ flex: 1, textAlign: "start" }}>{mutual.slice(0, 6).map((l) => arName(l)).join("، ")}{mutual.length > 6 ? "…" : ""}</span>
          </div>
        )}
        <div className="why-row">
          <span className="why-name">{ar ? "الأدلةُ عددًا" : "totals"}</span>
          <span className="why-val" style={{ flex: 1, textAlign: "start" }}>
            {ar
              ? `${num(cls.m ?? 0)} مفصِّلة · ${num(cls.T ?? 0)} محاور · ${num(cls.mu ?? 0)} مثانٍ`
              : `${num(cls.m ?? 0)} elaborators · ${num(cls.T ?? 0)} axes · ${num(cls.mu ?? 0)} mutual`}
          </span>
        </div>
      </div>
      {shawahid.length > 0 && (
        <>
          <button className={`why-shbtn${open ? " on" : ""}`} onClick={() => setOpen((v) => !v)}>
            <span>{ar ? `الشواهدُ بنصوصها (${num(shawahid.length)})` : `witnesses in full (${shawahid.length})`}</span>
            <span aria-hidden="true">{open ? "▴" : "▾"}</span>
          </button>
          {open && (
            <div className="why-shawahid">
              {shawahid.map(({ loc, rel }, i) => (
                <div className="why-sh" key={`${loc}-${rel}-${i}`}>
                  <div className="why-sh-top">
                    <span className="why-sh-rel">{rel}</span>
                    <Link className="why-sh-ref" to={readPathOf(loc)}>{arName(loc)}</Link>
                  </div>
                  <div className="quran why-sh-text">{texts ? (texts.get(loc)?.textClean ?? loc) : "…"}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="why-foot">
        {ar
          ? "كلّية: قاعدةٌ تلتقي عندَها المحاور (مفصِّلاتٌ ≥٨ واتساعٌ ≥٥) · جامعة: مفصِّلاتٌ ≥٣ أو مثانٍ · تفصيل: ما سوى ذلك. العتباتُ عُيِّرت على نصفِ الضبطِ المجمَّد وحدَه، وامتحانُ العيّنةِ المصونةِ منشورٌ بنتيجتِه قبل التعميق."
          : "kulliyya: axes meet at it (m≥8, spread≥5) · jāmiʿa: m≥3 or mutual · tafṣīl: otherwise. Thresholds tuned on the frozen tune half only; the held-out exam is published with its pre-deepening result."}
      </div>
    </div>
  );
}

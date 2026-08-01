/**
 * بطاقةُ فحصٍ برابطها الثابت — عنوانُ الاستشهاد. المسار: /fahis/c/:id.
 *
 * المعرّفُ لا يتغيّر ولا يُعاد استعمالُه، فما استُشهد به اليومَ يُقرأ غدًا.
 * وترتيبُ ما داخل البطاقة على الميثاق: الشواهدُ قبل النتيجة (التشريح في
 * FahisCardBlock)، وما بعدَها عدّةُ المرجعيّة: استشهادٌ جاهزٌ يُنسخ، ورابطٌ
 * ثابت، وسجلُّ مراجعاتٍ إن وُجد.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FahisTabs from "../components/FahisTabs";
import FahisCardBlock from "../components/FahisCardBlock";
import { FAHIS_CSS } from "../lib/fahisTheme";
import { type FahisCardData, KIND_LABEL, arDigits, loadFahisCards } from "../lib/fahisCards";
import { num, useUILang } from "../i18n";

export default function FahisCard() {
  useUILang();
  const { id } = useParams();
  const [cards, setCards] = useState<FahisCardData[] | null>(null);
  const [copied, setCopied] = useState<"" | "cite" | "link">("");

  useEffect(() => { loadFahisCards().then(setCards).catch(() => setCards([])); }, []);

  const card = cards?.find((c) => c.id === id) ?? null;

  useEffect(() => {
    if (card) document.title = `${card.title} — ميزان الأقوال · مشكاة`;
  }, [card]);

  const copy = (what: "cite" | "link") => {
    const text = what === "link" || !card
      ? location.href
      : `«${card.title}» — ميزانُ الأقوال، مشكاة · بطاقة ${num(card.n)} · فُحصت ${arDigits(card.date)} · ${location.href}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    }).catch(() => {});
  };

  return (
    <div className="page page-narrow fahis" dir="rtl" lang="ar">
      <style>{FAHIS_CSS}</style>
      <FahisTabs />

      {cards === null && <p className="lim">…</p>}

      {cards !== null && !card && (
        <>
          <p>لا بطاقةَ بهذا المعرّف — ولعلّها لم تُنشر بعدُ.</p>
          <p><Link to="/fahis">إلى الأقوال المفحوصة كلِّها ←</Link></p>
        </>
      )}

      {card && (
        <>
          <p className="crumb"><Link to="/fahis">ميزانُ الأقوال</Link> ← بطاقة {num(card.n)}</p>
          <h1>{card.title}</h1>
          <div className="fc-meta">
            {/* لا شارةَ حكمٍ هنا: داخلَ صفحة البطاقة الشواهدُ قبل النتيجة على أصل
                الميثاق — والاستثناءُ المقرُّ للفهرس وشريط الإحصاء وحدَهما */}
            {card.kinds.map((k) => <span className="k" key={k}>{KIND_LABEL[k]}</span>)}
            <span className="dt">فُحصت {arDigits(card.date)}</span>
          </div>

          <FahisCardBlock card={card} />

          <div className="foot">
            <span>بطاقة {num(card.n)}</span>
            <button onClick={() => copy("cite")}>{copied === "cite" ? "نُسخ الاستشهاد ✓" : "انسخِ الاستشهاد"}</button>
            <button onClick={() => copy("link")}>{copied === "link" ? "نُسخ الرابط ✓" : "انسخِ الرابطَ الثابت"}</button>
            <Link to="/fahis">كلُّ الأقوال المفحوصة</Link>
          </div>
          <p className="mithaq">
            الفكرةُ تُبحث لا قائلُها، ولا يُذكر في البطاقة اسمُ أحد — من ميثاق الفحص،
            وبيانُه في <Link to="/fahis/method">المنهج والمراجع</Link>.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * «المصادر والمنهج» — المسار: /tarikh/masadir.
 *
 * صفحةُ من أراد أن يتحقّق بنفسه: الكتبُ التي جاءت منها كلُّ روايةٍ معروضةٍ في
 * الباب بوفيات مصنِّفيها، والبيّناتُ الوثائقيّةُ الخمسُ ببطاقاتها وإحالاتها
 * المنشورة، والميثاقُ الحاكم (سلّمُ الأدلّة · درجاتُ الثقة · قواعدُ الفحص السبع ·
 * حدودُ المنهج) منقولًا حرفًا، ثمّ بصمةُ اللقطة كي يُعاد التشغيلُ عليها.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TARIKH_CSS } from "../lib/tarikhTheme";
import { arNum, count, COUNTS, loadTarikhClaims, type TarikhClaims } from "../lib/tarikhData";
import { inlineMd } from "../lib/tarikhMd";
import TarikhTabs from "../components/TarikhTabs";

export default function TarikhMasadir() {
  const [data, setData] = useState<TarikhClaims | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadTarikhClaims().then(setData).catch((e) => setErr(String(e))); }, []);

  const totalRecords = data?.clusterIndex.reduce((a, c) => a + c.records, 0) ?? 0;

  return (
    <div className="page page-narrow tarikh" dir="rtl" lang="ar">
      <style>{TARIKH_CSS}</style>
      <TarikhTabs />
      <h1>المصادر والمنهج</h1>
      <p className="lede">
        لا يُطلب من أحدٍ أن يصدّق: كلُّ روايةٍ في هذا الباب معروضةٌ بنصّها وكتابِها
        وموضعِها، وكلُّ حكمٍ محمولٌ على ميثاقٍ معلَنٍ قبل الفحص. وهذه الصفحة
        عُدّةُ من أراد أن يتحقّق أو ينقض.
      </p>

      {err && <p className="note">تعذّر التحميل: {err}</p>}
      {!data && !err && <p className="note">…</p>}

      {data && (
        <>
          {/* ١ — الكتب */}
          <h2>الكتبُ التي جاءت منها الروايات</h2>
          <p className="sub">
            {count(data.corpus.length, COUNTS.work)} مرتَّبةً بوفيات مصنِّفيها — منها{" "}
            {count(totalRecords, COUNTS.record)} في {count(data.clusterIndex.length, COUNTS.cluster)} معروضةٍ بأشجارها.
{" "}ومدوّنةُ البحث كلُّها أوسع: {inlineMd(data.corpusNote, "cn-")}.
          </p>
          <div className="works">
            {data.corpus.map((w) => (
              <div className="work" key={w.work}>
                <span className="wn">{w.work}</span>
                <span className="wa">
                  {w.author ?? "—"}
                  {w.deathAh != null && <> (ت{arNum(w.deathAh)}هـ)</>}
                </span>
                <span className="wc">{count(w.records, COUNTS.record)}</span>
              </div>
            ))}
          </div>

          {/* ٢ — البيّنة الوثائقية */}
          <h2>البيّنةُ الوثائقيّة</h2>
          <p className="sub">آثارٌ ماديّةٌ ودراساتٌ منشورة، يُحال إليها في الأحكام بالرمز و١…و٥.</p>
          <div className="wcards">
            {data.documentary.witnesses.map((w) => (
              <div className="wcard" key={w.id}>
                <div className="h"><span className="id">{w.id}</span><b>{w.title}</b></div>
                <div className="x">{inlineMd(w.raw, `${w.id}-`)}</div>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>{inlineMd(data.documentary.generalLimit, "gl-")}</p>

          <h3 style={{ marginTop: 22 }}>{data.externalRefs.title}</h3>
          <p className="refs">{inlineMd(data.externalRefs.raw, "refs-")}</p>

          {/* ٣ — الميثاق */}
          <h2>{data.method.title}</h2>
          <p className="sub"><b>الغاية:</b> {inlineMd(data.method.aim, "aim-")}</p>

          <h3>{data.method.ladder.title}</h3>
          <ol className="mlist">
            {data.method.ladder.items.map((it, i) => <li key={i}>{inlineMd(it, `l${i}-`)}</li>)}
          </ol>

          <h3>درجاتُ الثقة في الأحكام</h3>
          <div className="ladder">
            {data.grades.map((g) => (
              <div className={`g g-${g.id}`} key={g.id}>
                <span className="gchip">{g.label}</span>
                <span className="gl">{g.gloss}</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 22 }}>{data.method.rules.title}</h3>
          <ol className="mlist">
            {data.method.rules.items.map((it, i) => <li key={i}>{inlineMd(it, `r${i}-`)}</li>)}
          </ol>

          <h3>{data.method.limits.title}</h3>
          <ul className="mlist">
            {data.method.limits.items.map((it, i) => <li key={i}>{inlineMd(it, `x${i}-`)}</li>)}
          </ul>

          {/* ٤ — القيود المعتمَدة */}
          <h2>قيودٌ تُقرأ مع البيّنات</h2>
          <ul className="mlist">
            {data.qoyud.map((q) => <li key={q.id}><b>{q.id}:</b> {inlineMd(q.raw, `${q.id}-`)}</li>)}
          </ul>

          <p className="note" style={{ marginTop: 26, lineHeight: 1.9 }}>
            وكلُّ ما في هذا الباب مولَّدٌ آليًّا من نسخةٍ مجمَّدةٍ من هذه المادّة، تحرسها
            بوّابةٌ تُعيد مقابلةَ كلِّ نصٍّ معروضٍ بمصدره حرفًا حرفًا قبل أن يُعرض —
            فلا يصل إلى الصفحة نصٌّ لم يُطابَق.
          </p>
        </>
      )}
    </div>
  );
}

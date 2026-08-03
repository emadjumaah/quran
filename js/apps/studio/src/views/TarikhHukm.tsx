/**
 * الوثيقةُ المختومة كاملةً — صفحةُ قراءة. المسار: /tarikh/wathiqa.
 *
 * تُعرض بنصّها كما خُتمت (`HUKM-JAMC-v1.md`)، بلا اختصارٍ ولا إعادةِ صياغة،
 * ومعها بصمةُ الملفّ وإصدارةُ ختمه ليُتحقّق منها.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TARIKH_CSS } from "../lib/tarikhTheme";
import { arNum, loadTarikhHukm } from "../lib/tarikhData";
import { Md } from "../lib/tarikhMd";
import TarikhTabs from "../components/TarikhTabs";

export default function TarikhHukm() {
  const [doc, setDoc] = useState<{ markdown: string; chars: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadTarikhHukm().then(setDoc).catch((e) => setErr(String(e))); }, []);

  return (
    <div className="page page-narrow tarikh" dir="rtl" lang="ar">
      <style>{TARIKH_CSS}</style>
      <TarikhTabs />
      <p className="crumb"><Link to="/tarikh">ملفُّ جمع القرآن</Link> ← الوثيقةُ كاملةً</p>
      {err && <p className="note">تعذّر التحميل: {err}</p>}
      {!doc && !err && <p className="note">…</p>}
      {doc && (
        <>
          <Md className="doc" text={doc.markdown} />
          <p className="note" style={{ marginTop: 26, borderTop: "1px solid var(--line)", paddingTop: 14, lineHeight: 1.9 }}>
            هذه الوثيقةُ تُعرض كما خُتمت — {arNum(doc.chars)} حرفًا لم يُحرَّر منها حرف.
            وسجلُّ تحريرها ومراجعاتها محفوظٌ في مستودع بحثها.
          </p>
        </>
      )}
    </div>
  );
}

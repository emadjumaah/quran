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

export default function TarikhHukm() {
  const [doc, setDoc] = useState<{ rev: string; sha256: string; markdown: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadTarikhHukm().then(setDoc).catch((e) => setErr(String(e))); }, []);

  return (
    <div className="page page-narrow tarikh" dir="rtl" lang="ar">
      <style>{TARIKH_CSS}</style>
      <p className="crumb"><Link to="/tarikh">تاريخ النص</Link> ← الوثيقةُ كاملةً</p>
      {err && <p className="note">تعذّر التحميل: {err}</p>}
      {!doc && !err && <p className="note">…</p>}
      {doc && (
        <>
          <Md className="doc" text={doc.markdown} />
          <p className="note" style={{ marginTop: 26, borderTop: "1px solid var(--line)", paddingTop: 14, lineHeight: 1.9 }}>
            هذه الوثيقةُ تُعرض في مشكاة كما خُتمت في مستودع بحثها: إصدارةُ الختم{" "}
            <code>{doc.rev}</code> · بصمةُ الملفّ <code>{doc.sha256.slice(0, 16)}</code> ·{" "}
            {arNum(doc.markdown.length)} حرفًا. لم يُحرَّر منها حرفٌ في العرض.
          </p>
        </>
      )}
    </div>
  );
}

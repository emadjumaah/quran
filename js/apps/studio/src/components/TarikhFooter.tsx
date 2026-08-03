/**
 * تذييلُ باب «تاريخ النص»: الدرجاتُ الخمسُ وما تعنيه، وقيدُ قراءة المدار،
 * والقيودُ المعتمَدة، ثمّ إحالةٌ إلى الوثيقة الكاملة معروضةً صفحةَ قراءة.
 *
 * أسماءُ الدرجات من v1 §٠، وشروحُها من الميثاق §٣ — منقولةٌ حرفًا لا مصوغة.
 */
import { Link } from "react-router-dom";
import type { TarikhClaims } from "../lib/tarikhData";
import { inlineMd } from "../lib/tarikhMd";

export default function TarikhFooter({ data, hideDocLink }: { data: TarikhClaims; hideDocLink?: boolean }) {
  return (
    <div className="mithaq">
      <h2 style={{ marginTop: 0 }}>الميثاقُ في سطور</h2>
      <p className="sub">{inlineMd(data.howToRead[0].raw, "h0-")}</p>
      <div className="ladder">
        {data.grades.map((g) => (
          <div className={`g g-${g.id}`} key={g.id}>
            <span className="gchip">{g.label}</span>
            <span className="gl">{g.gloss}</span>
          </div>
        ))}
      </div>
      <p className="note" style={{ marginTop: 14, lineHeight: 1.9 }}>
        {inlineMd(data.howToRead[1].raw, "h1-")}
      </p>
      <details style={{ marginTop: 10 }}>
        <summary className="note" style={{ cursor: "pointer" }}>
          {inlineMd(data.howToRead[2].raw, "h2-")}
        </summary>
        <ul style={{ marginTop: 8, paddingInlineStart: 20 }}>
          {data.qoyud.map((q) => (
            <li key={q.id} className="note" style={{ lineHeight: 1.9, marginBottom: 7 }}>
              <b>{q.id}:</b> {inlineMd(q.raw, `${q.id}-`)}
            </li>
          ))}
        </ul>
      </details>
      {!hideDocLink && (
        <p style={{ marginTop: 16 }}>
          والوثيقةُ كاملةً — بمقدّماتها وخلاصتها وسجلِّ ختمها وإحالاتها الخارجية —{" "}
          <Link to="/tarikh/wathiqa">تُقرأ هنا</Link>.
        </p>
      )}
    </div>
  );
}

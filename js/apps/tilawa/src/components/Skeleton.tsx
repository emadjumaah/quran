/**
 * **هيكلُ انتظارٍ بمقاس المحتوى** — ما يُرى بين شاشة الإقلاع وقيام المصحف.
 *
 * نصُّ المصحف ١٫٣ م.ب يُجلب مرّةً؛ فلو تُرك السطحُ فارغًا أو وُضعت فيه دوّامةٌ
 * قال الوجهُ «موقعٌ يُحمَّل» (ميثاقُ الوجه §١/١٠). فيُرسم **شكلُ الصفحة**:
 * إطارُها وترويستُها ولوحةُ سورةٍ وأسطرُ متنٍ بارتفاع سطر المصحف نفسِه — فيقع
 * المصحفُ في موضعه حين يصل، ولا تثب الصفحةُ تحت عين القارئ.
 *
 * **ولا حرفَ فيه يُقرأ ولا لفظَ قرآنٍ يُحاكى** — أشرطةٌ صمّاءُ لا غير.
 */
const LINES = [96, 88, 94, 72, 90, 84];

export default function Skeleton() {
  return (
    <div className="tw-skeleton" aria-hidden>
      <div className="tw-sk-page">
        <div className="tw-sk-head">
          <span className="tw-sk-bar" style={{ width: "24%" }} />
          <span className="tw-spacer" />
          <span className="tw-sk-bar" style={{ width: "14%" }} />
          <span className="tw-spacer" />
          <span className="tw-sk-bar" style={{ width: "30%" }} />
        </div>
        <div className="tw-sk-bar tw-sk-line" style={{ width: "100%", height: 54, marginBottom: 20 }} />
        {LINES.map((w, i) => (
          <div key={i} className="tw-sk-bar tw-sk-line" style={{ width: `${w}%`, marginInline: "auto" }} />
        ))}
      </div>
    </div>
  );
}

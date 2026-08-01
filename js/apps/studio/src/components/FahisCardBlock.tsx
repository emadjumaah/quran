/**
 * تشريحُ بطاقة الفحص (ر٢) — ترتيبُ الميثاق §د-٢ محفوظٌ حرفيًّا داخل البطاقة:
 * القولُ ← «أي:» ← ما فُحص ← الشواهدُ برتبها ← النتيجةُ ← ما لا يلزم منها.
 * فالقارئُ لا يبلغ الحكمَ الملوَّنَ إلا وقد مرّ على شواهده.
 *
 * قاعدتا التحرير: سطرُ «أي:» بلا مصطلح؛ والشاهدُ الجاري خلافَ القول يُعلَّم
 * ولا يُكتم. وشارةُ الرتبة بلون رتبتها (سندُ الشاهد)، ولونُ الحالة للحكم —
 * ولا يختلطان.
 */
import { Link } from "react-router-dom";
import { type FahisCardData, VERDICT_META, arDigits, toolHref } from "../lib/fahisCards";
import { RANK_TONE } from "../lib/fahisTheme";
import { num } from "../i18n";

/** يُبرز ما بين نجمتين — فالبطاقةُ يجب أن يظهر فيها موضعُ الحسم لا أن تُقرأ سطرًا مستويًا */
export function Emph({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))}
    </>
  );
}

export default function FahisCardBlock({ card }: { card: FahisCardData }) {
  const v = VERDICT_META[card.verdict];
  return (
    <div className={`fc v-${card.verdict}`} id={card.id}>
      <div className="fc-claim">القول: «{card.claim}»</div>
      <p className="fc-ay"><b>أي:</b> {card.plain}.</p>
      <p className="fc-scope">ما فُحص: {card.scope}.</p>

      <h3>الشواهد — وسندُ كلِّ شاهدٍ برتبته</h3>
      <ol>
        {card.evidence.map((e, i) => (
          <li key={i} className={e.counter ? "counter" : undefined}>
            {e.counter && <span className="cmark">شاهدٌ يجري خلافَ القول — يُعرض ولا يُكتم</span>}
            {e.rank !== null
              ? <span className="rb" style={{ background: RANK_TONE[e.rank] ?? "#777" }}>الرتبة {num(e.rank)}</span>
              : <span className="rb m">منهجُ الفحص</span>}
            <Emph text={e.text} />
          </li>
        ))}
      </ol>

      <div className="vstrip">
        <b>النتيجة: {v.label}</b>
        <p className="vd-detail">{card.verdictDetail}</p>
        <p className="vd-gloss">{v.gloss}</p>
      </div>

      <p className="fc-limit"><b>ما لا يلزم من هذه النتيجة:</b> <Emph text={card.limit} /></p>

      {card.tool && (
        <>
          <Link className="redo" to={toolHref(card.tool)}>أعِد الفحصَ بنفسك ⟲</Link>
          <span className="redo-note">يفتح قالبَ الأداة مملوءًا فيُعيد الحسابَ أمامك — وكلُّ رقمٍ يُعاد فيُطابق.</span>
        </>
      )}

      {card.revisions.length > 0 && (
        <details className="revs">
          <summary>سجلُّ المراجعات ({num(card.revisions.length)}) — لا تعديلَ صامتًا في مرجع</summary>
          <ul>
            {card.revisions.map((r, i) => (
              <li key={i}><b>{arDigits(r.date)}</b> — {r.what}. <span style={{ opacity: .75 }}>({r.why})</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

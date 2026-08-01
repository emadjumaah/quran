/**
 * «المنهجُ والمراجع» — بابُ المقياس في ميزان الأقوال. المسار: /fahis/method.
 *
 * هنا كلُّ ما يقوم عليه الحكم: الأصولُ الثلاثة، وشروطُ الاستقامة، والأنواعُ
 * الثمانية بأدواتها، ومعجمُ صيغ الحكم الستِّ بألوانها وشرحِها الثابت،
 * والمصفاةُ بأرقامها المعلَنة، ولوحُ المراجع المولَّدُ من المانيفست —
 * فلا يُكتب باليد ولا يشيخ.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FahisTabs from "../components/FahisTabs";
import { FAHIS_CSS, RANK_TONE } from "../lib/fahisTheme";
import { VERDICT_META, loadFahisCards } from "../lib/fahisCards";
import { getUILang, num, useUILang } from "../i18n";

interface Book {
  id: string; label: string; author: string; died: number | null;
  rank: number; group: string; kind: "ayah" | "root" | "section";
  anchor?: string | null; role?: string | null; note?: string;
  coverage: number; coverageOf: number | null; shards: number; bytes: number;
}
interface Manifest { date: string; ranks: Record<string, string>; books: Book[] }

/** الأصولُ الثلاثة — نصُّ الميثاق §أ مختصرًا */
const USUL = [
  { t: "المرجعُ من أهل الاختصاص", d: "المسألةُ اللغويّةُ تُبحث في المعاجم وكتب المعاني والإعراب وفقه اللغة — كلٌّ في بابه. ويُذكر مع كلِّ شاهدٍ من أيِّ كتابٍ أُخذ، ليُراجَع في موضعه." },
  { t: "الفكرةُ تُبحث لا قائلُها", d: "لا يُذكر اسمُ أحدٍ في نتيجة، ولا تُقوَّى فكرةٌ بجاهِ صاحبها ولا تُضعَّف بمخالفته. تُجرَّد الفكرةُ من قائلها ثم تُوزن." },
  { t: "لا نتبنّى مذهبًا، نطلب البيان", d: "لسنا مع فريقٍ ولا على فريق. نُقرّ ما تُقرّه الشواهد، ونقف عند ما لا تُثبته، ونصرّح بما لم يتبيّن لنا. و«لم يتبيّن» نتيجةٌ معتبرةٌ لا نقص." },
];

/** شروطُ استقامة الفكرة — الميثاق §ج */
const SHURUT = [
  { t: "قابليّةُ الاختبار", d: "تُصاغ الفكرةُ بحيث يمكن أن يُختبر صدقُها بشاهد. وما لا يُختبر بشيءٍ لا يُثبَت بشيء." },
  { t: "الاستقراءُ التامّ", d: "تُفحص على كلِّ مواضع اللفظ في المصحف لا على ما وافقها، وموضعٌ واحدٌ مخالفٌ يُقيّدها أو يمنع إطلاقَها." },
  { t: "السندُ من رتبةٍ مناسبة", d: "لغويّةٌ بمعجم، ونحويّةٌ بمعرِب، وقاعديّةٌ بأصوليّ — لا بنقلٍ عن غير أهل الشأن." },
  { t: "معدّلُ الصدفة قبل الحكم", d: "في كلِّ قولٍ عدديٍّ يُحسب أولًا كم مثيلًا يقع تلقائيًّا. فإن كثُر المثيلُ فلا دلالةَ في الواقعة." },
];

/** أنواعُ الأقوال والأداةُ التي تفحص كلَّ نوع — القولُ يُصنَّف بأداته لا بموضوعه ولا بقائله */
const ADAWAT = [
  { k: "كلّيّة", ex: "«كلُّ… / لا يوجد… / أبدًا»", tool: "الاستقراءُ التامّ — يكفي موضعٌ واحدٌ مخالف", r: 1 },
  { k: "عدديّة", ex: "«وردت كذا كذا مرّة»", tool: "العدُّ التامُّ ثمّ معدّلُ الصدفة قبل النتيجة", r: 1 },
  { k: "صرفيّة", ex: "«جذرُها كذا / صيغتُها تدلّ على…»", tool: "وسمُ الصرف لكلِّ كلمةٍ في المصحف", r: 1 },
  { k: "قراءات", ex: "«لا يصحّ إلا هذا الضبط»", tool: "النشرُ لابن الجزري — تُعرض القراءاتُ المتواترة", r: 1 },
  { k: "دلاليّة", ex: "«هذا اللفظ يعني كذا»", tool: "استقراءُ مواضعه كلِّها + المعاجم + معاني القرآن", r: 2 },
  { k: "إعرابيّة", ex: "«هذه بدلٌ لا مفعول»", tool: "كتبُ الإعراب الأربعة — ويُعرض خلافُها لا قولٌ واحد", r: 3 },
  { k: "ترادفٌ وفروق", ex: "«لا ترادفَ بين س وص»", tool: "توزيعُ اللفظين + كتبُ الفروق + قواعدُ الأصوليّين", r: 4 },
  { k: "خارجَ بابنا", ex: "تاريخٌ وفقهٌ وعقيدة", tool: "لا آلةَ لنا فيه — موقوفٌ ولا نتكلّف حكمًا", r: 0 },
];

export default function FahisMethod() {
  useUILang();
  const ar = getUILang() === "ar";
  const [m, setM] = useState<Manifest | null>(null);
  const [nCards, setNCards] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}refs/manifest.json?v=${__DATA_VERSION__}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setM)
      .catch(() => {});
    loadFahisCards().then((c) => setNCards(c.length)).catch(() => {});
  }, []);

  const byRank = new Map<number, Book[]>();
  for (const b of m?.books ?? []) {
    if (!byRank.has(b.rank)) byRank.set(b.rank, []);
    byRank.get(b.rank)!.push(b);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  return (
    <div className="page page-narrow fahis" dir="rtl" lang="ar">
      <style>{FAHIS_CSS}</style>

      {!ar && (
        <p className="muted" style={{ marginBottom: 18, fontSize: ".9rem" }} dir="ltr" lang="en">
          The method behind Mīzān al-Aqwāl: the three principles, the four conditions, the eight
          claim types and their instruments, the six verdicts, and the full reference library by
          evidentiary rank — all in Arabic, as are the sources.
        </p>
      )}

      <FahisTabs />

      <h1>المنهجُ والمراجع</h1>
      <p className="lede">
        المقياسُ الذي بُني عليه كلُّ حكمٍ في هذا القسم — معلَنٌ كلُّه: مَن شاء
        راجَع، ومَن شاء خالفَ على بيّنة. فالاعتراضُ المسنَدُ عندنا خيرٌ من موافقةٍ
        بلا نظر.
      </p>

      <section>
        <h2>الأصولُ الثلاثة</h2>
        <p className="sub">عليها تقوم كلُّ نتيجة</p>
        <div className="usul">
          {USUL.map((u) => (
            <div key={u.t}><b>{u.t}</b><p>{u.d}</p></div>
          ))}
        </div>
      </section>

      <section>
        <h2>متى تستقيم الفكرة</h2>
        <p className="sub">أربعةُ شروطٍ مجتمعة — يقف عند واحدٍ منها كثيرٌ ممّا يُتداول</p>
        <div className="usul">
          {SHURUT.map((u) => (
            <div key={u.t}><b>{u.t}</b><p>{u.d}</p></div>
          ))}
        </div>
      </section>

      <section>
        <h2>بأيِّ أداةٍ يُفحص القول</h2>
        <p className="sub">
          القولُ يُصنَّف <b>بالأداة التي تفحصه</b> لا بموضوعه ولا بقائله — ولذلك
          يصلح الميزانُ لأيِّ فكرةٍ تأتي بعدُ، لا لما جُمع وحدَه
        </p>
        <div className="books">
          {ADAWAT.map((a) => (
            <div className="bk" key={a.k}>
              <div>
                <span className="nm">{a.k}</span>
                <span className="au">{a.ex}</span>
              </div>
              <div className="cv">{a.r ? `الرتبة ${num(a.r)}` : "—"}</div>
              <div className="how">{a.tool}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>صيغُ الحكم الستّ</h2>
        <p className="sub">معجمٌ ثابت: العنوانُ نفسُه والشرحُ نفسُه في كلِّ بطاقة — واللونُ للحالة لا للسند</p>
        <div className="vlex">
          {(Object.keys(VERDICT_META) as (keyof typeof VERDICT_META)[]).map((v) => (
            <div key={v} className={`v-${v}`}>
              <span className="vchip">{VERDICT_META[v].label}</span>
              <span className="g">{VERDICT_META[v].gloss}</span>
            </div>
          ))}
        </div>
        <p className="lim" style={{ marginTop: 12 }}>
          وشارةُ الحالة تظهر في فهرس البطاقات لأنّه جدولُ محتويات؛ وأمّا داخلُ
          البطاقة فالشواهدُ قبل النتيجة دائمًا — لا يبلغ القارئُ حكمًا إلا وقد
          مرّ على أدلّته.
        </p>
      </section>

      <section>
        <h2>من أين تأتي البطاقات — المصفاةُ بأرقامها</h2>
        <p className="sub">نعلن الطريقَ كلَّه ليُعلم أنّ وراء كلِّ بطاقةٍ تقطيرًا لا انتقاءً</p>
        <div className="sift">
          <div><b>٢٨٫٣ مليون حرف</b><span>مادّةٌ مجموعةٌ ممّا يُقال في القرآن ولغته — ٦٣٩ نصًّا، كلُّ نصٍّ محفوظٌ برابط مصدره، ولا يُنشر منها شيء: يخرج حكمُنا لا كلامُ أحد</span></div>
          <div><b>٢٬٥٥٥ جملة</b><span>رُشّحت آليًّا بأنماط الدعاوى القابلة للفحص</span></div>
          <div><b>٧٦٤ قابلةً للفحص</b><span>بعد طرح ما هو خارجَ بابنا وما لا قولَ فيه</span></div>
          <div><b>{nCards !== null ? `${num(nCards)} بطاقةً منشورة` : "…"}</b><span>حُرّرت قابلةً للاختبار، وفُحصت على الميثاق، ونُشرت بشواهدها وحدودها — والعددُ ينمو</span></div>
        </div>
        <p className="lim" style={{ marginTop: 12 }}>
          والقولُ يُجرَّد من قائله قبل الفحص عملًا بالأصل الثاني — فلا اسمَ في
          بطاقة، ولا حكمَ على أحد: تُوزن الأفكارُ لا الرجال.
        </p>
      </section>

      <section>
        <h2>على أيِّ شيءٍ يقوم الميزان</h2>
        <p className="sub">
          {m
            ? <>المراجعُ المعتمَدةُ كلُّها، مرتَّبةً بقوّتها في الاحتجاج — {num(m.books.length)} كتابًا،
              وكلُّ رقمٍ هنا مولَّدٌ من البناء لا مكتوبٌ باليد. وما لم يثبت إسنادُه إلى موضعه لم يُحمل أصلًا.</>
            : "…"}
        </p>

        {ranks.map((r) => (
          <div className="rank" key={r}>
            <header>
              <span className="rn" style={{ background: RANK_TONE[r] ?? "#777" }}>الرتبة {num(r)}</span>
              <span className="rd">{m?.ranks[String(r)]}</span>
            </header>
            <div className="books">
              {byRank.get(r)!.map((b) => (
                <div className="bk" key={b.id}>
                  <div>
                    <span className="nm">{b.label}</span>
                    <span className="au">{b.author}{b.died ? ` (ت ${num(b.died)})` : ""}</span>
                  </div>
                  <div className="cv">
                    {b.kind === "ayah" && <>{num(b.coverage)} موضعًا من {num(6236)}</>}
                    {b.kind === "root" && <>{num(b.coverage)} مادّةً من {num(1651)}</>}
                    {b.kind === "section" && <>{num(b.coverage)} بابًا</>}
                  </div>
                  {/* لا يُعاد نصُّ الرتبة تحت كلِّ كتاب — يُذكر ما يخصُّ الكتابَ
                      وحدَه: دورُه إن كان مميِّزًا، وإلا فالمِرساةُ التي أُسند بها */}
                  {(b.note || b.anchor || b.role) && (
                    <div className="how">
                      {b.note ?? (b.rank === 1 || b.rank === 5 ? b.role : b.anchor ? `المِرساة: ${b.anchor}` : b.role)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="lim" style={{ marginTop: 18 }}>
          وهذه المراجعُ تُقرأ في مواضعها من التطبيق أيضًا: المعاجمُ في{" "}
          <Link to="/roots">صفحة المادّة</Link>، وكتبُ الإعراب والمعاني عند الآية.
          و<Link to="/docs">التوثيق</Link> يشرح كيف بُني كلُّ جزءٍ من مشكاة.
        </p>
      </section>
    </div>
  );
}

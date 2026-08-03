/**
 * «تاريخ النص» — صدرُ الباب. المسار: /tarikh.
 *
 * مدخلٌ واحدٌ وكشفٌ تدريجيّ: سطرٌ زمنيٌّ وثائقيٌّ واحد، ثمّ ثماني بطاقاتِ دعوى
 * بترتيب السردية على كلٍّ منها شارةُ درجتها. والدرجاتُ ونصوصُها كلُّها منقولةٌ
 * حرفًا من وثيقة الحكم المختومة v1 — تُعرض ولا تُحرَّر.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TARIKH_CSS } from "../lib/tarikhTheme";
import {
  arNum, loadTarikhClaims, loadTarikhTimeline,
  type TarikhClaims, type TarikhTimeline,
} from "../lib/tarikhData";
import { inlineMd } from "../lib/tarikhMd";
import GradeChip from "../components/GradeChip";
import TarikhFooter from "../components/TarikhFooter";
import { getUILang, useUILang } from "../i18n";

/**
 * السطرُ الزمنيّ الوثائقيّ — بالاتجاه العربيّ: الأقدمُ يمينًا والأحدثُ يسارًا،
 * فالمحورُ يُقرأ كما يُقرأ السطر. والمرتكزُ ذو المدى يُرسم شريطًا لا نقطةً،
 * والبطاقاتُ تتناوب علوًّا كي لا تتراكب عند التقارب.
 */
function Timeline({ tl }: { tl: TarikhTimeline }) {
  const { ceFrom, ceTo } = tl.axis;
  const at = (ce: number) => ((ce - ceFrom) / (ceTo - ceFrom)) * 100;
  return (
    <div className="tl">
      <div className="axis">
        <div className="rule" />
        {tl.points.map((p, i) => {
          const lo = p.ce[0], hi = p.ce[1]!;
          const start = at(lo ?? ceFrom), end = at(hi);
          const stagger = i % 2 === 1;
          return (
            <div
              key={p.key}
              className={`pt${stagger ? " alt" : ""}`}
              style={{ insetInlineStart: `${end}%` }}
            >
              {lo !== null && lo !== hi && (
                <div className="span" style={{ width: `${end - start}%`, insetInlineEnd: 0 }} />
              )}
              <div className="dot" />
              <div className="w">{p.witness}</div>
              <div className="lab">
                {p.ah != null ? `${arNum(p.ah)}هـ` : lo !== null ? `${arNum(lo)}–${arNum(hi)}م` : `قبل ${arNum(hi)}م`}
              </div>
            </div>
          );
        })}
      </div>
      <div className="ticks">
        <span>{arNum(ceFrom)}م</span><span>{arNum(Math.round((ceFrom + ceTo) / 2))}م</span><span>{arNum(ceTo)}م</span>
      </div>
      <p className="cap">
        مرتكزاتٌ ماديّةٌ مؤرَّخة:{" "}
        {tl.points.map((p, i) => (
          <span key={p.key}>{i > 0 && <span className="sep">·</span>}{p.phrase}</span>
        ))}.
        {tl.bands.length > 0 && (
          <> وشاهدا {tl.bands.map((b) => b.witness).join(" و")} لا تاريخَ نقطيًّا لهما — {tl.bands[0].band}.</>
        )}
      </p>
    </div>
  );
}

export default function Tarikh() {
  useUILang();
  const ar = getUILang() === "ar";
  const [data, setData] = useState<TarikhClaims | null>(null);
  const [tl, setTl] = useState<TarikhTimeline | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadTarikhClaims().then(setData).catch((e) => setErr(String(e)));
    loadTarikhTimeline().then(setTl).catch(() => {});
  }, []);

  return (
    <div className="page page-narrow tarikh" dir="rtl" lang="ar">
      <style>{TARIKH_CSS}</style>

      {!ar && (
        <p className="muted" style={{ marginBottom: 18, fontSize: ".9rem" }} dir="ltr" lang="en">
          «Tārīkh al-naṣṣ» presents the sealed verdict document on the collection of the Qurʾān:
          eight claims, each with its evidence — transmitted and documentary — its graded verdict,
          its limits, and what would change the grade. Arabic only for now.
        </p>
      )}

      <h1>تاريخ النص</h1>
      <p className="lede">
        كيف وصل المصحفُ إلينا؟ ثماني دعاوى تُعرض هنا بأدلّتها: بيّنةٌ منقولةٌ
        مؤرَّخةُ الدوران بأشجار طرقها، وبيّنةٌ وثائقيّةٌ من الرقوق والنقوش —
        ولكلِّ دعوى <b>درجةٌ معلَنة</b>، وحدودٌ لا يتجاوزها حكمُها، وبندٌ يقول
        صراحةً <b>ما الذي يغيّر الدرجة</b>.
      </p>

      {err && <p className="note">تعذّر تحميلُ الباب: {err}</p>}
      {!data && !err && <p className="note">…</p>}

      {tl && <Timeline tl={tl} />}

      {data && (
        <>
          <h2>الدعاوى الثماني</h2>
          <p className="sub">بترتيب السردية — من كتابة الوحي إلى مصاحف الصحابة.</p>
          <div className="cards">
            {data.claims.map((c) => (
              <Link className={`card g-${c.grade}`} key={c.id} to={c.route}>
                <div className="row">
                  <span className="n">{c.id}</span>
                  <span className="t">{c.title}</span>
                  <GradeChip grade={c.grade} grades={data.grades} />
                  {c.grades.length > 1 && (
                    <span className="gchip more" title="للدعوى أحكامٌ فرعيّةٌ بدرجاتٍ أخرى — تُقرأ داخلها">
                      ودرجاتٌ أخرى ({arNum(c.grades.length - 1)})
                    </span>
                  )}
                </div>
                <p className="cl">{inlineMd(c.fields.claim.raw, `${c.id}-`)}</p>
              </Link>
            ))}
          </div>

          <TarikhFooter data={data} />
        </>
      )}
    </div>
  );
}

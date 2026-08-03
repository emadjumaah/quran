/**
 * صفحةُ الدعوى — المسار: /tarikh/d/:id.
 *
 * ترتيبُ العرض: الحكمُ وتسبيبُه ← البيّنةُ المنقولةُ وشجرتُها التفاعليّة ←
 * بطاقاتُ البيّنة الوثائقيّة ← «حدود الحكم» و«ما الذي يغيّر الدرجة» في ذيل
 * الصفحة بتصميمٍ محترمٍ لا هامشيّ. وكلُّ نصٍّ هنا منقولٌ حرفًا من v1.
 *
 * الكسل: شجرةُ العنقود لا تُجلب إلا حين يُطلب عنقودُها — والدعوى ذاتُ عناقيدَ
 * متعدّدةٍ تُحمّل المفتوحَ منها وحدَه.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TARIKH_CSS } from "../lib/tarikhTheme";
import {
  arNum, count, COUNTS, loadTarikhClaims, loadTarikhCluster,
  type TarikhClaim, type TarikhClaims, type TarikhCluster,
} from "../lib/tarikhData";

/** فاصلةٌ معزولةُ الاتجاه — لا تلتصق بالأرقام فتُقرأ رقمًا */
const Sep = () => <span className="sep">·</span>;
import { inlineMd, Md } from "../lib/tarikhMd";
import GradeChip from "../components/GradeChip";
import TarikhFooter from "../components/TarikhFooter";
import TarikhTree from "../components/TarikhTree";
import TarikhTabs from "../components/TarikhTabs";

/** الشجرةُ ومعها بطاقةُ العنقود — تُحمّل عند اختيار عنقودها لا قبلَه */
function ClusterPane({ id, data }: { id: string; data: TarikhClaims }) {
  const [cl, setCl] = useState<TarikhCluster | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setCl(null); setErr(null);
    loadTarikhCluster(id).then((c) => { if (live) setCl(c); }).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, [id]);

  const brief = data.clusterIndex.find((c) => c.id === id);
  if (err) return <p className="note">تعذّر تحميلُ العنقود: {err}</p>;
  if (!cl) return <p className="note">…تُحمَّل شجرةُ {id}</p>;

  const earliest = cl.earliestWitness;
  const settled = cl.earliestFullySettledRoute;
  return (
    <>
      <p className="note" style={{ margin: "0 0 8px", lineHeight: 1.9 }}>
        {count(cl.records.length, COUNTS.record)} في {count(cl.works.length, COUNTS.work)}
        {earliest && <><Sep />أقدمُ شاهد: {earliest.work_ar} (ت{arNum(earliest.death_ah)})</>}
        <Sep />أقدمُ طريقٍ كاملةِ التسوية: {settled ? `${settled.work_ar} (ت${arNum(settled.death_ah)})` : "لا شيء"}
        {brief && brief.chronoSuspect > 0 && <><Sep />حوافُّ مشبوهةٌ زمنيًّا: {arNum(brief.chronoSuspect)}</>}
      </p>
      <TarikhTree cluster={cl} />
      {cl.records.some((r) => r.chainless) && (
        <details style={{ marginTop: 12 }}>
          <summary className="note" style={{ cursor: "pointer" }}>
            روايات هذا العنقود التي لا إسنادَ مسنَدًا لها — لا موضعَ لها في الشجرة، وتُعرض هنا بنصّها
          </summary>
          <div style={{ marginTop: 8 }}>
            {cl.records.filter((r) => r.chainless).map((r) => (
              <div className="wcard" key={r.id} style={{ marginBottom: 8 }}>
                <div className="h">
                  <b>{r.source.workAr}</b>
                  {r.source.deathAh != null && <span className="id">ت{arNum(r.source.deathAh)}</span>}
                  <span className="id"><bdi>{r.id}</bdi></span>
                </div>
                <div className="x" style={{ lineHeight: 2 }}>{r.fullText}</div>
              </div>
            ))}
          </div>
        </details>
      )}
      {Object.keys(cl.candidates).length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="note" style={{ cursor: "pointer" }}>
            المرشَّحون للمدار بالمعايير — وما يفصل بينها
          </summary>
          <div style={{ marginTop: 8 }}>
            {Object.entries(cl.candidates).map(([crit, v]) => (
              <div key={crit} style={{ marginBottom: 10 }}>
                <b className="note">المعيار {crit}</b>
                <ul style={{ marginTop: 4, paddingInlineStart: 20 }}>
                  {v.candidates.length === 0 && <li className="note">لا مرشَّح</li>}
                  {v.candidates.map((c) => (
                    <li key={c.node} className="note" style={{ lineHeight: 1.9 }}>
                      {c.label}
                      {c.deathYear != null ? ` (ت${arNum(c.deathYear)})` : ""} — تلاميذُه {arNum(c.students)}
                      {c.studentsCorroborated > 0 && `؛ ${count(c.studentsCorroborated, COUNTS.branch)}`}
                      {c.studentsDeathRange?.min != null && `؛ وفياتُهم ${arNum(c.studentsDeathRange.min)}–${arNum(c.studentsDeathRange.max ?? c.studentsDeathRange.min)}`}
                      {c.flags.includes("cl-on-name-node") && "؛ على عقدةِ اسمٍ غير مسوّاة (ق-ج)"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

export default function TarikhClaim() {
  const { id = "" } = useParams();
  const [data, setData] = useState<TarikhClaims | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => { loadTarikhClaims().then(setData).catch((e) => setErr(String(e))); }, []);

  const claim: TarikhClaim | undefined = data?.claims.find((c) => c.id === decodeURIComponent(id));
  const inSnap = (claim?.clusters ?? []).filter((c) => c.inSnapshot && c.id);
  useEffect(() => { setActive(inSnap[0]?.id ?? null); }, [claim?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page page-narrow tarikh" dir="rtl" lang="ar">
      <style>{TARIKH_CSS}</style>
      <TarikhTabs />
      <p className="crumb"><Link to="/tarikh">تاريخ النص</Link> ← {claim?.title ?? decodeURIComponent(id)}</p>

      {err && <p className="note">تعذّر التحميل: {err}</p>}
      {!data && !err && <p className="note">…</p>}
      {data && !claim && <p className="note">لا دعوى بهذا المعرّف.</p>}

      {data && claim && (
        <>
          <h1>{claim.title}</h1>
          <p className="lede">{inlineMd(claim.fields.claim.raw, "c-")}</p>

          {/* ١ — الحكم وتسبيبه */}
          <div className={`verdict g-${claim.grade}`}>
            {claim.rulings.map((r, i) => {
              // حكمٌ نصُّه اسمُ الدرجة وحده («راجح بالتقاطع.») — الشارةُ تكفيه
              const label = r.grades[0] ? data.grades.find((g) => g.id === r.grades[0])?.label : null;
              const bare = label && r.raw.replace(/[.\s]+$/, "") === label;
              return (
                <p className="r" key={i}>
                  {r.grades[0] && <GradeChip grade={r.grades[0]} grades={data.grades} />}
                  {!bare && inlineMd(r.raw, `r${i}-`)}
                </p>
              );
            })}
            {claim.rulings[0]?.body && (
              <p className="why">{inlineMd(claim.rulings[0].body, "why-")}</p>
            )}
          </div>

          <details className="howto" style={{ marginTop: 6 }}>
            <summary style={{ cursor: "pointer" }}>ماذا تعني هذه الدرجة؟ — سلّمُ الدرجات الخمس</summary>
            <div className="ladder" style={{ marginTop: 8 }}>
              {data.grades.map((g) => (
                <div className={`g g-${g.id}`} key={g.id}>
                  <span className="gchip">{g.label}</span>
                  <span className="gl">{g.gloss}</span>
                </div>
              ))}
            </div>
          </details>

          {/* ٢ — البيّنة المنقولة وشجرتُها */}
          <div className="block">
            <h3>
              {claim.fields.manqul.label}
              {claim.fields.manqul.note ? ` (${claim.fields.manqul.note})` : ""}
            </h3>
            <p className="note" style={{ margin: "0 0 8px" }}>
              ما رواه الناسُ عن هذا الخبر في كتب التراث: مَن رواه عمّن، وفي أيّ كتابٍ دُوّن، ومتى دار.
            </p>
            <Md className="body" text={claim.fields.manqul.raw} />
            {claim.clusters.length > 0 && (
              <>
                <div className="cltabs">
                  {claim.clusters.map((c) =>
                    c.inSnapshot && c.id ? (
                      <button key={c.ref} data-on={active === c.id ? 1 : 0} onClick={() => setActive(c.id)}>
                        {c.ref}
                      </button>
                    ) : (
                      <span key={c.ref} className="out" title="عنقودٌ مذكورٌ في الوثيقة وليس في لقطة هذا الباب">
                        {c.ref} — خارجَ اللقطة
                      </span>
                    ),
                  )}
                </div>
                {active && <ClusterPane id={active} data={data} />}
              </>
            )}
            {claim.clusters.length === 0 && (
              <p className="note">لا شجرةَ عنقودٍ لهذه الدعوى في الوثيقة — بيّنتُها المنقولة وسومٌ وأبوابُ كتب.</p>
            )}
          </div>

          {/* ٣ — البيّنة الوثائقية ببطاقاتها */}
          {(claim.fields.wathaiqi || claim.witnessRefs.length > 0) && (
            <div className="block">
              <h3>
                {claim.fields.wathaiqi?.label ?? "البيّنة الوثائقية"}
                {claim.fields.wathaiqi?.note ? ` (${claim.fields.wathaiqi.note})` : ""}
              </h3>
              <p className="note" style={{ margin: "0 0 8px" }}>
                ما بقي من آثارٍ ماديّةٍ يمكن مسكُها: رقوقٌ مؤرَّخةٌ كربونيًّا ونقوشٌ محفورة.
              </p>
              {claim.fields.wathaiqi && <Md className="body" text={claim.fields.wathaiqi.raw} />}
              {claim.witnessRefs.length > 0 && (
                <div className="wcards" style={{ marginTop: 10 }}>
                  {claim.witnessRefs.map((w) => {
                    const wit = data.documentary.witnesses.find((x) => x.id === w);
                    if (!wit) return null;
                    return (
                      <div className="wcard" key={w}>
                        <div className="h">
                          <span className="id">{wit.id}</span>
                          <b>{wit.title}</b>
                        </div>
                        <div className="x">{inlineMd(wit.raw, `${w}-`)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="note" style={{ marginTop: 8 }}>{inlineMd(data.documentary.generalLimit, "gl-")}</p>
            </div>
          )}

          {/* ٤ — الحدود وما يغيّر الدرجة: ظاهران في الذيل لا هامشيّان */}
          <div className="block">
            {claim.fields.hudud && (
              <div className="wcard" style={{ marginBottom: 10 }}>
                <div className="h"><b>حدودُ الحكم</b></div>
                <Md className="x" text={claim.fields.hudud.raw} />
              </div>
            )}
            <div className="wcard">
              <div className="h"><b>{claim.fields.yughayyir.label}</b></div>
              <Md className="x" text={claim.fields.yughayyir.raw} />
            </div>
            {claim.qaydRefs.length > 0 && (
              <p className="note" style={{ marginTop: 10, lineHeight: 1.9 }}>
                قيودٌ تُقرأ مع بيّنات هذه الدعوى:{" "}
                {claim.qaydRefs.map((q, i) => {
                  const qd = data.qoyud.find((x) => x.id === q);
                  return (
                    <span key={q}>
                      {i > 0 && " · "}
                      <b>{q}</b> {qd ? inlineMd(qd.raw, `${q}-`) : null}
                    </span>
                  );
                })}
              </p>
            )}
          </div>

          <nav className="cltabs" style={{ marginTop: 26 }}>
            {data.claims.map((c) => (
              <Link key={c.id} to={c.route} style={{ textDecoration: "none" }}>
                <span className="gchip" style={{ opacity: c.id === claim.id ? 1 : 0.6 }}>{c.id}</span>
              </Link>
            ))}
          </nav>

          <TarikhFooter data={data} />
        </>
      )}
    </div>
  );
}

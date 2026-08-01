/**
 * «ميزانُ الأقوال» — فهرسُ البطاقات، صدرُ القسم. المسار: /fahis.
 * (الاسمُ الداخليُّ للقسم «فاحص» — كما بقي «نبراس» اسمَ «اسأل مشكاة» الداخليّ.)
 *
 * الفهرسُ جدولُ محتوياتٍ لا عرضُ حكم: شارةُ الحالة الملوّنةُ تظهر فيه بإقرار
 * المالك (خطّة إعادة البناء §٣، 2026-08-01) — وأمّا داخلُ البطاقة فالشواهدُ
 * قبل النتيجة دائمًا على أصل الميثاق §د-٢.
 *
 * البياناتُ من `public/fahis-cards.json` — يكتبها fahis-lint من المصدر الحاكم
 * `js/data/fahis/cards.json`، فلا تصل بطاقةٌ لم تمرّ على فاحص اللسان.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FahisTabs from "../components/FahisTabs";
import { FAHIS_CSS } from "../lib/fahisTheme";
import {
  type FahisCardData, type FahisKind, type FahisVerdict,
  KIND_LABEL, VERDICT_META, loadFahisCards,
} from "../lib/fahisCards";
import { normalizeAr } from "../lib/arabicSearch";
import { getUILang, num, useUILang } from "../i18n";

const VERDICT_ORDER: FahisVerdict[] = ["tastaqim", "taqyid", "la-tastaqim", "lam-yatabayyan", "mawquf", "kharij-babina"];

export default function Fahis() {
  useUILang();
  const ar = getUILang() === "ar";
  const [cards, setCards] = useState<FahisCardData[] | null>(null);
  const [q, setQ] = useState("");
  const [vf, setVf] = useState<FahisVerdict | null>(null);
  const [kf, setKf] = useState<FahisKind | null>(null);

  useEffect(() => { loadFahisCards().then(setCards).catch(() => setCards([])); }, []);

  const byVerdict = useMemo(() => {
    const m = new Map<FahisVerdict, number>();
    for (const c of cards ?? []) m.set(c.verdict, (m.get(c.verdict) ?? 0) + 1);
    return m;
  }, [cards]);

  const kinds = useMemo(() => {
    const m = new Map<FahisKind, number>();
    for (const c of cards ?? []) for (const k of c.kinds) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [cards]);

  const shown = useMemo(() => {
    if (!cards) return null;
    const needle = normalizeAr(q.trim());
    return cards.filter((c) => {
      if (vf && c.verdict !== vf) return false;
      if (kf && !c.kinds.includes(kf)) return false;
      if (!needle) return true;
      const hay = normalizeAr([c.title, c.claim, c.plain, c.verdictDetail, ...c.lemmas, ...c.topics].join(" "));
      return hay.includes(needle);
    });
  }, [cards, q, vf, kf]);

  return (
    <div className="page page-narrow fahis" dir="rtl" lang="ar">
      <style>{FAHIS_CSS}</style>

      {!ar && (
        <p className="muted" style={{ marginBottom: 18, fontSize: ".9rem" }} dir="ltr" lang="en">
          Mīzān al-Aqwāl (“the scale of claims”) examines what people say <i>about</i> the Qur’an
          and its language — never the Qur’an itself — against the muṣḥaf and the reference
          library, evidence before verdict. The cards and their sources are in Arabic.
        </p>
      )}

      <FahisTabs />

      <h1>ميزانُ الأقوال</h1>
      <p className="lede">
        يُقال عن القرآن ولغته كلامٌ كثير — في العدد والمعنى والإعراب والترادف —
        فتُوزن هنا <b>أقوالُ القائلين</b> بمقياسٍ معلن: يُعرض <b>الدليلُ قبل
        النتيجة</b> والقارئُ يرى بنفسه. لا نتبنّى مذهبًا ولا نقصد أحدًا:
        نُقرّ ما تُقرّه الشواهد، ونقف عند ما لا تُثبته، ونصرّح بما لم يتبيّن.
      </p>

      {cards === null && <p className="lim">…</p>}

      {cards && (
        <>
          <div className="fstats">
            <span className="tot">{num(cards.length)} بطاقةً مفحوصة</span>
            {VERDICT_ORDER.filter((v) => byVerdict.has(v)).map((v) => (
              <span key={v} className={`v-${v}`}>
                <button data-on={vf === v ? 1 : 0} onClick={() => setVf(vf === v ? null : v)}>
                  <span className="d" />
                  {VERDICT_META[v].label} {num(byVerdict.get(v)!)}
                </button>
              </span>
            ))}
          </div>

          <div className="ffind">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} dir="rtl" lang="ar"
              placeholder="ابحث عن لفظٍ أو قول — مثل: الترادف، النسخ، سبع سماوات"
              aria-label="بحث في البطاقات"
            />
          </div>
          <div className="fkinds">
            {[...kinds.entries()].map(([k, n]) => (
              <button key={k} data-on={kf === k ? 1 : 0} onClick={() => setKf(kf === k ? null : k)}>
                {KIND_LABEL[k]} {num(n)}
              </button>
            ))}
          </div>

          <div className="frows">
            {shown!.map((c) => (
              <Link className="frow" key={c.id} to={`/fahis/c/${c.id}`}>
                <span className="t">{c.title}</span>
                <span className="k">{c.kinds.map((k) => KIND_LABEL[k]).join(" · ")}</span>
                <span className={`v-${c.verdict}`}><span className="vchip">{VERDICT_META[c.verdict].label}</span></span>
              </Link>
            ))}
            {shown!.length === 0 && (
              <p className="fempty">لا بطاقةَ توافق هذا البحث — جرّب لفظًا أعمّ، أو أزل المصافي.</p>
            )}
          </div>

          <p className="lim" style={{ marginTop: 14 }}>
            القولُ في كلِّ بطاقةٍ مجرَّدٌ من قائله، والشواهدُ قبل النتيجة، ومعها
            ما لا يلزم منها — ولكلِّ بطاقةٍ رابطٌ ثابتٌ يُستشهد به. والبابُ مفتوحٌ
            لما بعدَ هذه: ما لا يثبت لا يُعرض، وما يُعرض يُعاد حسابُه فيُطابق.
          </p>

          <div className="fcta">
            <div className="tx">
              <b>زِنْ قولًا بنفسك</b>
              <p>اكتب ما سمعتَه أو ما تظنّه، فيُجيبك حسابٌ على المصحف لا رأي — بلا ذكاءٍ اصطناعيٍّ في القوالب المحسوبة.</p>
            </div>
            <Link to="/fahis/tool">زِنْ قولًا</Link>
          </div>

          <p className="lim" style={{ marginTop: 16 }}>
            والمقياسُ الذي بُني عليه كلُّ حكمٍ معلَنٌ في{" "}
            <Link to="/fahis/method">المنهج والمراجع</Link> — الأصولُ والشروط،
            وصيغُ الحكم الستُّ، والمراجعُ برتبها، والمصفاةُ التي تخرج منها البطاقات.
          </p>
        </>
      )}
    </div>
  );
}

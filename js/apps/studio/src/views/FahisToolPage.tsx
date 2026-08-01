/**
 * «افحص فكرة» — بابُ الأداة في ميزان الأقوال. المسار: /fahis/tool.
 *
 * يستقبل التعبئةَ المسبقة من أزرار «أعِد الفحصَ بنفسك» في البطاقات:
 *   ?q=<قالب>&w=<لفظ أو موضع>&n=<العدد المدَّعى إن وُجد>
 * فيفتح القالبَ مملوءًا ويُشغّل الحساب — «يُعاد فيُطابق» فعلًا لا شعارًا.
 */
import { useSearchParams } from "react-router-dom";
import FahisTabs from "../components/FahisTabs";
import FahisTool, { type FahisToolInitial } from "../components/FahisTool";
import { FAHIS_CSS } from "../lib/fahisTheme";
import { getUILang, useUILang } from "../i18n";

const QALABS = new Set(["adad", "kulliya", "iraab", "dalala", "open"]);

export default function FahisToolPage() {
  useUILang();
  const ar = getUILang() === "ar";
  const [params] = useSearchParams();

  let initial: FahisToolInitial | undefined;
  const q = params.get("q");
  if (q && QALABS.has(q)) {
    const w = params.get("w") ?? undefined;
    initial = {
      qalab: q as FahisToolInitial["qalab"],
      word: q === "iraab" ? undefined : w,
      loc: q === "iraab" ? w : undefined,
      claimed: params.get("n") ?? undefined,
      autorun: true,
    };
  }

  return (
    <div className="page page-narrow fahis" dir="rtl" lang="ar">
      <style>{FAHIS_CSS}</style>

      {!ar && (
        <p className="muted" style={{ marginBottom: 18, fontSize: ".9rem" }} dir="ltr" lang="en">
          Write a claim about the Qur’an’s wording and get a computed answer — counts, positions,
          and a chance-rate — reproducible on every run. Arabic input.
        </p>
      )}

      <FahisTabs />

      <h1>زِنْ قولًا</h1>
      <p className="lede">
        اكتب القولَ الذي سمعتَه أو الفكرةَ التي تظنّها، فيُجيبك <b>حسابٌ على
        المصحف</b> لا رأي — بلا ذكاءٍ اصطناعيٍّ في القوالب المحسوبة، وكلُّ رقمٍ
        هنا يُعاد فيُطابق.
      </p>

      <section style={{ marginTop: 22 }}>
        <FahisTool key={params.toString()} initial={initial} />
        <p className="lim" style={{ marginTop: 12 }}>
          خمسةُ مداخل: العددُ والكلّيّةُ محسوبان تمامًا، والإعرابُ يضع أهلَ الصنعة
          متجاورين بالأقدميّة، والدلالةُ تعرض المادّةَ كلَّها ثم تسألك ولا تحكم،
          والمسارُ المفتوحُ نثرًا يُصنِّف ثم يُشغِّل الحسابَ عندنا. والباقي —
          الترادفُ والقراءةُ والصرف — يُبنى تباعًا، ولكلٍّ آلتُه ورتبتُه في{" "}
          <a href="#/fahis/method">المنهج والمراجع</a>.
        </p>
      </section>
    </div>
  );
}

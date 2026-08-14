/**
 * **الإسنادُ حيث يُسمع الصوت** — شرطُ رخصةٍ لا تحسينًا.
 *
 * توقيتاتُ الكلمات التي يقوم عليها بابُ التلاوة عندنا **`quran-align` برخصة
 * CC BY 4.0**، وهي توجب إسنادًا ظاهرًا. والتلاوةُ نفسُها **منقولةٌ** لا
 * مصنوعةً عندنا. فيُذكر الاثنان **في موضع السماع**، لا في صفحةِ مصادرَ بعيدة.
 *
 * وثلاثةُ حدودٍ في صياغته:
 *   • **وسمُ «منقول»** كما يُوسَم كلُّ معروضٍ في هذا المشروع.
 *   • **ويُسمّى المصدرُ الذي يُسمع منه الآن بعينه** — فمن نزّل التلاوةَ يسمع
 *     من جهازه، ولا يُقال له إنّه يسمع من الشبكة.
 *   • **ولا يُدّعى أنّ التوقيتات في هذا المستودع** — هي أداةُ الباب، لا مادّةٌ
 *     نعيد نشرها؛ والإسنادُ واجبٌ على كلّ حال.
 */
import { getUILang } from "../i18n";

export const CREDIT = {
  timings: {
    what_ar: "مواضع الكلمات",
    what_en: "Word timings",
    who: "quran-align — Collin Fair",
    license: "CC BY 4.0",
    href: "https://github.com/cpfair/quran-align",
  },
  recitation: {
    what_ar: "التلاوة",
    what_en: "Recitation",
    who_ar: "محمود خليل الحصري",
    who_en: "Mahmoud Khalil al-Ḥuṣarī",
    href: "https://everyayah.com",
  },
};

/** من أين يُسمع الآن — يُقال بصدقٍ ولا يُعمَّم */
export type CreditSource = "downloaded" | "everyayah" | "cdn";

const sourceLine = (src: CreditSource, ar: boolean): string => {
  if (src === "downloaded") return ar ? "من جهازك (منزَّلة)" : "from your device (downloaded)";
  if (src === "everyayah") return ar ? "عبر everyayah.com" : "via everyayah.com";
  return ar ? "عبر شبكة توزيعٍ عامّة" : "via a public delivery network";
};

export default function RecitationCredit({
  source = "cdn",
  className = "",
}: {
  source?: CreditSource;
  className?: string;
}) {
  const ar = getUILang() === "ar";
  const c = CREDIT;
  return (
    <div className={`tlw-credit ${className}`.trim()}>
      <span className="tlw-tag">{ar ? "منقول" : "Sourced"}</span>
      <span className="tlw-credit-lines">
        <span>
          <b>{ar ? c.recitation.what_ar : c.recitation.what_en}:</b>{" "}
          {ar ? c.recitation.who_ar : c.recitation.who_en} — {sourceLine(source, ar)}
        </span>
        <span>
          <b>{ar ? c.timings.what_ar : c.timings.what_en}:</b>{" "}
          <a href={c.timings.href} target="_blank" rel="noreferrer noopener">
            {c.timings.who}
          </a>{" "}
          — {c.timings.license}
        </span>
      </span>
    </div>
  );
}

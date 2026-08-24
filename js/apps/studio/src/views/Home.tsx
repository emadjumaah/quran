/**
 * **الصفحةُ الأولى — بوّابةُ مهمّةٍ لا معرِضُ أقسام** (ف٥ §١).
 *
 * الجملةُ الحاكمة: **مستخدمُ مشكاة طالبُ علمٍ جاء بآيةٍ أو سؤال، ومخرجُه فهمٌ
 * موثَّقٌ بمصادره في أقلّ نقرات.** وبلاغُ المالك الذي فتح هذا الباب: «لا أعرف ما
 * الذي أصنعه بكلّ هذه الأقسام» — **فالعلاجُ مدخلٌ وترتيبٌ، لا إعادةُ بناء**:
 * يبقى كلُّ بابٍ حيث هو، ويتغيّر أوّلُ ما يقع عليه البصر.
 *
 * وهيكلُها أربعةٌ لا خامسَ لها:
 *   ١ — **حقلٌ واحدٌ جامع** «ابحثْ أو اسألْ»: اللفظُ والآيةُ إلى البحث القائم،
 *       والسؤالُ إلى «اسأل مشكاة». **حقلٌ واحدٌ لا حقلان** — وتحرسه بوّابةُ الوجه.
 *   ٢ — **المصحفُ** بموضعه المحفوظ، فالقراءةُ بابُ مشكاة الثاني.
 *   ٣ — **ثلاثُ بطاقاتِ مهمّةٍ بأفعالها** لا بأسماء الأقسام: افهمْ آيةً · تتبّعْ
 *       لفظًا · حقّقْ مسألةً. وكلُّ بطاقةٍ تصف فعلَ الطالب ثمّ تفتح أبوابَه.
 *   ٤ — **وسائرُ الأبواب تبقى كما هي خلف «المزيد»** — لا يُحذف بابٌ ولا يُعاد
 *       بناؤه، وشاهدُ ذلك عدٌّ حيٌّ في بوّابة الوجه.
 *
 * **ولا شيءَ ههنا يعترض القارئ**: سطرُ الاستقبال يُطوى بنقرةٍ ولا يبتلع حدثًا
 * (وكان نافذةً تعلو المصحف فرُفعت — ف٥ §١).
 */
import { Link } from "react-router-dom";
import { parseMawdi, readMawdi } from "@mishkat/quran-core/lib/mawadi";
import InlineOmni from "../components/InlineOmni";
import WelcomeQuestions from "../components/WelcomeQuestions";
import { surahNameUI } from "../db";
import { getUILang, num, useUILang } from "../i18n";

/** بابٌ صغيرٌ تحت البطاقة — اسمُ الباب كما هو في التنقّل، فلا يُخترع اسمان لبابٍ واحد */
interface Door {
  to: string;
  ar: string;
  en: string;
}

interface Task {
  /** الفعلُ الذي جاء له الطالبُ — به تُعرف البطاقةُ في الحرس */
  ar: string;
  en: string;
  lineAr: string;
  lineEn: string;
  to: string;
  goAr: string;
  goEn: string;
  doors: Door[];
}

export default function Home() {
  useUILang();
  const ar = getUILang() === "ar";
  /** موضعُ القراءة المحفوظ — من طبقة المواضع، ولا يُستجوَب عنه قارئ */
  const at = parseMawdi(readMawdi("mushaf"));
  const loc = at ? `${at.surahNo}/${at.ayahNo}` : "1/1";
  const where = at ? `${surahNameUI(at.surahNo)} ${ar ? num(at.ayahNo) : at.ayahNo}` : null;

  /** ثلاثٌ لا أكثر — **بأفعالٍ لا بأسماء أقسام** (ف٥ §١) */
  const TASKS: Task[] = [
    {
      ar: "افهمْ آيةً",
      en: "Understand a verse",
      lineAr: "بطاقتُها الجامعة: صلاتُها المفحوصةُ وشبيهُها وجذورُها — وتفسيرُها وإعرابُها ومراجعُها بتعليمها في المصحف.",
      lineEn: "Its hub card — verified links, its twin, its roots — with tafsīr, grammar and references a tap away in the mushaf.",
      to: `/aya/${loc}`,
      goAr: where ? `ابدأْ من موضعك: ${where}` : "ابدأْ من الفاتحة ١",
      goEn: where ? `Start where you left off: ${where}` : "Start at al-Fātiḥa 1",
      doors: [
        { to: "/tafasir", ar: "التفاسيرُ والمصادر", en: "Tafsīr & sources" },
        { to: `/read/${loc}`, ar: "أدواتُها في المصحف", en: "Its tools in the mushaf" },
      ],
    },
    {
      ar: "تتبّعْ لفظًا",
      en: "Trace a word",
      lineAr: "مواضعُه كلُّها بعدٍّ دقيق، وما التبس به من نظائرَ وفروق — وهو ما تنفرد به مشكاة.",
      lineEn: "Every occurrence with an exact count, and the near-twins and distinctions around it.",
      to: "/roots",
      goAr: "ابدأْ من الجذر وعدِّه الدقيق",
      goEn: "Start from the root and its exact count",
      doors: [
        { to: "/furuq", ar: "فروقُ التنزيل", en: "Furūq — aligned twins" },
        { to: "/lisan", ar: "الفروقُ اللغويّة", en: "Lexical distinctions" },
        { to: "/wujuh", ar: "الوجوهُ والنظائر", en: "Polysemy" },
      ],
    },
    {
      ar: "حقّقْ مسألةً",
      en: "Verify a question",
      lineAr: "قولٌ يُوزن بأدلّته ودرجتُه معلَنةٌ يُقال معها ما الذي يغيّرها — قراءةٌ من المصادر لا فتوى.",
      lineEn: "A claim weighed against its evidence, with a declared grade and what would change it — reading the sources, not issuing a verdict.",
      to: "/fahis",
      goAr: "ابدأْ من ميزان الأقوال",
      goEn: "Start from Mīzān al-Aqwāl",
      doors: [
        { to: "/bayan", ar: "البيانُ — تدبّرُ لغة القرآن", en: "Bayān — the diction" },
        { to: "/tarikh", ar: "ملفُّ جمع القرآن", en: "The collection of the Qur'an" },
      ],
    },
  ];

  return (
    <main className="page home" data-home="root">
      <div className="home-wrap">
        {/* ═══ ١ — الصدر: حقلٌ واحدٌ جامع ═══ */}
        <section className="home-ask" data-home="ask">
          <h1 className="home-h1">{ar ? "ابدأْ بآيةٍ أو لفظٍ أو سؤال" : "Start with a verse, a word, or a question"}</h1>
          <InlineOmni
            ask
            placeholder={ar ? "ابحثْ أو اسألْ…" : "Search or ask…"}
          />
        </section>

        {/* ═══ ٢ — المصحف: القراءةُ بابُ مشكاة الثاني ═══ */}
        <Link className="home-mushaf" to={`/read/${loc}`} data-home="mushaf">
          <span className="home-mushaf-k">{where ? (ar ? "تابعِ القراءة" : "Continue reading") : (ar ? "افتحِ المصحف" : "Open the mushaf")}</span>
          <span className="home-mushaf-where quran">{where ?? (ar ? "الفاتحة ١" : "al-Fātiḥa 1")}</span>
          <span className="home-mushaf-go" aria-hidden>{ar ? "←" : "→"}</span>
        </Link>

        {/* ═══ ٣ — ثلاثُ بطاقاتِ مهمّةٍ بأفعالها ═══ */}
        <div className="home-tasks">
          {TASKS.map((k) => (
            <section className="home-task" key={k.ar} data-home="task">
              <Link className="home-task-go" to={k.to}>
                <span className="home-task-title" data-home="task-verb">{ar ? k.ar : k.en}</span>
                <span className="home-task-line">{ar ? k.lineAr : k.lineEn}</span>
                <span className="home-task-cta">{ar ? k.goAr : k.goEn} {ar ? "←" : "→"}</span>
              </Link>
              <div className="home-doors">
                {k.doors.map((d) => (
                  <Link className="home-door" key={d.to} to={d.to}>{ar ? d.ar : d.en}</Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ═══ سطرُ الاستقبال — يُطوى بنقرةٍ ولا يعلو المصحف ═══ */}
        <WelcomeQuestions />

        {/* ═══ ٤ — ولا بابَ ضاع ═══ */}
        <p className="home-more">
          {ar
            ? "وسائرُ الأبواب — المواضيعُ والكلّيّاتُ وخريطةُ المصحف والإحصاءاتُ والتوثيقُ وغيرُها — في «المزيد» على حاله، لم يُحذف منها بابٌ."
            : "Everything else — topics, the gathering verses, the mushaf map, statistics, documentation — stays where it was, under «More». Nothing was removed."}
        </p>
      </div>
    </main>
  );
}

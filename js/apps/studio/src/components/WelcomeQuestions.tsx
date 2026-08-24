/**
 * استقبالُ الزيارة الأولى — الرؤية 2026-07-29 (البند ٢): الزائرُ لا يبحث عن
 * «أداة»، الزائرُ عنده «سؤال». فبدل أن نشرح ما مشكاة، نعرض أربعةَ أسئلةٍ
 * حيّةٍ لا يجيب عنها غيرُنا، وكلُّ سؤالٍ ينقر فيفتح جوابَه المحسوبَ مباشرةً:
 *
 *   · فرقُ ﴿خشيةَ إملاق﴾ و﴿من إملاق﴾  → الآيةُ معلَّمةً ولوحةُ شبيهها مفتوحة (?know=twin)
 *   · صلاتُ آية الكرسيّ المفحوصة       → لوحةُ صلاتها مفتوحة (?know=links)
 *   · عدُّ «شهر» مفردةً وجمعًا          → صفحةُ الجذر بعدِّه الدقيق
 *   · افتراقُ الخوف عن الخشية          → بطاقةُ البيان المحرَّرة
 *
 * ═══ **وكانت نافذةً تعلو المصحفَ فصارت سطرًا في الصفحة الأولى** (ف٥ §١) ═══
 * **قرارُ الإدارة المحسوم بتجربتَيها**: `wq-overlay` كانت لوحًا `fixed` يملأ
 * الشاشة فوق أوّل ما يقع عليه البصر — **ويبتلع الحدث**: عجلةُ الحاسوب لا تعمل
 * تحته، ونقرةُ القارئ تقع عليه لا على المصحف. وهي مع ذلك مخالفةُ ميثاق الوجه
 * §١٣ («لا يُطمس نصُّ القرآن ولا يُغطّى بلوحٍ منبثقٍ لأجل أداة»).
 *
 * **فرُفعت من فوق المصحف نهائيًّا**، وحلّ محلَّها **سطرٌ خفيفٌ في الصفحة الأولى**:
 * لا `fixed` ولا أرضيّةَ تحجب، **يُطوى بنقرةٍ فلا يعود** (علَمٌ في `localStorage`)،
 * ويجري في مجرى الصفحة فلا يعترض تمريرًا ولا نقرة. **والأسئلةُ الأربعةُ بحالها**
 * — الرفعُ رفعُ لوحٍ لا إلغاءُ باب.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { getUILang } from "../i18n";

/** علَمُ السطر — غيرُ علَم النافذة الزائلة، فالسطرُ جديدٌ ولم يُطوَ من قبل */
const KEY = "mishkat:home-questions-v1";

const QUESTIONS_AR: { q: string; to: string }[] = [
  { q: "لماذا قال هنا ﴿خَشْيَةَ إِمْلَاقٍ﴾ وهناك ﴿مِنْ إِمْلَاقٍ﴾؟", to: "/read/17/31?know=twin" },
  { q: "ما صلاتُ آية الكرسيّ التي فُحصت واحدةً واحدة؟", to: "/read/2/255?know=links" },
  { q: "كم مرةً وردت «شهر» مفردةً — لا «أشهر» ولا «شهور»؟", to: "/roots/شهر" },
  { q: "أين يفترق الخوفُ عن الخشية في التنزيل؟", to: "/bayan/khawf-khashya" },
];
/** الزائرُ الإنجليزيّ يُستقبل بما بُني له: الترجماتُ والجسرُ إلى العربية */
const QUESTIONS_EN: { q: string; to: string }[] = [
  { q: "Read with six famous translations — switched in place, instantly", to: "/read/2/255" },
  { q: "Two nearly identical verses differ by one word — see it highlighted", to: "/read/17/31?know=twin" },
  { q: "Tap and hold any word: its sound, meaning, and Arabic root", to: "/read/1" },
  { q: "Ask about the Quran in English — answers cited from the text itself", to: "/assistant" },
];

export default function WelcomeQuestions() {
  const ar = getUILang() === "ar";
  const [gone, setGone] = useState(() => localStorage.getItem(KEY) === "1");
  if (gone) return null;
  const QUESTIONS = ar ? QUESTIONS_AR : QUESTIONS_EN;
  const fold = () => {
    localStorage.setItem(KEY, "1");
    setGone(true);
  };
  return (
    <div className="home-hint" data-home="hint">
      <div className="home-hint-h">
        {ar ? "أسئلةٌ تجيبك عنها مشكاةُ بمصادرها" : "Questions Mishkāt answers — with its sources"}
      </div>
      {/* صفٌّ واحدٌ يُمرَّر عرضًا — لا لوحَ يعلو شيئًا */}
      <div className="home-hint-row">
        {QUESTIONS.map((x) => (
          <Link key={x.to} to={x.to} className="home-hint-q" onClick={fold}>
            {x.q}
          </Link>
        ))}
      </div>
      <button className="home-hint-x" onClick={fold} aria-label={ar ? "طيُّ السطر" : "fold"}>
        {ar ? "طَيّ" : "Hide"}
      </button>
    </div>
  );
}

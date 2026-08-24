/**
 * **بطاقةُ العبور** — ما بقي في مشكاة من بابِ «التتبّع» بعد أن انتقل.
 *
 * التتبّعُ صار إلى **تطبيق التلاوة** (خارطةُ المخرج §١)، **ولا يُكسر رابطٌ
 * منشور**: من جاء إلى `/tatabbu` — من محفوظاته أو من رابطٍ قديم — وجد بطاقةً
 * تقول له أين صار البابُ وتفتحه له عند موضعه، لا صفحةً مفقودة.
 *
 * **وهي سطحُ عبورٍ لا سطحُ تلاوة**: صفحةٌ عاديّةٌ في مشكاة بهيكل التطبيق كلِّه —
 * رأسٌ وتبويبٌ ودُرج — ولا يُطوى لها شيء؛ فليس فيها تلاوةٌ تُشغل عن قشرة.
 *
 * **ولا لغةَ أدواتٍ فيها** (بوّابةُ خ٧): لا اسمَ نطاقٍ يُقرأ نصًّا في المتن، ولا
 * ذِكرَ بناءٍ ولا مسارٍ داخليّ — وإنّما خبرٌ للقارئ وبابٌ يفتحه.
 */
import { Link } from "react-router-dom";
import { parseMawdi, readMawdi } from "@mishkat/quran-core/lib/mawadi";
import { TILAWA_BASE, tilawaAyah } from "../bridge";
import { getUILang, num, useUILang } from "../i18n";
import { surahNameUI } from "../db";

export default function Ubur() {
  useUILang();
  const ar = getUILang() === "ar";
  /** موضعُ القراءة المحفوظ — يُحمَل معه إن وُجد، ولا يُستجوَب عنه قارئ */
  const at = parseMawdi(readMawdi("mushaf"));
  const href = at ? tilawaAyah(at.surahNo, at.ayahNo) : TILAWA_BASE;
  const where = at ? `${surahNameUI(at.surahNo)} ${ar ? num(at.ayahNo) : at.ayahNo}` : null;

  return (
    <main className="page ubur" data-ubur="root">
      <div className="ubur-card">
        <h1 className="ubur-h1">{ar ? "التتبّعُ صار في تطبيق التلاوة" : "Follow-along has moved to the Tilāwa app"}</h1>
        <p className="ubur-lede">
          {ar
            ? "كان ههنا بابٌ يتلو فيه القارئُ فيجري المؤشّرُ مع صوته. وقد صار إلى تطبيقٍ أوسعَ له: مصحفٌ يُقرأ ويُستمع إليه، والتتبّعُ بأحواله، وتثبيتُ المتشابهات."
            : "This was where you recited and the cursor followed your voice. It now lives in an app built for it: a mushaf to read and listen to, follow-along in all its modes, and drilling of similar passages."}
        </p>
        <p className="ubur-lede">
          {ar
            ? "وتبقى مشكاةُ على ما هي عليه: مرجعٌ للبحث والتنقيب في القرآن — لا يزاحمه شيء."
            : "Mishkāt remains what it is: a reference for research and study of the Qur'an — undisturbed."}
        </p>
        <a className="ubur-go" data-ubur="go" href={href} target="_blank" rel="noopener">
          {ar ? "افتحْ تطبيق التلاوة" : "Open the Tilāwa app"} ←
        </a>
        {where && (
          <p className="ubur-where" data-ubur="where">
            {ar ? "ويُفتح على موضعك: " : "It opens at your place: "}
            <b className="quran">{where}</b>
          </p>
        )}
        <Link className="ubur-back" to="/read">
          {ar ? "عودةٌ إلى المصحف" : "Back to the mushaf"} ←
        </Link>
      </div>
    </main>
  );
}

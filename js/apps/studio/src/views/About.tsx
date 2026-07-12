/**
 * عن المشروع — the research front door: what مشكاة is, the data covenant it holds
 * itself to, how each layer is computed, exactly how AI is (and isn't) used, the
 * sources, and a one-click download of the whole computed dataset as Excel.
 * Route: /about.
 */
import { getUILang, num, useUILang } from "../i18n";

export default function About() {
  useUILang();
  const ar = getUILang() === "ar";
  const XLSX_URL = `${import.meta.env.BASE_URL}mishkat-dataset.xlsx`;

  const USE = ar
    ? ["نصّ القرآن الكريم (مصحف المدينة، رسم عثمان طه)", "ترجمات ومعاني الكلمات", "«المفردات» للراغب الأصفهاني و«مقاييس اللغة» لابن فارس", "الوسم الصرفيّ لمُدوّنة القرآن (QAC)", "إعرابٌ منشور محكَّم («المجتبى» — الخراط)", "الطباعة والرسم والفواصل"]
    : ["The Qur'anic text (Madina muṣḥaf)", "Word translations & glosses", "al-Rāghib's Mufradāt + Ibn Fāris's Maqāyīs", "The Quranic Arabic Corpus morphology", "One published, reviewed iʿrāb (al-Kharrāṭ)", "Typography, rasm & verse-endings"];
  const AVOID = ar
    ? ["تفسير", "حديث", "أسباب نزول", "قراءات", "ناسخ ومنسوخ", "أيّ رأيٍ أو ترجيحٍ من عندنا"]
    : ["Tafsīr", "Ḥadīth", "Occasions of revelation", "Variant readings (qirāʾāt)", "Abrogation (naskh)", "Any opinion or ruling of our own"];

  const METHODS = ar
    ? [
        ["المحكمات والجوامع", "نلتقط الجُمل المُحكَمة من القرآن ونربطها بجوامعها (أصولها) عبر شبكةٍ من التوارد، فيظهر هرمُ المعاني من الكبرى إلى التفصيل."],
        ["فروق التنزيل", "نوازن آليًّا بين الآيات المتشابهة لفظًا ونُبرز مواضع الاختلاف حرفًا حرفًا — إبدالًا وتقديمًا وزيادة."],
        ["الفروق اللغوية والمترادفات", "نُضمِّن تعريفَ كلِّ جذرٍ من المعجمين بمتّجهٍ دلاليّ، فتنتظم أقربُ الكلمات معنًى (مترادفات) وتتكوّن الحقول الدلالية — والقارئ يوازن الفرق بنفسه."],
        ["مثلها (الآيات القريبة)", "متّجهاتُ معنى الآيات تكشف أقربَها إليها دلالةً عبر المصحف كلِّه — ترتيبٌ لا تأويل."],
        ["الصرف والنحو بالأرقام", "إحصاءٌ كاملٌ لأقسام الكلمة والأوزان والأزمنة والإعراب من ١٣٠٬٠٣٠ مقطعًا صرفيًّا."],
        ["مساعد التدبّر", "توليدٌ مقيَّدٌ بأدواتنا وحدها (إعراب · جذور · جيران) لا يتعدّاها ولا يدّعي أنّه تفسير."],
      ]
    : [
        ["Muḥkamāt & principles", "Decisive statements linked to their governing principles through a co-occurrence network — a pyramid of meaning."],
        ["Furūq al-tanzīl", "Near-identical verses aligned automatically, differences surfaced token by token."],
        ["Lexical distinctions & synonyms", "Each root's lexicon definition embedded as a meaning-vector; nearest words = synonyms, clusters = fields."],
        ["Similar verses", "Verse meaning-vectors reveal the closest āyāt across the whole muṣḥaf — ranking, not interpretation."],
        ["Morphology by the numbers", "A full census of word classes, forms, tense and case from 130,030 segments."],
        ["Reflection assistant", "Generation grounded strictly in our own tools — it never reaches outside them."],
      ];

  return (
    <div className="page">
      <div className="fr-wrap">
        <header className="jw-header">
          <h1 className="jw-title">{ar ? "عن المشروع" : "About the project"}</h1>
          <p className="jw-lead">
            {ar
              ? "«مشكاة» تجربةٌ في خدمة القرآن حاسوبيًّا: نبني فوق النصّ شبكةً من المعاني والعلاقات محسوبةً بالكامل، ونعرضها بسطًا يسيرًا. مبدؤنا واحد: نحسب ونعرض، والقارئ يحكم."
              : "Mishkāt is an experiment in serving the Qur'an computationally: a fully computed graph of meanings and relations built over the text, presented simply. One principle: we compute and present; the reader judges."}
          </p>
        </header>

        {/* the data covenant */}
        <div className="card ab-covenant-card">
          <h2 className="ab-h2">{ar ? "عهد البيانات" : "The data covenant"}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {ar
              ? "ما يميّز المشروع هو ما يمتنع عنه. كلُّ ما نعرضه محسوبٌ من مصادرَ محدودةٍ معلومة، لا نتعدّاها:"
              : "What sets the project apart is what it abstains from. Everything is computed from a fixed, known set of sources:"}
          </p>
          <div className="ab-covenant">
            <div className="ab-col ab-use">
              <div className="ab-col-h">{ar ? "نعتمد" : "We use"}</div>
              <ul>{USE.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div className="ab-col ab-avoid">
              <div className="ab-col-h">{ar ? "لا نقربه" : "We never touch"}</div>
              <ul>{AVOID.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
        </div>

        {/* how each layer is computed */}
        <h2 className="ab-h2 ab-section-h">{ar ? "كيف نحسب" : "How it's computed"}</h2>
        <div className="ab-methods">
          {METHODS.map(([t, d]) => (
            <div key={t} className="card ab-method">
              <div className="ab-method-t">{t}</div>
              <div className="ab-method-d">{d}</div>
            </div>
          ))}
        </div>

        {/* AI transparency */}
        <div className="card ab-ai">
          <h2 className="ab-h2"><span className="ai-spark" aria-hidden /> {ar ? "أين يقع الذكاء الاصطناعي؟" : "Where AI fits"}</h2>
          <p>
            {ar
              ? "نستعمل نماذج Gemini في موضعين اثنين لا ثالث لهما، وكلاهما شفّاف:"
              : "We use Gemini models in exactly two places, both transparent:"}
          </p>
          <ul className="ab-ai-list">
            <li>
              <b>{ar ? "متّجهات المعنى (embeddings):" : "Meaning-vectors (embeddings):"}</b>{" "}
              {ar
                ? "لترتيب الآيات المتقاربة («مثلها») والكلمات المترادفة («الفروق اللغوية»). الذكاء الاصطناعي هنا يُرتِّب فحسب — لا يضيف معنًى ولا يُنشئ نصًّا."
                : "to rank similar verses and synonym words. The model only ranks — it adds no meaning and writes no text."}
            </li>
            <li>
              <b>{ar ? "مساعد التدبّر (توليد مقيَّد):" : "Reflection assistant (grounded generation):"}</b>{" "}
              {ar
                ? "يُغذَّى بأدواتنا وحدها — إعراب الآية وجذورها ومعانيها وجيرانها — بتوجيهٍ صارمٍ يمنعه من إدخال أيّ علمٍ خارجيّ، ويمنعه من ادّعاء أنّه تفسير. إعانةٌ على التدبّر بأدوات الموقع، لا بديلٌ عن أهل العلم."
                : "fed only our own tools — the verse's iʿrāb, roots, glosses and neighbours — under a strict instruction that forbids any outside knowledge and forbids claiming to be tafsīr."}
            </li>
          </ul>
        </div>

        {/* open data */}
        <div className="card ab-data">
          <h2 className="ab-h2">{ar ? "بياناتٌ مفتوحةٌ قابلةٌ للتحقّق" : "Open, verifiable data"}</h2>
          <p style={{ marginTop: 0 }}>
            {ar
              ? "لأنّ كلَّ شيءٍ محسوب، فكلُّ شيءٍ قابلٌ للفحص. حمِّل مجموعات البيانات المحسوبة كلَّها في ملفِّ Excel واحد: الجذور والمعجمان، والمترادفات، والحقول الدلالية، وفروق التنزيل، والأمثال، والصرف بالأرقام."
              : "Because everything is computed, everything is inspectable. Download all the computed datasets in one Excel file: roots, synonyms, semantic fields, furūq, parables, and the morphology census."}
          </p>
          <a className="ab-dl" href={XLSX_URL} download>
            <span aria-hidden>⬇</span> {ar ? "تنزيل البيانات (Excel · ٧ أوراق)" : "Download dataset (Excel · 7 sheets)"}
          </a>
        </div>

        <p className="muted" style={{ textAlign: "center", margin: "22px 0 8px", fontSize: 12.5, lineHeight: 1.9 }}>
          {ar
            ? "المصادر: نصّ مصحف المدينة وخطّ KFGQPC (مجمع الملك فهد) · «المفردات» للراغب و«مقاييس اللغة» لابن فارس · الوسم الصرفيّ QAC · «المجتبى من مشكل إعراب القرآن» للخراط · نماذج Gemini للمتّجهات والتوليد المقيَّد."
            : "Sources: Madina muṣḥaf text + KFGQPC font (King Fahd Complex) · al-Rāghib's Mufradāt & Ibn Fāris's Maqāyīs · QAC morphology · al-Kharrāṭ's iʿrāb · Gemini models for vectors & grounded generation."}
        </p>
      </div>
    </div>
  );
}

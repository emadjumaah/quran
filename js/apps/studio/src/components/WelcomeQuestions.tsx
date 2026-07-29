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
 * تظهر مرّةً واحدةً (علَمٌ في localStorage)، وتُقفل بأيِّ نقرةٍ فيها أو بـ✕.
 * من رأى جوابًا واحدًا فَهِم المشروعَ — دون أن نشرح شيئًا.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { getUILang } from "../i18n";

const KEY = "mishkat:welcomed-v1";

const QUESTIONS: { q: string; to: string }[] = [
  { q: "لماذا قال هنا ﴿خَشْيَةَ إِمْلَاقٍ﴾ وهناك ﴿مِنْ إِمْلَاقٍ﴾؟", to: "/read/17/31?know=twin" },
  { q: "ما صلاتُ آية الكرسيّ التي فُحصت واحدةً واحدة؟", to: "/read/2/255?know=links" },
  { q: "كم مرةً وردت «شهر» مفردةً — لا «أشهر» ولا «شهور»؟", to: "/roots/شهر" },
  { q: "أين يفترق الخوفُ عن الخشية في التنزيل؟", to: "/bayan/khawf-khashya" },
];

export default function WelcomeQuestions() {
  const [gone, setGone] = useState(() => localStorage.getItem(KEY) === "1" || getUILang() !== "ar");
  if (gone) return null;
  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setGone(true);
  };
  // نافذةٌ منبثقةٌ مرّةً واحدةً عند أول فتح — لا لافتةٌ فوق الفاتحة (أمر المالك)
  return (
    <div className="wq-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }} role="dialog" aria-modal="true" aria-label="أسئلة مشكاة">
      <div className="wq card">
        <button className="wq-x" onClick={dismiss} aria-label="إغلاق">✕</button>
        <div className="wq-head">أسئلةٌ تجيبك عنها مشكاةُ — ولا تجدها في غيرها</div>
        <div className="wq-list">
          {QUESTIONS.map((x) => (
            <Link key={x.to} to={x.to} className="wq-q" onClick={dismiss}>
              {x.q} <span className="wq-go">←</span>
            </Link>
          ))}
        </div>
        <div className="wq-foot muted">كلُّ جوابٍ محسوبٌ من نصِّ المصحف وصرفِه — بسندٍ معلن. هذه النافذةُ لن تعود.</div>
      </div>
    </div>
  );
}

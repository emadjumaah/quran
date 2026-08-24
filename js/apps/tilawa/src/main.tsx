import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LAST_AYAH } from "./quran";
import "./app.css";

/**
 * صفحةُ الانتظار — هيكلُ ف١ الأدنى: يبني ويُعرض، ولا مصحفَ فيه ولا تتبّعَ ولا
 * تثبيت. وعددُ الآي مقيَّدٌ في الوسم لا في العَرْض: به يثبت وصلُ الحزمة
 * المشتركة في الناتج المبنيّ، ولا يُعرض للقارئ خبرٌ لم يُبنَ بعد.
 */
function Wait() {
  return (
    <main className="wait" data-mushaf-ayat={LAST_AYAH}>
      <h1>التلاوة — قيدَ البناء</h1>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Wait />
  </StrictMode>,
);

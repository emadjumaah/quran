/**
 * القراءةُ لغير العربيّ — «وضعُ الفهم» (رؤية 2026-07-29، أمر المالك: الترجمةُ
 * تكبر وتُقرأ، والعربيُّ حاضرٌ فوقها أرفع؛ ومشكاةُ مرجعٌ لا مصحفٌ مترجمٌ فقط).
 *
 * EnVerseLine — سطرُ الترجمة الدائم تحت كل آيةٍ حين تكون الواجهةُ غيرَ عربية:
 * نصٌّ إنجليزيٌّ كبيرٌ مقروء، معه اسمُ الترجمة الفعّالة خافتًا. لا زرَّ يفتح
 * ولا لوحةَ — هو المتن.
 *
 * EnTransBar — شريطُ تقليب الترجمات: اسمُ كلِّ ترجمةٍ زرًّا، والتبديلُ فوريٌّ
 * على الصفحة كلِّها (الملفُّ يُجلب عند أول اختيارٍ ويبقى).
 */
import { useEffect, useState } from "react";
import type { AyahDoc } from "../types";
import { ayahByLocationMap } from "../db";
import { getUILang } from "../i18n";
import { EN_TRANSLATIONS, activeTranslationId, secondTranslationId, secondTranslationOf, setActiveTranslation, setSecondTranslation, translationOf, useEnTranslation } from "../lib/enTranslations";

export function EnTransBar() {
  useEnTranslation();
  const [compare, setCompare] = useState(() => !!secondTranslationId());
  if (getUILang() === "ar") return null;
  const active = activeTranslationId();
  const second = secondTranslationId();
  return (
    <div className="entr-bar" role="tablist" aria-label="translation">
      <span className="entr-lbl">Translation</span>
      {EN_TRANSLATIONS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`entr-pill${active === t.id ? " on" : second === t.id ? " on2" : ""}`}
          onClick={() => {
            // في وضع المقارنة: النقرُ على غير الفعّالة يعيّن الثانية؛ وإلا يبدّل الفعّالة
            if (compare && t.id !== active) setSecondTranslation(second === t.id ? "" : t.id);
            else setActiveTranslation(t.id);
          }}
          title={compare && t.id !== active ? `compare with ${t.label}` : t.label}
        >
          {t.short}
        </button>
      ))}
      <button
        className={`entr-pill entr-cmp${compare ? " on2" : ""}`}
        onClick={() => {
          const next = !compare;
          setCompare(next);
          if (!next) setSecondTranslation("");
          else if (!second) setSecondTranslation(EN_TRANSLATIONS.find((t) => t.id !== active)!.id);
        }}
        title="show two translations side by side — see how translators differ"
      >
        ⇄ Compare
      </button>
    </div>
  );
}

export function EnVerseLine({ ayah }: { ayah: AyahDoc }) {
  useEnTranslation();
  if (getUILang() === "ar") return null;
  const { text, meta } = translationOf(ayah);
  if (!text) return null;
  const sec = secondTranslationOf(ayah);
  if (sec?.text) {
    // المقارنة: الترجمتان متجاورتين موسومتين — يرى القارئُ أين اختلف المترجمون
    return (
      <div className="en-verse-cmp" dir="ltr">
        <p className="en-verse"><span className="en-cmp-tag">{meta.short}</span>{text}</p>
        <p className="en-verse en-verse-2"><span className="en-cmp-tag">{sec.meta.short}</span>{sec.text}</p>
      </div>
    );
  }
  // بلا ذيل اسم المترجم — الشريطُ المثبَّت يحمله (أمر المالك 2026-07-29)
  return <p className="en-verse" dir="ltr">{text}</p>;
}

/** سطرُ ترجمةٍ لآيةٍ مقتبسةٍ داخل اللوحات (مثلها · الشبيه · بطاقة الآية) —
 *  يستقي وثيقتَها من خريطة المواضع، ولا يظهر إلا لغير العربيّ
 *  (رصد المالك 2026-07-29: «all open area is mostly arabic»). */
export function EnQuoteLine({ loc, doc }: { loc?: string; doc?: AyahDoc }) {
  useEnTranslation();
  const [d, setD] = useState<AyahDoc | null>(doc ?? null);
  const en = getUILang() !== "ar";
  useEffect(() => {
    if (doc) { setD(doc); return; }
    if (!en || !loc) return;
    let live = true;
    ayahByLocationMap().then((m) => live && setD(m.get(loc) ?? null));
    return () => { live = false; };
  }, [loc, doc, en]);
  if (!en || !d) return null;
  const { text } = translationOf(d);
  if (!text) return null;
  return <p className="en-quote" dir="ltr">{text}</p>;
}

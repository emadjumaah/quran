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
import type { AyahDoc } from "../types";
import { getUILang } from "../i18n";
import { EN_TRANSLATIONS, activeTranslationId, setActiveTranslation, translationOf, useEnTranslation } from "../lib/enTranslations";

export function EnTransBar() {
  useEnTranslation();
  if (getUILang() === "ar") return null;
  const active = activeTranslationId();
  return (
    <div className="entr-bar" role="tablist" aria-label="translation">
      <span className="entr-lbl">Translation</span>
      {EN_TRANSLATIONS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`entr-pill${active === t.id ? " on" : ""}`}
          onClick={() => setActiveTranslation(t.id)}
          title={t.label}
        >
          {t.short}
        </button>
      ))}
    </div>
  );
}

export function EnVerseLine({ ayah }: { ayah: AyahDoc }) {
  useEnTranslation();
  if (getUILang() === "ar") return null;
  const { text, meta } = translationOf(ayah);
  if (!text) return null;
  return (
    <p className="en-verse" dir="ltr">
      {text}
      <span className="en-verse-src"> — {meta.label}</span>
    </p>
  );
}

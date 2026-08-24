import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * **ورقةٌ سفليّةٌ تُرحَّل إلى `body`** — لا تُركَّب داخلَ الرأس ولا داخلَ سطح
 * القراءة (درسُ ج٩ §١): و`transform` على عنصرٍ يجعله مرجعَ `fixed` لكلّ ما
 * تحته، فتنهار الورقةُ إلى ارتفاع الرأس. **والرأسُ ههنا متحوِّلٌ دائمًا**
 * (ينزلق بالسكرول) فالترحيلُ شرطُ صحّةٍ لا تحسين.
 *
 * **وخلفَها أرضيّةٌ معتمة** (درسُ ج٩ §٢) فلا تختلط عناصرُها بنصّ المصحف؛
 * ولمسُ الأرضيّة يغلقها، وكذلك مفتاحُ الهروب.
 *
 * **وذيلٌ ثابتٌ يُطلب** (م٣ §٢): ما وُضع في `footer` بقي مرئيًّا وإن طال ما
 * فوقه — فبابٌ يقع تحت مئةٍ وأربعَ عشرةَ سورةً بابٌ لا يجده أحد.
 */
export default function Sheet({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  /** ما يبقى في ذيل الورقة لا يجري مع التمرير */
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="tw-backdrop" onClick={onClose} />
      <div className="tw-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="tw-grip" aria-hidden />
        <h2>{title}</h2>
        <div className="tw-sheet-body">{children}</div>
        {footer && <div className="tw-sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

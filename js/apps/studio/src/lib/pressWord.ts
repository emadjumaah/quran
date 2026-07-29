/**
 * نقرةُ الكلمة في المصحف — «القراءةُ أولًا» بقاعدةٍ واحدةٍ للجوال والحاسوب
 * (أمر المالك 2026-07-29: أُلغي النقرُ الطويل — «نقرةٌ أخرى على الكلمة بعد
 * نقرة تعليم الآية، هذا أوضح»):
 *
 *   النقرةُ الأولى في أيِّ مكانٍ من الآية — حتى فوق كلماتها — تسري إلى الآية
 *   فتعلّمها وتُظهر لوحتَها؛ والنقرةُ الثانية على كلمةٍ من الآية المعلَّمة
 *   تفتح بياناتِ الكلمة.
 */

export interface WordPressHandlers<T> {
  onClick: (e: React.MouseEvent, w: T) => void;
}

export function useWordPress<T>(opts: {
  /** هل آيةُ هذه الكلمة معلَّمةٌ الآن؟ (شرطُ فتح الكلمة) */
  isAyahSelected: (w: T) => boolean;
  onOpenWord: (w: T) => void;
}): WordPressHandlers<T> {
  return {
    onClick: (e, w) => {
      if (opts.isAyahSelected(w)) {
        e.stopPropagation();
        opts.onOpenWord(w);
      }
      // وإلا: تسري النقرةُ إلى الآية فتعلّمها (لا نوقفها)
    },
  };
}

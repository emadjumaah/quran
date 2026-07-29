/**
 * تمييزُ نيّةِ القارئ على كلمات المصحف (قرار المالك 2026-07-29):
 *   «القراءةُ أولًا» — النقرُ في أيِّ مكانٍ من الآية، حتى فوق كلماتها، يعلّمها
 *   ويُظهر أدواتِها؛ ولا تُفتح بياناتُ الكلمة إلا بقصدٍ ظاهر:
 *     · الجوال: نقرٌ طويلٌ على الكلمة (٤٥٠مث، يُلغى إن تحرّك الإصبع — فذاك تمرير).
 *     · الحاسوب: نقرةٌ على الكلمة والآيةُ معلَّمةٌ من قبل (الأولى تعلّم، الثانية تفتح).
 *
 * الخطّاف يُرجع مساكاتِ المؤشّر للكلمة الواحدة، ويقول للنداء الأعلى إن كانت
 * النقرةُ قد استُهلكت فتحًا للكلمة (كي لا تُبدَّل حالُ التعليم معها).
 */
import { useRef } from "react";

const LONG_MS = 450;
const MOVE_TOLERANCE = 12; // بكسل — فوقه نعدّه تمريرًا لا قصدًا

export interface WordPressHandlers<T> {
  onPointerDown: (e: React.PointerEvent, w: T) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  /** نداءُ النقرة العاديّة — يفتح الكلمةَ على الحاسوب إن كانت الآيةُ معلَّمة */
  onClick: (e: React.MouseEvent, w: T) => void;
}

export function useWordPress<T>(opts: {
  /** هل آيةُ هذه الكلمة معلَّمةٌ الآن؟ (شرطُ الفتح بالنقرة على الحاسوب) */
  isAyahSelected: (w: T) => boolean;
  onOpenWord: (w: T) => void;
}): WordPressHandlers<T> {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const firedLong = useRef(false);
  const lastType = useRef<string>("mouse");

  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  return {
    onPointerDown: (e, w) => {
      firedLong.current = false;
      lastType.current = e.pointerType || "mouse";
      if (e.pointerType !== "touch") return; // النقرُ الطويل للّمس وحدَه
      start.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        firedLong.current = true;
        opts.onOpenWord(w);
      }, LONG_MS);
    },
    onPointerMove: (e) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > MOVE_TOLERANCE || Math.abs(e.clientY - start.current.y) > MOVE_TOLERANCE) {
        clear(); // تحرّك الإصبع: تمريرٌ لا قصد
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClick: (e, w) => {
      if (firedLong.current) {
        // النقرةُ التي تعقُب الطويلَ لا تُعلّم ولا تفتح — استُهلكت
        firedLong.current = false;
        e.stopPropagation();
        return;
      }
      // اللمسُ القصير يسري إلى الآية فيعلّمها؛ والفأرةُ على آيةٍ معلَّمةٍ تفتح الكلمة
      if (lastType.current === "touch") return;
      if (opts.isAyahSelected(w)) {
        e.stopPropagation();
        opts.onOpenWord(w);
      }
    },
  };
}

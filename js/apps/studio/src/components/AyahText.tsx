import { num } from "../i18n";
import { useSettings } from "../settings";
import type { WordDoc } from "../types";
import { TAJWID, tajwidWords } from "../tajwid";
import type { WordPressHandlers } from "../lib/pressWord";

/** One ayah rendered word-by-word. «القراءةُ أولًا» (قرار المالك 2026-07-29):
 *  النقرُ فوق الكلمة يسري إلى الآية فيعلّمها؛ وبياناتُ الكلمة بقصدٍ ظاهرٍ
 *  وحدَه — نقرٌ طويلٌ على الجوال، أو نقرةٌ بعد تعليم الآية على الحاسوب
 *  (المساكاتُ من useWordPress تُمرَّر عبر `press`). Honours the script setting
 *  (Uthmani ⇄ imlaa'i); with tajwīd on, each word is colour-coded in place. */
export default function AyahText({
  words,
  ayahNo,
  selected,
  press,
}: {
  words: WordDoc[];
  ayahNo?: number;
  selected?: string | null;
  press?: WordPressHandlers<WordDoc>;
}) {
  const { script, tajwid } = useSettings();
  // tajwīd needs the fully-vowelled Uthmani text; compute per-word colours once
  const colored = tajwid ? tajwidWords(words.map((w) => w.textUthmani)) : null;
  return (
    <div className="quran">
      {words.map((w, wi) => (
        <span key={w.location}>
          <span
            className={`w${selected === w.location ? " sel" : ""}`}
            onPointerDown={press ? (e) => press.onPointerDown(e, w) : undefined}
            onPointerMove={press?.onPointerMove}
            onPointerUp={press?.onPointerUp}
            onPointerCancel={press?.onPointerCancel}
            onClick={press ? (e) => press.onClick(e, w) : undefined}
            onContextMenu={press ? (e) => e.preventDefault() : undefined}
          >
            {colored
              ? colored[wi].map((s, i) =>
                  s.rule ? (
                    <span key={i} className={TAJWID[s.rule].cls} title={TAJWID[s.rule].ar}>{s.text}</span>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )
              : script === "imlaai" ? w.textClean : w.textUthmani}
          </span>{" "}
        </span>
      ))}
      {ayahNo != null && <span className="ayah-marker">﴿{num(ayahNo)}﴾</span>}
    </div>
  );
}

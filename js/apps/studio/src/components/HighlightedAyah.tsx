import { t } from "../i18n";
import type { AyahDoc } from "../types";

/** Does this whitespace token carry an Arabic letter (vs a lone waqf mark)? */
const HAS_LETTER = /[ء-يٱ-ۓە]/;

/**
 * Full ayah text with one or two sets of word positions highlighted —
 * set A in accent green (.sel), set B in gold (.selB).
 */
export default function HighlightedAyah({
  ayah,
  matched,
  matchedB,
  onOpen,
  fontSize = 23,
}: {
  ayah: AyahDoc;
  matched: Set<number>;
  matchedB?: Set<number>;
  onOpen?: () => void;
  fontSize?: number;
}) {
  const tokens = ayah.textUthmani.split(/\s+/);
  let wordIdx = 0;
  return (
    <div
      className="quran"
      style={{ fontSize, lineHeight: 2.1, cursor: onOpen ? "pointer" : undefined }}
      title={onOpen ? t("nav.reader") : undefined}
      onClick={onOpen}
    >
      {tokens.map((tok, i) => {
        const isWord = HAS_LETTER.test(tok);
        if (isWord) wordIdx += 1;
        const cls =
          isWord && matched.has(wordIdx)
            ? "w sel"
            : isWord && matchedB?.has(wordIdx)
              ? "w selB"
              : undefined;
        return (
          <span key={i}>
            <span className={cls}>{tok}</span>{" "}
          </span>
        );
      })}
    </div>
  );
}

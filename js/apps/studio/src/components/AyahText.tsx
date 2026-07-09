import { num } from "../i18n";
import type { WordDoc } from "../types";

/** One ayah rendered word-by-word; clicking a word selects it. */
export default function AyahText({
  words,
  ayahNo,
  selected,
  onSelect,
}: {
  words: WordDoc[];
  ayahNo?: number;
  selected?: string | null;
  onSelect?: (w: WordDoc) => void;
}) {
  return (
    <div className="quran">
      {words.map((w) => (
        <span key={w.location}>
          <span
            className={`w${selected === w.location ? " sel" : ""}`}
            onClick={() => onSelect?.(w)}
          >
            {w.textUthmani}
          </span>{" "}
        </span>
      ))}
      {ayahNo != null && <span className="ayah-marker">﴿{num(ayahNo)}﴾</span>}
    </div>
  );
}

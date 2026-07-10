import { num } from "../i18n";
import { useSettings } from "../settings";
import type { WordDoc } from "../types";

/** One ayah rendered word-by-word; clicking a word selects it. Honours the
 *  script setting (Uthmani ⇄ simple/imlaa'i). */
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
  const { script } = useSettings();
  return (
    <div className="quran">
      {words.map((w) => (
        <span key={w.location}>
          <span
            className={`w${selected === w.location ? " sel" : ""}`}
            onClick={() => onSelect?.(w)}
          >
            {script === "imlaai" ? w.textClean : w.textUthmani}
          </span>{" "}
        </span>
      ))}
      {ayahNo != null && <span className="ayah-marker">﴿{num(ayahNo)}﴾</span>}
    </div>
  );
}

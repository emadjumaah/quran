import { num } from "../i18n";
import { useSettings } from "../settings";
import type { WordDoc } from "../types";
import TajwidText from "./TajwidText";

/** One ayah rendered word-by-word; clicking a word selects it. Honours the
 *  script setting (Uthmani ⇄ simple/imlaa'i). With tajwīd on, renders the
 *  colour-coded ayah (word-click off — recitation aid). */
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
  const { script, tajwid } = useSettings();
  if (tajwid) {
    return <TajwidText text={words.map((w) => w.textUthmani).join(" ")} ayahNo={ayahNo} />;
  }
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

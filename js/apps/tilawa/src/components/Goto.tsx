import { useState } from "react";
import type { Mushaf } from "../mushaf";
import { num } from "../mushaf";
import { AYAH_COUNTS, SURAH_OFFSET } from "@mishkat/quran-core";
import Sheet from "./Sheet";

/**
 * **الانتقال** — سورةٌ أو صفحة، ولا ثالثَ لهما: هذان وحدَهما ما يفتح به قارئُ
 * المصحف مصحفَه. ولا بحثَ ههنا ولا فهرسَ موضوعات — تلك أبوابُ مشكاة.
 */
export default function Goto({
  mushaf,
  onGo,
  onClose,
}: {
  mushaf: Mushaf;
  /** ينتقل إلى آيةٍ بعينها بالرقم العامّ */
  onGo: (ayahId: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"surah" | "page">("surah");
  const go = (id: number) => {
    onGo(id);
    onClose();
  };
  return (
    <Sheet title="الانتقال" onClose={onClose}>
      <div className="tw-seg" role="tablist" aria-label="الانتقال">
        <button role="tab" aria-pressed={tab === "surah"} onClick={() => setTab("surah")}>
          السور
        </button>
        <button role="tab" aria-pressed={tab === "page"} onClick={() => setTab("page")}>
          الصفحات
        </button>
      </div>
      {tab === "surah" ? (
        <div className="tw-grid">
          {AYAH_COUNTS.map((count, i) => (
            <button key={i} onClick={() => go(SURAH_OFFSET[i] + 1)}>
              <b className="quran">{mushaf.surahName(i + 1)}</b>
              <i>{num(count)}</i>
            </button>
          ))}
        </div>
      ) : (
        <div className="tw-grid pages">
          {mushaf.pages.map((p) => (
            <button key={p.page} onClick={() => go(p.ayahs[0].id)}>
              {num(p.page)}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

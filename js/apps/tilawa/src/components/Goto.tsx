import { useState } from "react";
import type { Mushaf } from "../mushaf";
import { num } from "../mushaf";
import { AYAH_COUNTS, SURAH_OFFSET, locationOf } from "@mishkat/quran-core";
import { MISHKAT_LIVE, mishkatAyah } from "../bridge";
import Sheet from "./Sheet";

/**
 * **الانتقال** — سورةٌ أو صفحة، ولا ثالثَ لهما: هذان وحدَهما ما يفتح به قارئُ
 * المصحف مصحفَه. ولا بحثَ ههنا ولا فهرسَ موضوعات — تلك أبوابُ مشكاة.
 *
 * **وفي ذيلها بابُ مشكاة عند الآية التي يقف عليها القارئ** (م٣ §٢): وموضعُه
 * ههنا لا في المصحف نفسِه — **فالمصحفُ نصٌّ صافٍ لا يُنقر ولا يُستفتى**، ولا
 * ورقةَ آيةٍ في هذا التطبيق يُوضع فيها. وهذه ورقةُ الانتقال، والذهابُ إلى
 * مشكاة عند هذه الآية انتقالٌ من جنس ما فيها.
 */
export default function Goto({
  mushaf,
  at,
  onGo,
  onClose,
}: {
  mushaf: Mushaf;
  /** الآيةُ التي يقف عليها القارئ الآن — بالرقم العامّ */
  at: number;
  /** ينتقل إلى آيةٍ بعينها بالرقم العامّ */
  onGo: (ayahId: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"surah" | "page">("surah");
  const [surahNo, ayahNo] = locationOf(at);
  const go = (id: number) => {
    onGo(id);
    onClose();
  };
  /* **بابُ مشكاة في ذيلٍ ثابت** — لا في آخر قائمةٍ من مئةٍ وأربعَ عشرةَ سورةً
     وستِّمئةٍ وأربعِ صفحاتٍ لا يبلغها قارئٌ بتمرير (قِيس في لقطة البوّابة فنُقل). */
  const bridge = MISHKAT_LIVE ? (
    <a
      className="tw-about-link"
      data-bridge="mishkat-ayah"
      href={mishkatAyah(surahNo, ayahNo)}
      target="_blank"
      rel="noopener"
    >
      <b>
        تدبَّرْ في مشكاة — {mushaf.surahName(surahNo)} {num(ayahNo)}
      </b>
      <span>تُفتح هذه الآيةُ في المرجع الحاسوبيّ: طبقاتُها وصلاتُها وما قيل فيها.</span>
    </a>
  ) : undefined;

  return (
    <Sheet title="الانتقال" onClose={onClose} footer={bridge}>
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

import { useSyncExternalStore } from "react";
import {
  getAttribution,
  getPlayState,
  getReciter,
  getReciters,
  pause,
  play,
  resume,
  stop,
  subscribePlay,
} from "../audio";
import { setReciter } from "../audio";
import type { Mushaf } from "../mushaf";
import { num } from "../mushaf";
import { locationOf } from "@mishkat/quran-core";
import Sheet from "./Sheet";

export const usePlayState = () => useSyncExternalStore(subscribePlay, getPlayState);

/**
 * **ورقةُ الاستماع** — تشغيلٌ من أوّل السورة أو من الآية الظاهرة، واختيارُ قارئ.
 * **والإسنادُ في موضع السماع** لا في صفحةِ مصادرَ بعيدة: التلاوةُ منقولةٌ لا
 * مصنوعةً عندنا، فيُقال منقولةٌ ومن مَن.
 */
export function ListenSheet({
  mushaf,
  topAyahId,
  onClose,
}: {
  mushaf: Mushaf;
  /** أوّلُ آيةٍ ظاهرةٍ على الشاشة الآن */
  topAyahId: number;
  onClose: () => void;
}) {
  const reciters = getReciters();
  const chosen = getReciter();
  const [surahNo] = locationOf(topAyahId);
  const surahStart = mushaf.ayahs.find((a) => a.surahNo === surahNo && a.ayahNo === 1);
  const start = (id: number) => {
    play(id);
    onClose();
  };
  return (
    <Sheet title="الاستماع" onClose={onClose}>
      {reciters.length === 0 ? (
        <p className="tw-note">سجلُّ التلاوات لم يُحمَّل — تحقّق من الاتّصال ثمّ أعد المحاولة.</p>
      ) : (
        <>
          <div className="tw-grid">
            <button onClick={() => start(topAyahId)}>
              <b className="quran">من هذه الآية</b>
              <i>{`${mushaf.surahName(surahNo)} ${num(locationOf(topAyahId)[1])}`}</i>
            </button>
            {surahStart && (
              <button onClick={() => start(surahStart.id)}>
                <b className="quran">من أوّل السورة</b>
                <i>{mushaf.surahName(surahNo)}</i>
              </button>
            )}
          </div>

          <div className="tw-set-row">
            <span>القارئ</span>
          </div>
          <div className="tw-reciters">
            {reciters.map((r) => (
              <button key={r.key} aria-pressed={chosen === r.key} onClick={() => setReciter(r.key)}>
                {r.ar}
              </button>
            ))}
          </div>

          {/* **ويُسمّى المصدرُ الذي يُسمع منه الآن بعينه**: الإسنادُ أعلاه أصلُ
              التسجيل كما قيّده المانيفست، **والتشغيلُ من مرآتنا** لا من الموضع
              الذي نُقل عنه — فلا يُقال لقارئٍ إنّه يسمع من حيث لا يسمع. */}
          <p className="tw-credit">
            <b>منقولة</b> — {getAttribution()}. وتُشغَّل الآن من مرآتنا على الشبكة، ولا تنزيلَ في هذه النسخة.
          </p>
        </>
      )}
    </Sheet>
  );
}

/** شريطُ التشغيل — **لا يظهر إلّا والصوتُ قائم**، ولا يستوطن فوق النصّ */
export function PlayBar({ mushaf }: { mushaf: Mushaf }) {
  const st = usePlayState();
  if (st.id === null) return null;
  const [s, a] = locationOf(st.id);
  return (
    <div className="tw-play">
      <button onClick={() => (st.playing ? pause() : resume())} aria-label={st.playing ? "إيقاف" : "متابعة"}>
        {st.playing ? "❚❚" : "▶"}
      </button>
      <span className="tw-play-where">
        <b>{mushaf.surahName(s)}</b> {num(a)}
        {st.error && ` — ${st.error}`}
      </span>
      <button onClick={stop} aria-label="إنهاء الاستماع">
        ✕
      </button>
    </div>
  );
}

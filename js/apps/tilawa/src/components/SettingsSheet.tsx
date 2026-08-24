import { SCALES, getSettings, setSettings, type QuranFont, type Theme } from "../settings";
import { num } from "../mushaf";
import Sheet from "./Sheet";

/**
 * **الإعداداتُ الدنيا** — مقاسُ الخطّ ووضعُ الصفحة وخطُّ المصحف، ولا رابعَ.
 * وهي **ورقةٌ في `body`** لا لوحةٌ منسدلةٌ من رأسٍ متحوِّل (درسُ ج٩ §١).
 *
 * **ولا رقمَ خطٍّ مكتوبٌ في الوسم**: السلّمُ رمزٌ في `:root` تضربه هيئةُ الصفحة.
 */
const THEMES: { id: Theme; ar: string }[] = [
  { id: "light", ar: "فاتح" },
  { id: "dark", ar: "داكن" },
  { id: "sepia", ar: "ورقيّ" },
];

const FONTS: { id: QuranFont; ar: string }[] = [
  { id: "amiri", ar: "أميري" },
  { id: "kfgqpc", ar: "المجمَّع" },
  { id: "scheherazade", ar: "شهرزاد" },
];

export default function SettingsSheet({ onClose, onAbout }: { onClose: () => void; onAbout: () => void }) {
  const s = getSettings();
  const i = SCALES.indexOf(s.scale);
  return (
    <Sheet title="الإعدادات" onClose={onClose}>
      <div className="tw-set-row">
        <span>مقاسُ الخطّ</span>
        <div className="tw-steps">
          <button
            onClick={() => setSettings({ scale: SCALES[i - 1] })}
            disabled={i <= 0}
            aria-label="أصغر"
          >
            −
          </button>
          <span>{num(Math.round(s.scale * 100))}٪</span>
          <button
            onClick={() => setSettings({ scale: SCALES[i + 1] })}
            disabled={i >= SCALES.length - 1}
            aria-label="أكبر"
          >
            +
          </button>
        </div>
      </div>

      <div className="tw-set-row">
        <span>وضعُ الصفحة</span>
        <div className="tw-modes">
          {THEMES.map((t) => (
            <button key={t.id} aria-pressed={s.theme === t.id} onClick={() => setSettings({ theme: t.id })}>
              {t.ar}
            </button>
          ))}
        </div>
      </div>

      <div className="tw-set-row">
        <span>خطُّ المصحف</span>
        <div className="tw-modes">
          {FONTS.map((f) => (
            <button key={f.id} aria-pressed={s.font === f.id} onClick={() => setSettings({ font: f.id })}>
              {f.ar}
            </button>
          ))}
        </div>
      </div>

      {/* **يُقال ولا يُكتم**: ما يُحفظ ههنا محلّيٌّ لهذا الجهاز، ولا يُرفع منه شيء */}
      <p className="tw-note">
        ما تختاره وموضعُ قراءتك محفوظان في هذا الجهاز وحدَه — ولا يُرفع من قراءتك شيءٌ إلى خادم.
      </p>

      {/* **بابُ «عن التطبيق»** — سطرُ تعريفٍ وإسنادُ ما يُقرأ ويُسمَع، ورقةً على حدة */}
      <button className="tw-about-open" data-tw="about-open" onClick={onAbout}>
        عن التطبيق
      </button>
    </Sheet>
  );
}

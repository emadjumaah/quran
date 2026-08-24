import { ENGINES } from "@mishkat/quran-core/lib/sawt/engines";
import { HALAT } from "@mishkat/quran-core/lib/sawt/halat";
import { isAppleMobile } from "@mishkat/quran-core/lib/sawt/vad";
import type { HalId } from "@mishkat/quran-core/lib/sawt/halat";
import type { Tatabbu } from "../tatabbu";
import type { Mushaf } from "../mushaf";
import { num } from "../mushaf";
import Sheet from "./Sheet";

/**
 * **سطحُ التتبّع في التلاوة — شريطٌ واحدٌ ووَرَقتان.**
 *
 * ولا صفحةَ ثانيةً ولا شاشةَ بدء: يلمس القارئُ الميكروفونَ في الرأس فتنقلب
 * صفحتُه **في مكانها** حالًا تتلوها، ويظهر تحتها شريطٌ رفيعٌ فيه ثلاثة لا رابعَ
 * لها: **الحالُ** ▾ · **المحرّكُ وتبديلُه** · **ابدأ/✕**.
 *
 * **وسطورُ الصدق تُجلب من الحزمة ولا تُكتب ههنا** (`engines.ts`): لكلّ محرّكٍ
 * سطرُه ونفعُه وثمنُه بالأرقام — فعبارةٌ واحدةٌ في الصفحة تصلح لأحدهما وتكذب
 * على الآخر.
 */

/** شريطُ الحال — رفيعٌ في أسفل الشاشة، يبقى والرأسُ منسحبٌ في التلاوة */
export function TrackBar({ t }: { t: Tatabbu }) {
  const live = t.phase === "running";
  const now = live ? t.active : t.engine;
  return (
    <div className="tw-track" data-track="bar">
      {t.fell && (
        <p className="tw-track-fell" data-track="fell" role="status">
          <b>{t.fell.why}.</b>{" "}
          {t.fell.to ? (
            <>
              فتحوّلنا إلى <b>{t.fell.to.label}</b> — {t.fell.to.privacyLine}
            </>
          ) : t.halId === "salat" ? (
            <>
              ووضعُ الصلاة لا يُفتح بغيره، فصوتُ المصلّي لا يخرج إلى طرفٍ ثالثٍ بحال — فاخترْ
              حالًا أخرى إن شئت التلاوةَ الآن.
            </>
          ) : (
            <>ولا محرّكَ آخرَ يعمل على هذا الجهاز.</>
          )}
        </p>
      )}
      {live && t.seeking && (
        <p className="tw-track-seek" data-track="seek" role="status">
          يلتمس موضعك…
        </p>
      )}
      {live && t.engineState === "denied" && (
        <p className="tw-track-fell" data-track="denied" role="status">
          لم يُؤذن للصفحة بالميكروفون — يُؤذن من إعدادات المتصفّح ثمّ يُعاد البدء.
        </p>
      )}
      <div className="tw-track-row">
        <select
          className="tw-track-hal"
          data-track="hal"
          aria-label="الحال"
          value={t.halId}
          disabled={live}
          onChange={(e) => t.chooseHal(e.target.value as HalId)}
        >
          {HALAT.map((h) => (
            <option key={h.id} value={h.id} disabled={!!h.suspended}>
              {h.name}
              {h.suspended ? " (موقوفة)" : ""}
            </option>
          ))}
        </select>

        {/* **أيُّ محرّكٍ يسمعك الآن** — ولا يُترك القارئُ يحزر؛ وفي التهيئة يُبدَّل بلمسة */}
        {live ? (
          <span className="tw-track-eng" data-track="engine" aria-label={`المحرّك: ${now?.label ?? "—"}`}>
            <span className={`tw-dot tw-dot-${t.engineState}`} aria-hidden />
            {now?.label ?? "—"}
          </span>
        ) : (
          <button
            className="tw-track-eng tw-track-swap"
            data-track="engine"
            aria-label={`المحرّك: ${now?.label ?? "لم يُختر بعدُ"} — بدِّله`}
            onClick={t.swapEngine}
          >
            <span className={`tw-dot tw-dot-${t.engineState}`} aria-hidden />
            {now?.label ?? "المحرّك"}
          </button>
        )}

        <span className="tw-spacer" />

        {live ? (
          <button className="tw-track-act" data-track="end" onClick={t.finish}>
            أنهيت
          </button>
        ) : (
          <button
            className="tw-track-act"
            data-track="begin"
            onClick={t.start}
            disabled={!t.supported || !!t.hal.suspended}
          >
            ابدأ
          </button>
        )}
        <button className="tw-track-x" data-track="close" aria-label="إغلاق التتبّع" onClick={t.close}>
          ✕
        </button>
      </div>

      {/* **سطرُ خيارٍ لا قفزةٌ صامتة** (درسُ ج٩ §٣): الختمةُ تستأنف، ومحفوظُها
          لا يُهدَر ولا يُرمى به القارئُ عن الصفحة التي ينظر إليها. */}
      {t.offerMark && t.mark && (
        <button className="tw-track-resume" data-track="resume" onClick={t.takeMark}>
          تتابع من موضعك؟ <b>{locSay(t.mark.location)}</b>
        </button>
      )}

      {!t.supported && (
        <p className="tw-track-fell">
          متصفّحُ هذا الجهاز لا يتيح التعرّفَ على الصوت — فلا يعمل التتبّعُ هنا.
        </p>
      )}
      {t.hal.suspended && (
        <p className="tw-track-note" data-track="hal-note">
          {t.hal.name} موقوفةٌ اليوم — {t.hal.suspended}. واخترْ غيرَها لتتلوَ الآن.
        </p>
      )}
    </div>
  );
}

/** «٢:٢٥٥:٣» ⇒ «٢:٢٥٥» بأرقام العرب — والاسمُ يأتيه من الصفحة */
const locSay = (loc: string): string => {
  const [s, a] = loc.split(":");
  return `${num(s)}:${num(a)}`;
};

/**
 * **السؤالُ الواحدُ عن المحرّك** — مرّةً ويُحفظ جوابُه، **وبلا ترجيحٍ خفيّ**:
 * لكلٍّ سطرُ صدقه ونفعُه وثمنُه، كما أعلنتها الحزمة نصًّا.
 */
export function EngineSheet({ t }: { t: Tatabbu }) {
  return (
    <Sheet title="بأيِّ محرّكٍ يتتبّع؟" onClose={t.dismissAsk}>
      <div data-track="engine-choice">
        {t.halId === "salat" && (
          <p className="tw-warn">
            وضعُ الصلاة لا يُفتح إلّا بالمحرّك الذي يعمل على جهازك — فصوتُ المصلّي لا يخرج إلى
            طرفٍ ثالثٍ بحال.
          </p>
        )}
        <div className="tw-engines">
          {ENGINES.map((e) => {
            const usable = t.engineUsable(e);
            const blocked = t.halId === "salat" && !e.fitsSalat;
            return (
              <button
                key={e.id}
                className="tw-engine"
                data-track={`engine-${e.id}`}
                aria-pressed={t.engine?.id === e.id}
                disabled={!usable || blocked}
                onClick={() => t.chooseEngine(e.id)}
              >
                <b>{e.label}</b>
                <span>{e.privacyLine}</span>
                <span>{e.benefit}</span>
                <span>{e.cost}</span>
                {!usable && <span>ولا يعمل على هذا الجهاز</span>}
                {blocked && usable && <span>ولا يُفتح به وضعُ الصلاة</span>}
              </button>
            );
          })}
        </div>
        {/* **سطرُ صدقٍ على أجهزة آبل الجوّالة** (درسُ ص٤): يُقال ولا يُمنع خيارُه */}
        {isAppleMobile() && (
          <p className="tw-note">
            والمحرّكُ الذي يعمل على جهازك ثقيلٌ على أجهزة iOS اليوم — إن انقطع فمحرّكُ المتصفّح
            أثبتُ عليها.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** **الإعلانُ قبل أوّل تشغيلٍ للميكروفون** — بعبارةٍ بيّنةٍ لا تُخفى في مطويّ */
export function ConsentSheet({ t }: { t: Tatabbu }) {
  return (
    <Sheet title="قبل تشغيل الميكروفون" onClose={t.dismissAsk}>
      <div data-track="consent">
        <p className="tw-note tw-warn-body">
          التعرّفُ يجري <b>{t.engine?.label ?? "—"}</b> — {t.engine?.privacyLine} ولا نحفظ نحن
          صوتًا، ولا نخزّنه، ولا يصل إلى خوادمنا منه شيء.
        </p>
        {t.halId === "salat" && t.engine && !t.engine.onDevice && (
          <p className="tw-warn">
            <b>وأنت تختار «الصلاة»</b> — وهذا المحرّكُ لا يصلح لها.
          </p>
        )}
        <div className="tw-acts">
          <button className="tw-act-main" data-track="agree" onClick={t.agree}>
            أوافق — وابدأ
          </button>
          <button className="tw-act" onClick={t.dismissAsk}>
            لا
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * **ما بعد الختام** — «تقبّل الله» وموضعُك، **ومواضعُ للنظر** حيث تكون الحالُ
 * لها. **ولغتُها لغةُ شكٍّ لا حكم**: خبرٌ عن سمع الآلة لا تقريرُ خطأٍ على تلاوة.
 * وفي «الصلاة» لا تُفتح هذه الورقةُ أصلًا — صمتٌ تامّ.
 */
export function AfterSheet({ t, mushaf }: { t: Tatabbu; mushaf: Mushaf }) {
  const places = t.hal.after === "places" ? (t.report?.places ?? []) : [];
  const say = (loc: string) => {
    const [s, a] = loc.split(":").map(Number);
    return `${mushaf.surahName(s)} ${num(a)}`;
  };
  return (
    <Sheet title="تقبّل الله" onClose={t.dismissReport}>
      <div data-track="after">
        {t.reached && (
          <p className="tw-reached">
            بلغتَ <b className="quran">{t.reached}</b>
          </p>
        )}
        <p className="tw-note">
          حُفظ موضعُك في هذا الجهاز، فتستأنف منه في المجلس القادم. موضعٌ وتاريخُه لا غير.
        </p>
        {t.hal.after === "places" && (
          <>
            <p className="tw-note">
              مواضعُ لم يتبيّن لنا فيها ما تُلي — وقد يكون ذلك من سمع الآلة لا من التلاوة.{" "}
              <b>فهذا خبرٌ لا حكم، ولا يُعدُّ خطأً، والآلةُ لا تُجيز.</b>
            </p>
            {places.length === 0 ? (
              <p className="tw-note">لم يقع موضعٌ للنظر.</p>
            ) : (
              <ul className="tw-places" data-track="places">
                {places.slice(0, 12).map((p, i) => (
                  <li key={`${p.from}-${i}`}>
                    <span className="quran">{say(p.from)}</span>
                    <span>{p.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="tw-acts">
          <button className="tw-act-main" data-track="again" onClick={t.start}>
            تلاوةٌ أخرى
          </button>
          <button className="tw-act" onClick={t.close}>
            عودة إلى القراءة
          </button>
        </div>
      </div>
    </Sheet>
  );
}

import { Fragment, memo } from "react";
import type { Mushaf, Page } from "../mushaf";
import { BASMALA, ayahTokens, num } from "../mushaf";

/**
 * **صفحةُ مصحفٍ واحدة** — سردٌ متّصلٌ كالمصحف المطبوع: ترويسةٌ مؤطَّرةٌ (السورةُ ·
 * رقمُ الصفحة في خرطوشه · الجزءُ والحزب)، ولوحةُ سورةٍ وبسملةٌ حيث تبتدئ سورة،
 * وعلامتا ۞ و۩ في مواضعهما، ورقمُ كلِّ آيةٍ في ميداليّته.
 *
 * **وهيئتُها كلُّها من الحزمة** (`mushaf.css`) — لا قاعدةَ ههنا ولا مقاسَ خطٍّ
 * مكتوبٌ في الوسم؛ وهذا الملفُّ **وسمٌ ونصٌّ لا غير**.
 *
 * **ونصٌّ صافٍ**: لا طبقةَ ولا شارةَ ولا كلمةَ تُنقر فتفتح لوحة. رقمُ الآية
 * ليس زرًّا — **المصحفُ يُقرأ ولا يُستفتى**.
 *
 * ## والكلماتُ عناصرُ الصفحة نفسِها (ف٣ §١)
 *
 * **المكسبُ الذي فُصلت التلاوةُ لأجله**: يجري مؤشّرُ التتبّع على **كلمات هذه
 * الصفحة بأعيانها** لا على سطح نصٍّ ثانٍ يُرسم فوقها. فيُرسم كلُّ لفظٍ في
 * `<span>` بموضعه العالميّ `"سورة:آية:كلمة"` — وهو عينُ ما تمسك به المحاذاة.
 *
 * **والرسمُ لا يتبدّل بذلك حرفًا**: الفاصلُ **مسافةُ النصّ نفسُها** لا هامشٌ
 * ولا حشوة، والقسمةُ من `ayahTokens` وحدَها (فلا ترقيمان)، و`.mp-w` **بلا
 * قاعدةٍ تمسّ التنضيد** — فتسويةُ السطر ومواضعُ الكلمات كما كانت سواءً بسواء.
 * وعلاماتُ الوقف تُرسم نصًّا كما هي: **رموزُ قراءةٍ لا كلماتٍ يجري عليها مؤشّر**.
 */
function MushafPage({
  page,
  mushaf,
  playingId,
  cursor,
}: {
  page: Page;
  mushaf: Mushaf;
  /** الآيةُ المسموعةُ الآن — تُظلَّل بلون التظليل القائم */
  playingId: number | null;
  /** موضعُ مؤشّر التتبّع `"سورة:آية:كلمة"` **إن كان في هذه الصفحة** — وإلّا `null`.
   *  **ويُقصَر على صفحته قصدًا**: فلا تُعاد صفحاتُ النافذة رسمًا كلَّما تقدّمت
   *  كلمةٌ واحدة (الأداءُ شرطٌ لا زينة). */
  cursor: string | null;
}) {
  const first = page.ayahs[0];
  if (!first) return null;
  const opening = page.page === 1 || page.page === 2;
  const start = page.startsSurah;

  /* ۞ عند مطلع كلّ ربع — ويُقرأ من تبدُّل رقم الربع لا من جدولٍ ثانٍ */
  const rubs = new Set<number>();
  let prev = first.rub;
  for (const a of page.ayahs) {
    if (a.rub !== prev) rubs.add(a.id);
    prev = a.rub;
  }

  return (
    <section className={`mushaf-page${opening ? " opening" : ""}`} data-page={page.page}>
      <div className="mp-head">
        <span className="mp-head-cell">{mushaf.surahName(first.surahNo)}</span>
        <span className="mp-head-folio">{num(page.page)}</span>
        <span className="mp-head-cell">
          الجزء {num(first.juz)} · الحزب {num(first.hizb)}
        </span>
      </div>

      {start !== null && (
        <>
          <div className="mp-surah-band">
            <span className="mp-band-crest" aria-hidden />
            <span className="mp-surah-name quran">سورة {mushaf.surahName(start)}</span>
            <span className="mp-surah-meta">{mushaf.surahMeta(start)}</span>
          </div>
          {mushaf.showsBismillah(start) && <div className="mp-basmala quran">{BASMALA}</div>}
        </>
      )}

      <div className="quran mp-text">
        {page.ayahs.map((a) => (
          <Fragment key={a.id}>
            {rubs.has(a.id) && (
              <div className="mp-mark mp-rub" title={`الحزب ${num(a.hizb)}`}>
                <span>۞</span>
              </div>
            )}
            {a.sajda && (
              <div className="mp-mark mp-sajda" title="موضع سجدة">
                <span>۩</span>
              </div>
            )}
            <span
              id={`ayah-${a.id}`}
              data-ayah={a.id}
              className={`mp-ayah${playingId === a.id ? " tw-now" : ""}`}
            >
              {ayahTokens(a.id, a.text).map((t, i) => (
                <Fragment key={i}>
                  {i > 0 ? " " : null}
                  {t.no ? (
                    <span
                      data-w={`${a.surahNo}:${a.ayahNo}:${t.no}`}
                      className={
                        cursor === `${a.surahNo}:${a.ayahNo}:${t.no}` ? "mp-w tw-cursor" : "mp-w"
                      }
                    >
                      {t.text}
                    </span>
                  ) : (
                    /* علامةُ وقفٍ — نصٌّ كما هو، ولا يجري عليها مؤشّر */
                    t.text
                  )}
                </Fragment>
              ))}{" "}
              <span className="ayah-marker">{num(a.ayahNo)}</span>{" "}
            </span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

export default memo(MushafPage);

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
  slip = null,
  veil = "none",
  marks = null,
}: {
  page: Page;
  mushaf: Mushaf;
  /** الآيةُ المسموعةُ الآن — تُظلَّل بلون التظليل القائم */
  playingId: number | null;
  /** موضعُ مؤشّر التتبّع `"سورة:آية:كلمة"` **إن كان في هذه الصفحة** — وإلّا `null`.
   *  **ويُقصَر على صفحته قصدًا**: فلا تُعاد صفحاتُ النافذة رسمًا كلَّما تقدّمت
   *  كلمةٌ واحدة (الأداءُ شرطٌ لا زينة). */
  cursor: string | null;
  /**
   * **موضعُ وميض الاصطياد** `"سورة:آية:كلمة"` إن كان في هذه الصفحة (ن٢).
   * **إشارةٌ هادئةٌ تنطفئ من تلقائها** — أرضيّةٌ تخفت لا لونُ خطأٍ ولا لوحٌ يطمس
   * النصّ؛ وحشوتُها يقابلها هامشٌ سالبٌ يساويها فلا يتزحزح تنضيدُ الصفحة.
   */
  slip?: string | null;
  /**
   * **حجابُ حال التثبيت** (`halat.ts`: «النصُّ محجوبٌ ينكشف بالتلاوة، وما بعده
   * يبقى محجوبًا»): `"none"` صفحةٌ مكشوفةٌ · `"from"` تنكشف إلى المؤشّر وتُحجب
   * بعده · `"all"` صفحةٌ لم يبلغها القارئُ بعد. **ويبقى موضعُ الكلمة وطولُها**
   * — لونٌ وخطٌّ منقوطٌ لا غير، فلا يتزحزح تنضيدُ الصفحة بالحجاب ولا بكشفه.
   */
  veil?: "none" | "from" | "all";
  /**
   * **وسمُ المفارق** (بابُ التثبيت): الآياتُ التي لها نظيرةٌ تلتبس بها.
   * **ولا يزيد في الصفحة عنصرًا ولا يزحزح تنضيدًا** — إنّما يتبدّل **حبرُ
   * ميداليّة رقم الآية** وحدَه، فيُرى موضعُ الالتباس ولا يُلوَّث المتن.
   * **ومجموعةٌ واحدةٌ ثابتةٌ** تُمرَّر إلى كلّ الصفحات (لا تُبنى في كلّ رسم)
   * فلا يُبطَل حفظُ الصفحات.
   */
  marks?: Set<number> | null;
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
              className={`mp-ayah${playingId === a.id ? " tw-now" : ""}${
                marks?.has(a.id) ? " tw-fork" : ""
              }`}
            >
              {ayahTokens(a.id, a.text).map((t, i) => {
                const at = `${a.surahNo}:${a.ayahNo}:${t.no}`;
                const now = cursor === at;
                const slipped = slip === at;
                /* **ما بلغه القارئُ مكشوفٌ وما بعده محجوب** — والمؤشّرُ حدُّهما.
                   والرتبةُ `ord` لا الاسمُ `no`: علامةُ الوقف تتبع كلمتَها. */
                const hidden =
                  veil === "all" ||
                  (veil === "from" && !!cursor && after(`${a.surahNo}:${a.ayahNo}:${t.ord}`, cursor));
                const sep = i > 0 ? " " : "";
                return t.no ? (
                  <Fragment key={i}>
                    {sep}
                    <span
                      data-w={at}
                      className={`mp-w${now ? " tw-cursor" : ""}${slipped ? " tw-slip" : ""}${
                        hidden ? " tw-veil" : ""
                      }`}
                    >
                      {t.text}
                    </span>
                  </Fragment>
                ) : (
                  /* ═══ **علامةُ وقفٍ — ومعها فاصلُها في صندوقها** ═══
                     رسمُها كما هو ولا يجري عليها مؤشّر؛ وإنّما وُسمت لتُحجب مع ما
                     تحجبه حالُ التثبيت، فلا تبقى علاماتٌ عائمةٌ فوق بياضٍ تدلّ على
                     مواضع الوقف فيما لم يُتلَ بعد.
                     **والفاصلُ داخلَ صندوقها قصدًا**: علاماتُ الوقف حروفٌ **صفرُ
                     العرض** تُركَّب على ما قبلها، فإن أُفردت في صندوقٍ بلا حاملٍ
                     رُكِّبت على **الفراغ المجاور** — وهو نصُّ الآية لا نصُّ العلامة،
                     فتُرسم بحبره ولو حُجبت (قِيس: عرضُ الصندوق صفر، والعلامةُ
                     ظاهرةٌ في المحجوب). فبضمّ الفراغ إليها صار لها حاملٌ في
                     صندوقها، فتُحجب وتنكشف معه. **والحروفُ المعروضةُ هي هي**:
                     فراغٌ ثمّ علامةٌ ثمّ فراغ. */
                  <span key={i} className={`mp-mk${hidden ? " tw-veil" : ""}`}>{sep + t.text}</span>
                );
              })}{" "}
              <span className="ayah-marker">{num(a.ayahNo)}</span>{" "}
            </span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}

/** أيقع هذا الموضعُ بعد ذاك في ترتيب المصحف؟ — مقابلةُ أعدادٍ لا نصوص */
function after(a: string, b: string): boolean {
  const x = a.split(":").map(Number);
  const y = b.split(":").map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}

export default memo(MushafPage);

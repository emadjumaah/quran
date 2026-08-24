/**
 * **نصُّ المصحف في التلاوة — مأخذُه ومَقروؤه.**
 *
 * مصدرُه `mushaf-text.json` من `@mishkat/quran-assets`، وهو مولَّدٌ من قاعدة
 * مشكاة نفسِها (`js/scripts/export-mushaf-text.mjs`) — **فالمصدرُ واحدٌ**
 * والقارئان يقرآن حرفًا واحدًا. ولا `monlite` ههنا ولا `WASM`: التلاوةُ تُفتح
 * فتُقرأ، ولا تجرّ محرّكَ قاعدةٍ لنصٍّ لا يتغيّر.
 *
 * **والملفُّ يحمل مطالعَ الوحدات لا أرقامَها**: أوّلُ آيةٍ في كلّ صفحةٍ وجزءٍ
 * وربع؛ فيُشتقّ منها رقمُ الصفحة والجزء والحزب لكلّ آيةٍ ههنا مرّةً واحدةً عند
 * التحميل — ولا يُشحن ستّةُ آلاف رقمٍ أربعَ مرّات.
 */
import { AYAH_COUNTS, SURAH_OFFSET, globalIdOf, locationOf } from "@mishkat/quran-core";
import { provideQuranText } from "@mishkat/quran-core/db";
import type { AyahDoc, SurahDoc, WordDoc } from "@mishkat/quran-core/types";

/** صورةُ الملفّ المولَّد كما هي — أسماؤها أسماءُ مفاتيحه */
interface RawMushaf {
  tag: string;
  ayat: number;
  /** [اسمُها · مكّيّةٌ(١)/مدنيّة(٠) · ترتيبُ نزولها · أفيها بسملةٌ تُكتب] */
  surahs: [string, 0 | 1, number, 0 | 1][];
  text: string[];
  pageStart: number[];
  juzStart: number[];
  rubStart: number[];
  sajda: [number, string][];
}

/** آيةٌ في المصحف بحدودها — ما يلزم الصفحةَ ولا يزيد */
export interface Ayah {
  /** الرقمُ العامّ ١…٦٢٣٦ */
  id: number;
  surahNo: number;
  ayahNo: number;
  /** «سورة:آية» */
  location: string;
  text: string;
  page: number;
  juz: number;
  hizb: number;
  rub: number;
  sajda: boolean;
}

export interface Page {
  page: number;
  ayahs: Ayah[];
  /** السورةُ التي **تبدأ** في هذه الصفحة — منها لوحتُها وبسملتُها (وقد لا تكون) */
  startsSurah: number | null;
}

export interface Mushaf {
  ayahs: Ayah[];
  pages: Page[];
  surahName: (n: number) => string;
  /** ما يُكتب في لوحة السورة: مكّيّةٌ/مدنيّة · آياتها · ترتيبُها */
  surahMeta: (n: number) => string;
  /** أتُكتب البسملةُ فوق هذه السورة؟ — مقروءةٌ من البيانات لا مكتوبةٌ برقم سورة */
  showsBismillah: (n: number) => boolean;
}

export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

/** الأرقامُ بحروف العرب — والمصحفُ لا يُكتب بغيرها */
export const num = (n: number | string): string =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** رقمُ الوحدة التي تقع فيها آيةٌ — من مطالعها (وهي متصاعدةٌ فيصحّ البحثُ الثنائيّ) */
const unitOf = (starts: number[], id: number): number => {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= id) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
};

let loading: Promise<Mushaf> | null = null;

/** يُحمَّل مرّةً واحدةً ويُبنى مرّةً واحدة */
export function loadMushaf(): Promise<Mushaf> {
  loading ??= fetch(`${import.meta.env.BASE_URL}mushaf-text.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`نصُّ المصحف لم يُجلب (${r.status})`);
      return r.json() as Promise<RawMushaf>;
    })
    .then(build);
  return loading;
}

function build(raw: RawMushaf): Mushaf {
  const sajdas = new Set(raw.sajda.map(([id]) => id));
  const ayahs: Ayah[] = raw.text.map((text, i) => {
    const id = i + 1;
    const [surahNo, ayahNo] = locationOf(id);
    const rub = unitOf(raw.rubStart, id);
    return {
      id,
      surahNo,
      ayahNo,
      location: `${surahNo}:${ayahNo}`,
      text,
      page: unitOf(raw.pageStart, id),
      juz: unitOf(raw.juzStart, id),
      /** الحزبُ ربعُه المقسومُ على أربعة — ولا يُكتب جدولٌ ثانٍ له */
      hizb: Math.ceil(rub / 4),
      rub,
      sajda: sajdas.has(id),
    };
  });

  const pages: Page[] = raw.pageStart.map((_, i) => ({ page: i + 1, ayahs: [], startsSurah: null }));
  for (const a of ayahs) {
    const p = pages[a.page - 1];
    p.ayahs.push(a);
    if (a.ayahNo === 1) p.startsSurah = a.surahNo;
  }

  const surahName = (n: number) => raw.surahs[n - 1]?.[0] ?? "";
  const surahMeta = (n: number) => {
    const s = raw.surahs[n - 1];
    if (!s) return "";
    return [s[1] ? "مكّيّة" : "مدنيّة", `آياتها ${num(AYAH_COUNTS[n - 1])}`, `ترتيبُها ${num(n)}`].join(" · ");
  };
  /** التوبةُ وحدَها بلا بسملة، **والفاتحةُ بسملتُها آيتُها الأولى** فلا تُكتب مرّتين */
  const bare = (x: string) => x.replace(/ـ/g, "");
  const showsBismillah = (n: number) => {
    if (!raw.surahs[n - 1]?.[3]) return false;
    return bare(ayahs[SURAH_OFFSET[n - 1]].text) !== bare(BASMALA);
  };

  /* ── **منفذُ نصّ المصحف** (ف١): تُسجَّل قاعدةُ التلاوة مرّةً عند بناء النصّ ──
     فيجد المسبارُ (ف٣) ما يطلبه بأسمائه نفسِها. */
  provideQuranText({
    allAyahs: async (): Promise<AyahDoc[]> =>
      ayahs.map((a) => ({
        _id: `a${a.id}`,
        location: a.location,
        surahNo: a.surahNo,
        ayahNo: a.ayahNo,
        textUthmani: a.text,
        textClean: "",
        juz: a.juz,
        hizb: a.hizb,
        rub: a.rub,
        ruku: 0,
        page: a.page,
        manzil: 0,
        sajdaType: a.sajda ? "sajda" : null,
        wordCount: 0,
        letterCount: 0,
      })),
    listSurahs: async (): Promise<SurahDoc[]> =>
      raw.surahs.map((s, i) => ({
        _id: `s${i + 1}`,
        surahNo: i + 1,
        nameAr: s[0],
        nameTranslit: "",
        nameEn: "",
        revelation: s[1] ? "Meccan" : "Medinan",
        chronoOrder: s[2],
        ayahCount: AYAH_COUNTS[i],
        rukuCount: 0,
        hasBismillah: !!s[3],
        wordCount: 0,
        letterCount: 0,
      })),
    /**
     * **مفرداتُ مدًى من سورةٍ واحدة — مشتقّةٌ من الرسم لا مقروءةٌ من صرفٍ.**
     *
     * التلاوةُ لا تشحن جدولَ المفردات (جذورَه ولمّاتِه وقطعَه) — تلك مادّةُ
     * البحث في مشكاة. فتُشقّ الكلماتُ من الرسم **بالقسمة الواحدة**
     * (`ayahTokens` — وهي التي تَرسم بها الصفحةُ كلماتِها)، **وتُطرح منها
     * علاماتُ الوقف** فهي رموزُ قراءةٍ لا كلماتٍ تُنطق. وقد قِيس هذا بجدول مشكاة:
     * **٦٢٣٢ آيةً من ٦٢٣٦ يتطابق فيها عددُ الكلمات**، والأربعُ الباقيةُ
     * موضعُ «بَعْدَ مَا» يصلها الجدولُ كلمةً واحدة. **والصرفُ فارغٌ صريحًا**
     * (`root` و`lemma` بلا قيمة) فلا يظنّ قارئٌ أنّه ههنا.
     */
    wordsBetween: async (surahNo: number, fromAyah: number, toAyah: number): Promise<WordDoc[]> => {
      const out: WordDoc[] = [];
      for (let a = fromAyah; a <= toAyah && a <= AYAH_COUNTS[surahNo - 1]; a++) {
        const id = globalIdOf(surahNo, a);
        for (const t of ayahTokens(id, ayahs[id - 1].text)) {
          if (!t.no) continue; // علامةُ وقفٍ — تُرسم ولا تُنطق
          out.push({
            _id: `w${surahNo}:${a}:${t.no}`,
            location: `${surahNo}:${a}:${t.no}`,
            surahNo,
            ayahNo: a,
            wordNo: t.no,
            textUthmani: t.text,
            textClean: t.text,
            root: null,
            lemma: null,
            stemPos: null,
            segments: [],
          });
        }
      }
      return out;
    },
  });

  return { ayahs, pages, surahName, surahMeta, showsBismillah };
}

/** رمزُ وقفٍ قائمٌ بنفسه (ۖ ۗ ۘ ۙ ۚ ۛ …) — علامةُ قراءةٍ لا كلمة */
const WAQF_ONLY = /^[ۖ-ۭ]+$/;

/* ═══════════ **شقُّ الآية كلماتٍ — قسمةٌ واحدةٌ لا قسمتان** ═══════════
   صفحةُ المصحف تَرسم الكلماتِ عناصرَ ليجريَ عليها المؤشّر، والمنفذُ يُخرجها
   للمحاذاة — **فلو شُقّت مرّتين لانحرف ترقيمُ إحداهما عن الأخرى بصمت**،
   فيُظلَّل في الصفحة غيرُ ما يُطابَق في المحاذاة. فالقسمةُ ههنا وحدَها،
   ويقرأ منها الوجهان.

   وثلاثةُ أحكامٍ فيها:
   • **الفاصلُ مسافةٌ واحدة** — وقد قِيس على الملفّ نفسِه: ٦٢٣٦ آيةً ليس في
     رسمها إلّا `U+0020` مفردةً، ولا صدرَ فيها ولا عجزَ بفراغ. فالشقُّ بالمسافة
     وردُّها يُعيد النصَّ **حرفًا حرفًا**.
   • **وعلاماتُ الوقف تُرسم ولا تُرقَّم**: ۖ ۗ ۘ ۚ ۛ رموزُ قراءةٍ لا كلماتٍ
     تُنطق (٤٥٧٨ رمزًا قائمًا بنفسه في المصحف) — فتظهر في الصفحة كما هي،
     **ولا يجري عليها المؤشّر** ولا تدخل في عدّ الكلمات.
   • **ورقمُ الكلمة في آيتها مبدوءٌ بواحد** — وهو عينُ ترقيم `wordsBetween`
     أدناه، وعينُ صورة `"سورة:آية:كلمة"` التي يمسك بها التتبّع. */
export interface AyahToken {
  text: string;
  /** رقمُها في آيتها (١…) — و`0` لعلامة وقفٍ لا تُعدّ كلمة */
  no: number;
  /**
   * **رتبتُها في الآية للترتيب لا للتسمية**: للكلمة رقمُها، **ولعلامة الوقف رقمُ
   * الكلمة التي قبلها** — فتُحجب وتنكشف معها في حال التثبيت، ولا تبقى علامةٌ
   * عائمةٌ فوق بياضٍ تدلّ على مواضع الوقف فيما لم يُتلَ بعد.
   */
  ord: number;
}

/** يُشقّ ما يُنظر إليه لا المصحفُ كلُّه — والمشقوقُ يُحفظ فلا يُعاد شقُّه */
const cut = new Map<number, AyahToken[]>();

/** كلماتُ آيةٍ بعلاماتها — من رسمها كما هو، بلا حذفٍ ولا تحويل */
export function ayahTokens(ayahId: number, text: string): AyahToken[] {
  let toks = cut.get(ayahId);
  if (!toks) {
    let no = 0;
    toks = text.split(" ").map((t) => {
      const word = !WAQF_ONLY.test(t);
      if (word) no++;
      return { text: t, no: word ? no : 0, ord: no };
    });
    cut.set(ayahId, toks);
  }
  return toks;
}

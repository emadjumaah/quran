/**
 * **طبقةُ المواضع — لكلِّ غرضٍ موضعُه** (ج٤ §٣ · `SAWT-PLAN.md` §١٢، وأمرُ المالك
 * ١٤ أغسطس: «من يختم القرآن، أو يقرأ في الصلاة، أو يراجع حفظه، أو يتدرّب —
 * كلُّهم يجب أن يرجعوا إلى آخر مكانٍ وصلوا إليه»).
 *
 * **والعلّةُ التي كانت**: في المستودع ثلاثةُ أنظمةِ مواضعَ لا يعرف بعضُها بعضًا —
 * موضعُ القراءة (`quran-studio:last-read`)، وتقدّمُ الختمة (`recordProgress`)،
 * **وعلامةُ التتبّع (`sawt.mark.v1`) واحدةٌ لكلّ الأحوال**. فالرجلُ نفسُه: ختمتُه
 * في الجزء الثاني عشر، ومراجعتُه في النحل، وتثبيتُه في جزء عمّ — **وعلامةٌ واحدةٌ
 * تكتب على الأخرى فيعود إلى غير حيث وقف**، وهذا أسوأُ من ألّا يعود لأنّه يثق ثمّ
 * يُخذَل.
 *
 * **والحكم:**
 *   ١ — **مفتاحٌ مستقلٌّ لكلّ حال** تحت فضاءٍ واحدٍ (`quran-studio:mawdi:*`)،
 *       فلا يبقى نظامان يكتبان في معنًى واحد.
 *   ٢ — **والقديمُ يُقرأ ولا يُكتب**: مفاتيحُ من سبق تبقى في جهازه تُقرأ عند
 *       غياب الجديد — **فلا يفقد قارئٌ موضعَه في التحوّل**، ولا يُمحى ما كتبته
 *       نسخةٌ سابقة. (ومن كتب مرّةً بالجديد صار الجديدُ قولَه.)
 *   ٣ — **والختمةُ تقدّمٌ لا نقطة**: `recordProgress` في `bookmarks.ts` يحفظ
 *       **أقصى** ما بُلغ ولا ينقص، وهو صوابُها — **فيبقى على حاله ولا يُنقل
 *       ههنا**؛ وهذه الطبقةُ لموضع آخرِ وقوفٍ يتقدّم ويتأخّر.
 *   ٤ — **وحدٌّ يُعلَن ولا يُوعَد بخلافه**: المواضعُ **محلّيّةٌ لكلّ جهاز** —
 *       لا سيرفرَ عندنا؛ ومن قرأ على حاسوبه لا يجد موضعَه في هاتفه. **يُقال في
 *       اللوحة ولا يُكتم** (`LOCAL_ONLY_NOTE`).
 */

/** حالُ القراءة التي يُحفظ لها موضع — الأحوالُ الستُّ وقراءةُ المصحف */
export type MawdiId = "mushaf" | "salat" | "murajaa" | "tathbit" | "khatma" | "ard" | "talqin";

export interface Mawdi {
  /** `"سورة:آية"` أو `"سورة:آية:كلمة"` — صورةُ `runs.saveMark` نفسُها */
  location: string;
  /** ISO */
  at: string;
}

/** فضاءُ المفاتيح الواحد — ولا مفتاحَ خارجَه تكتبه هذه الطبقة */
const NS = "quran-studio:mawdi:";

/**
 * **مفاتيحُ ما قبلَ الطبقة** — تُقرأ ولا تُكتب:
 *  • `quran-studio:last-read` نصٌّ صريحٌ `"س:آ"` لموضع قراءة المصحف.
 *  • `sawt.mark.v1` كائنُ `{location, at}` — **وكان واحدًا لكلّ الأحوال**، فهو
 *    ميراثُ الجميع حتّى يكتب كلُّ حالٍ موضعَه بنفسه. (وهذه هي العلّةُ بعينها،
 *    فلا يُصطنع لها تفصيلٌ لم يُحفظ: يُقرأ ما كُتب لا ما يُظنّ.)
 */
const LEGACY_READ = "quran-studio:last-read";
const LEGACY_MARK = "sawt.mark.v1";

/** حدٌّ يُقال في اللوحة (§٣/٦) — ولا يُوعَد بخلافه */
export const LOCAL_ONLY_NOTE =
  "المواضعُ محفوظةٌ في هذا الجهاز وحدَه — فمن قرأ على حاسوبه لا يجدها في هاتفه، ولا نرفع من قراءتك شيئًا إلى خادم.";

const isLoc = (s: unknown): s is string => typeof s === "string" && /^\d+:\d+(:\d+)?$/.test(s);

function readRaw(key: string): Mawdi | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Mawdi;
    return isLoc(v?.location) ? { location: v.location, at: String(v.at ?? "") } : null;
  } catch {
    return null;
  }
}

/** موضعُ حالٍ بعينها — الجديدُ أوّلًا، ثمّ ميراثُ ما قبله */
export function readMawdi(id: MawdiId): Mawdi | null {
  const own = readRaw(NS + id);
  if (own) return own;
  if (id === "mushaf") {
    try {
      const s = localStorage.getItem(LEGACY_READ);
      if (isLoc(s)) return { location: s, at: "" };
    } catch {
      /* الجهازُ قد يمنع القراءة */
    }
    return null;
  }
  return readRaw(LEGACY_MARK);
}

/** **ولا يكتب أحدٌ إلّا ههنا** — مفتاحٌ واحدٌ لكلّ معنًى (§٣/١) */
export function saveMawdi(id: MawdiId, location: string): void {
  if (!isLoc(location)) return;
  try {
    localStorage.setItem(NS + id, JSON.stringify({ location, at: new Date().toISOString() }));
  } catch {
    /* الجهازُ قد يمنع التخزين — لا يُبطل القراءة */
  }
}

/**
 * **التصفيرُ لحالٍ بعينها** (§٣/٥): من صفّر مراجعتَه لم تُمحَ ختمتُه.
 * ويُمحى معه ميراثُ ما قبل الطبقة **لهذه الحال وحدَها** — وإلّا عاد الممحوُّ
 * من الباب الخلفيّ فبدا التصفيرُ كذبًا.
 */
export function clearMawdi(id: MawdiId): void {
  try {
    localStorage.removeItem(NS + id);
    if (id === "mushaf") localStorage.removeItem(LEGACY_READ);
    else localStorage.removeItem(LEGACY_MARK);
  } catch {
    /* لا شيء */
  }
}

/** كلُّ المواضع لعرضها في لوحةٍ واحدة */
export function listMawadi(ids: MawdiId[]): { id: MawdiId; mawdi: Mawdi | null }[] {
  return ids.map((id) => ({ id, mawdi: readMawdi(id) }));
}

/** `"٢:٢٥٥"` ⇐ `{ surahNo: 2, ayahNo: 255 }` — والكلمةُ إن كانت */
export function parseMawdi(m: Mawdi | null): { surahNo: number; ayahNo: number; wordNo?: number } | null {
  if (!m || !isLoc(m.location)) return null;
  const [s, a, w] = m.location.split(":").map(Number);
  return { surahNo: s, ayahNo: a, ...(w ? { wordNo: w } : {}) };
}

/**
 * **الالتقاطُ من أيّ آية** — أن يفتح القارئُ فيتلوَ من حيث شاء فيُلتقَط موضعُه.
 *
 * طلبُ المالك (١٤ أغسطس): «أقرأ من أيّ آيةٍ من القرآن، هل يلتقطها؟». وكان
 * الجوابُ **لا**: المحاذاةُ تلتمس في نافذةٍ ضيّقةٍ حول المؤشّر (عشرٌ أمامًا
 * وثلاثٌ خلفًا)، فمن بدأ بعيدًا عن المؤشّر لم يُلتقَط.
 *
 * **والأداةُ قائمةٌ ولا تُبتكَر**: **الثلاثيّة** — ثلاثُ كلماتٍ متتاليةٍ **داخل
 * الآية الواحدة** (وهي عينُ ما تفهرسه بوّابةُ التتبّع منذ ص-م١) — ثلاثيّةٌ
 * تُخرج موضعًا أو مواضع.
 *
 * ### الضوابطُ الخمسةُ التي هي لبُّ الباب
 *
 * ١) **المحلّيُّ أوّلًا دائمًا** — لا يُستدعى هذا إلّا حين تخيب المحاذاةُ
 *    القريبة. فهو **مخرجٌ عند الضياع لا محرّكُ تتبّع**.
 * ٢) **ولا يُقفَز إلّا على مطابقةٍ فاصلة**: الثلاثيّةُ المكرّرةُ تُخرج مواضعَ،
 *    **فلا يُقفَز حتّى تنحصر بواحد** بضمّ ما بعدها من كلمات. **والانتظارُ خيرٌ
 *    من قفزةٍ كاذبة** — وهي أضرُّ ما في الباب، وفي وضع التثبيت تكشف ما لم يُتلَ.
 * ٣) **ويعمل خلفًا كما يعمل أمامًا** — وبه يُفرَّق بين **الترجيع** (القارئُ يعيد
 *    ما تلاه قريبًا، فيبقى المؤشّر) و**الابتداء من موضعٍ سابقٍ قصدًا** (فيُلتقَط):
 *    ما وقع في جوار المؤشّر فهو ترجيعٌ يتولّاه المحلّيّ، وما بعُد فهو ابتداء.
 * ٤) **ولا يُصدَّق الفهرسُ وحدَه**: كلُّ مرشَّحٍ **يُتحقَّق منه بمقابلة الكلمات
 *    كلِّها** بنصّ المصحف في موضعه — فلا يقع قفزٌ على مطابقةٍ ثلاثيّةٍ عارضة.
 * ٥) **ويعمل داخل المقطع المختار** — التصفيةُ بشرط الانتماء نفسِه (`inSegment`).
 *
 * **ولا وزنَ لهذا الفهرس على السلك**: يُبنى في الجهاز من قاعدة المصحف التي عنده
 * أصلًا، **وعند الحاجة لا عند الإقلاع** — فلا بايتَ يُنزَّل لأجله.
 */
import { allAyahs } from "../../db";
import { normalizeAr } from "../arabicSearch";
import type { AyahRef } from "./script";

/** صفٌّ من صفوف المصحف كما يدخل هذا الفهرس — **نصٌّ وموضعُه لا غير** */
export interface IltiqatRow {
  surahNo: number;
  ayahNo: number;
  juz: number;
  page: number;
  text: string;
}

/** موضعٌ في المصحف كما يخرج من الفهرس */
export interface IltiqatHit extends AyahRef {
  /** رقمُ الكلمة في آيتها، مبدوءًا بواحد — على صورة `runs.saveMark` */
  wordNo: number;
  /** موضعُها "سورة:آية:كلمة" */
  location: string;
  /** ترتيبُها في كلمات المصحف كلِّه — به يُقاس البعدُ عن المؤشّر */
  flat: number;
}

/** أقلُّ ما تُبنى به ثلاثيّة */
export const TRIGRAM = 3;

/**
 * فهرسٌ ساكنٌ يُبنى مرّةً: ثلاثيّةٌ ⇒ مواضعُ، ومعه صفُّ كلمات المصحف مطبَّعًا
 * لتُقابَل به المرشَّحاتُ كلمةً كلمة.
 */
export class IltiqatIndex {
  /** كلماتُ المصحف مطبَّعةً بترتيبه */
  private readonly words: string[] = [];
  /** لكلّ كلمةٍ: فهرسُ آيتها في `refs` */
  private readonly ayahOf: number[] = [];
  /** لكلّ كلمةٍ: رقمُها في آيتها مبدوءًا بواحد */
  private readonly noInAyah: number[] = [];
  private readonly refs: AyahRef[] = [];
  /** ثلاثيّةٌ ⇒ مواضعُ ظهورها في `words` */
  private readonly index = new Map<string, number[]>();
  /** "سورة:آية" ⇒ موضعُ أوّل كلماتها — به يُترجَم موضعُ المؤشّر إلى ترتيبٍ عامّ */
  private readonly ayahStart = new Map<string, number>();

  constructor(rows: IltiqatRow[]) {
    for (const r of rows) {
      const ai = this.refs.length;
      this.refs.push({ surahNo: r.surahNo, ayahNo: r.ayahNo, juz: r.juz, page: r.page });
      this.ayahStart.set(`${r.surahNo}:${r.ayahNo}`, this.words.length);
      const toks = normalizeAr(r.text).split(" ").filter(Boolean);
      const base = this.words.length;
      for (let i = 0; i < toks.length; i++) {
        this.words.push(toks[i]);
        this.ayahOf.push(ai);
        this.noInAyah.push(i + 1);
      }
      // **الثلاثيّةُ داخلَ الآية الواحدة** — فلا تُلفَّق ثلاثيّةٌ عبر آيتين
      for (let i = 0; i + TRIGRAM - 1 < toks.length; i++) {
        const key = toks.slice(i, i + TRIGRAM).join(" ");
        const at = this.index.get(key);
        if (at) at.push(base + i);
        else this.index.set(key, [base + i]);
      }
    }
  }

  get wordCount(): number {
    return this.words.length;
  }
  get trigramCount(): number {
    return this.index.size;
  }

  /** موضعٌ "سورة:آية:كلمة" ⇒ ترتيبُه في كلمات المصحف — أو `null` إن لم يُعرف */
  flatOf(location: string): number | null {
    const [s, a, w] = location.split(":").map(Number);
    const start = this.ayahStart.get(`${s}:${a}`);
    if (start == null) return null;
    return start + (Number.isFinite(w) ? Math.max(0, w - 1) : 0);
  }

  /** موضعُ كلمةٍ بترتيب المصحف ⇒ إحالتُها الكاملة */
  hitAt(flat: number): IltiqatHit {
    const ref = this.refs[this.ayahOf[flat]];
    const wordNo = this.noInAyah[flat];
    return { ...ref, wordNo, location: `${ref.surahNo}:${ref.ayahNo}:${wordNo}`, flat };
  }

  /**
   * **يلتمس المواضعَ التي تطابق هذه الرموزَ كلَّها.**
   *
   * والرموزُ ما خرج من المحرّك مطبَّعًا. فتُؤخذ أوّلُ ثلاثيّةٍ منها فهرسًا، ثمّ
   * **يُتحقَّق من كلّ مرشَّحٍ بمقابلة الرموز كلِّها** بنصّ المصحف عنده — فلا
   * يُصدَّق الفهرسُ وحدَه. **ويُتسامح في رمزٍ واحدٍ لا يطابق** لكلّ خمسةٍ، فمحرّكُ
   * التعرّف يُبدّل ويُسقط، والتشدّدُ يمنع الالتقاطَ أصلًا.
   *
   * ويرجع **كلَّ** ما وجد: فالحكمُ بالانحصار لمن يستدعيه، لا لهذا.
   */
  find(tokens: string[], limit = 24): IltiqatHit[] {
    if (tokens.length < TRIGRAM) return [];
    const seeds = this.index.get(tokens.slice(0, TRIGRAM).join(" "));
    if (!seeds) return [];
    const out: IltiqatHit[] = [];
    const slack = Math.floor(tokens.length / 5);
    for (const at of seeds) {
      let bad = 0;
      for (let i = TRIGRAM; i < tokens.length; i++) {
        if (this.words[at + i] !== tokens[i]) bad++;
        if (bad > slack) break;
      }
      if (bad <= slack) out.push(this.hitAt(at));
      if (out.length > limit) return out.slice(0, limit);
    }
    return out;
  }
}

/**
 * **الحكمُ على الالتماس** — وفيه يقع الضابطُ الثاني والثالث.
 *
 * `jump` لا يخرج إلّا على **مطابقةٍ فاصلةٍ بعيدةٍ عن المؤشّر**؛ وما سواه إمّا
 * **ترجيعٌ** (قريبٌ فيُترك للمحلّيّ) أو **مواضعُ لم تنحصر** (فيُنتظر ما يُضيّقها).
 */
export type IltiqatVerdict =
  | { kind: "none" }
  | { kind: "near" }
  | { kind: "many"; count: number }
  | { kind: "jump"; hit: IltiqatHit };

/** ما دون هذا البعدِ من المؤشّر ترجيعٌ لا ابتداء — والمحلّيُّ أولى به */
export const NEAR_WORDS = 12;

export function judge(
  index: IltiqatIndex,
  tokens: string[],
  /** شرطُ الانتماء إلى المقطع المختار — يُمرَّر `inSegment` نفسُه من موضع النداء */
  within: (a: AyahRef) => boolean,
  cursorFlat: number | null,
): IltiqatVerdict {
  const hits = index.find(tokens).filter((h) => within(h));
  if (!hits.length) return { kind: "none" };
  if (hits.length > 1) return { kind: "many", count: hits.length };
  const hit = hits[0];
  if (cursorFlat != null && Math.abs(hit.flat - cursorFlat) <= NEAR_WORDS) return { kind: "near" };
  return { kind: "jump", hit };
}

/* ═══════════ البناءُ عند الحاجة لا عند الإقلاع ═══════════ */

let building: Promise<IltiqatIndex> | null = null;
let built: IltiqatIndex | null = null;
/** زمنُ البناء بالمللي — يُقاس ولا يُقدَّر، وتقرؤه البوّابةُ الحيّة */
export let buildMs: number | null = null;

export const iltiqatReady = (): IltiqatIndex | null => built;

/**
 * يُبنى مرّةً واحدةً ويبقى، **من قاعدة المصحف التي في الجهاز** — فلا طلبَ شبكةٍ
 * ولا أصلَ يُنزَّل. والنداءُ الثاني يجد الأوّلَ فلا يُبنى مرّتين.
 */
export function loadIltiqat(): Promise<IltiqatIndex> {
  if (built) return Promise.resolve(built);
  if (building) return building;
  building = allAyahs()
    .then((rows) => {
      const t0 = performance.now();
      // **بترتيب المصحف صراحةً** — فالبعدُ عن المؤشّر يُقاس بهذا الترتيب، ولا
      // يُتّكل على ترتيبِ ما يخرج من القاعدة.
      const ordered = [...rows].sort((a, b) => a.surahNo - b.surahNo || a.ayahNo - b.ayahNo);
      const idx = new IltiqatIndex(
        ordered.map((w) => ({
          surahNo: w.surahNo,
          ayahNo: w.ayahNo,
          juz: w.juz,
          page: w.page,
          text: w.textUthmani,
        })),
      );
      buildMs = Math.round(performance.now() - t0);
      built = idx;
      return idx;
    })
    .catch((e) => {
      building = null;
      throw e;
    });
  return building;
}

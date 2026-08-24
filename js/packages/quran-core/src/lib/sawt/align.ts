/**
 * محرّكُ المحاذاة — قلبُ «التتبّع بالصوت».
 *
 * **الحدُّ الفاصل**: النصُّ معلومٌ سلفًا، فالمسألة ليست «ماذا قال؟» بل «أين هو
 * الآن من نصٍّ نعرفه؟» — وهذا يقلبها من تعرُّفٍ مفتوح إلى **مطابقةٍ على نافذةٍ
 * متوقَّعة**، فيكفيها محرّكٌ متواضعُ الدقّة.
 *
 * أربعةُ قيودٍ يقوم عليها هذا الملفّ:
 *
 *   ١) **التطبيعُ بأدواتنا القائمة لا بجديد**: `lib/arabicSearch` — ويمرّ به
 *      **الطرفان** (كلمةُ المصحف وما يُخرجه المحرّك) بالدالّة نفسِها. هذا عقدُ
 *      بلاغ الحدود: المصطلحُ يمرّ بمُطبِّع النصّ.
 *   ٢) **المطابقةُ تسامحيّة** على المطبَّع، لأنّ محرّكات التعرّف تُخرج نصًّا
 *      معياريًّا لا تلاوةً — فتُقبل مسافةُ تحريرٍ محدودةٌ بطول الكلمة، وتُقبل
 *      المطابقةُ بالجذع (`stemAr`) حين يزيد المحرّكُ سابقةً أو ينقصها.
 *   ٣) **لا نقفز ولا نخمّن**: إن تعذّرت المطابقة بقي المؤشّرُ مكانَه وانتظر.
 *      والاستردادُ الواسعُ لا يقع إلّا بمطابقةٍ **وحيدةٍ** لا لبس فيها — ولذلك
 *      يُجرَّب المقطعُ الأطولُ أوّلًا (٥ كلمات) ثمّ ما دونه؛ فإن تعدّدت
 *      المواضعُ (وهو حالُ المتشابهات: ﴿ولا أنتم عابدون ما أعبد﴾ في الكافرون
 *      موضعان) **لم نقفز**.
 *   ٤) **الميلُ إلى الكشف عند الشكّ لا إلى الحبس**: نافذةُ التوقّع أمامًا أوسعُ
 *      منها خلفًا، ولا يُرجَع بالمؤشّر إلى الوراء بحالٍ — فترجيعُ القارئ
 *      لكلمةٍ أو تكرارُه إيّاها لا يقهقر المؤشّر.
 *
 * وهذا الملفُّ **صافٍ** (لا DOM ولا محرّك ولا زمن): مدخلُه كلماتٌ مطبَّعة
 * ومخرجُه موضعٌ ووقائع — فيصلح للفحص بيدٍ وللقياس.
 */
import { normalizeAr, stemAr } from "../arabicSearch";

/** إعداداتُ المحاذاة — كلُّها معلنةٌ ومقيسة، ولا رقمَ سحريًّا في المتن. */
export interface AlignConfig {
  /** نافذةُ التوقّع أمامًا (كلمات) */
  ahead: number;
  /** نافذةُ التوقّع خلفًا — للترجيع والتكرار، ولا يتحرّك بها المؤشّر */
  back: number;
  /** كم رمزًا متتاليًا غيرَ مطابقٍ يُعدُّ «فقدًا» فيُطلَب الاستردادُ الواسع */
  lostRun: number;
  /** أطولُ مقطعٍ يُجرَّب في الاسترداد الواسع ثمّ ينزل إلى ٣ */
  relockGramMax: number;
  /** أقصرُ مقطعٍ يُقبل في الاسترداد الواسع */
  relockGramMin: number;
}

/**
 * **والميلُ إلى التسامح** (حدُّ الإدارة، `findings/sawt/M1-MULHAQ-IDARA.md` §٣):
 * إن اختلف المسموعُ عن المتوقَّع فلا سبيلَ في هذه الطبقة إلى تمييز «أخطأ
 * القارئُ» من «أخطأ المحرّك» — فيُدفع التصميمُ إلى نافذةٍ أوسعَ ومطابقةٍ أسمحَ
 * وميلٍ إلى المضيّ لا الوقوف. ولذلك النافذةُ **عشرٌ** أمامًا لا ثمانٍ.
 */
export const DEFAULT_ALIGN: AlignConfig = {
  ahead: 10,
  back: 3,
  lostRun: 3,
  relockGramMax: 5,
  relockGramMin: 3,
};

/**
 * ما جاوز هذا البعدَ من موضع المؤشّر لا يُطابَق إلّا **تطابقًا أو بالجذع** —
 * لا بمسافة تحرير. فالتسامحُ مطلوبٌ لملازمة القارئ، لا لإلقائه بعيدًا: كلمةٌ
 * مشوّشةٌ من المحرّك قد تُشبه كلمةً على بعد تسعِ كلماتٍ فتصير قفزةً كاذبة،
 * والقفزةُ الكاذبةُ أضرُّ من الانتظار (وفي وضع الكشف تكشف ما لم يُتلَ بعدُ).
 */
const STRICT_BEYOND = 5;

/* ═══════════════ التطبيعُ والمطابقةُ التسامحيّة ═══════════════ */

/** كلماتُ ما يصل من المحرّك، مطبَّعةً بمُطبِّع النصّ نفسِه (لا بمطبِّعٍ ثانٍ). */
export const speechTokens = (s: string): string[] =>
  normalizeAr(s).split(" ").filter(Boolean);

/** مسافةُ التحرير، مقطوعةً عند سقفٍ (فلا نحسب ما لا نحتاجه). */
export function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return false;
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[b.length] <= max;
}

/**
 * المطابقةُ التسامحيّة بين كلمةِ مصحفٍ مطبَّعةٍ وكلمةٍ من المحرّك مطبَّعة.
 *
 * ثلاثُ مراتبَ متنازلةُ الثقة، وكلٌّ منها مقيَّدٌ كي لا يبتلع جارَه:
 *   • **التطابق**: بعد التطبيع — وهو الأصل.
 *   • **الجذع**: `stemAr` على الطرفين (السوابقُ المتّصلة واللواحقُ الضميريّة) —
 *     ولا يُقبل إلّا لجذعٍ ثلاثيٍّ فأكثر.
 *   • **مسافةُ التحرير**: ميزانيّةٌ بطول الكلمة — **صفرٌ للقصار** (فـ«من» و«عن»
 *     لا تلتقيان)، وواحدٌ للمتوسّط بشرط اتّفاق الحرف الأوّل، واثنان للطوال.
 */
export function tolerantEq(a: string, b: string, strict = false): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = stemAr(a);
  const sb = stemAr(b);
  if (sa.length >= 3 && sa === sb) return true;
  if (strict) return false;
  const max = Math.max(a.length, b.length);
  if (max <= 4) return false;
  if (max <= 7) return a[0] === b[0] && editDistanceAtMost(a, b, 1);
  return editDistanceAtMost(a, b, 2);
}

/* ═══════════════ خطوةُ المحاذاة ═══════════════ */

/** واقعةُ استردادٍ واسع — بها تُقاس مسافةُ الاسترداد في المحكّ */
export interface RelockEvent {
  /** الموضعُ الذي كان عليه المؤشّرُ حين انقطعت المطابقة */
  fromCursor: number;
  /** الموضعُ الذي عاد إليه */
  to: number;
  /** كم رمزًا متتاليًا لم يُطابَق قبل أن يعود — وهي مسافةُ الاسترداد */
  after: number;
}

/** واقعةُ كلمةٍ في مسار المؤشّر */
export interface AlignStep {
  /** الموضعُ بعد المعالجة: فهرسُ الكلمة المتوقَّعة التالية */
  cursor: number;
  /** فهارسُ كلماتٍ طوبقت مطابقةً مباشرة */
  matched: number[];
  /** فهارسُ كلماتٍ تخطّاها المؤشّرُ ولم يقرَّها */
  skipped: number[];
  /** عددُ رموز المحرّك التي لم تُطابَق البتّة */
  unmatched: number;
  /** أطولُ سلسلةِ رموزٍ غيرِ مطابقةٍ متتالية — بها يُعرَف الفقد */
  longestUnmatchedRun: number;
  /**
   * وقائعُ الاسترداد الواسع في هذه الخطوة. **وتُنشر كلُّها لا آخرُها**: قد
   * ينقطع التتبّعُ ويعود داخلَ الجملة الواحدة، فلو لم تُسجَّل هذه لبقي شرطُ
   * الاسترداد في المحكّ بلا مادّةٍ يُقاس عليها — وهو عيبٌ كشفته مسابرُ
   * المحاذاة قبل أن يتلوَ أحدٌ بصوته.
   */
  relocks: RelockEvent[];
  /** تعذّرت المطابقةُ وتعدّدت المواضعُ فلم نقفز */
  ambiguous: boolean;
}

interface Hit {
  /** أوّلُ كلمةٍ في المصحف شملها التطابق */
  at: number;
  /** آخرُ كلمةٍ شملها التطابق (تُساوي at إلّا حين يجمع رمزٌ واحدٌ كلمتين) */
  to: number;
  /** كم رمزًا من المحرّك استهلك هذا التطابق (١ أو ٢) */
  consumed: number;
}

/**
 * التماسُ الرمز في نافذة التوقّع أمامًا — والأقربُ أولى.
 * وتُعالَج فيه اختلافاتُ حدِّ الكلمة بين رسم المصحف وإملاء المحرّك في الوجهين:
 * كلمةُ مصحفٍ يُخرجها المحرّكُ رمزين، ورمزٌ واحدٌ يجمع كلمتين («بعد ما» /
 * «بعدما» — وهو خلافٌ قائمٌ في مادّتنا نفسِها، لا في المحرّك وحدَه).
 */
function findAhead(
  script: string[],
  pos: number,
  ahead: number,
  tok: string,
  next: string | undefined,
): Hit | null {
  const end = Math.min(script.length - 1, pos + ahead);
  for (let j = pos; j <= end; j++) {
    const strict = j - pos > STRICT_BEYOND;
    if (tolerantEq(script[j], tok, strict)) return { at: j, to: j, consumed: 1 };
    if (next && tolerantEq(script[j], tok + next, strict)) return { at: j, to: j, consumed: 2 };
    if (j + 1 < script.length && tolerantEq(script[j] + script[j + 1], tok, strict)) {
      return { at: j, to: j + 1, consumed: 1 };
    }
  }
  return null;
}

/** التماسُ الرمز خلفَ المؤشّر — للترجيع والتكرار: يُعرَف ولا يُحرَّك به المؤشّر. */
function foundBehind(script: string[], pos: number, back: number, tok: string): boolean {
  const start = Math.max(0, pos - back - 1);
  for (let j = start; j < pos; j++) if (tolerantEq(script[j], tok)) return true;
  return false;
}

/**
 * محاذاةُ ما وصل من المحرّك على النصّ، ابتداءً من مِرساة.
 *
 * **ولمَ من المرساة لا من آخر موضع؟** لأنّ نتائج المحرّك الجزئيّةَ تُراجَع
 * وتُبدَّل وهي تنمو («الله» ثمّ «الله الرحمن»)، فلو استهلكناها زيادةً على زيادة
 * لحسبنا الكلمةَ الواحدةَ مرارًا. فنُعيد محاذاةَ الجملة كلِّها من مرساتها في كلِّ
 * مرّة — فتكون الخطوةُ **حتميّةً لا تتأثّر بعدد المرّات**.
 */
export function alignUtterance(
  script: string[],
  tokens: string[],
  anchor: number,
  cfg: AlignConfig = DEFAULT_ALIGN,
): AlignStep {
  let pos = Math.max(0, Math.min(anchor, script.length));
  const matched: number[] = [];
  const skipped: number[] = [];
  let unmatched = 0;
  let run = 0;
  let longestRun = 0;
  const relocks: RelockEvent[] = [];
  let ambiguous = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const hit = pos < script.length ? findAhead(script, pos, cfg.ahead, tok, tokens[i + 1]) : null;
    if (hit) {
      for (let j = pos; j < hit.at; j++) skipped.push(j);
      for (let j = hit.at; j <= hit.to; j++) matched.push(j);
      pos = hit.to + 1;
      if (hit.consumed === 2) i++;
      run = 0;
      continue;
    }
    if (foundBehind(script, pos, cfg.back, tok)) {
      // ترجيعٌ أو تكرار — معروفٌ ولا يقهقر المؤشّر
      run = 0;
      continue;
    }
    unmatched++;
    run++;
    if (run > longestRun) longestRun = run;
    if (run >= cfg.lostRun) {
      const tail = tokens.slice(Math.max(0, i - cfg.relockGramMax + 1), i + 1);
      const found = relock(script, tail, pos, cfg);
      if (found == null) {
        ambiguous = true;
      } else {
        relocks.push({ fromCursor: pos, to: found.at, after: run });
        for (let j = found.at; j <= found.to; j++) matched.push(j);
        pos = found.to + 1;
        run = 0;
      }
    }
  }

  return {
    cursor: pos,
    matched,
    skipped,
    unmatched,
    longestUnmatchedRun: longestRun,
    relocks,
    ambiguous,
  };
}

/**
 * الاستردادُ الواسع: التماسُ آخر ما تُلي في النصّ كلِّه.
 *
 * **وشرطُه الوحدانيّة**، على درجتين:
 *   ١) يُجرَّب المقطعُ **الأطولُ أوّلًا** (أدلُّ على موضعه)، فإن لم يُصَب به
 *      موضعٌ ألبتّةَ — وذلك حين يخطئ المحرّكُ في بعض ما أخرج — نزلنا إلى ما
 *      دونه. أمّا إن تعدّدت المواضعُ بالمقطع الأطول **فلا نزول**: الأقصرُ
 *      أعمُّ فمواضعُه أكثر، فالنزولُ لا يجلب وحدانيّةً.
 *   ٢) وتُقصر المواضعُ على ما **عند المؤشّر أو أمامَه** (بتسامحِ نافذةِ الخلف)،
 *      لأنّ التلاوةَ مطّردةٌ إلى الأمام. وليس هذا تخمينًا بل استعمالٌ لقيدٍ
 *      قائم؛ فإن بقي بعد القصر أكثرُ من موضعٍ **لم نقفز**.
 *
 * وهذا هو مَخرجُ المتشابهات: ﴿ولا أنتم عابدون ما أعبد﴾ في الكافرون موضعان،
 * فإن كان القارئُ في أوّلهما لم نُلقِ به في الثاني. والقفزُ الخاطئُ أضرُّ من
 * الانتظار: في وضع الكشف يكشف ما لم يبلغه القارئُ بعدُ فيُفسد التحفيظ.
 */
export function relock(
  script: string[],
  tail: string[],
  from: number,
  cfg: AlignConfig = DEFAULT_ALIGN,
): { at: number; to: number } | null {
  for (let g = Math.min(cfg.relockGramMax, tail.length); g >= cfg.relockGramMin; g--) {
    const gram = tail.slice(tail.length - g);
    const hits: { at: number; to: number }[] = [];
    for (let s = 0; s + gram.length <= script.length; s++) {
      let ok = true;
      for (let k = 0; k < gram.length; k++) {
        if (!tolerantEq(script[s + k], gram[k])) {
          ok = false;
          break;
        }
      }
      if (ok) hits.push({ at: s, to: s + gram.length - 1 });
    }
    if (hits.length === 0) continue; // خطأٌ في ذيل ما أخرجه المحرّك — جرِّب أقصر
    const forward = hits.filter((h) => h.at >= from - cfg.back);
    return forward.length === 1 ? forward[0] : null;
  }
  return null;
}

/**
 * جسرُ الفجوات الصغيرة — «التقدّمُ المُقَرّ» في تعريف الإصابة.
 *
 * الكلمةُ التي لم يُطابقها المحرّكُ نصًّا لكنّ القارئَ **أثبت مرورَه بها**
 * (طوبق ما قبلها وما بعدها والفجوةُ ≤ الحدّ) تُحسب مُقَرّةً بالجوار: فمحرّكاتُ
 * التعرّف تُسقط الكلمات القصيرة كثيرًا، وإسقاطُها ليس فوتًا في التتبّع.
 * وما جاوز الحدَّ **فائتٌ** يُحسب على المحرّك بلا اعتذار.
 */
export function bridgeGaps(
  matched: Set<number>,
  first: number,
  last: number,
  maxGap = 2,
): Set<number> {
  const bridged = new Set<number>();
  let prev = -1;
  for (let i = first; i <= last; i++) {
    if (!matched.has(i)) continue;
    if (prev >= 0 && i - prev - 1 > 0 && i - prev - 1 <= maxGap) {
      for (let j = prev + 1; j < i; j++) bridged.add(j);
    }
    prev = i;
  }
  return bridged;
}

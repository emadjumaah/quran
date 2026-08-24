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
  /**
   * **ما اصطيد من انزلاقٍ إلى نظيرة** — وهي **فارغةٌ أبدًا ما لم يُفتح بابُ
   * الاصطياد** بإعدادٍ مُمرَّر؛ فمن يقرأ ولا يُسمِّع لا يمسّه من هذا شيء.
   */
  hunts: HuntEvent[];
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
  hunt?: HuntConfig,
): AlignStep {
  let pos = Math.max(0, Math.min(anchor, script.length));
  const matched: number[] = [];
  const skipped: number[] = [];
  let unmatched = 0;
  let run = 0;
  let longestRun = 0;
  const relocks: RelockEvent[] = [];
  const hunts: HuntEvent[] = [];
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
    /* **ههنا حادت الكلمةُ عن نصّ الآية** — وههنا وحدَه يُلتمس فرعُ النظيرة.
       **وهو التماسٌ محضٌ**: لا يمسّ المؤشّرَ ولا العدَّ ولا الاستردادَ بحرف. */
    if (hunt && !hunts.length) {
      /* **انزلاقٌ واحدٌ للجملة الواحدة**: تُعاد محاذاةُ الجملة من مرساتها كلَّما
         نمت، فلو التُمس عند كلّ رمزٍ حائدٍ لتكرّر الخبرُ الواحدُ بوجوهٍ شتّى. */
      const ev = huntAt(script, tokens, i, pos, hunt);
      if (ev) hunts.push(ev);
    }
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
    hunts,
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

/* ═══════════════ الاصطيادُ الصوتيّ — بابٌ مغلقٌ ما لم يُفتح ═══════════════ */

/**
 * **التسميعُ يمسك الانزلاقَ إلى النظيرة.**
 *
 * الحافظُ لا يُخطئ في مطلع الآية؛ يُخطئ **عند نقطة التفرّع**: يبلغ العبارةَ
 * المشتركةَ بين موضعين، فينزلق إلى نظيرتها في سورةٍ أخرى **ويمضي فيها**. وهذا
 * القسمُ يمسك ذلك الانزلاقَ من محاذاة ما يُسمع على **نصَّي الزوج معًا**.
 *
 * ### أربعةُ قيودٍ تحكمه
 *
 * ١) **بابٌ مغلقٌ ما لم يُفتح**: لا يعمل منه حرفٌ ما لم يُمرَّر `HuntConfig` —
 *    فالمصلّي والقارئُ العاديُّ لا يمسّهما شيء، وسلوكُ المحاذاة القائمُ لا
 *    يتبدّل بحرف. وهذا شرطٌ في التصميم لا وعدٌ في تعليق.
 * ٢) **الفهرسُ يُمرَّر ولا يُقرأ**: المحاذاةُ لا تفتح ملفًّا ولا تعرف «فروق
 *    التنزيل» — يُبنى الفهرسُ في التطبيق ويُسلَّم إليها إعدادًا.
 * ٣) **العتبةُ صارمةٌ معلَنةٌ باسمها**: ثلاثُ كلماتٍ متتالياتٍ **حصريّة** —
 *    **فاتّهامُ قارئٍ مصيبٍ بالانزلاق أفدحُ من تفويت انزلاق**. ومن ثَمّ كان
 *    التماسُ التهمة **صارمًا** (تطابقٌ أو جذعٌ لا مسافةَ تحرير) والتماسُ
 *    البراءة **تسامحيًّا أوسعَ نافذة**: يُبرَّأ بأدنى شبهةٍ ولا يُتَّهم إلّا
 *    ببيّنة.
 * ٤) **خبرٌ لا حكم**: تُرفع الواقعةُ إلى السطح، وهو يتولّى موضعَ الإعلان
 *    بمراتب القرار — **ولا مقاطعةَ في أثناء الجريان بحال**.
 *
 * **وما لا يصطاده معلَنٌ**: مفرقٌ يتّفق فيه ما بعد الوجهين (﴿يُذَبِّحُونَ﴾ /
 * ﴿يُقَتِّلُونَ﴾ ثمّ ﴿أَبْنَآءَكُمْ﴾ في الآيتين) لا تقوم به ثلاثُ كلماتٍ حصريّة —
 * فيمرّ ولا يُقال فيه شيء. وذلك مقتضى العتبة لا نقصٌ فيها.
 */

/** **العتبةُ** — كم كلمةً متتاليةً حصريّةً يثبت بها الانزلاق (رقمٌ معلَنٌ مسمًّى) */
export const HUNT_RUN = 3;

/**
 * **أقصى ما يُتخطّى من كلمات الفرع بين مطابقتين** — محرّكاتُ التعرّف تُسقط
 * الكلماتِ القصيرةَ كثيرًا، فلو لزم اللحاقُ كلمةً بكلمةٍ لضاع كلُّ انزلاقٍ حقّ.
 */
export const HUNT_STEP = 2;

/**
 * **نافذةُ البراءة** — أيُّ مطابقةٍ لهذا الرمز في هذا القدر من نصّ الآية التي
 * هو فيها **تُسقط الحصريّة** فيُقطع العدّ. **وهي أوسعُ من نافذة التهمة قصدًا.**
 *
 * **وهي مثبَّتةٌ عند المفرق لا تسير مع الرمز**: لو سارت لجازت كلمةٌ شاردةٌ
 * تطابق ما بعدَ الآية فتُقدّمها، **فيخرج من نافذة البراءة ما كان فيها** ويُتَّهم
 * عائدٌ إلى الصواب. والعتبةُ إنّما تُبلغ بثلاثٍ من موضع المفرق، وهنّ في النافذة.
 */
export const HUNT_CLEAR = 8;

/** مفرقٌ واحدٌ في زوج — بموضعه من الآيتين ووجهيه رسمًا */
export interface HuntFork {
  /** رقمُ كلمة المفرق في الآية التي يتلوها (مبدوءٌ بواحد) */
  here: number;
  /** رقمُها في فرع النظيرة (مبدوءٌ بواحد) */
  there: number;
  /** الوجهان **رسمًا كما في المصحف** — و`null` أنّ الآيةَ تنتهي ههنا */
  faceHere: string | null;
  faceThere: string | null;
}

/** نظيرةُ آيةٍ: فرعُها الذي يمضي فيه المنزلق، ومفارقُها */
export interface HuntPair {
  /** مفتاحُ الزوج — **وهو مفتاحُ سجلّ الخلط نفسُه** فتلتقي التسميعةُ والتدريب */
  key: string;
  /** موضعُ النظيرة «سورة:آية» */
  there: string;
  /**
   * **فرعُها**: كلماتُها مطبَّعةً **وما يليها في المصحف**. ولِمَ يُضمّ ما يليها؟
   * لأنّ المفرقَ قد يقع في آخر الآية، فلا يبقى بعده من النظيرة إلّا كلمةٌ
   * واحدةٌ لا تبلغ العتبةَ أبدًا — **والانزلاقُ إنّما يثبت بما يمضي فيه
   * المنزلق**، وهو ما بعد النظيرة من المصحف.
   */
  branch: string[];
  forks: HuntFork[];
}

/** «سورة:آية» ⇐ ما لها من نظائر */
export type HuntIndex = Map<string, HuntPair[]>;

/** إعدادُ الاصطياد — **تمريرُه فتحُ الباب، وتركُه إغلاقُه** */
export interface HuntConfig {
  index: HuntIndex;
  /** موضعُ كلمةٍ من النصّ «سورة:آية:كلمة» — دالّةٌ فلا تُنسخ مصفوفةٌ في كلّ خطوة */
  locOf: (i: number) => string | undefined;
}

/** واقعةُ اصطياد — **الزوجُ · موضعُ المفرق · الوجهان** */
export interface HuntEvent {
  key: string;
  /** الآيةُ التي كان يتلوها «سورة:آية» */
  here: string;
  /** النظيرةُ التي جرى عليها «سورة:آية» */
  there: string;
  /** موضعُ الوميض «سورة:آية:كلمة» — كلمةُ المفرق، أو آخرُ كلمةٍ إن كان مفرقَ ذيل */
  at: string;
  faceHere: string | null;
  faceThere: string | null;
  /** كم كلمةً حصريّةً متتاليةً ثبت بها */
  run: number;
}

/** التماسُ رمزٍ في مدًى أمامَ موضعٍ — فهرسُه أو `-1` */
function seek(words: string[], from: number, ahead: number, tok: string, strict: boolean): number {
  const end = Math.min(words.length - 1, from + ahead);
  for (let j = Math.max(0, from); j <= end; j++) {
    if (tolerantEq(words[j], tok, strict)) return j;
  }
  return -1;
}

/**
 * **عدُّ الحصريّ المتتالي** — يُعرض كلُّ رمزٍ على الجهتين من نقطة المفرق: على
 * **فرع النظيرة** بمؤشّرٍ يسير معه، وعلى **نصّ الآية التي هو فيها** بنافذةِ
 * براءةٍ مثبَّتةٍ عند المفرق (وهي من النصّ المتّصل فتشمل ما بعد الآية).
 *
 * • طابق النظيرةَ ولم يطابق الحاليةَ ⇒ **حصريٌّ** فيُعدّ.
 * • طابقهما معًا (وهو حالُ ما اتّفقتا فيه بعد المفرق) ⇒ **يُقطع العدّ**، فلا
 *   تُبنى تهمةٌ على كلامٍ يحتمل الوجهين.
 * • لم يطابق واحدًا منهما (خطأُ محرّكٍ أو كلامٌ غيرُ تلاوة) ⇒ **يُقطع العدّ**
 *   كذلك؛ والعتبةُ لا تُبلغ إلّا بثلاثٍ **نقيّاتٍ متتاليات**.
 *
 * **ويُمضى إلى آخر الرموز ولا يُقطع عند بلوغ العتبة** — فآيةٌ لها نظائرُ عدّةٌ
 * يتشابه بعضُها ببعضٍ يقع كلامُه على أكثر من فرع، **فالأطولُ حصريّةً أولى**
 * بأن يُنسب إليه؛ ولولا استيفاءُ العدّ لاستوت الفروعُ كلُّها عند الثلاث.
 */
function exclusiveRun(
  script: string[],
  forkAt: number,
  branch: string[],
  branchAt: number,
  tokens: string[],
  from: number,
): number {
  let there = branchAt;
  let run = 0;
  let best = 0;
  for (let i = from; i < tokens.length; i++) {
    const tok = tokens[i];
    const t = seek(branch, there, HUNT_STEP, tok, true);
    const h = seek(script, forkAt, HUNT_CLEAR, tok, false);
    if (t >= 0 && h < 0) {
      there = t + 1;
      run++;
      if (run > best) best = run;
      continue;
    }
    run = 0;
    if (t >= 0) there = t + 1;
  }
  return best;
}

/**
 * التماسُ الانزلاق في نظائر آيةٍ بعينها — **وأطولُها حصريّةً أولى**: آيةٌ تلتبس
 * بثلاثٍ يشبه بعضُها بعضًا يقع كلامُ المنزلق على أكثر من فرع، فيُنسب إلى أدلِّها
 * عليه. **وما تساوى فيه فرعان فالتباسٌ في المادّة لا في الحكم** — وأوّلُهما في
 * ترتيب المصحف يُقدَّم، فيثبت الحكمُ ولا يتقلّب.
 *
 * @param base فهرسُ الكلمة الأولى من تلك الآية في النصّ
 * @param pos موضعُ المؤشّر حين حادت الكلمة — **ولا يُلتمس مفرقٌ لم يبلغه**
 */
function huntIn(
  script: string[],
  tokens: string[],
  from: number,
  ayah: string,
  base: number,
  pos: number,
  index: HuntIndex,
): HuntEvent | null {
  const pairs = index.get(ayah);
  if (!pairs) return null;
  let best: HuntEvent | null = null;
  for (const p of pairs) {
    for (const f of p.forks) {
      const at = base + f.here - 1;
      /* **بعد بلوغ المؤشّر نقطةَ المفرق** — لا قبلَها، ولا بعد أن يجاوزها
         مستقيمًا (وتُترك سعةُ خطوةٍ لِما يجمعه المحرّكُ من كلمتين في رمز). */
      if (at > pos || pos - at > HUNT_STEP) continue;
      const run = exclusiveRun(script, at, p.branch, f.there - 1, tokens, from);
      if (run < HUNT_RUN || (best && run <= best.run)) continue;
      best = {
        key: p.key,
        here: ayah,
        there: p.there,
        /* وجهٌ خالٍ ⇒ مفرقُ ذيلٍ لا كلمةَ له في هذه الآية، فالوميضُ على آخرها */
        at: `${ayah}:${f.faceHere === null ? f.here - 1 : f.here}`,
        faceHere: f.faceHere,
        faceThere: f.faceThere,
        run,
      };
    }
  }
  return best;
}

/**
 * **آيةُ المؤشّر ونظائرُها** — تُلتمس من موضع الكلمة التي وقف عندها.
 *
 * **ومفرقُ الذيل يُلتمس بعده**: زوجٌ تنتهي فيه إحدى الآيتين وتمضي الأخرى نقطةُ
 * مفرقه بعد آخر كلمةٍ من المنقضية، والمؤشّرُ يومئذٍ في **مطلع التي تليها** —
 * فلو اقتُصر على آية المؤشّر لسقط بابُ الذيل كلُّه من الاصطياد.
 */
function huntAt(script: string[], tokens: string[], from: number, pos: number, h: HuntConfig): HuntEvent | null {
  const loc = h.locOf(pos);
  if (!loc) return null;
  const cut = loc.lastIndexOf(":");
  const no = Number(loc.slice(cut + 1));
  if (!Number.isFinite(no) || no < 1) return null;
  const found = huntIn(script, tokens, from, loc.slice(0, cut), pos - no + 1, pos, h.index);
  if (found || no > HUNT_STEP + 1) return found;
  const before = h.locOf(pos - no);
  if (!before) return null;
  const cut2 = before.lastIndexOf(":");
  const prev = Number(before.slice(cut2 + 1));
  if (!Number.isFinite(prev) || prev < 1) return null;
  return huntIn(script, tokens, from, before.slice(0, cut2), pos - no - prev + 1, pos, h.index);
}

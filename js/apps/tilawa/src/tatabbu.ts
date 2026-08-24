/**
 * **التتبّعُ في التلاوة — تدبيرُ الحال لا منطقُه.**
 *
 * منطقُ التتبّع كلُّه في الحزمة المشتركة (`@mishkat/quran-core/lib/sawt/*`):
 * المحرّكان، والأحوالُ الستّ، والمحاذاةُ بنافذتها، والالتقاطُ من أيّ آية،
 * والمِسطرة. **وما ههنا استهلاكٌ محضٌ — صفرُ تعديلٍ في حرفٍ منه**: يُفتح المقطع،
 * ويُنشأ المحرّك، ويُغذَّى ما يصل منه إلى `alignUtterance`، فيَخرج **موضعُ كلمةٍ
 * واحدةٍ** `"سورة:آية:كلمة"` — تظلّله صفحةُ المصحف على كلمتها بعينها.
 *
 * ### أربعةُ أحكامٍ تحكم هذا الملفّ
 *
 * ١) **حالٌ من الصفحة لا صفحةٌ ثانية** (درسا ج٤/ج٩): لمسةُ الميكروفون في الرأس
 *    تبدأ التتبّعَ **من أوّل آيةٍ مرئيّةٍ الآن** — لا شاشةَ بدءٍ ولا انتقالَ
 *    مسارٍ ولا فتحَ على موضعٍ محفوظٍ يرمي القارئَ بعيدًا عمّا ينظر إليه.
 *    **والمرئيُّ مقدَّمٌ على المحفوظ**؛ والمحفوظُ يُعرض سطرَ خيارٍ في «الختمة»
 *    لا قفزةً صامتة.
 * ٢) **الإعلانُ يسبق الميكروفون**: يُسأل عن المحرّك مرّةً ويُحفظ جوابُه، ويُقرأ
 *    **سطرُ صدقه** ويُؤذَن إذنًا صريحًا قبل أن يُفتح مجرًى صوتيّ. والإذنُ لمحرّكٍ
 *    بعينه لا يُورَّث لغيره، والإعلانُ يُعاد في كلِّ حالٍ على حدة.
 * ٣) **قاعدتا الميثاق فوق الجميع**: لا تصحيحَ أثناء التلاوة البتّة — لا لونَ
 *    خطأٍ ولا صوتَ ولا كلمة؛ ليس إلّا مؤشّرٌ يجري. **وفي الصلاة صمتٌ تامّ**
 *    (لا شيءَ بعد الختام) **والحرُّ وحدَه** (لا يخرج صوتُ المصلّي إلى طرفٍ ثالثٍ
 *    بحال، ولا يُرجَع فيها إلى الشبكيّ ولو تعطّل كلُّ شيء).
 * ٤) **لكلّ حالٍ موضعُها** عبر طبقة المواضع في الحزمة (`mawadi`): تُقرأ بمفتاح
 *    الحال وتُكتب به عند الختام — فختمتُه لا تمحو مراجعتَه.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ALIGN,
  alignUtterance,
  speechTokens,
  type HuntEvent,
  type HuntIndex,
} from "@mishkat/quran-core/lib/sawt/align";
import { SawtMeter, type SawtReport } from "@mishkat/quran-core/lib/sawt/metrics";
import {
  WebSpeechRecognizer,
  webSpeechAvailable,
  type RecognizerPort,
  type RecognizerState,
} from "@mishkat/quran-core/lib/sawt/recognizer";
import {
  OnDeviceRecognizer,
  onDeviceAvailable,
} from "@mishkat/quran-core/lib/sawt/onDeviceRecognizer";
import {
  WINDOW_AHEAD,
  WINDOW_WORDS,
  inSegment,
  openSegment,
  type SawtWindow,
  type SegmentSpec,
} from "@mishkat/quran-core/lib/sawt/script";
import {
  judge,
  loadIltiqat,
  releaseIltiqat,
  type IltiqatHit,
  type IltiqatIndex,
} from "@mishkat/quran-core/lib/sawt/iltiqat";
import {
  ENGINE_GRACE_MS,
  ENGINE_GRACE_S,
  findEngine,
  readEngineChoice,
  saveEngineChoice,
  type EngineDescriptor,
  type EngineId,
} from "@mishkat/quran-core/lib/sawt/engines";
import {
  declaredIn,
  findHal,
  noteDeclared,
  readConsent,
  readHal,
  saveConsent,
  saveHal,
  type Hal,
  type HalId,
} from "@mishkat/quran-core/lib/sawt/halat";
import { noteCut } from "@mishkat/quran-core/lib/sawt/cut";
import { readMawdi, saveMawdi, type Mawdi, type MawdiId } from "@mishkat/quran-core/lib/mawadi";
import { loadHuntIndex } from "./furuq";
import { noteSlips } from "./tathbit";
import { num, type Mushaf } from "./mushaf";

/** المصحفُ كلُّه مقطعُ التلاوة — القارئُ يقرأ سيلًا فلا يُقصّ عليه مدًى */
const SPEC: SegmentSpec = { id: "mushaf", title: "المصحف كلُّه", kind: "mushaf" };

/** كم نتيجةً مختومةً يقف عندها المؤشّرُ قبل أن يمضيَ من تلقائه */
const STALL_BEFORE_ADVANCE = 3;

/* ═══════ **بابُ الاصطياد الصوتيّ — حالاتٌ مسمّاةٌ لا استنباط** (ن٢ §٠) ═══════
   من فتح المصحفَ ليقرأ لا يمسّه من هذا شيء، ولا مَن يتلو في «الختمة» (سجلُّ
   موضعٍ لا غير) ولا في «العَرْض» (بابُ أحكامٍ لا تسميع). **والحالاتُ تُسمّى
   ههنا ولا يُزاد في عقد الأحوال حرف.** */

/** الحالاتُ التي يُفتح فيها البابُ — **تسميعٌ يُمسَك عليه** */
const HUNT_IN: HalId[] = ["murajaa", "tathbit", "salat"];

/**
 * ومن هذه: **من يُبيَّن له في مجلسه**. **وفي الصلاة صمتٌ تامّ** — لا وميضٌ ولا
 * بيانٌ ولا شيءَ بعد الختام؛ يُقيَّد الاصطيادُ في السجلّ وحدَه فيعود الزوجُ في
 * التدريب، ولا يُقال للمصلّي في صلاته شيء.
 */
const HUNT_SHOWN: HalId[] = ["murajaa", "tathbit"];

/** كم يمكث وميضُ المفرق قبل أن ينطفئ — إشارةٌ تُهمَل ولا تُنتظر */
const FLASH_MS = 2600;

/**
 * **أوّلُ وقفة** — كم من الصمت بعد آخر ما وصل من المحرّك يُعدّ وقفةً يُبان عندها.
 * **ولا مقاطعةَ في أثناء الجريان بحال**: ما دام الصوتُ يصل يُعاد العدُّ من أوّله.
 */
const WAQFA_MS = 2400;

/** أطوارُ السطح: مطفأ · مهيَّأٌ بالشريط · يتلو · بعد الختام */
export type Phase = "off" | "armed" | "running" | "done";
/** ما يُسأل عنه قبل الميكروفون — ولا ثالثَ لهما */
export type Ask = "engine" | "consent" | null;

interface WakeLockish {
  release(): Promise<void>;
}
interface WakeLockNav {
  wakeLock?: { request(type: "screen"): Promise<WakeLockish> };
}

export interface Tatabbu {
  phase: Phase;
  ask: Ask;
  halId: HalId;
  hal: Hal;
  chooseHal: (id: HalId) => void;
  engine: EngineDescriptor | null;
  /** ما يعمل الآن فعلًا — وقد يخالف المختارَ إن وقع رجوع (ص-م٥) */
  active: EngineDescriptor | null;
  engineState: RecognizerState;
  engineDetail: string | null;
  engineUsable: (e: EngineDescriptor) => boolean;
  /** أفي هذا الجهاز محرّكٌ أصلًا؟ */
  supported: boolean;
  /** خبرُ إخفاقٍ ورجوعٍ بنصّه — أو `null` */
  fell: { why: string; to: EngineDescriptor | null } | null;
  /** موضعُ المؤشّر `"سورة:آية:كلمة"` — وعليه تُظلَّل كلمةُ الصفحة */
  cursor: string | null;
  /** يلتمس موضعَ القارئ (مواضعُ لم تنحصر) — إشارةٌ هادئةٌ لا لوح */
  seeking: boolean;
  /** موضعُ هذه الحال المحفوظُ في الجهاز */
  mark: Mawdi | null;
  /** يُعرض سطرُ «تتابع من موضعك؟» — للختمة وحدَها وإن خالف المرئيَّ */
  offerMark: boolean;
  takeMark: () => void;
  /**
   * **موضعُ وميض الاصطياد الآن** `"سورة:آية:كلمة"` — إشارةٌ بصريّةٌ هادئةٌ
   * تنطفئ من تلقائها. و`null` في الصلاة أبدًا.
   */
  flash: string | null;
  /** **بيانُ ما اصطيد** — يُعرض عند أوّل وقفة، ويُطوى بلمسة. وفي الصلاة `null` */
  bayan: HuntEvent[] | null;
  dismissBayan: () => void;
  /** ما اصطيد في هذا المجلس كلِّه — يُقرأ بعد الختام */
  slips: HuntEvent[];
  /** أبابُ الاصطياد مفتوحٌ في هذه الحال؟ — يُقال ولا يُخفى */
  hunting: boolean;
  report: SawtReport | null;
  reached: string | null;
  /** يُطوى خبرُ الختام ويبقى الشريطُ — فمن أراد حالًا أخرى بدّلها ثمّ بدأ */
  dismissReport: () => void;
  /** لمسةُ الميكروفون: تبدأ من أوّل آيةٍ مرئيّةٍ الآن */
  arm: (location: string) => void;
  agree: () => void;
  chooseEngine: (id: EngineId) => void;
  swapEngine: () => void;
  dismissAsk: () => void;
  start: () => void;
  finish: () => void;
  close: () => void;
}

/**
 * @param surahName اسمُ السورة للعرض — من نصّ المصحف عند التطبيق لا من جدولٍ ثانٍ
 * @param mushaf نصُّ المصحف — **منه وحدَه يُبنى فهرسُ النظائر** (ن٢ §١)، فلا
 *   تقرأ المحاذاةُ ملفًّا بنفسها ولا يُشحن شيءٌ لمن لا يُسمِّع
 */
export function useTatabbu(surahName: (n: number) => string, mushaf: Mushaf | null): Tatabbu {
  const [phase, setPhase] = useState<Phase>("off");
  const [ask, setAsk] = useState<Ask>(null);
  const [halId, setHalId] = useState<HalId>(() => readHal());
  const hal = findHal(halId);
  const halRef = useRef(halId);
  halRef.current = halId;

  const [engineId, setEngineId] = useState<EngineId | null>(() => readEngineChoice());
  const [activeId, setActiveId] = useState<EngineId | null>(null);
  const [engineState, setEngineState] = useState<RecognizerState>("idle");
  const [engineDetail, setEngineDetail] = useState<string | null>(null);
  const [fell, setFell] = useState<{ why: string; to: EngineDescriptor | null } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [report, setReport] = useState<SawtReport | null>(null);
  const [reached, setReached] = useState<string | null>(null);
  const [markTick, setMarkTick] = useState(0);
  const [heard, setHeard] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [bayan, setBayan] = useState<HuntEvent[] | null>(null);
  const [slips, setSlips] = useState<HuntEvent[]>([]);

  const winRef = useRef<SawtWindow | null>(null);
  const recRef = useRef<RecognizerPort | null>(null);
  const meterRef = useRef<SawtMeter | null>(null);
  const wakeRef = useRef<WakeLockish | null>(null);
  const iltiqatRef = useRef<IltiqatIndex | null>(null);
  /** فهرسُ النظائر — **و`null` هو إغلاقُ الباب**: لا يُبنى إلّا في حالٍ تصطاد */
  const huntRef = useRef<HuntIndex | null>(null);
  /** ما اصطيد في المجلس، وما لم يُبَّن بعدُ، ومفاتيحُ ما قُيّد كي لا يُعاد */
  const caughtRef = useRef<HuntEvent[]>([]);
  const pendingRef = useRef<HuntEvent[]>([]);
  const seenSlipRef = useRef<Set<string>>(new Set());
  const flashRef = useRef(0);
  const waqfaRef = useRef(0);
  const cursorRef = useRef(0);
  const anchorRef = useRef(0);
  const stallRef = useRef(0);
  const skipsRef = useRef(0);
  const autoRef = useRef(0);
  const recentRef = useRef<string[]>([]);
  const seekingRef = useRef(false);
  const growingRef = useRef(false);
  const fellRef = useRef(false);
  const awayRef = useRef(false);
  const resumeAfterChoiceRef = useRef(false);
  /** الموضعُ الذي يُفتح عليه المقطع — المرئيُّ عند اللمسة، أو محفوظُ الختمة بطلبه */
  const fromRef = useRef<string | null>(null);
  /** أوّلُ آيةٍ مرئيّةٍ حين لُمس الميكروفون — بها يُعرف أيُخالفها المحفوظ */
  const seenRef = useRef<string | null>(null);

  const engine = engineId ? findEngine(engineId) : null;
  const active = activeId ? findEngine(activeId) : null;
  const engineUsable = useCallback(
    (e: EngineDescriptor) => (e.onDevice ? onDeviceAvailable() : webSpeechAvailable()),
    [],
  );
  const supported = webSpeechAvailable() || onDeviceAvailable();
  /** موضعُ هذه الحال — يُعاد قراءتُه عند تبدُّل الحال وعند كلّ ختام */
  const mark = useMemo(() => readMawdi(halId as MawdiId), [halId, markTick]);

  /* ── المؤشّرُ موضعًا يُعرض ── */
  const showCursor = useCallback((at: number) => {
    const win = winRef.current;
    const w = win?.script.words[Math.min(at, win.script.words.length - 1)];
    setCursor(w ? w.location : null);
  }, []);

  /** تُوسَّع نافذةُ التحميل قبل أن يبلغ المؤشّرُ طرفَها — نموٌّ واحدٌ في وقتٍ واحد */
  const growIfNeeded = useCallback(() => {
    const win = winRef.current;
    if (!win || !win.more || growingRef.current) return;
    if (win.script.words.length - cursorRef.current > WINDOW_AHEAD) return;
    growingRef.current = true;
    void win
      .grow(win.script.words.length + WINDOW_WORDS)
      .catch(() => {})
      .finally(() => {
        growingRef.current = false;
      });
  }, []);

  /**
   * **موضعُ الإعلان بمراتب القرار ١٠** — ولا مقاطعةَ في أثناء الجريان بحال:
   * وميضٌ خفيفٌ عند موضع المفرق (لا صوتَ ولا لوحَ يطمس النصّ)، والبيانُ الكامل
   * يُؤجَّل إلى **أوّل وقفة** أو إلى الختام. **وفي الصلاة لا وميضَ ولا بيان.**
   */
  const noteHunts = useCallback((evs: HuntEvent[]) => {
    const shown = HUNT_SHOWN.includes(halRef.current);
    let last: HuntEvent | null = null;
    for (const e of evs) {
      const k = `${e.key}|${e.at}`;
      if (seenSlipRef.current.has(k)) continue; // تُعاد محاذاةُ الجملة فيتكرّر الخبر
      seenSlipRef.current.add(k);
      caughtRef.current.push(e);
      if (!shown) continue;
      pendingRef.current.push(e);
      last = e;
    }
    if (!last) return;
    setFlash(last.at);
    window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  /** **العدُّ إلى الوقفة يُعاد من أوّله كلّما وصل صوت** — فلا يُقاطَع جريان */
  const armWaqfa = useCallback(() => {
    window.clearTimeout(waqfaRef.current);
    if (!pendingRef.current.length) return;
    waqfaRef.current = window.setTimeout(() => {
      const due = pendingRef.current;
      pendingRef.current = [];
      setBayan((b) => [...(b ?? []), ...due]);
    }, WAQFA_MS);
  }, []);

  /** يُطفأ ما عُلّق من مؤقّتات — عند الختام وعند الإغلاق وعند ذهاب الصفحة */
  const hushHunt = useCallback(() => {
    window.clearTimeout(flashRef.current);
    window.clearTimeout(waqfaRef.current);
    setFlash(null);
  }, []);

  const stopAll = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  /**
   * **تفريغٌ صارمٌ** (درسُ ص٤ §٢/١): أوزانُ المحرّك الحرّ وفهرسُ الالتقاط ذاكرةٌ
   * قائمةٌ لا نفعَ لها في صفحةٍ لا تتتبّع — وأجهزةُ آبل تقتل الصفحةَ إذا ضاقت.
   */
  const release = useCallback(() => {
    stopAll();
    hushHunt();
    iltiqatRef.current = null;
    huntRef.current = null;
    releaseIltiqat();
    recentRef.current = [];
  }, [stopAll, hushHunt]);

  useEffect(() => () => release(), [release]);

  /**
   * **يُفتح المقطعُ عند موضعٍ بعينه وتُستأنف المِسطرةُ منه** — يشترك فيه
   * الالتقاطُ من موضعٍ بعيد وسطرُ «تتابع من موضعك؟»؛ فالفعلُ واحدٌ في الحالين
   * (نافذةٌ جديدةٌ عند الموضع، ومؤشّرٌ عليه، وقياسٌ يصف الشوطَ الأخير).
   */
  const openAt = useCallback(
    async (location: string) => {
      const { win, startWord } = await openSegment(SPEC, location);
      winRef.current = win;
      cursorRef.current = startWord;
      anchorRef.current = startWord;
      stallRef.current = 0;
      recentRef.current = [];
      seekingRef.current = false;
      meterRef.current = new SawtMeter(win.script);
      showCursor(startWord);
      setSeeking(false);
    },
    [showCursor],
  );

  /* ── الالتقاطُ من موضعٍ بعيد: يُفتح المقطعُ عنده وتُستأنف المِسطرة ── */
  const relocate = useCallback(async (hit: IltiqatHit) => openAt(hit.location), [openAt]);

  /* ── الختام: يُحفظ الموضعُ لهذه الحال، وتُقرأ المِسطرة ── */
  const finish = useCallback(() => {
    const meter = meterRef.current;
    const win = winRef.current;
    const rec = recRef.current;
    stopAll();
    hushHunt();
    /* **وههنا تكتمل الحلقة**: تسميعٌ ⇐ اصطيادٌ ⇐ سجلُّ الخلط بالزوج ⇐ جدولٌ
       يعيده في التدريب. **ويُقيَّد عند الختام لا في أثنائه** — فلا يُكتب في
       تخزين الجهاز والقارئُ يتلو، **وفي الصلاة يُقيَّد ولا يُعرض منه شيء**. */
    const caught = caughtRef.current;
    setSlips(caught.slice());
    setBayan(null);
    pendingRef.current = [];
    noteSlips([...new Set(caught.map((e) => e.key))]);
    let r: SawtReport | null = null;
    if (meter && win) {
      r = meter.finish({
        condition: "قراءةُ صاحبها",
        engineLabel: rec?.label ?? "—",
        restarts: rec?.restarts ?? 0,
        manualSkips: skipsRef.current,
        autoAdvances: autoRef.current,
        /* **ولا مجرًى ثانيًا للميكروفون ههنا**: قياسُ زمن الوقف عُدّةُ محكٍّ في
           مشكاة، وفتحُه في تطبيق العبادة ينازع المحرّكَ على الميكروفون بلا نفعٍ
           لقارئ — فيُعلَن غيرَ مقيسٍ ولا يُدَّعى رقمٌ لم يُقَس. */
        waqfMeasured: false,
        longestSilenceMs: null,
      });
      const w = win.script.words[Math.min(cursorRef.current, win.script.words.length - 1)];
      if (w && cursorRef.current > 0) {
        saveMawdi(halRef.current as MawdiId, w.location);
        setReached(`${surahName(w.surahNo)} ${num(w.ayahNo)}`);
        setMarkTick((t) => t + 1);
      }
    }
    setReport(r);
    setSeeking(false);
    /* **وفي الصلاة صمتٌ تامّ**: لا شيءَ بعد الختام — لا موضعٌ ولا مواضعُ للنظر */
    setPhase(findHal(halRef.current).after === "silent" ? "armed" : "done");
  }, [stopAll, hushHunt, surahName]);

  /* ── ذهابُ الصفحة يُنهي التتبّعَ ويُفرّغ ما يُمسَك (درسُ ص٤) ── */
  useEffect(() => {
    const away = () => {
      if (awayRef.current) return;
      awayRef.current = true;
      if (phase === "running") {
        noteCut("page", activeId);
        finish();
      }
      release();
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") away();
    };
    window.addEventListener("pagehide", away);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pagehide", away);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, activeId, finish, release]);

  /**
   * **البدء** — والمحرّكُ يُنشأ ويبدأ **قبل كلّ انتظار** (ص-م٥ §٢): أجهزةُ آبل
   * تُنشئ السياقَ الصوتيَّ موقوفًا خارجَ نبضة الإيماءة، فلا يصل صوتٌ وهو يبدو
   * حيًّا. وفتحُ المقطع بعده — ونتائجُ المحرّك لا تجيء قبل أن يتلوَ أحد.
   */
  const begin = useCallback(
    (override?: EngineId) => {
      const chosen = findEngine(override ?? engineId ?? "browser-speech");
      skipsRef.current = 0;
      autoRef.current = 0;
      stallRef.current = 0;
      recentRef.current = [];
      seekingRef.current = false;
      awayRef.current = false;
      caughtRef.current = [];
      pendingRef.current = [];
      seenSlipRef.current = new Set();
      huntRef.current = null;
      hushHunt();
      setSeeking(false);
      setReport(null);
      setReached(null);
      setHeard(false);
      setAsk(null);
      setBayan(null);
      setSlips([]);

      const rec: RecognizerPort = chosen.onDevice
        ? new OnDeviceRecognizer()
        : new WebSpeechRecognizer("ar-SA");
      recRef.current = rec;
      setActiveId(chosen.id);
      setEngineState("starting");
      setEngineDetail(null);
      rec.onState((s, detail) => {
        setEngineState(s);
        setEngineDetail(detail ?? null);
      });
      rec.onResult((r) => {
        setHeard(true);
        const win = winRef.current;
        const gauge = meterRef.current;
        if (!win || !gauge) return; // لم يُفتح المقطعُ بعد — ولا يُحسب ما لا موضعَ له
        const tokens = speechTokens(r.text);
        if (!tokens.length) return;
        const before = anchorRef.current;
        /* **الاصطيادُ إعدادٌ يُمرَّر لا شيءٌ يُقرأ** (ن٢ §١): الفهرسُ يُبنى ههنا
           ويُسلَّم، والمواضعُ **تُقرأ دالّةً** فلا تُنسخ مصفوفةُ سبعةٍ وسبعين ألفًا
           في كلّ نتيجةٍ جزئيّة. وحيث لا فهرسَ فلا مسارَ جديدٌ ألبتّة. */
        const ix = huntRef.current;
        const step = alignUtterance(
          win.norms,
          tokens,
          before,
          DEFAULT_ALIGN,
          ix ? { index: ix, locOf: (i) => win.script.words[i]?.location } : undefined,
        );
        if (step.hunts.length) noteHunts(step.hunts);
        armWaqfa();
        if (step.cursor !== cursorRef.current) {
          cursorRef.current = step.cursor;
          showCursor(step.cursor);
          growIfNeeded();
        }
        // المِسطرةُ تُغذّى بالمختوم وحدَه — والجزئيُّ يُراجَع وينمو فتتضاعف الكلمة
        if (!r.isFinal) return;
        gauge.commit(step, before);
        if (step.cursor > before) {
          stallRef.current = 0;
          anchorRef.current = step.cursor;
          recentRef.current = [];
          if (seekingRef.current) {
            seekingRef.current = false;
            setSeeking(false);
          }
          return;
        }
        /* وقف المؤشّرُ والصوتُ يصل — **فالمحلّيُّ أوّلًا، ثمّ الالتماسُ الشامل،
           ثمّ المضيُّ عند الشكّ**؛ ولا يُحبَس قارئٌ لعلّه مصيبٌ والمحرّكُ أخطأ. */
        stallRef.current += 1;
        recentRef.current = [...recentRef.current, ...tokens].slice(-9);
        if (stallRef.current >= STALL_BEFORE_ADVANCE) {
          const ix = iltiqatRef.current;
          if (ix && recentRef.current.length >= 4) {
            const w = win.script.words[Math.min(cursorRef.current, win.script.words.length - 1)];
            const at = w ? ix.flatOf(w.location) : null;
            const v = judge(ix, recentRef.current, (a) => inSegment(SPEC, a), at);
            if (v.kind === "jump") {
              void relocate(v.hit);
              return;
            }
            // **والانتظارُ خيرٌ من قفزةٍ كاذبة** — مواضعُ لم تنحصر فيُنتظر ما يضيّقها
            if (v.kind === "many") {
              if (!seekingRef.current) {
                seekingRef.current = true;
                setSeeking(true);
              }
              return;
            }
          }
        }
        if (stallRef.current >= STALL_BEFORE_ADVANCE && before < win.norms.length) {
          stallRef.current = 0;
          autoRef.current += 1;
          const next = before + 1;
          anchorRef.current = next;
          cursorRef.current = next;
          showCursor(next);
        }
      });
      rec.start();
      setPhase("running");

      /* المقطعُ يُفتح على **ما أمام القارئ** — والمِسطرةُ تُنشأ معه */
      void openSegment(SPEC, fromRef.current).then(({ win, startWord }) => {
        winRef.current = win;
        meterRef.current = new SawtMeter(win.script);
        cursorRef.current = startWord;
        anchorRef.current = startWord;
        showCursor(startWord);
      });

      /* فهرسُ الالتقاط يُبنى عند البدء لا عند الإقلاع — من نصّ المصحف الذي عندنا */
      void loadIltiqat()
        .then((ix) => {
          iltiqatRef.current = ix;
        })
        .catch(() => {
          iltiqatRef.current = null;
        });

      /* **وفهرسُ النظائر كذلك — في الحالات المسمّاة وحدَها.** ومادّتُه تُجلب
         شبكةً أوّلَ مرّة، فإن تعذّرت بقي البابُ مغلقًا والتتبّعُ يعمل كما هو:
         **لا يُعطَّل تسميعٌ لأجل اصطياد**. */
      if (HUNT_IN.includes(halRef.current) && mushaf) {
        void loadHuntIndex(mushaf)
          .then((ix) => {
            huntRef.current = ix;
          })
          .catch(() => {
            huntRef.current = null;
          });
      }

      /* الشاشةُ تبقى مضاءةً — القارئُ لا يلمس شيئًا بعد البدء */
      void (async () => {
        try {
          const navi = navigator as unknown as WakeLockNav;
          wakeRef.current = (await navi.wakeLock?.request("screen")) ?? null;
        } catch {
          /* الجهازُ قد يمنعه — ولا يُبطل التلاوة */
        }
      })();
    },
    [engineId, growIfNeeded, relocate, showCursor, mushaf, noteHunts, armWaqfa, hushHunt],
  );

  /**
   * **الرجوعُ عند الإخفاق — ولا شاشةَ ميّتة** (ص-م٥ §١‑٢). وقيدان لا يُنقضان:
   * **الصلاةُ لا يُرجَع فيها إلى الشبكيّ بحال**، **والإذنُ لا يُورَّث** فمن لم
   * يأذن للشبكيّ لا يُشغَّل له صامتًا.
   */
  const fallback = useCallback(
    (why: string) => {
      if (fellRef.current) return;
      fellRef.current = true;
      stopAll();
      const netUsable = webSpeechAvailable();
      if (halRef.current === "salat" || !netUsable) {
        setPhase("armed");
        setFell({ why, to: null });
        return;
      }
      saveEngineChoice("browser-speech");
      setEngineId("browser-speech");
      setFell({ why, to: findEngine("browser-speech") });
      if (readConsent("browser-speech") && declaredIn().includes(halRef.current)) {
        begin("browser-speech");
      } else {
        setPhase("armed");
        setAsk("consent");
      }
    },
    [begin, stopAll],
  );

  /** حارسُ الجمود — مهلةٌ معلَنةٌ تُعاد عند كلّ خبر، ولا تُقطع على تنزيلٍ يجري */
  useEffect(() => {
    if (phase !== "running" || activeId !== "on-device" || heard) return;
    if (engineState === "denied") return;
    if (engineState === "error" || engineState === "unsupported") {
      fallback(engineDetail ?? "لم يُقلع محرّكُ جهازك");
      return;
    }
    const t = window.setTimeout(
      () => fallback(`لم يُقلع محرّكُ جهازك ولم يصل منه خبرٌ ${num(ENGINE_GRACE_S)} ثانية`),
      ENGINE_GRACE_MS,
    );
    return () => clearTimeout(t);
  }, [phase, activeId, heard, engineState, engineDetail, fallback]);

  /** **الإعلانُ يسبق الميكروفون** — وهذا هو المدخلُ الوحيدُ إلى البدء */
  const start = useCallback(() => {
    fellRef.current = false;
    setFell(null);
    if (!engineId || !engineUsable(findEngine(engineId))) {
      resumeAfterChoiceRef.current = true;
      setAsk("engine");
      return;
    }
    // **والصلاةُ بالحرّ وحدَه** — لا يخرج صوتُ المصلّي إلى طرفٍ ثالثٍ بحال
    if (halId === "salat" && !findEngine(engineId).fitsSalat) {
      resumeAfterChoiceRef.current = true;
      setAsk("engine");
      return;
    }
    if (!readConsent(engineId) || !declaredIn().includes(halId)) {
      setAsk("consent");
      return;
    }
    begin();
  }, [begin, engineId, engineUsable, halId]);

  /** لمسةُ الميكروفون في الرأس — **الحالُ في مكانها، من أوّل آيةٍ مرئيّة** */
  const arm = useCallback(
    (location: string) => {
      seenRef.current = location;
      fromRef.current = location;
      setPhase((p) => (p === "off" || p === "done" ? "armed" : p));
      start();
    },
    [start],
  );

  const agree = useCallback(() => {
    if (!engineId) return;
    saveConsent(engineId);
    noteDeclared(halId);
    setAsk(null);
    begin(engineId);
  }, [begin, engineId, halId]);

  const chooseEngine = useCallback(
    (id: EngineId) => {
      fellRef.current = false;
      setFell(null);
      saveEngineChoice(id);
      setEngineId(id);
      setAsk(null);
      if (!resumeAfterChoiceRef.current) return;
      resumeAfterChoiceRef.current = false;
      // الإذنُ لا يُورَّث بين محرّكين — فيُعاد الإعلانُ لهذا المحرّك
      if (!readConsent(id) || !declaredIn().includes(halId)) setAsk("consent");
      else begin(id);
    },
    [begin, halId],
  );

  /** **التبديلُ حقٌّ في كلّ وقتٍ لا خطوةٌ في طقس بدء** — فلا يُشغَّل ميكروفونٌ بعده */
  /**
   * **طيُّ ورقة الختام لا إغلاقُ السطح**: يبقى الشريطُ فيُبدَّل الحالُ ويُبدأ من
   * جديد. **وبغير هذا لا سبيلَ إلى تبديل الحال بعد أوّل إذن** — إذ اللمسةُ تبدأ
   * في الحال، والحالُ لا تُبدَّل والتلاوةُ جارية.
   */
  const dismissReport = useCallback(() => setPhase("armed"), []);

  /** يُطوى البيانُ بلمسة — **خبرٌ يُهمَل بلا أثر**، والقيدُ في السجلّ قائمٌ سواه */
  const dismissBayan = useCallback(() => setBayan(null), []);

  const swapEngine = useCallback(() => {
    resumeAfterChoiceRef.current = false;
    setAsk("engine");
  }, []);

  const dismissAsk = useCallback(() => {
    resumeAfterChoiceRef.current = false;
    setAsk(null);
  }, []);

  const chooseHal = useCallback((id: HalId) => {
    const h = findHal(id);
    if (h.suspended) return; // الموقوفةُ تُعرض باسمها ولا يُتلى بها
    setHalId(id);
    saveHal(id);
    setAsk(null);
  }, []);

  /** يُغلق سطحُ التتبّع ويعود المصحفُ قراءةً — ولا يبقى مؤشّرٌ في نصّ ساكن */
  const close = useCallback(() => {
    release();
    setPhase("off");
    setCursor(null);
    setReport(null);
    setReached(null);
    setFell(null);
    setAsk(null);
    setBayan(null);
    setSlips([]);
    caughtRef.current = [];
    pendingRef.current = [];
    seenSlipRef.current = new Set();
    setActiveId(null);
    setEngineState("idle");
    winRef.current = null;
    meterRef.current = null;
  }, [release]);

  /**
   * **سطرُ «تتابع من موضعك؟»** — للختمة وحدَها (حالٌ تستأنف)، وإن خالف المرئيَّ.
   *
   * **ويبقى معروضًا في أثناء التلاوة كذلك**: لمسةُ الميكروفون تبدأ من الصفحة
   * التي أمام القارئ في الحال (لا شاشةَ بدءٍ يُسأل فيها)، فلو لم يُعرض إلّا قبل
   * البدء **لما رآه أحدٌ قطُّ**. فهو سطرٌ خفيفٌ يُهمَل بلا أثر، ومن لمسه نُقل
   * موضعُه ثَمَّ **في مكانه** بلا إعادة بدء (درسُ ج٩ §٣).
   */
  const offerMark =
    (phase === "armed" || phase === "running") &&
    !!hal.resumes &&
    !!mark &&
    !!seenRef.current &&
    mark.location !== seenRef.current;
  const takeMark = useCallback(() => {
    if (!mark) return;
    fromRef.current = mark.location;
    seenRef.current = null;
    if (phase === "running") void openAt(mark.location);
    else start();
  }, [mark, openAt, phase, start]);

  return {
    phase,
    ask,
    halId,
    hal,
    chooseHal,
    engine,
    active,
    engineState,
    engineDetail,
    engineUsable,
    supported,
    fell,
    cursor,
    seeking,
    flash,
    bayan,
    dismissBayan,
    slips,
    hunting: HUNT_IN.includes(halId),
    mark,
    offerMark,
    takeMark,
    report,
    reached,
    dismissReport,
    arm,
    agree,
    chooseEngine,
    swapEngine,
    dismissAsk,
    start,
    finish,
    close,
  };
}

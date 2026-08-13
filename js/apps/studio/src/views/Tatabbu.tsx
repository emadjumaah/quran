/**
 * «التتبّع» — صفحةٌ يتلو فيها القارئُ من المصحف فيجري المؤشّرُ مع صوته.
 *
 * صارت **بابًا في الواجهة** لا مسبارًا مستورًا (ص-م٢): مدخلُها في الرأس، وهي
 * **قائمةٌ بنفسها** بلا هيكل التطبيق — لا رأسَ ولا تبويبَ ولا دُرجَ ولا زرًّا
 * طائرًا — وزرُّ إغلاقٍ واحدٌ يعود بالقارئ من حيث جاء.
 *
 * **والجوالُ أشدُّ تجريدًا**: ملءُ الشاشة، وليس فيها إلّا ثلاثة — النصُّ، وقائمةُ
 * اختيار الحال، وزرُّ الإغلاق. **ولا رابعَ لها**: ما لزم من تهيئةٍ يُطوى في
 * لوحٍ يُفتح بلمسةٍ على النصّ قبل البدء، ويختفي كلُّه عند التلاوة.
 *
 * **سياسةُ التصحيح — قرارُ الإدارة، مُلزِمٌ ولا يُخالَف هنا ولا في غيره**:
 * لا تصحيحَ أثناء التلاوة البتّة. لا لونَ أحمر، ولا صوت، ولا اهتزاز، ولا كلمةَ
 * «أخطأت». ثلاثُ مراتب: (١) أثناءها المؤشّرُ وحدَه، وفي حال التثبيت **عدمُ
 * انكشاف الكلمة هو التنبيه** — تصحيحٌ لا يقول شيئًا؛ (٢) وعند الوقف إشارةٌ
 * صامتةٌ تُهمَل؛ (٣) وبعد الختام «مواضعُ للنظر» وهي موضعُ القول وحدَه. **وفي
 * حال الصلاة صمتٌ تامّ**: لا أثناءها ولا بعدها.
 *
 * **وحدٌّ يُبنى عليه التصميم** (ملحقُ الإدارة §٣): لا يُميَّز في هذه الطبقة
 * خطأُ القارئ من خطأ المحرّك — فالميلُ إلى التسامح والمضيّ، ولغةُ ما بعد
 * الختام لغةُ شكٍّ: «لم يتبيّن لنا» لا «أخطأت»، **والآلةُ لا تُجيز**.
 *
 * **والقيدُ الذي لا يُتجاوز** (ص-م٢ §٦): محرّكُ اليوم هو محرّكُ المتصفّح، وهو
 * **يرسل الصوتَ إلى خادم صانعه**. فلا ميكروفونَ يُشغَّل قبل إعلانٍ ظاهرٍ وإذنٍ
 * صريحٍ يُحفظ في الجهاز ويُسحب من الصفحة نفسِها. **ولا يُقال في هذه الصفحة
 * البتّةَ إنّها تعمل بلا إنترنت ولا إنّ الصوتَ لا يغادر الجهاز** — فذلك لا يصحّ
 * إلّا بالمحرّك الحرّ على الجهاز.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_ALIGN, alignUtterance, speechTokens } from "../lib/sawt/align";
import { SawtMeter, type SawtReport } from "../lib/sawt/metrics";
import {
  WebSpeechRecognizer,
  type RecognizerPort,
  type RecognizerState,
  webSpeechAvailable,
} from "../lib/sawt/recognizer";
import {
  SEALED_SEGMENTS,
  WINDOW_AHEAD,
  WINDOW_WORDS,
  openSegment,
  type SawtScript,
  type SawtWindow,
  type SegmentSpec,
} from "../lib/sawt/script";
import {
  HALAT,
  findHal,
  readConsent,
  readHal,
  saveConsent,
  saveHal,
  clearConsent,
  declaredIn,
  noteDeclared,
  type Hal,
  type HalId,
} from "../lib/sawt/halat";
import { isAppleMobile, startVad, type VadHandle } from "../lib/sawt/vad";
import {
  CONDITIONS,
  deviceName,
  isStandalone,
  listRuns,
  readMark,
  saveMark,
  saveRun,
  type SawtRunRow,
} from "../lib/sawt/runs";
import { surahNameAr } from "../db";
import { num } from "../i18n";

type Phase = "idle" | "running" | "done";
/** أبوابُ الاختيار على المصحف كلِّه، ومعها مقاطعُ المحكّ المختومة */
type Pick = "mihakk" | "surah" | "juz" | "page" | "range" | "mushaf";

/** كم نتيجةً مختومةً يقف عندها المؤشّرُ قبل أن يمضيَ من تلقائه */
const STALL_BEFORE_ADVANCE = 3;
/** عددُ سور المصحف وأجزائه وصفحاته — عِدَدٌ ثابتةٌ لا تُستخرج من قاعدة */
const SURAHS = 114;
const JUZS = 30;
const PAGES = 604;

interface WakeLockish {
  release(): Promise<void>;
}
interface WakeLockNav {
  wakeLock?: { request(type: "screen"): Promise<WakeLockish> };
}

/** عرضُ الهاتف — وعليه يقع التجريد */
function useIsMobile(): boolean {
  const [m, setM] = useState<boolean>(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

const ayahCountOf = (script: SawtScript): number => script.totalAyahs;

/** تاريخٌ بأرقامٍ عربيّة — فبعضُ المحلّيّات تُخرج «ar» بأرقامٍ لاتينيّة */
const arDate = (iso: string): string => {
  const d = new Date(iso);
  return `${num(d.getDate())}/${num(d.getMonth() + 1)}/${num(d.getFullYear())}`;
};

export default function Tatabbu() {
  const nav = useNavigate();
  const mobile = useIsMobile();

  const [phase, setPhase] = useState<Phase>("idle");
  const [halId, setHalId] = useState<HalId>(() => readHal());
  const hal = findHal(halId);

  const [pick, setPick] = useState<Pick>("surah");
  const [sealed, setSealed] = useState(SEALED_SEGMENTS[0].id);
  const [surahNo, setSurahNo] = useState(1);
  const [juz, setJuz] = useState(1);
  const [page, setPage] = useState(1);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(10);

  const [conditionId, setConditionId] = useState("asas");
  const [measureTime, setMeasureTime] = useState(!isAppleMobile());
  const [resume, setResume] = useState(false);
  // عُدّةُ التهيئة **تُفتح بطلبٍ لا بقدوم** (أمر المالك 2026-08-14، ونقضُ إقرار
  // ص-م٢): يأتي القارئُ فيجد المصحفَ صافيًا، ومن أراد تهيئةً طلبها من الشريط.
  const [setup, setSetup] = useState(false);
  const [asking, setAsking] = useState(false); // الإعلانُ يسبق الميكروفون
  const [consent, setConsent] = useState(() => readConsent());

  const [ready, setReady] = useState(false);
  const [growth, setGrowth] = useState(0);
  const [openMs, setOpenMs] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [engineState, setEngineState] = useState<RecognizerState>("idle");
  const [engineDetail, setEngineDetail] = useState<string | null>(null);
  const [report, setReport] = useState<SawtReport | null>(null);
  const [reached, setReached] = useState<string | null>(null);
  const [waqfMeasured, setWaqfMeasured] = useState(false);
  const [felt, setFelt] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [runs, setRuns] = useState<SawtRunRow[]>([]);

  const winRef = useRef<SawtWindow | null>(null);
  const recRef = useRef<RecognizerPort | null>(null);
  const vadRef = useRef<VadHandle | null>(null);
  const meterRef = useRef<SawtMeter | null>(null);
  const wakeRef = useRef<WakeLockish | null>(null);
  const anchorRef = useRef(0);
  const cursorRef = useRef(0);
  const lastAdvanceRef = useRef(0);
  const skipsRef = useRef(0);
  const autoRef = useRef(0);
  const stallRef = useRef(0);
  const waqfTimerRef = useRef<number | null>(null);
  const currentElRef = useRef<HTMLSpanElement | null>(null);
  const textElRef = useRef<HTMLDivElement | null>(null);

  const mark = useMemo(() => readMark(), [phase]);
  const supported = webSpeechAvailable();
  const condition = CONDITIONS.find((c) => c.id === conditionId) ?? CONDITIONS[0];

  useEffect(() => setRuns(listRuns()), [phase]);

  /* ── الصفحةُ قائمةٌ بنفسها: يُخفى هيكلُ التطبيق ما دامت مفتوحة ── */
  useEffect(() => {
    document.body.classList.add("sawt-page");
    return () => document.body.classList.remove("sawt-page");
  }, []);
  useEffect(() => {
    if (phase !== "running") return;
    document.body.classList.add("sawt-live");
    return () => document.body.classList.remove("sawt-live");
  }, [phase]);

  /* ── المقطعُ المختار: الاختيارُ على المصحف كلِّه ── */
  const spec: SegmentSpec = useMemo(() => {
    switch (pick) {
      case "mihakk":
        return SEALED_SEGMENTS.find((s) => s.id === sealed) ?? SEALED_SEGMENTS[0];
      case "juz":
        return { id: `j${juz}`, title: `الجزء ${num(juz)}`, kind: "juz", juz };
      case "page":
        return { id: `p${page}`, title: `صفحة ${num(page)}`, kind: "page", page };
      case "range":
        return {
          id: `r${surahNo}-${rangeFrom}-${rangeTo}`,
          title: `${surahNameAr(surahNo)} ${num(rangeFrom)}–${num(Math.max(rangeFrom, rangeTo))}`,
          kind: "range",
          surahNo,
          from: rangeFrom,
          to: Math.max(rangeFrom, rangeTo),
        };
      case "mushaf":
        return { id: "mushaf", title: "المصحف كلُّه", kind: "mushaf" };
      default:
        return { id: `s${surahNo}`, title: surahNameAr(surahNo), kind: "surahs", surahs: [surahNo] };
    }
  }, [pick, sealed, surahNo, juz, page, rangeFrom, rangeTo]);

  /** من أين يبدأ: من الموضع المختار، أو من آخر موضعٍ محفوظ */
  const from = (hal.resumes || resume) && mark ? mark.location : null;
  const specKey = JSON.stringify(spec);

  /* ── فتحُ نافذة العمل: ما يُتلى الآنَ وما حوله، لا المصحفُ كلُّه ── */
  useEffect(() => {
    let alive = true;
    setReady(false);
    const t0 = performance.now();
    void openSegment(JSON.parse(specKey) as SegmentSpec, from).then(({ win, startWord }) => {
      if (!alive) return;
      winRef.current = win;
      cursorRef.current = startWord;
      anchorRef.current = startWord;
      setCursor(startWord);
      setOpenMs(Math.round(performance.now() - t0));
      setGrowth((g) => g + 1);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [specKey, from]);

  /* ── تُوسَّع النافذةُ قبل أن يبلغ المؤشّرُ طرفَها ── */
  useEffect(() => {
    const win = winRef.current;
    if (!win || !win.more) return;
    if (win.script.words.length - cursor > WINDOW_AHEAD) return;
    void win.grow(win.script.words.length + WINDOW_WORDS).then((grew) => {
      if (grew) setGrowth((g) => g + 1);
    });
  }, [cursor, growth]);

  const script = winRef.current?.script ?? null;
  const wordCount = script ? script.words.length : 0;

  /* ── تمريرٌ يتبع المؤشّر: لا لمسَ بعد البدء، ولا تمريرَ مفاجئ ── */
  useEffect(() => {
    if (phase !== "running") return;
    const el = currentElRef.current;
    const box = textElRef.current;
    if (!el || !box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    // لا يُمرَّر إلّا إذا خرج المؤشّرُ من وسط الشاشة — فالصلاةُ لا يُقفز فيها
    const band = b.height * 0.28;
    if (r.top >= b.top + band && r.bottom <= b.bottom - band) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [cursor, phase]);

  const stopAll = useCallback(() => {
    recRef.current?.stop();
    vadRef.current?.stop();
    if (waqfTimerRef.current != null) clearTimeout(waqfTimerRef.current);
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  /* ── الختام ── */
  const finish = useCallback(() => {
    const meter = meterRef.current;
    const rec = recRef.current;
    const win = winRef.current;
    const silence = vadRef.current?.longestSilenceMs() ?? null;
    stopAll();
    if (meter && win) {
      const r = meter.finish({
        condition: condition.name,
        engineLabel: rec?.label ?? "—",
        restarts: rec?.restarts ?? 0,
        manualSkips: skipsRef.current,
        autoAdvances: autoRef.current,
        waqfMeasured,
        longestSilenceMs: silence,
      });
      setReport(r);
      saveRun(r, condition.id, condition.name);
      // علامةُ آخر موضع: موضعٌ وتاريخُه لا غير — سجلُّ موضعٍ لا لعبةَ مواظبة
      const w = win.script.words[Math.min(cursorRef.current, win.script.words.length - 1)];
      if (w && cursorRef.current > 0) {
        saveMark(w.location);
        setReached(`${surahNameAr(w.surahNo)} ${num(w.ayahNo)}`);
      }
    }
    setPhase("done");
  }, [stopAll, waqfMeasured, condition]);

  /* ── البدء: لمسةٌ واحدة، ثمّ لا لمسَ البتّة ── */
  const begin = useCallback(async () => {
    const win = winRef.current;
    if (!win) return;
    const at = cursorRef.current;
    anchorRef.current = at;
    skipsRef.current = 0;
    autoRef.current = 0;
    stallRef.current = 0;
    lastAdvanceRef.current = 0;
    setHeard(false);
    setSlow(false);
    setFelt(null);
    setReport(null);
    setReached(null);
    setCopied(null);
    setSetup(false);
    const meter = new SawtMeter(win.script);
    meterRef.current = meter;

    // الشاشةُ تبقى: القارئُ لا يلمس شيئًا بعد التكبير
    try {
      const navi = navigator as unknown as WakeLockNav;
      wakeRef.current = (await navi.wakeLock?.request("screen")) ?? null;
    } catch {
      /* الجهازُ قد يمنعه — لا يُبطل الجلسة */
    }

    // قياسُ الزمن اختياريّ: إن تعذّر المجرى أو تعارض مع المحرّك يُطفأ ويُعلَن
    // «غير مقيسٍ آليًّا»، ولا يُكتب رقمٌ مقدَّرٌ في خانةٍ مقيسة.
    setWaqfMeasured(false);
    if (measureTime) {
      try {
        vadRef.current = await startVad({
          onSpeechStart: () => {},
          onSpeechEnd: (endedAt) => {
            if (waqfTimerRef.current != null) clearTimeout(waqfTimerRef.current);
            waqfTimerRef.current = window.setTimeout(() => {
              const adv = lastAdvanceRef.current;
              meter.noteWaqfLatency(adv > endedAt ? adv - endedAt : 0);
            }, 1500);
          },
        });
        setWaqfMeasured(true);
      } catch {
        vadRef.current = null;
      }
    }

    const rec = new WebSpeechRecognizer("ar-SA");
    recRef.current = rec;
    rec.onState((s, detail) => {
      setEngineState(s);
      setEngineDetail(detail ?? null);
    });
    rec.onResult((r) => {
      setHeard(true);
      const tokens = speechTokens(r.text);
      if (!tokens.length) return;
      const before = anchorRef.current;
      const step = alignUtterance(win.norms, tokens, before, DEFAULT_ALIGN);
      if (step.cursor !== cursorRef.current) {
        cursorRef.current = step.cursor;
        setCursor(step.cursor);
        lastAdvanceRef.current = performance.now();
        requestAnimationFrame(() => meter.noteEngineLatency(performance.now() - r.at));
      }
      // المِسطرةُ تُغذّى بالمختوم وحدَه: الجزئيُّ يُراجَع وينمو، فلو حُسب
      // لتضاعفت الكلمةُ الواحدةُ مرارًا.
      if (!r.isFinal) return;
      meter.commit(step, before);
      if (step.cursor > before) {
        stallRef.current = 0;
        anchorRef.current = step.cursor;
        return;
      }
      // **المضيُّ عند الشكّ**: وقف المؤشّرُ وما زال الصوتُ يصل. فلا نَحبِس
      // قارئًا لعلّه مصيبٌ والمحرّكُ هو المخطئ — نمضي كلمةً. والكلمةُ الممضيُّ
      // عنها تبقى غيرَ مطابقةٍ في الحساب، فلا يُشترى المضيُّ برقمٍ كاذب.
      stallRef.current += 1;
      if (stallRef.current >= STALL_BEFORE_ADVANCE && before < win.norms.length) {
        stallRef.current = 0;
        autoRef.current += 1;
        const next = before + 1;
        anchorRef.current = next;
        cursorRef.current = next;
        setCursor(next);
        lastAdvanceRef.current = performance.now();
      }
    });
    rec.start();
    setPhase("running");
  }, [measureTime]);

  /**
   * **الإعلانُ يسبق الميكروفون.** لا يُشغَّل التقاطٌ ولا يُفتح مجرًى صوتيٌّ
   * حتّى يُقرأ الإعلانُ ويقع الإذنُ الصريح — وهذا هو المدخلُ الوحيدُ إلى البدء.
   */
  const requestStart = useCallback(() => {
    // الموافقةُ مرّةٌ واحدة، والإعلانُ في كلِّ حالٍ على حدة
    if (!readConsent() || !declaredIn().includes(halId)) {
      setAsking(true);
      return;
    }
    void begin();
  }, [begin, halId]);

  const agreeAndStart = useCallback(() => {
    saveConsent();
    noteDeclared(halId);
    setConsent(readConsent());
    setAsking(false);
    void begin();
  }, [begin, halId]);

  /* ── «تجاوز»: رخصةٌ كي لا يَحبِس التتبّعُ قارئًا مصيبًا (في التثبيت وحدَه) ── */
  const skipOne = useCallback(() => {
    const win = winRef.current;
    if (!win) return;
    const next = Math.min(cursorRef.current + 1, win.norms.length);
    cursorRef.current = next;
    anchorRef.current = next;
    skipsRef.current += 1;
    setCursor(next);
  }, []);

  /* ── إن طال الصمتُ ولم يصل شيء: خبرٌ عن الآلة لا تصحيحٌ للقارئ ── */
  useEffect(() => {
    if (phase !== "running" || heard) return;
    const t = window.setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(t);
  }, [phase, heard]);

  const chooseHal = (id: HalId) => {
    setHalId(id);
    setAsking(false);
    const h = findHal(id);
    if (!h.suspended) saveHal(id);
    // الختمةُ تستأنف من آخر موضعٍ تلقائيًّا، والمصحفُ كلُّه مقطعُها الطبيعيّ
    if (id === "khatma") {
      setPick("mushaf");
      setResume(true);
    }
  };

  const copy = (what: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => setCopied(what));
  };

  /** زرُّ إغلاقٍ واحدٌ يعود بالقارئ من حيث جاء — وإن قدِم من خارج التطبيق فإلى المصحف */
  const close = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/read");
  };

  /* ═══════════════ قِطَعٌ تُشترك فيها الشاشتان ═══════════════ */

  const halNote = (h: Hal) => (h.suspended ? h.suspended : h.what);

  /** النصُّ القرآنيّ — من قاعدتنا حرفًا، ولا تحويلَ في موضع العرض.
   *  **والنصُّ نصٌّ لا زرّ**، ولا يُخفَت ولا يُطمس: المصحفُ يُفتح صافيًا والبدءُ
   *  من الشريط (أمر المالك 2026-08-14 — «ألغِ هذا البوب أب»). */
  const textView = () => {
    if (!script) return <div className="sawt-text sawt-text-wait" />;
    return (
      <div
        className={`sawt-text${hal.bigger ? " sawt-big" : ""}`}
        dir="rtl"
        ref={textElRef}
        data-sawt="text"
      >
        {script.ayahs.map((a, ai) => (
          <p className="sawt-aya" key={`${a.surahNo}:${a.ayahNo}`}>
            {/* فاصلُ سورةٍ حين ينتقل المقطعُ من سورةٍ إلى أخرى — كي يعرف
                القارئُ أين هو بلا أن يُقطع عليه سياقُ التلاوة */}
            {(ai === 0 || script.ayahs[ai - 1].surahNo !== a.surahNo) && (
              <span className="sawt-surah">{surahNameAr(a.surahNo)}</span>
            )}
            {script.words.slice(a.from, a.to + 1).map((w, k) => {
              const i = a.from + k;
              const state = i < cursor ? "past" : i === cursor ? "now" : "next";
              const hidden = hal.text === "veiled" && i >= cursor;
              return (
                <span
                  key={w.location}
                  ref={i === cursor ? currentElRef : undefined}
                  className={`sawt-w sawt-${state}${hidden ? " sawt-veil" : ""}`}
                >
                  {w.text}{" "}
                </span>
              );
            })}
            <span className="ayah-marker">﴿{num(a.ayahNo)}﴾</span>
          </p>
        ))}
      </div>
    );
  };

  /** قائمةُ اختيار الحال — عنصرٌ واحدٌ صغير، والموقوفةُ فيها باسمها */
  const halSelect = () => (
    <select
      className="sawt-hal-select"
      data-sawt="hal"
      value={halId}
      aria-label="الحال"
      disabled={phase === "running"}
      onChange={(e) => chooseHal(e.target.value as HalId)}
    >
      {HALAT.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
          {h.suspended ? " (موقوفة)" : ""}
        </option>
      ))}
    </select>
  );

  /**
   * **الإعلانُ قبل أوّل تشغيلٍ للميكروفون** — بعبارةٍ بيّنةٍ لا تُخفى في تفصيلٍ
   * مطويّ، وأظهرُ ما يكون في «الصلاة».
   */
  const consentView = () => (
    <div className="sawt-warn" role="alertdialog" aria-label="قبل تشغيل الميكروفون" data-sawt="consent">
      <b>قبل تشغيل الميكروفون:</b> هذه الصفحة تستعمل محرّكَ التعرّف المدمج في المتصفّح،
      <b> وهو يرسل صوتَك إلى خادم صانع المتصفّح</b> (غوغل في كروم، وآبل في سفاري) ليحوّله إلى
      نصّ. ولا نحفظ نحن صوتًا، ولا نخزّنه، ولا يصل إلى خوادمنا منه شيء.
      {halId === "salat" && (
        <p className="sawt-warn-loud">
          <b>وأنت تختار «الصلاة»</b> — فاعلم أنّ صوتَ تلاوتك في صلاتك يمرّ بخادم صانع
          المتصفّح ما دام هذا المحرّكُ هو العامل. وحتّى يقوم المحرّكُ الحرُّ على الجهاز نفسِه،
          هذا حالُه ولا يُكتم.
        </p>
      )}
      <div className="sawt-warn-acts">
        <button className="sawt-start" onClick={agreeAndStart} data-sawt="agree">
          أوافق — وابدأ
        </button>
        <button className="sawt-copy" onClick={() => setAsking(false)}>
          لا
        </button>
      </div>
    </div>
  );

  /** اختيارُ المقطع على المصحف كلِّه */
  const pickerView = () => (
    <>
      <div className="sawt-segs">
        {(
          [
            ["surah", "سورة"],
            ["juz", "جزء"],
            ["page", "صفحة"],
            ["range", "من آيةٍ إلى آية"],
            ["mushaf", "المصحف كلُّه"],
            ["mihakk", "مقاطع المحكّ"],
          ] as [Pick, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            className={`sawt-seg${pick === k ? " on" : ""}`}
            onClick={() => setPick(k)}
            aria-pressed={pick === k}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="sawt-pick-row">
        {(pick === "surah" || pick === "range") && (
          <select className="sawt-select" value={surahNo} onChange={(e) => setSurahNo(Number(e.target.value))}>
            {Array.from({ length: SURAHS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {num(n)} — {surahNameAr(n)}
              </option>
            ))}
          </select>
        )}
        {pick === "range" && (
          <>
            <label className="sawt-mini">
              من آية
              <input
                type="number"
                min={1}
                value={rangeFrom}
                onChange={(e) => setRangeFrom(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="sawt-mini">
              إلى آية
              <input
                type="number"
                min={1}
                value={rangeTo}
                onChange={(e) => setRangeTo(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          </>
        )}
        {pick === "juz" && (
          <select className="sawt-select" value={juz} onChange={(e) => setJuz(Number(e.target.value))}>
            {Array.from({ length: JUZS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                الجزء {num(n)}
              </option>
            ))}
          </select>
        )}
        {pick === "page" && (
          <select className="sawt-select" value={page} onChange={(e) => setPage(Number(e.target.value))}>
            {Array.from({ length: PAGES }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                صفحة {num(n)}
              </option>
            ))}
          </select>
        )}
        {pick === "mihakk" && (
          <select className="sawt-select" value={sealed} onChange={(e) => setSealed(e.target.value)}>
            {SEALED_SEGMENTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="muted sawt-note">
        {script ? (
          <>
            {spec.title} · {num(ayahCountOf(script))} آية
            {winRef.current?.more ? " — يُحمَّل ما يُتلى وما حوله، ويتّسع مع تقدّمك" : ` · ${num(wordCount)} كلمة`}
          </>
        ) : (
          "يُحمَّل المقطع…"
        )}
      </p>
      {mark && !hal.resumes && (
        <label className="sawt-check">
          <input type="checkbox" checked={resume} onChange={(e) => setResume(e.target.checked)} />
          <span>
            ابدأ من آخر موضعٍ بلغه صوتُك:{" "}
            <b>
              {surahNameAr(Number(mark.location.split(":")[0]))} {num(Number(mark.location.split(":")[1]))}
            </b>{" "}
            — {arDate(mark.at)}
          </span>
        </label>
      )}
    </>
  );

  /** الأحوالُ المقيسة وقياسُ الزمن — عُدّةُ المحكّ، تبقى كما خُتمت */
  const mihakkView = () => (
    <>
      <h2 className="sawt-h2">حالُ القراءة المقيسة</h2>
      <p className="muted sawt-note">
        حكمُ العبور على <b>حال الأساس</b> وحدَها. وما سواها يُقاس ليُعرف حدُّ الباب — لا ليُسقط
        المحكّ.
      </p>
      <div className="sawt-segs">
        {CONDITIONS.map((c) => (
          <button
            key={c.id}
            className={`sawt-seg${conditionId === c.id ? " on" : ""}`}
            onClick={() => setConditionId(c.id)}
            aria-pressed={conditionId === c.id}
            title={c.note}
          >
            {c.name}
            {c.priority ? " ★" : ""}
          </button>
        ))}
      </div>
      <label className="sawt-check">
        <input type="checkbox" checked={measureTime} onChange={(e) => setMeasureTime(e.target.checked)} />
        <span>
          قياسُ زمن التتبّع (يفتح مجرًى ثانيًا للميكروفون لقياس السكوت — يُطفأ إن تعارض مع
          المحرّك، ولا يُسجَّل صوت)
        </span>
      </label>
      {consent && (
        <p className="muted sawt-note">
          أذِنتَ بالميكروفون في {arDate(consent.at)} —{" "}
          <button
            className="sawt-link"
            onClick={() => {
              clearConsent();
              setConsent(null);
            }}
          >
            اسحب الإذن
          </button>
        </p>
      )}
    </>
  );

  /* ═══════════════ ما بعد الختام ═══════════════ */

  const r = report;
  const pct = r ? Math.round(r.hits.rate * 1000) / 10 : 0;
  const summary = r
    ? [
        `المقطع: ${r.segmentTitle}`,
        `الحال: ${hal.name} · ${r.condition}`,
        `الجهاز: ${deviceName()}${isStandalone() ? " (تطبيقٌ مثبَّت)" : " (لسانُ المتصفّح)"}`,
        `الكلماتُ المتلوّة: ${r.span.words}`,
        `الإصابة: ${pct}٪ (مباشرة ${r.hits.direct} · بالجوار ${r.hits.bridged} · فائتة ${r.hits.missed})`,
        `حوادثُ الفقد: ${r.losses.count} · أبعدُ استرداد: ${r.losses.worst ?? "—"} · بلا عودة: ${r.losses.unresolved}`,
        `القفزُ الكاذب: ${r.falseJumps}`,
        r.waqf.measured
          ? `زمنُ الوقف: وسيط ${r.waqf.median} مِث · مئين٩٠ ${r.waqf.p90} مِث (${r.waqf.count} وقفة)`
          : "زمنُ الوقف: غير مقيسٍ آليًّا",
        `زمنُ المحرّك عندنا: وسيط ${r.engine.median ?? "—"} مِث (${r.engine.count} حركة)`,
        `انقطاعُ المحرّك واستئنافُه: ${r.restarts} مرّة`,
        `التجاوزُ باليد: ${r.manualSkips} · المضيُّ عند الشكّ: ${r.autoAdvances}`,
        `أطولُ سكوت: ${r.longestSilenceMs ?? "—"} مِث`,
        felt ? `إحساسُ القارئ بالزمن: ${felt}` : null,
        `زمنُ فتح المقطع: ${openMs ?? "—"} مِث`,
        `المدّة: ${Math.round(r.durationMs / 1000)} ثانية`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const measureView = () =>
    r ? (
      <div className="sawt-card">
        <h2 className="sawt-h2">قياسُ التتبّع</h2>
        <p className="muted sawt-note">
          هذه أرقامٌ عن <b>الآلة</b> — كم تبِعت وكم فاتها وكم تأخّرت. وليست حكمًا على التلاوة.
          الحال: <b>{r.condition}</b>.
        </p>
        {!r.measurable && (
          <p className="sawt-note">
            <b>لم تقع تلاوةٌ يُقاس عليها في هذه التشغيلة</b> — فليس ما دونُ حكمًا على المحكّ لا
            بعبورٍ ولا بإخفاق.
          </p>
        )}
        <table className="sawt-table">
          <tbody>
            <tr>
              <td>الإصابة</td>
              <td>
                <b>{num(pct)}٪</b> من {num(r.span.words)} كلمة
              </td>
              <td className={!r.measurable ? "" : r.verdict.hitRate ? "ok" : "no"}>
                {!r.measurable ? "لم يُقَس" : r.verdict.hitRate ? "بلغ ٩٠٪" : "دون ٩٠٪"}
              </td>
            </tr>
            <tr>
              <td>الاسترداد</td>
              <td>
                {num(r.losses.count)} حادثة · أبعدُها{" "}
                {r.losses.worst == null ? "—" : num(r.losses.worst)} كلمة
                {r.losses.unresolved ? ` · ${num(r.losses.unresolved)} بلا عودة` : ""}
              </td>
              <td className={!r.measurable ? "" : r.verdict.recovery ? "ok" : "no"}>
                {!r.measurable ? "لم يُقَس" : r.verdict.recovery ? "في حدّ ٣ كلمات" : "جاوز ٣ كلمات"}
              </td>
            </tr>
            <tr>
              <td>القفزُ الكاذب</td>
              <td>{num(r.falseJumps)}</td>
              <td className={!r.measurable ? "" : r.verdict.falseJumps ? "ok" : "no"}>
                {!r.measurable ? "لم يُقَس" : r.verdict.falseJumps ? "في الحدّ" : "جاوز الحدّ"}
              </td>
            </tr>
            <tr>
              <td>زمنُ الوقف</td>
              <td>
                {r.waqf.measured
                  ? `وسيط ${num(r.waqf.median ?? 0)} مِث · مئين٩٠ ${num(r.waqf.p90 ?? 0)} مِث`
                  : "غير مقيسٍ آليًّا"}
              </td>
              <td className={r.verdict.latency == null ? "" : r.verdict.latency ? "ok" : "no"}>
                {r.verdict.latency == null ? "لا يُحكم فيما لم يُقَس" : r.verdict.latency ? "في الحدّ" : "جاوز الحدّ"}
              </td>
            </tr>
            <tr>
              <td>ثباتُ المحرّك</td>
              <td>
                انقطع واستُؤنف {num(r.restarts)} مرّة · أطولُ سكوت{" "}
                {r.longestSilenceMs == null ? "—" : `${num(r.longestSilenceMs)} مِث`}
              </td>
              <td />
            </tr>
            <tr>
              <td>ما مضى بلا مطابقة</td>
              <td>
                تجاوزٌ باليد {num(r.manualSkips)} · مضيٌّ عند الشكّ {num(r.autoAdvances)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>

        {!r.waqf.measured && (
          <div className="sawt-felt">
            <span>ولمّا لم يُقَس الزمنُ آليًّا — كيف أحسسته؟</span>
            {["يسبقني", "معي", "يتخلّف"].map((f) => (
              <button key={f} className={`sawt-seg${felt === f ? " on" : ""}`} onClick={() => setFelt(f)}>
                {f}
              </button>
            ))}
          </div>
        )}

        <button className="sawt-copy" onClick={() => copy("run", summary)}>
          {copied === "run" ? "نُسخ" : "انسخ القياس"}
        </button>
      </div>
    ) : null;

  const placesView = () =>
    r ? (
      <div className="sawt-card">
        <h2 className="sawt-h2">مواضعُ للنظر</h2>
        <p className="muted sawt-note">
          مواضعُ لم يتبيّن لنا فيها ما تُلي — وقد يكون ذلك من سمع الآلة لا من التلاوة.
          <b> فهذا خبرٌ لا حكم، ولا يُعدُّ خطأً، والآلةُ لا تُجيز.</b>
        </p>
        {r.places.length === 0 ? (
          <p className="muted">لم يقع موضعٌ للنظر.</p>
        ) : (
          <ul className="sawt-places">
            {r.places.slice(0, 40).map((p, i) => {
              const [s, a] = p.from.split(":");
              const [, a2] = p.to.split(":");
              return (
                <li key={`${p.from}-${p.to}-${i}`}>
                  <span className="sawt-place-ref">
                    {surahNameAr(Number(s))} {num(Number(a))}
                    {a2 !== a ? ` — ${num(Number(a2))}` : ""}
                  </span>
                  <span className="sawt-place-note">{p.note}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ) : null;

  /** بعد الختام — وفي «الصلاة» صمتٌ تامّ: كلمةٌ واحدةٌ وعودة، لا رقمَ ولا موضع */
  const afterView = () => {
    if (hal.after === "silent") {
      return (
        <div className="sawt-quiet" data-sawt="after">
          <p className="sawt-quiet-word">تقبّل الله</p>
          <button className="sawt-start" onClick={() => setPhase("idle")}>
            عودة
          </button>
        </div>
      );
    }
    return (
      <div data-sawt="after">
        <h1 className="sawt-h1">بعد الختام</h1>
        {hal.after === "mark" && reached && (
          <div className="sawt-card">
            <h2 className="sawt-h2">بلغتَ</h2>
            <p className="sawt-reached">{reached}</p>
            <p className="muted sawt-note">
              حُفظ موضعُك في هذا الجهاز، فتستأنف منه في المجلس القادم. موضعٌ وتاريخُه لا غير.
            </p>
          </div>
        )}
        {measureView()}
        {hal.after === "places" && placesView()}
        {engineDetail && <p className="muted sawt-note">خبرُ المحرّك: {engineDetail}</p>}
        <button className="sawt-start" onClick={() => setPhase("idle")}>
          تلاوةٌ أخرى
        </button>
      </div>
    );
  };

  /* ═══════════════ الجوال: ملءُ الشاشة، وثلاثةٌ لا رابعَ لها ═══════════════
     **ولا لوحَ عند القدوم** (أمر المالك 2026-08-14): تُفتح الصفحةُ على المصحف
     صافيًا — لا طمسَ ولا اعتراض — والبدءُ من الشريط نفسِه. فالعددُ ثلاثةٌ كما
     كان: النصُّ، والشريطُ (فيه أداتان و✕)، وما ينفتح عنه الشريطُ بطلبٍ لا بقدوم. */

  if (mobile) {
    const suspended = !!hal.suspended;
    return (
      <div className="sawt-m" data-sawt="root">
        <div className="sawt-m-bar">
          <button
            className="sawt-x"
            data-sawt="close"
            aria-label={phase === "running" ? "أنهيت" : "إغلاق"}
            onClick={phase === "running" ? finish : close}
          >
            ✕
          </button>
          {halSelect()}
          {phase === "idle" && (
            <button
              className={`sawt-m-more${setup ? " on" : ""}`}
              aria-label="المزيد — المقطعُ وعُدّةُ القياس"
              aria-expanded={setup}
              onClick={() => {
                setAsking(false);
                setSetup((v) => !v);
              }}
            >
              ⋯
            </button>
          )}
          {phase === "idle" && !suspended && (
            <button
              className="sawt-m-start"
              onClick={() => {
                setSetup(false);
                requestStart();
              }}
              disabled={!supported || !ready}
              data-sawt="begin"
            >
              {ready ? "ابدأ" : "…"}
            </button>
          )}
        </div>

        {/* **الإعلانُ حيث يقع الفعل**: ينفتح عنه الشريطُ عند ضغط «ابدأ» — بلا
            طمسٍ ولا صندوقٍ فوق النصّ، والموافقةُ مرّةٌ واحدةٌ محفوظةٌ كما هي */}
        {phase === "idle" && asking && <div className="sawt-m-panel">{consentView()}</div>}

        {/* عُدّةُ التهيئة — بطلبٍ لا بقدوم، تنزل من الشريط ولا تعلو المتن */}
        {phase === "idle" && !asking && setup && (
          <div className="sawt-m-panel" data-sawt="setup">
            <p className="sawt-hal-name">
              {hal.name}
              {suspended ? " — موقوفة" : ""}
            </p>
            <p className="muted sawt-note">{halNote(hal)}</p>
            {!suspended && (
              <>
                {pickerView()}
                {mihakkView()}
              </>
            )}
          </div>
        )}

        {phase === "idle" && !asking && !setup && (suspended || !supported) && (
          <p className="muted sawt-hint">
            {suspended
              ? halNote(hal)
              : "متصفّحُ هذا الجهاز لا يتيح التعرّفَ على الصوت — فلا يعمل التتبّعُ هنا."}
          </p>
        )}

        {textView()}

        {phase === "done" && (
          <div className="sawt-sheet" role="dialog" aria-label="بعد الختام">
            <div className="sawt-sheet-in">
              {afterView()}
            </div>
          </div>
        )}

        {phase === "running" && hal.after !== "silent" && slow && !heard && (
          <p className="muted sawt-hint">
            لم يصل صوتٌ بعدُ. إن طال ذلك فأنهِ، ثمّ أطفئ «قياسَ زمن التتبّع» وأعد البدء.
          </p>
        )}
      </div>
    );
  }

  /* ═══════════════ الحاسوب ═══════════════ */

  if (phase === "running") {
    const cur = script?.words[Math.min(cursor, wordCount - 1)];
    return (
      <div className="sawt-run" data-sawt="root">
        <div className="sawt-run-bar">
          <span className="sawt-where">{cur ? `${surahNameAr(cur.surahNo)} ${num(cur.ayahNo)}` : "—"}</span>
          <span className={`sawt-dot sawt-dot-${engineState}`} aria-label="حالُ الإصغاء" />
          {hal.text === "veiled" && (
            <button className="sawt-skip" onClick={skipOne}>
              تجاوز
            </button>
          )}
          <button className="sawt-end" onClick={finish}>
            أنهيت
          </button>
        </div>
        {textView()}
        {hal.after !== "silent" && slow && !heard && (
          <p className="muted sawt-hint">
            لم يصل صوتٌ بعدُ. إن طال ذلك فأنهِ، ثمّ أطفئ «قياسَ زمن التتبّع» وأعد البدء — فقد
            يتنازع مجرى القياس والمحرّكَ على الميكروفون في بعض الأجهزة.
          </p>
        )}
        {hal.after !== "silent" && engineState === "denied" && (
          <div className="sawt-warn sawt-warn-hard">
            لم يُؤذن للصفحة بالميكروفون — يُؤذن من إعدادات المتصفّح ثمّ يُعاد البدء.
          </div>
        )}
      </div>
    );
  }

  const matrix = CONDITIONS.map((c) => {
    const rows = runs.filter((x) => x.conditionId === c.id);
    return { c, last: rows.length ? rows[rows.length - 1] : null };
  });
  const matrixText = [
    `مصفوفةُ الأحوال — ${deviceName()}${isStandalone() ? " (تطبيقٌ مثبَّت)" : " (لسانُ المتصفّح)"}`,
    ...matrix.map(({ c, last }) =>
      last
        ? `${c.name}: إصابة ${last.hitPct}٪ · قفزٌ كاذب ${last.falseJumps} · ${last.segmentTitle} (${last.words} كلمة)`
        : `${c.name}: لم يُقَس`,
    ),
  ].join("\n");

  return (
    <div className="page sawt" data-sawt="root">
      <div className="page-narrow">
        <div className="sawt-top">
          <h1 className="sawt-h1">التتبّع</h1>
          <button className="sawt-x" data-sawt="close" aria-label="إغلاق" onClick={close}>
            ✕
          </button>
        </div>

        {phase === "done" ? (
          afterView()
        ) : (
          <>
            <p className="muted sawt-lede">تتلو، فيجري المؤشّرُ مع صوتك في المصحف.</p>

            <h2 className="sawt-h2">الحال</h2>
            <div className="sawt-halat">
              {HALAT.map((h) => (
                <button
                  key={h.id}
                  className={`sawt-hal${halId === h.id ? " on" : ""}${h.suspended ? " off" : ""}`}
                  onClick={() => chooseHal(h.id)}
                  aria-pressed={halId === h.id}
                >
                  <span className="sawt-hal-n">
                    {h.name}
                    {h.suspended ? " — موقوفة" : ""}
                  </span>
                  <span className="sawt-hal-w">{halNote(h)}</span>
                </button>
              ))}
            </div>

            {hal.suspended ? (
              <p className="sawt-note">
                هذه الحالُ موقوفةٌ اليوم — <b>{hal.suspended}</b>. واخترْ غيرَها لتتلوَ الآن.
              </p>
            ) : (
              <>
                <h2 className="sawt-h2">المقطع</h2>
                {pickerView()}

                {asking ? (
                  consentView()
                ) : (
                  <button
                    className="sawt-start"
                    onClick={requestStart}
                    disabled={!supported || !ready}
                    data-sawt="begin"
                  >
                    {ready ? "ابدأ — ثمّ لا تلمس شيئًا" : "يُحمَّل المقطع…"}
                  </button>
                )}
                {!supported && (
                  <div className="sawt-warn sawt-warn-hard">
                    متصفّحُ هذا الجهاز لا يتيح التعرّفَ على الصوت — فلا يعمل التتبّعُ هنا.
                  </div>
                )}
                <p className="muted sawt-note">
                  الميكروفونُ يوجب إيماءةً من المتصفّح، فهذه لمسةٌ واحدةٌ قبل البدء. وبعدها تبقى
                  الشاشةُ مضاءةً ويتبعك التمريرُ وحدَه.
                </p>

                {mihakkView()}

                <div className="sawt-card">
                  <h2 className="sawt-h2">مصفوفةُ الأحوال — ما قيس على هذا الجهاز</h2>
                  <p className="muted sawt-note">
                    {deviceName()} · {isStandalone() ? "تطبيقٌ مثبَّت" : "لسانُ المتصفّح"}
                  </p>
                  <table className="sawt-table">
                    <tbody>
                      {matrix.map(({ c, last }) => (
                        <tr key={c.id}>
                          <td>
                            {c.name}
                            {c.priority ? " ★" : ""}
                          </td>
                          <td>
                            {last ? (
                              <>
                                إصابة <b>{last.hitPct}٪</b> · قفزٌ كاذب {num(last.falseJumps)}
                              </>
                            ) : (
                              <span className="muted">لم يُقَس</span>
                            )}
                          </td>
                          <td className="muted">{last ? last.segmentTitle : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="sawt-copy" onClick={() => copy("matrix", matrixText)}>
                    {copied === "matrix" ? "نُسخت" : "انسخ المصفوفة"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

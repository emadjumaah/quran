/**
 * «التتبّع بالصوت» — مسبارٌ مستور.
 *
 * صفحةٌ يتلو فيها القارئُ من المصحف فيجري المؤشّرُ مع صوته تلقائيًّا، بأربعة
 * أوضاعٍ بنصّ توجيه المالك. **وهي مسبارٌ لا بابٌ منشور**: لا تُدرج في التنقّل،
 * ولا في التوثيق، ولا يُبلَّغ رابطُها إلّا للفحص.
 *
 * **سياسةُ التصحيح — قرارُ الإدارة، مُلزِمٌ ولا يُخالَف هنا ولا في غيره**:
 * لا تصحيحَ أثناء التلاوة البتّة. لا لونَ أحمر، ولا صوت، ولا اهتزاز، ولا كلمةَ
 * «أخطأت». ثلاثُ مراتب: (١) أثناءها المؤشّرُ وحدَه، وفي وضع الكشف **عدمُ
 * انكشاف الكلمة هو التنبيه** — تصحيحٌ لا يقول شيئًا؛ (٢) وعند الوقف إشارةٌ
 * صامتةٌ تُهمَل؛ (٣) وبعد الختام «مواضعُ للنظر» وهي موضعُ القول وحدَه. **وفي
 * وضع الصلاة صمتٌ تامّ**: لا أثناءها ولا بعدها.
 *
 * **وحدٌّ يُبنى عليه التصميم** (ملحقُ الإدارة §٣): لا يُميَّز في هذه الطبقة
 * خطأُ القارئ من خطأ المحرّك — فالميلُ إلى التسامح والمضيّ، ولغةُ ما بعد
 * الختام لغةُ شكٍّ: «لم يتبيّن لنا» لا «أخطأت»، **والآلةُ لا تُجيز**.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ALIGN, alignUtterance, speechTokens } from "../lib/sawt/align";
import { SawtMeter, type SawtReport } from "../lib/sawt/metrics";
import {
  WebSpeechRecognizer,
  type RecognizerPort,
  type RecognizerState,
  webSpeechAvailable,
} from "../lib/sawt/recognizer";
import { SEALED_SEGMENTS, type SawtScript, type SegmentSpec, loadSegment } from "../lib/sawt/script";
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

type Phase = "setup" | "running" | "done";

/** الأوضاعُ الأربعةُ بنصّ توجيه المالك */
type Mode = "follow" | "reveal" | "silent" | "review";

const MODES: { id: Mode; name: string; what: string; who: string }[] = [
  { id: "follow", name: "متابعةٌ بالنصّ", what: "النصُّ ظاهرٌ كلُّه، والمؤشّر يجري مع الصوت", who: "المراجعة · القراءة في الصلاة" },
  { id: "reveal", name: "الكشفُ بالتلاوة", what: "التالي مخفيّ، وتنكشف الكلمةُ حين تُتلى — ولا ينكشف ما بعدها", who: "التحفيظ" },
  { id: "silent", name: "بلا تصحيح", what: "تتبّعٌ فقط، وصمتٌ تامّ — لا شيءَ بعد الختام", who: "الصلاة" },
  { id: "review", name: "مع مراجعةٍ بعديّة", what: "تتبّعٌ الآن، ومواضعُ للنظر بعد الختام", who: "المراجعة" },
];

/** كم نتيجةً مختومةً يقف عندها المؤشّرُ قبل أن يمضيَ من تلقائه */
const STALL_BEFORE_ADVANCE = 3;

interface WakeLockish {
  release(): Promise<void>;
}
interface WakeLockNav {
  wakeLock?: { request(type: "screen"): Promise<WakeLockish> };
}

export default function Tatabbu() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("follow");
  const [segKey, setSegKey] = useState<string>(SEALED_SEGMENTS[0].id);
  const [surahNo, setSurahNo] = useState(1);
  const [conditionId, setConditionId] = useState("asas");
  const [script, setScript] = useState<SawtScript | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [engineState, setEngineState] = useState<RecognizerState>("idle");
  const [engineDetail, setEngineDetail] = useState<string | null>(null);
  const [report, setReport] = useState<SawtReport | null>(null);
  const [measureTime, setMeasureTime] = useState(!isAppleMobile());
  const [waqfMeasured, setWaqfMeasured] = useState(false);
  const [resume, setResume] = useState(false);
  const [felt, setFelt] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [runs, setRuns] = useState<SawtRunRow[]>([]);

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

  const mark = useMemo(() => readMark(), [phase]);
  const supported = webSpeechAvailable();
  const condition = CONDITIONS.find((c) => c.id === conditionId) ?? CONDITIONS[0];

  const spec: SegmentSpec = useMemo(() => {
    const sealed = SEALED_SEGMENTS.find((s) => s.id === segKey);
    if (sealed) return sealed;
    return { id: `s${surahNo}`, title: `سورة ${surahNameAr(surahNo)}`, kind: "surahs", surahs: [surahNo] };
  }, [segKey, surahNo]);

  useEffect(() => setRuns(listRuns()), [phase]);

  /* ── تحميلُ المقطع من قاعدة المصحف عندنا (لا نصَّ في الشيفرة) ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadSegment(spec)
      .then((s) => {
        if (alive) setScript(s);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [spec]);

  const norms = useMemo(() => script?.words.map((w) => w.norm) ?? [], [script]);

  /** موضعُ العلامة في هذا المقطع — إن كان فيه */
  const markIndex = useMemo(() => {
    if (!mark || !script) return -1;
    return script.words.findIndex((w) => w.location === mark.location);
  }, [mark, script]);

  /* ── تمريرٌ يتبع المؤشّر: لا لمسَ بعد البدء ── */
  useEffect(() => {
    if (phase !== "running") return;
    currentElRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    const silence = vadRef.current?.longestSilenceMs() ?? null;
    stopAll();
    if (meter) {
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
      // علامةُ آخر موضع: موضعٌ وتاريخُه لا غير
      const w = script?.words[Math.min(cursorRef.current, (script.words.length || 1) - 1)];
      if (w && cursorRef.current > 0) saveMark(w.location);
    }
    setPhase("done");
  }, [stopAll, waqfMeasured, condition, script]);

  /* ── البدء: لمسةٌ واحدة، ثمّ لا لمسَ البتّة ── */
  const start = useCallback(async () => {
    if (!script) return;
    const at = resume && markIndex >= 0 ? markIndex : 0;
    anchorRef.current = at;
    cursorRef.current = at;
    skipsRef.current = 0;
    autoRef.current = 0;
    stallRef.current = 0;
    lastAdvanceRef.current = 0;
    setCursor(at);
    setHeard(false);
    setSlow(false);
    setFelt(null);
    setReport(null);
    setCopied(null);
    const meter = new SawtMeter(script);
    meterRef.current = meter;

    // الشاشةُ تبقى: القارئُ لا يلمس شيئًا بعد التكبير
    try {
      const nav = navigator as unknown as WakeLockNav;
      wakeRef.current = (await nav.wakeLock?.request("screen")) ?? null;
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
      const step = alignUtterance(norms, tokens, before, DEFAULT_ALIGN);
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
      if (stallRef.current >= STALL_BEFORE_ADVANCE && before < norms.length) {
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
  }, [script, measureTime, norms, resume, markIndex]);

  /* ── «تجاوز»: رخصةٌ كي لا يَحبِس المسبارُ قارئًا مصيبًا ── */
  const skipOne = useCallback(() => {
    const next = Math.min(cursorRef.current + 1, norms.length);
    cursorRef.current = next;
    anchorRef.current = next;
    skipsRef.current += 1;
    setCursor(next);
  }, [norms.length]);

  /* ── إن طال الصمتُ ولم يصل شيء: خبرٌ عن الآلة لا تصحيحٌ للقارئ ── */
  useEffect(() => {
    if (phase !== "running" || heard) return;
    const t = window.setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(t);
  }, [phase, heard]);

  /* ── إخفاءُ هيكل التطبيق: صفحةُ تلاوةٍ لا صفحةُ تصفّح ── */
  useEffect(() => {
    if (phase !== "running") return;
    document.body.classList.add("sawt-live");
    return () => document.body.classList.remove("sawt-live");
  }, [phase]);

  const copy = (what: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => setCopied(what));
  };

  if (!script || loading) {
    return (
      <div className="page">
        <div className="page-narrow muted">يُحمَّل المقطع…</div>
      </div>
    );
  }

  /* ═══════════════ التهيئة ═══════════════ */
  if (phase === "setup") {
    const matrix = CONDITIONS.map((c) => {
      const rows = runs.filter((r) => r.conditionId === c.id);
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
      <div className="page sawt">
        <div className="page-narrow">
          <h1 className="sawt-h1">التتبّع بالصوت</h1>
          <p className="muted sawt-lede">
            تتلو، فيجري المؤشّرُ مع صوتك في المصحف. صفحةُ تجربةٍ تحت الفحص — لم تُنشر بعد.
          </p>

          <div className="sawt-warn" role="note">
            <b>قبل تشغيل الميكروفون:</b> هذه الصفحة تستعمل محرّكَ التعرّف المدمج في
            المتصفّح، <b>وهو يرسل صوتَك إلى خادم صانع المتصفّح</b> (غوغل في كروم، وآبل في
            سفاري) ليحوّله إلى نصّ. ولا نحفظ نحن صوتًا، ولا نخزّنه، ولا نرسله إلى أحد.
            ولهذا <b>لا يصلح هذا المحرّكُ للصلاة ولا للنشر العامّ</b> — إنّما هو محرّكُ
            تجربةٍ حتّى يقوم المحرّكُ الحرُّ على الجهاز بلا شبكة.
          </div>

          {!supported && (
            <div className="sawt-warn sawt-warn-hard">
              متصفّحُ هذا الجهاز لا يتيح التعرّفَ على الصوت — فلا تعمل التجربةُ هنا.
            </div>
          )}

          <h2 className="sawt-h2">الوضع</h2>
          <div className="sawt-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`sawt-mode${mode === m.id ? " on" : ""}`}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
              >
                <span className="sawt-mode-name">{m.name}</span>
                <span className="sawt-mode-what">{m.what}</span>
                <span className="sawt-mode-who">{m.who}</span>
              </button>
            ))}
          </div>

          <h2 className="sawt-h2">المقطع</h2>
          <div className="sawt-segs">
            {SEALED_SEGMENTS.map((s) => (
              <button
                key={s.id}
                className={`sawt-seg${segKey === s.id ? " on" : ""}`}
                onClick={() => setSegKey(s.id)}
                aria-pressed={segKey === s.id}
              >
                {s.title}
              </button>
            ))}
            <button
              className={`sawt-seg${segKey === "surah" ? " on" : ""}`}
              onClick={() => setSegKey("surah")}
              aria-pressed={segKey === "surah"}
            >
              سورةٌ أخرى
            </button>
            {segKey === "surah" && (
              <select
                className="sawt-select"
                value={surahNo}
                onChange={(e) => setSurahNo(Number(e.target.value))}
              >
                {Array.from({ length: 114 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {num(n)} — {surahNameAr(n)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="muted sawt-note">
            {num(script.words.length)} كلمة · {num(script.ayahs.length)} آية
          </p>

          {mark && (
            <label className="sawt-check">
              <input
                type="checkbox"
                checked={resume && markIndex >= 0}
                disabled={markIndex < 0}
                onChange={(e) => setResume(e.target.checked)}
              />
              <span>
                آخرُ موضعٍ بلغه صوتُك:{" "}
                <b>
                  {surahNameAr(Number(mark.location.split(":")[0]))}{" "}
                  {num(Number(mark.location.split(":")[1]))}
                </b>{" "}
                — {new Date(mark.at).toLocaleDateString("ar")}
                {markIndex < 0 ? " (ليس في هذا المقطع)" : " · ابدأ منه"}
              </span>
            </label>
          )}

          <h2 className="sawt-h2">حالُ القراءة</h2>
          <p className="muted sawt-note">
            حكمُ العبور على <b>حال الأساس</b> وحدَها. وما سواها يُقاس ليُعرف حدُّ الباب —
            لا ليُسقط المحكّ.
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
          <p className="muted sawt-note">{condition.note}</p>

          <label className="sawt-check">
            <input
              type="checkbox"
              checked={measureTime}
              onChange={(e) => setMeasureTime(e.target.checked)}
            />
            <span>
              قياسُ زمن التتبّع (يفتح مجرًى ثانيًا للميكروفون لقياس السكوت — يُطفأ إن تعارض
              مع المحرّك، ولا يُسجَّل صوت)
            </span>
          </label>

          <button className="sawt-start" onClick={() => void start()} disabled={!supported}>
            ابدأ — ثمّ لا تلمس شيئًا
          </button>
          <p className="muted sawt-note">
            الميكروفونُ يوجب إيماءةً من المتصفّح، فهذه لمسةٌ واحدةٌ قبل البدء. وبعدها تبقى
            الشاشةُ مضاءةً ويتبعك التمريرُ وحدَه.
          </p>

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
        </div>
      </div>
    );
  }

  /* ═══════════════ التلاوة ═══════════════ */
  if (phase === "running") {
    const cur = script.words[Math.min(cursor, script.words.length - 1)];
    return (
      <div className="sawt-run">
        <div className="sawt-run-bar">
          <span className="sawt-where">
            {cur ? `${surahNameAr(cur.surahNo)} ${num(cur.ayahNo)}` : "—"}
          </span>
          <span className={`sawt-dot sawt-dot-${engineState}`} aria-label="حالُ الإصغاء" />
          {mode === "reveal" && (
            <button className="sawt-skip" onClick={skipOne}>
              تجاوز
            </button>
          )}
          <button className="sawt-end" onClick={finish}>
            أنهيت
          </button>
        </div>

        <div className="sawt-text" dir="rtl">
          {script.ayahs.map((a) => (
            <p className="sawt-aya" key={`${a.surahNo}:${a.ayahNo}`}>
              {script.words.slice(a.from, a.to + 1).map((w, k) => {
                const i = a.from + k;
                const state = i < cursor ? "past" : i === cursor ? "now" : "next";
                const hidden = mode === "reveal" && i >= cursor;
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

        {mode !== "silent" && slow && !heard && (
          <p className="muted sawt-hint">
            لم يصل صوتٌ بعدُ. إن طال ذلك فأنهِ، ثمّ أطفئ «قياسَ زمن التتبّع» وأعد البدء —
            فقد يتنازع مجرى القياس والمحرّكَ على الميكروفون في بعض الأجهزة.
          </p>
        )}

        {engineState === "denied" && (
          <div className="sawt-warn sawt-warn-hard">
            لم يُؤذن للصفحة بالميكروفون — يُؤذن من إعدادات المتصفّح ثمّ يُعاد البدء.
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════ بعد الختام ═══════════════ */

  // وضعُ الصلاة: صمتٌ تامّ — لا مواضعَ ولا أرقام. وهذا نصُّ قرار الإدارة.
  if (mode === "silent") {
    return (
      <div className="page sawt">
        <div className="page-narrow sawt-quiet">
          <p className="sawt-quiet-word">تقبّل الله</p>
          <button className="sawt-start" onClick={() => setPhase("setup")}>
            عودة
          </button>
        </div>
      </div>
    );
  }

  const r = report;
  const pct = r ? Math.round(r.hits.rate * 1000) / 10 : 0;
  const summary = r
    ? [
        `المقطع: ${r.segmentTitle}`,
        `الحال: ${r.condition}`,
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
        `المدّة: ${Math.round(r.durationMs / 1000)} ثانية`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className="page sawt">
      <div className="page-narrow">
        <h1 className="sawt-h1">بعد الختام</h1>

        {r && (
          <div className="sawt-card">
            <h2 className="sawt-h2">قياسُ المسبار</h2>
            <p className="muted sawt-note">
              هذه أرقامٌ عن <b>الآلة</b> — كم تبِعت وكم فاتها وكم تأخّرت. وليست حكمًا على
              التلاوة. الحال: <b>{r.condition}</b>.
            </p>
            <table className="sawt-table">
              <tbody>
                <tr>
                  <td>الإصابة</td>
                  <td>
                    <b>{pct}٪</b> من {num(r.span.words)} كلمة
                  </td>
                  <td className={r.verdict.hitRate ? "ok" : "no"}>
                    {r.verdict.hitRate ? "بلغ ٩٠٪" : "دون ٩٠٪"}
                  </td>
                </tr>
                <tr>
                  <td>الاسترداد</td>
                  <td>
                    {num(r.losses.count)} حادثة · أبعدُها {r.losses.worst ?? "—"} كلمة
                    {r.losses.unresolved ? ` · ${r.losses.unresolved} بلا عودة` : ""}
                  </td>
                  <td className={r.verdict.recovery ? "ok" : "no"}>
                    {r.verdict.recovery ? "في حدّ ٣ كلمات" : "جاوز ٣ كلمات"}
                  </td>
                </tr>
                <tr>
                  <td>القفزُ الكاذب</td>
                  <td>{num(r.falseJumps)}</td>
                  <td className={r.verdict.falseJumps ? "ok" : "no"}>
                    {r.verdict.falseJumps ? "في الحدّ" : "جاوز الحدّ"}
                  </td>
                </tr>
                <tr>
                  <td>زمنُ الوقف</td>
                  <td>
                    {r.waqf.measured
                      ? `وسيط ${r.waqf.median} مِث · مئين٩٠ ${r.waqf.p90} مِث`
                      : "غير مقيسٍ آليًّا"}
                  </td>
                  <td className={r.verdict.latency == null ? "" : r.verdict.latency ? "ok" : "no"}>
                    {r.verdict.latency == null
                      ? "لا يُحكم فيما لم يُقَس"
                      : r.verdict.latency
                        ? "في الحدّ"
                        : "جاوز الحدّ"}
                  </td>
                </tr>
                <tr>
                  <td>ثباتُ المحرّك</td>
                  <td>
                    انقطع واستُؤنف {num(r.restarts)} مرّة · أطولُ سكوت{" "}
                    {r.longestSilenceMs ?? "—"} مِث
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
                  <button
                    key={f}
                    className={`sawt-seg${felt === f ? " on" : ""}`}
                    onClick={() => setFelt(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            <button className="sawt-copy" onClick={() => copy("run", summary)}>
              {copied === "run" ? "نُسخ" : "انسخ القياس"}
            </button>
          </div>
        )}

        {mode === "review" && r && (
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
        )}

        {engineDetail && <p className="muted sawt-note">خبرُ المحرّك: {engineDetail}</p>}
        <button className="sawt-start" onClick={() => setPhase("setup")}>
          تجربةٌ أخرى
        </button>
      </div>
    </div>
  );
}

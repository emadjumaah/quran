import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseMawdi, readMawdi, saveMawdi } from "@mishkat/quran-core/lib/mawadi";
import { globalIdOf, locationOf } from "@mishkat/quran-core";
import { loadMushaf, num, type Mushaf } from "./mushaf";
import { applySettings, subscribeSettings } from "./settings";
import { loadAudio, stop as stopAudio } from "./audio";
import { useTatabbu, type Tatabbu } from "./tatabbu";
import { useTathbit } from "./tathbit";
import MushafPage from "./components/MushafPage";
import Goto from "./components/Goto";
import SettingsSheet from "./components/SettingsSheet";
import { AfterSheet, ConsentSheet, EngineSheet, TrackBar } from "./components/Track";
import { ForkBar, TathbitSheet } from "./components/Tathbit";
import { ListenSheet, PlayBar, usePlayState } from "./components/Listen";

/** لحظةُ إقلاع الجلسة — بها يُعرف الموضعُ المحفوظُ من موضعٍ كتبته هذه الجلسةُ نفسُها */
const SESSION_START = Date.now();

/**
 * **عدّةُ الصفحات المرسومةُ حول موضع القارئ** — والمصحفُ يتّصل بالتمرير لا بزرّ.
 * ولا يُرسم المصحفُ كلُّه (٦٠٤ صفحةً ⇐ ستّةُ آلاف عنصر): نافذةٌ تُزاح مع القارئ
 * فتبقى الشجرةُ خفيفةً مهما طالت القراءة. **وثلاثٌ من كلّ جهةٍ مدًى للسحبة
 * السريعة** — فلا يسبق الإصبعُ الإزاحةَ إلى بياض.
 */
const WINDOW = 3;
const PAGES = 604;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** صفحةُ آيةٍ بالرقم العامّ */
const pageOf = (m: Mushaf, id: number): number => m.ayahs[id - 1]?.page ?? 0;
/** صفحةُ موضعٍ `"سورة:آية:كلمة"` */
const cursorPage = (m: Mushaf, loc: string): number => {
  const [s, a] = loc.split(":").map(Number);
  return pageOf(m, globalIdOf(s, a));
};

/**
 * **حجابُ حال التثبيت على صفحةٍ بعينها** — «النصُّ محجوبٌ ينكشف بالتلاوة، وما
 * بعده يبقى محجوبًا» (`halat.ts`). ولا يقع الحجابُ إلّا والتلاوةُ جارية: من فتح
 * المصحفَ ليقرأ يراه كاملًا، ومن ختم رآه كاملًا.
 */
const veilOf = (m: Mushaf, t: Tatabbu, page: number): "none" | "from" | "all" => {
  if (t.hal.text !== "veiled" || t.phase !== "running" || !t.cursor) return "none";
  const at = cursorPage(m, t.cursor);
  return page < at ? "none" : page === at ? "from" : "all";
};

export default function App() {
  /** المصحفُ في مرجعٍ — يقرؤه مستمعُ التمرير وتتبّعُ الصوت بلا أن يُعاد تركيبُهما */
  const mushafRef = useRef<Mushaf | null>(null);
  const [mushaf, setMushaf] = useState<Mushaf | null>(null);
  const [failed, setFailed] = useState(false);
  const [, bump] = useState(0);
  const play = usePlayState();
  /** **التتبّعُ حالٌ من هذه الصفحة** — منطقُه في الحزمة، وتدبيرُه في `tatabbu.ts` */
  const surahName = useCallback((n: number) => mushafRef.current?.surahName(n) ?? "", []);
  const track = useTatabbu(surahName, mushaf);
  /** **بابُ التثبيت** — مادّتُه لا تُجلب إلّا لمن فتحه (`tathbit.ts`) */
  const fix = useTathbit(mushaf);

  /* الموضعُ الذي يُفتح عليه — من المواضع، وإلّا فأوّلُ المصحف */
  const opened = useRef<{ id: number; resumed: boolean }>({ id: 1, resumed: false });
  const [resume, setResume] = useState<number | null>(null);
  const [win, setWin] = useState({ from: 1, to: 1 });
  const [sheet, setSheet] = useState<"goto" | "set" | "listen" | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  /** أوّلُ آيةٍ ظاهرةٍ الآن — تُحفظ موضعًا، ومنها يبدأ الاستماع */
  const topAyah = useRef(1);
  /** **مرساةُ التنضيد**: آيةٌ ظاهرةٌ وموضعُها من الشاشة قبل تبدُّل النافذة */
  const anchor = useRef<{ id: number; top: number } | null>(null);
  /** ما حرّكناه نحن من التمرير — **يُطرح من حركة الإصبع بالحساب** (درسُ ص٤ §١) */
  const ours = useRef(0);
  /** أيتلو الآن؟ — يقرؤه مستمعُ التمرير فلا يُعاد تركيبُه في كلّ تبدُّل حال */
  const reciting = useRef(false);
  reciting.current = track.phase === "running";
  /* **وصفحةُ القارئ تُتابَع بحالٍ ما دام بابُ التثبيت مفتوحًا وحدَه** — فشريطُ
     المفارق يقول ما في صفحته؛ ولمن يقرأ لا يُعاد رسمُ شيءٍ عند كلّ سكونِ إصبع. */
  const fixOn = useRef(false);
  fixOn.current = fix.on;
  const [herePage, setHerePage] = useState(1);

  useEffect(() => {
    applySettings();
    return subscribeSettings(() => bump((n) => n + 1));
  }, []);

  useEffect(() => {
    void loadAudio();
    loadMushaf().then(
      (m) => {
        /* ── **الفتحُ على آخر الموضع** (ف٢ §٣): والافتراضُ ١:١ ──
           **وسطرُ العودة لا يُقال إلّا لعائد**: الميراثُ بلا ختمٍ زمنيٍّ لا
           يُدرى أرجوعٌ هو، وما كتبته هذه الجلسةُ ليس رجوعًا (درسُ ج٩ §٤). */
        const saved = readMawdi("mushaf");
        const at = parseMawdi(saved);
        const id = at ? globalIdOf(at.surahNo, at.ayahNo) : 1;
        const stamp = saved?.at ? Date.parse(saved.at) : NaN;
        opened.current = { id, resumed: id > 1 && Number.isFinite(stamp) && stamp < SESSION_START };
        topAyah.current = id;
        const page = m.ayahs[id - 1].page;
        setWin({ from: clamp(page - WINDOW, 1, PAGES), to: clamp(page + WINDOW, 1, PAGES) });
        mushafRef.current = m;
        setMushaf(m);
      },
      () => setFailed(true),
    );
  }, []);

  /** ارتفاعُ الرأس يُقاس من الرأس نفسِه — فلا رقمَ مقدَّرٌ في الشيفرة */
  useLayoutEffect(() => {
    const h = header.current?.offsetHeight;
    if (h) document.documentElement.style.setProperty("--topbar-h", `${h}px`);
  }, [mushaf]);

  const scrollToAyah = useCallback((id: number, smooth = false) => {
    const el = scroller.current;
    const node = document.getElementById(`ayah-${id}`);
    if (!el || !node) return;
    /* **ومن وقف على أوّل صفحةٍ رآها من ترويستها**: الآيةُ الأولى تحتها لوحةُ
       السورة وبسملتُها، فلو قُصد النصُّ وحدَه قُطعت الصفحةُ عن رأسها. */
    const page = node.closest<HTMLElement>(".mushaf-page");
    const target = page && page.querySelector(".mp-ayah") === node ? page : node;
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 56;
    const top = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTo({ top: Math.max(0, top - head - 10), behavior: smooth ? "smooth" : "auto" });
  }, []);

  /** يُزيح نافذةَ الصفحات إلى ما حول صفحةٍ بعينها، ويمسك المرساةَ إن كان لها موضع */
  const reflow = useCallback((page: number, anchorId?: number) => {
    setWin((w) => {
      const from = clamp(page - WINDOW, 1, PAGES);
      const to = clamp(page + WINDOW, 1, PAGES);
      if (from === w.from && to === w.to) return w;
      const node = anchorId ? document.getElementById(`ayah-${anchorId}`) : null;
      anchor.current = node ? { id: anchorId!, top: node.getBoundingClientRect().top } : null;
      return { from, to };
    });
  }, []);

  /* أوّلُ رسمٍ: يُنزل القارئُ على موضعه، ويُعرض سطرُ العودة إن كان عائدًا */
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!mushaf || placed.current) return;
    placed.current = true;
    scrollToAyah(opened.current.id);
    if (opened.current.resumed) setResume(opened.current.id);
  }, [mushaf, scrollToAyah]);

  /** **وسطرُ العودة ينصرف من نفسه** — خبرٌ يُقال مرّةً، لا لوحٌ يقيم فوق المصحف */
  useEffect(() => {
    if (resume === null) return;
    const t = window.setTimeout(() => setResume(null), 6000);
    return () => window.clearTimeout(t);
  }, [resume]);

  /* ── **النصُّ لا يتزحزح حين تتبدّل النافذة** ──
     نافذةُ الصفحات تُزاح مع القارئ (تُضاف من جهةٍ وتُطرح من الأخرى)، وكلاهما
     يبدّل ارتفاعَ ما فوق الشاشة. **فتُمسَك آيةٌ ظاهرةٌ مرساةً**: يُقاس موضعُها
     من الشاشة قبل التبدّل، ويُردّ التمريرُ بفارقه بعده — فيبقى ما يقرؤه القارئ
     تحت عينه بالبكسل، ولا يُحسب فرقُ ارتفاعٍ يُظنّ كلُّه فوق. */
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    const node = document.getElementById(`ayah-${a.id}`);
    if (!node) return;
    const delta = node.getBoundingClientRect().top - a.top;
    el.scrollTop += delta;
    /* **ولا يُحسب هذا سحبَ إصبع**: تعويضُ المرساة يحرّك التمريرَ ولا يحرّك
       النصَّ، فلو قُرئ حركةً لانسحب الرأسُ أو عاد بلا سببٍ من القارئ. */
    ours.current += delta;
  }, [win.from, win.to]);

  /* ── **الانسحابُ مقترنٌ بالسكرول** (اقتباسُ آليّة ج٨ §٣) ──
     مقدارٌ متّصلٌ `--shell-p` من ٠ إلى ١ يزيد بمقدار حركة الإصبع واتّجاهها،
     بلا انتقالٍ ما دام يسحب، **وعند سكونه يُلتقط إلى أقرب طرف** فلا يبقى الرأسُ
     نصفَ ظاهر. ولمن طلب تقليلَ الحركة: الطرفان وحدَهما بلا اقتران. */
  useEffect(() => {
    const el = scroller.current;
    if (!el || !mushaf) return;
    const root = document.documentElement;
    const body = document.body;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    let p = 0;
    let last = el.scrollTop;
    let pending = 0;
    let raf = 0;
    let rest = 0;
    let idle = 0;
    const setP = (v: number) => {
      p = v;
      root.style.setProperty("--shell-p", String(v));
      body.classList.toggle("tw-immersive", v >= 0.999);
    };
    const snap = () => {
      body.classList.remove("tw-drag");
      setP(p >= 0.5 ? 1 : 0);
    };
    const frame = () => {
      raf = 0;
      const h = parseFloat(getComputedStyle(root).getPropertyValue("--topbar-h")) || 56;
      const d = pending;
      pending = 0;
      setP(clamp(p + d / h, 0, 1));
    };
    const onScroll = () => {
      const y = el.scrollTop;
      let d = y - last;
      last = y;
      if (ours.current) {
        d -= ours.current;
        ours.current = 0;
      }
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, 180);
      // **والقشرةُ مطويّةٌ طولَ التلاوة** — يمضي حفظُ الموضع وإزاحةُ النافذة، ولا يعود الرأس
      if (reciting.current) return;
      /* **أعلى المصحف: الرأسُ ظاهرٌ دائمًا** — ومن بلغ القاعَ فارتدادُه ليس تمريرًا */
      if (y <= 0) {
        pending = 0;
        window.clearTimeout(rest);
        body.classList.remove("tw-drag");
        setP(0);
        return;
      }
      if (y + el.clientHeight >= el.scrollHeight - 4) return;
      if (d === 0) return; // حدثٌ بلا حركةٍ لا يبدّل شيئًا
      if (calm.matches) {
        setP(d > 0 && y > 140 ? 1 : 0);
        return;
      }
      body.classList.add("tw-drag");
      pending += d;
      if (!raf) raf = requestAnimationFrame(frame);
      window.clearTimeout(rest);
      rest = window.setTimeout(snap, 150);
    };
    /** عند سكون الإصبع: يُقرأ الموضعُ ويُحفظ، وتُمدَّد نافذةُ الصفحات إن قاربت طرفَها */
    const settle = () => {
      const head = parseFloat(getComputedStyle(root).getPropertyValue("--topbar-h")) || 56;
      const edge = el.getBoundingClientRect().top + head;
      let seen = 0;
      for (const node of el.querySelectorAll<HTMLElement>(".mp-ayah[data-ayah]")) {
        const r = node.getBoundingClientRect();
        if (r.bottom > edge) {
          seen = Number(node.dataset.ayah);
          break;
        }
      }
      if (seen) {
        topAyah.current = seen;
        const [s, a] = locationOf(seen);
        saveMawdi("mushaf", `${s}:${a}`);
      }
      /* **والنافذةُ تتبع الموضعَ لا تتراكم**: صفحاتٌ حول صفحة القارئ لا غير،
         فيبقى المصحفُ سيلًا متّصلًا بالتمرير والشجرةُ خفيفةً مهما طال. */
      if (seen) {
        const page = mushafRef.current!.ayahs[seen - 1].page;
        reflow(page, seen);
        if (fixOn.current) setHerePage(page);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(rest);
      window.clearTimeout(idle);
      root.style.removeProperty("--shell-p");
      body.classList.remove("tw-drag", "tw-immersive");
    };
  }, [mushaf]);

  /* ── **أثناء التلاوة تنسحب القشرةُ ولا تعود** (بندُ ف٣ §١) ──
     المصحفُ وحدَه أمام المتلو، **والرأسُ لا يقفز إلى الظهور بحركةٍ عارضة**:
     يُرفع `--shell-p` إلى واحدٍ ما دام يتلو، ويُصرَف عنه مستمعُ التمرير (وهو
     يمضي في حفظ الموضع وإزاحة نافذة الصفحات كما هو). وعند الختام يعود الرأسُ
     ظاهرًا **من غير أن يُنازع القارئَ في تمريره**. */
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (track.phase !== "running") return;
    root.style.setProperty("--shell-p", "1");
    body.classList.add("tw-immersive");
    body.classList.remove("tw-drag");
    return () => {
      root.style.setProperty("--shell-p", "0");
      body.classList.remove("tw-immersive");
    };
  }, [track.phase]);

  /* ── **المؤشّرُ يجري على كلمات الصفحة، والصفحةُ تتبعه هادئةً** (ف٣ §١) ──
     الكلمةُ المظلَّلةُ عنصرٌ من عناصر صفحة المصحف (`[data-w]`)، فلا سطحَ ثانيَ
     يُرسم فوقها. **ولا يتحرّك شيءٌ ما دامت في حزام القراءة**؛ فإن خرجت منه
     دُفعت الصفحةُ دفعةً واحدةً ناعمةً وسكنت (درسُ سكون ص٤). وإن كانت في صفحةٍ
     خارجَ النافذة المرسومة أُزيحت النافذةُ إليها **بمرساةٍ** فلا يقفز النصّ. */
  useEffect(() => {
    const el = scroller.current;
    const loc = track.cursor;
    if (!el || !mushaf || !loc || track.phase !== "running") return;
    const [s, a] = loc.split(":").map(Number);
    const id = globalIdOf(s, a);
    const page = mushaf.ayahs[id - 1]?.page;
    if (!page) return;
    if (page < win.from || page > win.to) {
      reflow(page, topAyah.current);
      return;
    }
    reflow(page, id);
    const node = el.querySelector<HTMLElement>(`[data-w="${loc}"]`);
    if (!node) return;
    const box = el.getBoundingClientRect();
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 56;
    const r = node.getBoundingClientRect();
    const belt = { top: box.top + 12, bottom: box.bottom - 110 };
    if (r.top >= belt.top && r.bottom <= belt.bottom) return; // في الحزام ⇒ لا حركة
    const top = r.top - box.top + el.scrollTop - Math.max(head, box.height * 0.32);
    /* **والالتقاطُ من موضعٍ بعيدٍ نقلةٌ لا انزلاق**: تمريرٌ ناعمٌ عبر صفحاتٍ
       يقطع على القارئ ثوانيَ وهو يتلو — فالقريبُ ينزلق والبعيدُ يُنقل دفعةً. */
    const here = mushaf.ayahs[topAyah.current - 1]?.page ?? page;
    el.scrollTo({ top: Math.max(0, top), behavior: Math.abs(page - here) > 1 ? "auto" : "smooth" });
  }, [track.cursor, track.phase, mushaf, win.from, win.to, reflow]);

  /* ── **الصفحةُ تتبع الآيةَ المسموعةَ بتمريرٍ هادئ** (درسُ سكون ص٤) ──
     **حركةٌ عند الحاجة لا مع كلّ آية**: ما دامت الآيةُ في حزام القراءة لا
     يتحرّك شيء؛ فإن خرجت منه دُفعت الصفحةُ دفعةً واحدةً ناعمةً وسكنت. */
  const followed = useRef<number | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || play.id === null || play.id === followed.current) return;
    followed.current = play.id;
    const node = document.getElementById(`ayah-${play.id}`);
    if (!node) {
      // الآيةُ خارجَ الصفحات المرسومة — تُفتح صفحتُها ثمّ تُطلب
      const page = mushaf?.ayahs[play.id - 1].page;
      if (page) reflow(page);
      return;
    }
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 56;
    const box = el.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const belt = { top: box.top + head + 8, bottom: box.bottom - 90 };
    if (r.top >= belt.top && r.bottom <= belt.bottom) return; // في الحزام ⇒ لا حركة
    scrollToAyah(play.id, true);
  }, [play.id, mushaf, scrollToAyah]);

  /* لمّا تُرسَم صفحةُ الآية المسموعة بعد تمديد النافذة، تُطلب مرّةً */
  useEffect(() => {
    if (play.id !== null && followed.current === play.id && document.getElementById(`ayah-${play.id}`)) {
      const el = scroller.current;
      const node = document.getElementById(`ayah-${play.id}`);
      if (el && node) {
        const r = node.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom) scrollToAyah(play.id, true);
      }
    }
  }, [win.from, win.to, play.id, scrollToAyah]);

  const goTo = useCallback(
    (ayahId: number) => {
      if (!mushaf) return;
      setResume(null);
      topAyah.current = ayahId;
      const [s, a] = locationOf(ayahId);
      saveMawdi("mushaf", `${s}:${a}`);
      reflow(mushaf.ayahs[ayahId - 1].page);
      requestAnimationFrame(() => scrollToAyah(ayahId));
    },
    [mushaf, scrollToAyah],
  );

  const where = mushaf ? mushaf.surahName(locationOf(topAyah.current)[0]) : "";

  return (
    <>
      <header className="tw-top" ref={header}>
        <span className="tw-brand">
          {/* هلالٌ رقيقٌ — هويّةٌ لا شارة، وتمامُها في ف٣ */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M17.5 3.6A9 9 0 1 0 20.4 15 7.2 7.2 0 0 1 17.5 3.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          التلاوة
        </span>
        <span className="tw-spacer" />
        {/* **لمسةُ الميكروفون** (ف٣ §١): تقلب هذه الصفحةَ حالًا **في مكانها** —
            لا انتقالَ مسارٍ ولا شاشةَ بدء — وتبدأ من **أوّل آيةٍ مرئيّةٍ الآن**.
            **ولا يُسمَع ويُسمَّع معًا**: يسكت المشغِّلُ إن كان يعمل، فلا يسمع
            المحرّكُ تلاوةَ الشريط بدل تلاوة صاحبه. */}
        <button
          className="tw-btn"
          data-track="mic"
          aria-pressed={track.phase !== "off"}
          aria-label="التتبّع بالصوت"
          onClick={() => {
            stopAudio();
            const [s, a] = locationOf(topAyah.current);
            track.arm(`${s}:${a}`);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 3.8a2.6 2.6 0 0 1 2.6 2.6v5a2.6 2.6 0 0 1-5.2 0v-5A2.6 2.6 0 0 1 12 3.8Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M6.6 11a5.4 5.4 0 0 0 10.8 0M12 16.4V20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {/* **بابُ التثبيت** (ن١): لمسةٌ تُوسَم بها آياتُ الالتباس في الصفحة —
            **الاختبارُ عند المفرق لا عند المطلع**. ولا تُجلب مادّتُه إلّا الآن. */}
        <button
          className="tw-btn"
          data-tathbit="mark"
          aria-pressed={fix.on}
          aria-label="المفارق — مواضعُ الالتباس"
          onClick={() => {
            if (fix.on) fix.close();
            else {
              setHerePage(pageOf(mushaf!, topAyah.current) || 1);
              fix.open(topAyah.current);
            }
          }}
          disabled={!mushaf}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 21V13m0 0 6.4-6.4M12 13 5.6 6.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="19.4" cy="5.6" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="4.6" cy="5.6" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </button>
        <button className="tw-btn" onClick={() => setSheet("goto")} aria-label="الانتقال إلى سورةٍ أو صفحة">
          <span className="tw-where quran">{where || "الانتقال"}</span>
        </button>
        <button
          className="tw-btn"
          onClick={() => setSheet("listen")}
          aria-pressed={play.id !== null}
          aria-label="الاستماع"
        >
          ▶
        </button>
        <button className="tw-btn" onClick={() => setSheet("set")} aria-label="الإعدادات">
          ⚙
        </button>
      </header>

      <div className="tw-read" ref={scroller}>
        {failed ? (
          <p className="tw-fail">لم يُجلب نصُّ المصحف — تحقّق من الاتّصال ثمّ أعد فتح الصفحة.</p>
        ) : !mushaf ? (
          <p className="tw-loading">يُفتح المصحف…</p>
        ) : (
          <>
            <div className="mushaf-stage">
              {mushaf.pages.slice(win.from - 1, win.to).map((p) => (
                <MushafPage
                  key={p.page}
                  page={p}
                  mushaf={mushaf}
                  /* **ولا تُعاد صفحاتُ النافذة رسمًا لأجل واحدةٍ**: يُمرَّر إلى كلّ
                     صفحةٍ ما يخصّها وحدَه، فتسكن أخواتُها (الأداءُ شرطٌ لا زينة). */
                  playingId={play.id !== null && pageOf(mushaf, play.id) === p.page ? play.id : null}
                  cursor={track.cursor && cursorPage(mushaf, track.cursor) === p.page ? track.cursor : null}
                  /* **وميضُ الاصطياد** (ن٢): موضعُ المفرق يومض هادئًا ثمّ ينطفئ —
                     ويُقصَر على صفحته كالمؤشّر، فلا تُعاد أخواتُها رسمًا. */
                  slip={track.flash && cursorPage(mushaf, track.flash) === p.page ? track.flash : null}
                  /* **وحجابُ التثبيت يُحسب بالصفحة**: ما دون صفحة المؤشّر مكشوفٌ،
                     وصفحتُه تنكشف إليه، وما بعدها محجوبٌ كلُّه (`halat.ts`). */
                  veil={veilOf(mushaf, track, p.page)}
                  /* **ووسمُ المفارق مجموعةٌ واحدةٌ ثابتة** — تُبنى مرّةً عند فتح
                     الباب، فلا يُبطَل بها حفظُ الصفحات في كلّ رسم. */
                  marks={fix.on ? fix.marks : null}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* **خبرُ العودة حيث يقف القارئ** — والسيلُ يُفتح على موضعه فلا يُرى سطرٌ في رأسه */}
      {mushaf && resume !== null && (
        <p className="tw-resume">
          <button onClick={() => setResume(null)}>
            عُدتَ إلى {mushaf.surahName(locationOf(resume)[0])} {num(locationOf(resume)[1])}
          </button>
        </p>
      )}

      {/* **سطحُ التتبّع**: شريطٌ رفيعٌ واحدٌ وورقتان — ولا يُرسم نصٌّ ثانٍ فوق المصحف */}
      {track.phase !== "off" && <TrackBar t={track} mushaf={mushaf} />}
      {track.ask === "engine" && <EngineSheet t={track} />}
      {track.ask === "consent" && <ConsentSheet t={track} />}
      {track.phase === "done" && mushaf && <AfterSheet t={track} mushaf={mushaf} />}

      {/* **سطحُ التثبيت**: شريطٌ رفيعٌ وورقةٌ — ولا يجتمع مع شريط التتبّع في أسفل
          الشاشة، فالتلاوةُ حالٌ والتثبيتُ حالٌ أخرى. */}
      {mushaf && fix.on && track.phase === "off" && fix.tab === null && (
        <ForkBar t={fix} mushaf={mushaf} page={herePage} />
      )}
      {mushaf && fix.on && fix.tab !== null && (
        <TathbitSheet
          t={fix}
          mushaf={mushaf}
          onGo={(id) => {
            fix.show(null);
            setHerePage(pageOf(mushaf, id));
            goTo(id);
          }}
        />
      )}

      {mushaf && track.phase === "off" && !fix.on && <PlayBar mushaf={mushaf} />}

      {sheet === "goto" && mushaf && <Goto mushaf={mushaf} onGo={goTo} onClose={() => setSheet(null)} />}
      {sheet === "set" && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === "listen" && mushaf && (
        <ListenSheet mushaf={mushaf} topAyahId={topAyah.current} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

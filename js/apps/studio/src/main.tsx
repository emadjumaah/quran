import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { initDb, listSurahs } from "./db";
import { ensureLayers } from "./layers";
import { applyUILang, getUILang, setUILang, t, useUILang } from "./i18n";

// سجل الطبقات (rag-manifest) يُحمَّل مع الإقلاع كي ترى كلُّ الشاشات — لا نبراس
// وحده — الكتبَ والطبقاتِ المضافة قيودَ مانيفست («العائلات المفتوحة»)
void ensureLayers();
import "./theme.css";
import Reader from "./views/Reader";
import Roots from "./views/Roots";
import Search from "./views/Search";
const Collections = lazy(() => import("./views/Collections"));
const Dashboard = lazy(() => import("./views/Dashboard"));
import { NowPlayingBar } from "./components/AudioButton";
import ErrorBoundary from "./components/ErrorBoundary";
import Goto from "./views/Goto";
const Today = lazy(() => import("./views/Today"));
const Kulliyat = lazy(() => import("./views/Kulliyat"));
const KulliyatMukhtara = lazy(() => import("./views/KulliyatMukhtara"));
const AyaCard = lazy(() => import("./views/AyaCard"));
const Wujuh = lazy(() => import("./views/Wujuh"));
const Furuq = lazy(() => import("./views/Furuq"));
const Bayan = lazy(() => import("./views/Bayan"));
const Amthal = lazy(() => import("./views/Amthal"));
const Fawasil = lazy(() => import("./views/Fawasil"));
const MawadiV2 = lazy(() => import("./views/MawadiV2"));
const Tafasir = lazy(() => import("./views/Tafasir"));
const Maalim = lazy(() => import("./views/Maalim"));
const Mujam = lazy(() => import("./views/Mujam"));
const Lisan = lazy(() => import("./views/Lisan"));
const Sarf = lazy(() => import("./views/Sarf"));
const About = lazy(() => import("./views/About"));
const Docs = lazy(() => import("./views/Docs"));
const Fahis = lazy(() => import("./views/Fahis"));
const FahisCard = lazy(() => import("./views/FahisCard"));
const FahisToolPage = lazy(() => import("./views/FahisToolPage"));
const FahisMethod = lazy(() => import("./views/FahisMethod"));
const Tarikh = lazy(() => import("./views/Tarikh"));
const TarikhClaim = lazy(() => import("./views/TarikhClaim"));
const TarikhHukm = lazy(() => import("./views/TarikhHukm"));
const TarikhMasadir = lazy(() => import("./views/TarikhMasadir"));
import ShareButton from "./components/ShareButton";
const Galaxy = lazy(() => import("./views/Galaxy"));
const MushafMap = lazy(() => import("./views/MushafMap"));
const ThematicThread = lazy(() => import("./views/ThematicThread"));
const Learn = lazy(() => import("./views/Learn"));
const EraabDrill = lazy(() => import("./views/EraabDrill"));
const Assistant = lazy(() => import("./views/Assistant"));
// «التتبّع» — صار بابًا في الواجهة بأمر المالك 2026-08-14 بعد فحصه المسبارَ على
// كروم: مدخلُه في الرأس على العرضين، وصفحتُه قائمةٌ بنفسها بلا هيكل التطبيق.
const Tatabbu = lazy(() => import("./views/Tatabbu"));
import SettingsPanel from "./components/SettingsPanel";
import BookmarksPanel from "./components/BookmarksPanel";
import FocusExit from "./components/FocusExit";
import { applySettings, setSettings, useSettings } from "./settings";

applyUILang();
applySettings();

// Keep the app fresh. vite-plugin-pwa (registerType:autoUpdate) already applies
// and reloads on a new service worker — but only checks on load. Poll every 30s
// so an already-open tab picks up a new deploy instead of serving stale code.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready
    .then((reg) => {
      setInterval(() => void reg.update().catch(() => {}), 30_000);
    })
    .catch(() => {});
}

function Boot({ children }: { children: React.ReactNode }) {
  useUILang();
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb((loaded, total) => setProgress({ loaded, total }))
      .then(() => listSurahs()) // prime surah names for AyahRef
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="boot">
        <div>
          <div className="title">مشكاة</div>
          <p style={{ color: "var(--danger)" }}>{error}</p>
          <p className="muted">
            <code>node ../../scripts/convert-to-app-db.mjs</code>
          </p>
        </div>
      </div>
    );
  }
  if (!ready) {
    const pct =
      progress && progress.total > 0
        ? Math.round((progress.loaded / progress.total) * 100)
        : null;
    return (
      <div className="boot">
        <div>
          <div className="title">مشكاة</div>
          <div className="bar">
            <div style={{ width: pct != null ? `${pct}%` : "30%" }} />
          </div>
          <div className="muted">
            {t("boot.loading")} {pct != null ? `${pct}%` : ""}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {t("boot.tagline")}
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function ThemeToggle() {
  const s = useSettings();
  const resolved =
    s.theme === "auto"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : s.theme;
  const isDark = resolved === "dark";
  return (
    <button
      onClick={() => setSettings({ theme: isDark ? "light" : "dark" })}
      title={getUILang() === "ar" ? "فاتح/داكن" : "Light/Dark"}
      aria-label={getUILang() === "ar" ? (isDark ? "الوضع الفاتح" : "الوضع الداكن") : isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}

/** أيقونةُ التتبّع: موجُ صوتٍ يمرّ على سطر — لا ميكروفونَ، فالبابُ تتبُّعٌ لا تسجيل */
function TatabbuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M3.2 12h1.6M8 8v8M12 4.8v14.4M16 8v8M19.2 12h1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** مدخلُ «التتبّع» في الرأس: على الحاسوب زرٌّ بعنوانٍ وأيقونة — لا أيقونةً صمّاء —
 *  وعلى الجوال أيقونةٌ بجوار الإعدادات (أمر المالك 2026-08-14). */
function TatabbuButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const lang = useUILang();
  const label = lang === "ar" ? "التتبّع" : t("nav.tatabbu");
  return (
    <NavLink
      to="/tatabbu"
      className={`tatabbu-btn${iconOnly ? " icon-only" : ""}`}
      title={t("nav.tatabbu.hint")}
      aria-label={label}
    >
      <TatabbuIcon />
      {!iconOnly && <span>{label}</span>}
    </NavLink>
  );
}

function LangToggle() {
  const lang = useUILang();
  return (
    <button
      onClick={() => setUILang(lang === "ar" ? "en" : "ar")}
      title={lang === "ar" ? "Switch interface to English" : "التبديل إلى العربية"}
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}

// The desktop nav: a couple of always-visible destinations + themed dropdown
// GROUPS, so the bar stays tidy instead of one long scattered row. The mobile
// drawer reuses the same groups as labelled sections.
type NavItem = [to: string, ar: string, en: string];
// أربعُ وجهاتٍ لا تُشتّت (إعادةُ تنظيمٍ بأمر المالك 2026-07-26): «البيان» صار
// وجهةً مستقلّةً برأسها، والمتشابهُ جُمع — ألفاظُ التنزيل تضمُّ فروقَ التنزيل
// والفروقَ اللغويّة والوجوهَ والنظائر، والإحصاءُ يضمُّ الصرفَ وشبكةَ الجذور.
/** ثلاثُ وجهاتٍ لا تشتيت (الرؤية 2026-07-29، وافق المالك): ما يميّز مشكاةَ
 *  يتصدّر — «لماذا هذا اللفظ؟» جوهرةُ المشروع، و«بناء المصحف» شبكتُه المفحوصة —
 *  وما يوجد عند غيرنا (مواضيعُ وإحصاءاتٌ ومصادر) يُطوى تحت «المزيد».
 *  ثمّ رابعةٌ بأمر المالك 2026-08-03: «الفحص والتحقيق» — بابا الوزن بدرجاتٍ
 *  معلَنة، خرجا من «المزيد» إلى مجموعةٍ باسمهما. */
const NAV_GROUPS: { ar: string; en: string; items: NavItem[] }[] = [
  {
    ar: "ألفاظ التنزيل", en: "The wording",
    items: [
      ["/furuq", "فروق التنزيل — المتشابهاتُ محاذاةً", "Furūq — aligned twins"],
      ["/bayan", "البيان — تدبّر لغة القرآن", "Bayān — the diction"],
      ["/wujuh", "الوجوه والنظائر", "Polysemy"],
      ["/lisan", "الفروق اللغوية", "Lexical distinctions"],
      ["/roots", "الجذور والعدّ الدقيق", "Roots & exact counts"],
      ["/mujam", "معجم القرآن", "Dictionary"],
    ],
  },
  {
    ar: "بناء المصحف", en: "Composition",
    items: [
      ["/kulliyat", "الآيات الجامعة", "Gathering verses"],
      ["/qawaid", "القواعد وتفصيلها", "Rules & elaboration"],
      ["/shabaka", "خريطة المصحف", "Mushaf map"],
    ],
  },
  {
    ar: "المزيد", en: "More",
    items: [
      ["/mawadi", "المواضيع", "Topics"],
      ["/khayt", "الخيوط الموضوعية", "Thematic threads"],
      ["/amthal", "الأمثال", "Parables"],
      ["/tafasir", "التفاسير والمصادر", "Tafsir & sources"],
      ["/maalim", "إحصاءات القرآن", "Qur'an stats"],
      ["/sarf", "الصرف بالأرقام", "Morphology"],
      ["/galaxy", "شبكة الجذور", "Roots network"],
      ["/fawasil", "أطلس الفواصل", "Rhyme atlas"],
      ["/docs", "توثيق المشروع", "Documentation"],
    ],
  },
  // المجموعةُ الرابعة (قرارُ الإدارة س٣، ٣ آب ٢٠٢٦): البابان أخوان في المنهج —
  // كلاهما يزن قولًا بأدلّته، ويُعلن درجتَه، ويقول صراحةً ما الذي يغيّرها. وضمُّهما
  // يُظهر ما يميّز مشكاة. **ومساراتُهما لم تتغيّر** فالروابطُ القائمة كلُّها حيّة.
  {
    ar: "الفحص والتحقيق", en: "Weighing & verification",
    items: [
      ["/fahis", "ميزانُ الأقوال", "Mīzān al-Aqwāl — weighing claims"],
      ["/tarikh", "ملفّ جمع القرآن", "The collection of the Qur'an"],
    ],
  },
];

/** The nav groups, with المجموعات appended to «مصادر وأدوات» only when its layer is enabled. */
function useNavGroups() {
  const s = useSettings();
  if (!s.layers.collect) return NAV_GROUPS;
  return NAV_GROUPS.map((g) =>
    g.en === "Sources & tools"
      ? { ...g, items: [...g.items, ["/collections", "المجموعات", "Collections"] as NavItem] }
      : g,
  );
}

/** Retired root-graph (توارد الجذور) + journey routes fold into the root page,
 *  which now hosts the journey inline. Keeps old links working. */
function ToRootRedirect() {
  const { root } = useParams();
  return <Navigate to={root ? `/roots/${encodeURIComponent(root)}` : "/roots"} replace />;
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const ar = getUILang() === "ar";
  useEffect(() => setOpen(false), [loc.pathname]); // close on navigate
  const active = items.some(([to]) => loc.pathname.startsWith(to));
  return (
    <span className="nav-more">
      <button className={`nav-more-btn${active ? " active" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label} <span className="nav-more-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <>
          <div className="nav-more-backdrop" onClick={() => setOpen(false)} />
          <div className="nav-more-menu" role="menu">
            {items.map(([to, arL, enL]) => (
              <NavLink key={to} to={to} role="menuitem">{ar ? arL : enL}</NavLink>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function Nav() {
  useUILang();
  const ar = getUILang() === "ar";
  const groups = useNavGroups();
  return (
    <nav>
      <NavLink to="/read" title={ar ? "اقرأ المصحف" : "read the Qur'an"}>{t("nav.reader")}</NavLink>
      {/* **نبراس في التنقّل العامّ** (أمر المالك 2026-08-14): لمّا رُفع الزرُّ
          الطائرُ عن المصحف صار البابُ يُطلب ابتداءً من ههنا — ولا يُحذف باب */}
      <NavLink to="/assistant" title={ar ? "اسأل مشكاة: محادثةُ ذكاءٍ اصطناعيّ" : "Ask Mishkat — an AI chat"}>
        <span className="ai-spark" aria-hidden /> {ar ? "اسأل مشكاة" : "Ask Mishkat"}
      </NavLink>
      {groups.map((g) => (
        <NavGroup key={g.ar} label={ar ? g.ar : g.en} items={g.items} />
      ))}
      <NavLink to="/about" title={ar ? "عن المشروع" : "about the project"}>{ar ? "عن المشروع" : "About"}</NavLink>
    </nav>
  );
}

/** First load opens the Quran — at the last-read position, else al-Fātiḥa. */
function Home() {
  const last = localStorage.getItem("quran-studio:last-read");
  const to = last && /^\d+:\d+$/.test(last)
    ? `/read/${last.split(":")[0]}/${last.split(":")[1]}`
    : "/read/1";
  return <Navigate to={to} replace />;
}

function Brand() {
  return (
    <NavLink to="/" className="brand">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={30} height={30} />
      <span className="ar brand-word">مشكاة</span>
    </NavLink>
  );
}

/** Tracks whether the viewport is phone-width. */
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

// (the mobile drawer builds its sections from NAV_GROUPS above.)

function MobileDrawer({ onClose }: { onClose: () => void }) {
  useUILang();
  const ar = getUILang() === "ar";
  const groups = useNavGroups();
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={ar ? "القائمة" : "menu"}>
        <div className="drawer-head">
          {/* الشعارُ فعّالٌ كالحاسوب: يفتح الرئيسيةَ ويغلق الدُّرج (أمر المالك 2026-07-29) */}
          <NavLink to="/" onClick={onClose} className="ar drawer-brand">مشكاة</NavLink>
          <button onClick={onClose} aria-label={ar ? "إغلاق" : "close"}>✕</button>
        </div>
        {/* ثلاثةٌ نُقلت من رأس الجوال إلى الدُّرج (أمر المالك 2026-08-14): المشاركةُ
            والمحفوظاتُ وتبديلُ اللغة — بعنوانٍ واضحٍ فلا تُلتمس في الرأس فلا تُوجد */}
        <div className="drawer-group-h drawer-tools-h">{ar ? "أدوات الصفحة" : "Page tools"}</div>
        <div className="drawer-share"><ShareButton compact /></div>
        <div className="drawer-tools">
          <BookmarksPanel />
          <LangToggle />
        </div>
        <nav className="drawer-nav" onClick={onClose}>
          <NavLink to="/read">{ar ? "المصحف" : "Reader"}</NavLink>
          {/* بابُ نبراس ابتداءً بلا آية — بعد رفع الزرّ الطائر عن المصحف */}
          <NavLink to="/assistant"><span className="ai-spark" aria-hidden /> {ar ? "اسأل مشكاة" : "Ask Mishkat"}</NavLink>
          {groups.map((g) => (
            <div key={g.ar} className="drawer-group">
              <div className="drawer-group-h">{ar ? g.ar : g.en}</div>
              {g.items.map(([to, arL, enL]) => (
                <NavLink key={to} to={to}>{ar ? arL : enL}</NavLink>
              ))}
            </div>
          ))}
          <NavLink to="/about">{ar ? "عن المشروع" : "About"}</NavLink>
        </nav>
        <div className="drawer-controls">
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}

// Per-route boundary: keyed by path so a broken view shows an inline message
// (the top bar / nav / now-playing stay), and navigating away remounts + recovers.
function RouteBoundary({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <ErrorBoundary compact key={loc.pathname}>
      <Suspense fallback={<div className="page"><p className="muted">{t("loading")}</p></div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/** نِبراس (اسمُنا الداخلي؛ وللمستخدم «اسأل مشكاة») — a floating AI-chat button
 *  right; the single entry to research + meaning-search chat. A speech bubble with
 *  a sparkle marks it as an AI chat. Hidden while نِبراس itself is open. */
function NibrasFab() {
  const loc = useLocation();
  const ar = getUILang() === "ar";
  // الجوال: الزرُّ قابلٌ للسحب ويلتصق بإحدى الحافّتين ويُحفظ جانبُه وارتفاعُه
  // (سؤال المالك 2026-07-29: «هل يمكن عمله متحركًا كما في تطبيقات الجوال؟» — نعم)
  const [pos, setPos] = useState<{ side: "l" | "r"; y: number }>(() => {
    try { return JSON.parse(localStorage.getItem("mishkat:fab-pos") || "x"); } catch { return { side: "r", y: 0 }; }
  });
  const drag = useRef<{ startX: number; startY: number; baseY: number; moved: boolean; id: number } | null>(null);
  const fabRef = useRef<HTMLAnchorElement>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return; // السحبُ للمس — الحاسوبُ ثابت
    drag.current = { startX: e.clientX, startY: e.clientY, baseY: pos.y, moved: false, id: e.pointerId };
    fabRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 10) return;
    d.moved = true;
    const half = window.innerWidth / 2;
    const side: "l" | "r" = e.clientX < half ? "l" : "r";
    const y = Math.min(0, Math.max(-(window.innerHeight - 260), d.baseY - dy));
    setPos({ side, y });
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.moved) {
      e.preventDefault();
      localStorage.setItem("mishkat:fab-pos", JSON.stringify(pos));
    }
  };
  const onClick = (e: React.MouseEvent) => {
    // نقرةٌ تلت سحبًا لا تفتح المساعد
    if (drag.current?.moved) e.preventDefault();
  };
  // **ويُزال من فوق المصحف ومن صفحة التتبّع** (أمر المالك 2026-08-14): زرٌّ طائرٌ
  // يحوم فوق نصّ القرآن من أظهر علامات الويب، ويؤذي الصفحةَ التي جُرِّدت لتوّها
  // من حدودها. **ولا يُحذف البابُ ولا يُغيَّر مسارُه** — إعادةُ موضعٍ لا إلغاءُ
  // ميزة: يدخل من أدوات الآية («اسأل عن هذه الآية» مسبوقًا بموضعه) ومن التنقّل
  // العامّ (الرأسُ والدُّرج). ويبقى على سائر الصفحات كما كان.
  const overMushaf = loc.pathname === "/" || loc.pathname.startsWith("/read");
  if (overMushaf || loc.pathname.startsWith("/assistant") || loc.pathname.startsWith("/tatabbu")) return null;
  return (
    <NavLink
      ref={fabRef}
      to="/assistant"
      className={`nibras-fab${pos.side === "l" ? " fab-left" : " fab-right"}`}
      style={{ transform: `translateY(${pos.y}px)` }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={onClick}
      title={ar ? "اسأل مشكاة: محادثةُ ذكاءٍ اصطناعيّ — بحثٌ بالمعنى وصياغةٌ من بيانات القرآن" : "Ask Mishkat: an AI chat — meaning-search & drafting from the Qur'an's data"} aria-label={ar ? "اسأل مشكاة — محادثة ذكاء اصطناعي" : "Ask Mishkat — AI chat"}>
      {/* هلالُ المشكاة — لا معيّن (قرار مالك 2026-07-19) */}
      {/* شكلُ الهلال من public/hilal.svg — هويّةُ مشكاة الواحدة */}
      <svg className="nibras-fab-ic" viewBox="0 0 1049 1280" aria-hidden focusable="false">
        <g transform="rotate(-30 524.5 640)">
          <g transform="translate(0,1280) scale(0.1,-0.1)">
            <path fill="currentColor" d="M6015 12789 c-740 -46 -1469 -219 -2145 -509 -284 -121 -817 -407 -985 -528 -22 -15 -108 -77 -191 -136 -179 -126 -366 -275 -521 -412 -163 -144 -375 -344 -398 -375 -11 -15 -63 -74 -115 -131 -1223 -1342 -1815 -3153 -1624 -4968 153 -1459 796 -2809 1835 -3849 665 -665 1429 -1156 2315 -1486 406 -151 865 -268 1304 -330 341 -48 510 -59 900 -59 374 -1 519 8 810 45 85 11 182 23 215 25 33 3 121 19 195 35 707 160 1097 293 1625 554 386 191 672 366 1000 612 261 196 285 223 237 271 -17 17 -43 20 -233 25 -1742 51 -3386 839 -4545 2177 -1184 1368 -1717 3206 -1453 5010 218 1494 969 2854 2124 3849 116 100 115 98 115 132 0 52 -22 59 -186 58 -82 -1 -207 -6 -279 -10z" />
          </g>
        </g>
      </svg>
      <span className="nibras-fab-label">{ar ? "اسأل مشكاة" : "Ask Mishkat"}</span>
    </NavLink>
  );
}

/** Mobile-only bottom tab bar — thumb-reachable jumps to the key surfaces; the
 *  «المزيد» tab opens the full drawer. Hidden on desktop.
 *
 *  **وأربعتُها أفعالُ قارئٍ لا أقسامُ موقع** (قرارُ المالك ١٤ أغسطس، الصورة «أ»):
 *  أقرأ · أتلو · أبحث · وما وراء ذلك. والبحثُ يُطلب كلَّ يوم فله موضعُه ههنا،
 *  **والمحفوظاتُ لها موضعُها في الدُّرج** فلا تُزاحمه. (وخرجت «الكلّيّات»
 *  و«المواضيع» إلى التنقّل العامّ — **ولم يُحذف بابٌ ولا تغيّر مسار**.) */
function MobileTabBar({ onMenu }: { onMenu: () => void }) {
  const loc = useLocation();
  const p = loc.pathname;
  const ar = getUILang() === "ar";
  if (p.startsWith("/assistant")) return null; // نِبراس is a focused full-screen chat
  const on = (to: string) => (to === "/read" ? p === "/" || p.startsWith("/read") : p === to || p.startsWith(to + "/"));
  return (
    <nav className="tabbar" aria-label={ar ? "تنقّل" : "tabs"}>
      <NavLink to="/read" className={`tab${on("/read") ? " active" : ""}`}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M4 4.5A2 2 0 0 1 6 3h5v16H6a2 2 0 0 0-2 1.2zM20 4.5A2 2 0 0 0 18 3h-5v16h5a2 2 0 0 1 2 1.2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
        <span>{ar ? "المصحف" : "Read"}</span>
      </NavLink>
      <NavLink to="/tatabbu" className={`tab${on("/tatabbu") ? " active" : ""}`}>
        <TatabbuIcon />
        <span>{ar ? "التتبّع" : t("nav.tatabbu")}</span>
      </NavLink>
      <NavLink to="/search" className={`tab${on("/search") ? " active" : ""}`}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM21 21l-5.2-5.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        <span>{ar ? "البحث" : "Search"}</span>
      </NavLink>
      <button className="tab" onClick={onMenu} aria-label={ar ? "القائمة" : "menu"}>
        <svg viewBox="0 0 24 24" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <span>{ar ? "المزيد" : "More"}</span>
      </button>
    </nav>
  );
}

function App() {
  const mobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobile) setDrawer(false);
  }, [mobile]);
  /* **ارتفاعُ الرأس يُقاس من الرأس نفسِه** (ص-م٤ §٥د): في سطح القراءة يخرج
     الرأسُ من صفوف الشبكة إلى طبقةٍ عليا، فيلزم المتنَ حشوةٌ بمقداره تمرّ تحته.
     ولا يُكتب الرقمُ تقديرًا — يُقاس ويُتابَع مع كلّ تغيّرِ مقاس. */
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--topbar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="topbar" ref={topbarRef}>
          {mobile && (
            /* **أيقونةٌ مرسومةٌ لا محرفٌ نصّيّ** (ج٨ §٢أ — بلاغُ المالك «الأيقونات
               غيرُ مسنترةٍ بعضُها»): كان ههنا «☰» حرفًا من الخطّ، ومقاسُ الحرف
               وخطُّ أساسِه غيرُ مقاس الأيقونات المرسومة — فكان يقع أعلى أو أدنى
               من جيرانه. فصارت كلُّها SVG في `viewBox` واحدٍ ومقاسٍ واحد. */
            <button className="menu-btn" onClick={() => setDrawer(true)} aria-label={getUILang() === "ar" ? "القائمة" : "menu"}>
              <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <Brand />
          {!mobile && <Nav />}
          <span className="spacer" />
          {/* **موضعُ أدوات الصفحة في الرأس الواحد** (ج٨ §٢ب): تضع فيه صفحةُ
              القراءة بحثَها و«⋯» — فلا يقوم لها شريطٌ ثانٍ تحت الرأس. */}
          <span className="topbar-slot" id="topbar-slot" />
          {mobile ? (
            /* تنظيفُ رأس الجوال (أمر المالك 2026-08-14، وهو ينسخ أمرَ 2026-07-29 في
               تبديل اللغة): نُقلت المشاركةُ والمحفوظاتُ وتبديلُ اللغة إلى الدُّرج،
               فلا يبقى في الرأس إلّا القائمةُ والهويّةُ والتتبّعُ والإعدادات. */
            <>
              <TatabbuButton iconOnly />
              <SettingsPanel />
            </>
          ) : (
            <>
              <TatabbuButton />
              <ShareButton />
              <BookmarksPanel />
              <LangToggle />
              <ThemeToggle />
              <SettingsPanel />
            </>
          )}
        </header>
        {mobile && drawer && <MobileDrawer onClose={() => setDrawer(false)} />}
        <NibrasFab />
        {mobile && <MobileTabBar onMenu={() => setDrawer(true)} />}
        <RouteBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/read" element={<Home />} />
          <Route path="/read/:surahNo" element={<Reader />} />
          <Route path="/read/:surahNo/:ayahNo" element={<Reader />} />
          {/* RETIRED (2026-07-13): the old محكمات/جوامع system is superseded by الكلّيّات. */}
          <Route path="/jawami" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/jawami/lenses" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/gaps" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/muhkamat" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/muhkamat/:k" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/kulliyat" element={<KulliyatMukhtara />} />
          <Route path="/qawaid" element={<Kulliyat />} />
          <Route path="/graph" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/graph/:s/:a" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/fabric" element={<ToRootRedirect />} />
          <Route path="/fabric/:root" element={<ToRootRedirect />} />
          <Route path="/maalim" element={<Maalim />} />
          <Route path="/mujam" element={<Mujam />} />
          <Route path="/mujam/:root" element={<Mujam />} />
          <Route path="/lisan" element={<Lisan />} />
          <Route path="/sarf" element={<Sarf />} />
          <Route path="/galaxy" element={<Galaxy />} />
          <Route path="/shabaka" element={<MushafMap />} />
          <Route path="/khayt" element={<ThematicThread />} />
          <Route path="/about" element={<About />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/fahis" element={<Fahis />} />
          <Route path="/fahis/c/:id" element={<FahisCard />} />
          <Route path="/fahis/tool" element={<FahisToolPage />} />
          <Route path="/fahis/method" element={<FahisMethod />} />
          <Route path="/tarikh" element={<Tarikh />} />
          <Route path="/tarikh/d/:id" element={<TarikhClaim />} />
          <Route path="/tarikh/wathiqa" element={<TarikhHukm />} />
          <Route path="/tarikh/masadir" element={<TarikhMasadir />} />
          <Route path="/lexicon" element={<Navigate to="/kulliyat" replace />} />
          <Route path="/wujuh" element={<Wujuh />} />
          <Route path="/furuq" element={<Furuq />} />
          <Route path="/bayan" element={<Bayan />} />
          <Route path="/bayan/:id" element={<Bayan />} />
          <Route path="/amthal" element={<Amthal />} />
          <Route path="/fawasil" element={<Fawasil />} />
          <Route path="/mawdui" element={<Navigate to="/qawaid" replace />} />
          <Route path="/mawdui/*" element={<Navigate to="/qawaid" replace />} />
          <Route path="/tabwib" element={<Navigate to="/mawadi" replace />} />
          <Route path="/tabwib/*" element={<Navigate to="/mawadi" replace />} />
          <Route path="/mawadi" element={<MawadiV2 />} />
          <Route path="/mawadi/:name" element={<MawadiV2 />} />
          <Route path="/tafasir" element={<Tafasir />} />
          <Route path="/tafasir/:id" element={<Tafasir />} />
          <Route path="/aya/:s/:a" element={<AyaCard />} />
          <Route path="/roots" element={<Roots />} />
          <Route path="/roots/:root" element={<Roots />} />
          <Route path="/network" element={<ToRootRedirect />} />
          <Route path="/network/:root" element={<ToRootRedirect />} />
          <Route path="/network/:root/:other" element={<ToRootRedirect />} />
          <Route path="/search" element={<Search />} />
          <Route path="/meaning" element={<Navigate to="/search?m=1" replace />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/collections/:id" element={<Collections />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/eraab" element={<EraabDrill />} />
          <Route path="/journey" element={<ToRootRedirect />} />
          <Route path="/journey/:root" element={<ToRootRedirect />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/assistant/:id" element={<Assistant />} />
          <Route path="/today" element={<Today />} />
          <Route path="/goto/:kind/:n" element={<Goto />} />
          {/* مستور — لا يُدرج في التنقّل ولا في التوثيق حتّى يُقرَّر بعد الفحص */}
          <Route path="/tatabbu" element={<Tatabbu />} />
        </Routes>
        </RouteBoundary>
        <NowPlayingBar />
        <FocusExit />
      </div>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Boot>
        <App />
      </Boot>
    </ErrorBoundary>
  </React.StrictMode>,
);

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { initDb, listSurahs } from "./db";
import { applyUILang, getUILang, setUILang, t, useUILang } from "./i18n";
import "./theme.css";
import Reader from "./views/Reader";
import Roots from "./views/Roots";
import Network from "./views/Network";
import Search from "./views/Search";
import Collections from "./views/Collections";
import Dashboard from "./views/Dashboard";
import { NowPlayingBar } from "./components/AudioButton";
import Omnibox from "./components/Omnibox";
import Goto from "./views/Goto";
import Today from "./views/Today";
import Jawami from "./views/Jawami";
import SettingsPanel from "./components/SettingsPanel";
import BookmarksPanel from "./components/BookmarksPanel";
import FocusExit from "./components/FocusExit";
import { applySettings, setSettings, useSettings } from "./settings";

applyUILang();
applySettings();

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
          <div className="title">مصحف المعرفة</div>
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
          <div className="title">مصحف المعرفة</div>
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
    >
      {isDark ? "☀" : "☾"}
    </button>
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

/** Every external place whose data we actually use — one credit each. */
const SOURCES: { url: string; ar: string; en: string }[] = [
  {
    url: "https://tanzil.net",
    ar: "نص القرآن العثماني وبياناته (الجزء/الحزب/الصفحة/السجدات) — مشروع تنزيل",
    en: "Uthmani text + metadata (juz/hizb/page/sajda) — Tanzil",
  },
  {
    url: "https://corpus.quran.com",
    ar: "الصرف والجذور والمداخل والإعراب — المدونة القرآنية (جامعة ليدز)",
    en: "Morphology, roots, lemmas, grammar — Quranic Arabic Corpus (Leeds)",
  },
  {
    url: "https://github.com/wizsk/arabic_lexicons",
    ar: "المعاجم: المفردات (الراغب) · مقاييس اللغة (ابن فارس) · الصحاح · لسان العرب",
    en: "Lexicons: Mufradāt · Maqāyīs · Ṣiḥāḥ · Lisān al-ʿArab",
  },
  {
    url: "https://tanzil.net/trans/",
    ar: "الترجمات: صحيح إنترناشونال (EN) · حميد الله (FR) · ديانت (TR) — تنزيل",
    en: "Translations: Saheeh Intl (EN) · Hamidullah (FR) · Diyanet (TR) — Tanzil",
  },
  {
    url: "https://alquran.cloud/cdn",
    ar: "التلاوة: الحصري · العفاسي · عبد الباسط · المنشاوي · السديس · المعيقلي (Islamic Network)",
    en: "Recitations: Ḥuṣarī · Alafasy · ʿAbd al-Bāsiṭ · Minshāwī · Sudais · Muʿayqilī (Islamic Network)",
  },
  {
    url: "https://qul.tarteel.ai",
    ar: "مصحف المدينة وخطوط KFGQPC/QCF — مجمع الملك فهد، عبر Quran.com وQUL",
    en: "Madina muṣḥaf + KFGQPC/QCF fonts — King Fahd Complex, via Quran.com & QUL",
  },
  {
    url: "https://ai.google.dev",
    ar: "المتجهات الدلالية للبحث بالمعنى — Gemini embeddings",
    en: "Semantic vectors for meaning-search — Gemini embeddings",
  },
  {
    url: "https://github.com/qataruts/monlite",
    ar: "محرك قاعدة البيانات في المتصفح — monlite",
    en: "In-browser database engine — monlite",
  },
];

function Footer() {
  useUILang();
  const ar = getUILang() === "ar";
  return (
    <footer className="footer">
      <span>
        <b>{t("footer.sources")}:</b>{" "}
        {SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && <span className="muted"> · </span>}
            <a href={s.url} target="_blank" rel="noreferrer">
              {ar ? s.ar : s.en}
            </a>
          </span>
        ))}
      </span>
      <span className="muted">{t("footer.provenance")}</span>
    </footer>
  );
}

function Nav() {
  useUILang();
  return (
    <nav>
      <NavLink to="/read">{t("nav.reader")}</NavLink>
      <NavLink to="/jawami">{t("nav.jawami")}</NavLink>
      <NavLink to="/roots">{t("nav.roots")}</NavLink>
      <NavLink to="/network">{t("nav.network")}</NavLink>
      <NavLink to="/search">{t("nav.search")}</NavLink>
      <NavLink to="/collections">{t("nav.collections")}</NavLink>
      <NavLink to="/dashboard">{t("nav.dashboard")}</NavLink>
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
    <NavLink
      to="/"
      className="brand"
      style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}
    >
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={30} height={30} />
      <span className="ar" style={{ fontSize: 21, marginInlineStart: 0 }}>
        مصحف المعرفة
      </span>
    </NavLink>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="topbar">
          <Brand />
          <Nav />
          <span className="spacer" />
          <Omnibox />
          <BookmarksPanel />
          <LangToggle />
          <ThemeToggle />
          <SettingsPanel />
        </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/read" element={<Home />} />
          <Route path="/read/:surahNo" element={<Reader />} />
          <Route path="/read/:surahNo/:ayahNo" element={<Reader />} />
          <Route path="/jawami" element={<Jawami />} />
          <Route path="/roots" element={<Roots />} />
          <Route path="/roots/:root" element={<Roots />} />
          <Route path="/network" element={<Network />} />
          <Route path="/network/:root" element={<Network />} />
          <Route path="/network/:root/:other" element={<Network />} />
          <Route path="/search" element={<Search />} />
          <Route path="/meaning" element={<Navigate to="/search?m=1" replace />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/collections/:id" element={<Collections />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/today" element={<Today />} />
          <Route path="/goto/:kind/:n" element={<Goto />} />
        </Routes>
        <Footer />
        <NowPlayingBar />
        <FocusExit />
      </div>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boot>
      <App />
    </Boot>
  </React.StrictMode>,
);

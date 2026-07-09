import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { initDb } from "./db";
import "./theme.css";
import Reader from "./views/Reader";
import Roots from "./views/Roots";
import Network from "./views/Network";
import Search from "./views/Search";
import Collections from "./views/Collections";
import Dashboard from "./views/Dashboard";

function Boot({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDb((loaded, total) => setProgress({ loaded, total }))
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="boot">
        <div>
          <div className="title">القرآن الكريم</div>
          <p style={{ color: "var(--danger)" }}>Failed to load the knowledge graph: {error}</p>
          <p className="muted">
            Run <code>node ../../scripts/convert-to-app-db.mjs</code> then restart.
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
          <div className="title">القرآن الكريم</div>
          <div style={{ marginTop: 8, fontWeight: 600 }}>Quran Knowledge Graph Studio</div>
          <div className="bar">
            <div style={{ width: pct != null ? `${pct}%` : "30%" }} />
          </div>
          <div className="muted">
            {pct != null
              ? `loading the knowledge graph… ${pct}% (${Math.round((progress!.loaded / 1e6) * 10) / 10} MB)`
              : "loading the knowledge graph…"}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            114 surahs · 6,236 ayahs · 77,429 words · full morphology — all in your browser
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  return (
    <button onClick={() => setDark(!dark)} title="Toggle theme">
      {dark ? "☀" : "☾"}
    </button>
  );
}

function Footer() {
  const src = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noreferrer">
      {text}
    </a>
  );
  return (
    <footer className="footer">
      <span>
        Sources: {src("https://corpus.quran.com", "Quranic Arabic Corpus")} (morphology, K.
        Dukes, Univ. of Leeds, GPL) · {src("https://tanzil.net", "Tanzil")} (Uthmani text,
        structure &amp; translations, CC BY 3.0: Saheeh International · Muhammad Hamidullah ·
        Diyanet İşleri) ·{" "}
        {src("https://github.com/mustafa0x/quran-morphology", "quran-morphology")} (Arabic-script
        edition) · recitation: Shaykh Maḥmūd Khalīl al-Ḥuṣarī via{" "}
        {src("https://alquran.cloud", "Islamic Network CDN")} · semantic vectors: Gemini · built
        on {src("https://github.com/qataruts/monlite", "monlite")}
      </span>
      <span className="muted">
        Every data layer is recorded in the database's provenance table · audited end-to-end
      </span>
    </footer>
  );
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="topbar">
          <span className="brand">
            Quran Studio<span className="ar">مصحف المعرفة</span>
          </span>
          <nav>
            <NavLink to="/read">Reader</NavLink>
            <NavLink to="/roots">Roots</NavLink>
            <NavLink to="/network">Network</NavLink>
            <NavLink to="/search">Search</NavLink>
            <NavLink to="/collections">Collections</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
          </nav>
          <span className="spacer" />
          <ThemeToggle />
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/read/1" replace />} />
          <Route path="/read" element={<Navigate to="/read/1" replace />} />
          <Route path="/read/:surahNo" element={<Reader />} />
          <Route path="/read/:surahNo/:ayahNo" element={<Reader />} />
          <Route path="/roots" element={<Roots />} />
          <Route path="/roots/:root" element={<Roots />} />
          <Route path="/network" element={<Network />} />
          <Route path="/network/:root" element={<Network />} />
          <Route path="/search" element={<Search />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/collections/:id" element={<Collections />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
        <Footer />
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

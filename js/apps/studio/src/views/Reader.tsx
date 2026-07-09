/**
 * Reader — the mushaf reading view (/read/:surahNo and /read/:surahNo/:ayahNo).
 *
 * Three columns: surah sidebar (250px) · ayah text · word inspector (360px).
 * Under 900px the sidebars collapse and a surah <select> takes over.
 */
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listAyahs, listSurahs, listWords } from "../db";
import type { AyahDoc, SurahDoc, WordDoc } from "../types";
import AyahText from "../components/AyahText";
import MorphologyCard from "../components/MorphologyCard";
import CollectButton from "../components/CollectButton";
import AudioButton, { ayahIdOf } from "../components/AudioButton";
import Translations from "../components/Translations";

/** Tracks whether the viewport is narrower than 900px. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState<boolean>(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

function SurahSidebar({
  surahs,
  activeNo,
  onPick,
}: {
  surahs: SurahDoc[];
  activeNo: number;
  onPick: (surahNo: number) => void;
}) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const shown = q
    ? surahs.filter(
        (s) =>
          String(s.surahNo).startsWith(q) ||
          s.nameTranslit.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.nameAr.includes(filter.trim()),
      )
    : surahs;
  return (
    <aside
      style={{
        width: 250,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderInlineEnd: "1px solid var(--line)",
        background: "var(--panel)",
        minHeight: 0,
      }}
    >
      <div style={{ padding: "10px 10px 8px" }}>
        <input
          value={filter}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          placeholder="Filter surahs…"
          style={{ width: "100%" }}
          aria-label="Filter surahs"
        />
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 6px 10px" }}>
        {shown.map((s) => {
          const active = s.surahNo === activeNo;
          return (
            <div
              key={s.surahNo}
              onClick={() => onPick(s.surahNo)}
              role="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 8,
                cursor: "pointer",
                background: active ? "var(--accent-soft)" : undefined,
                color: active ? "var(--accent)" : "var(--ink-2)",
              }}
            >
              <span className="muted" style={{ width: 24, textAlign: "end" }}>
                {s.surahNo}
              </span>
              <span style={{ fontWeight: active ? 600 : 400 }}>{s.nameTranslit}</span>
              <span
                className="quran"
                style={{ marginInlineStart: "auto", fontSize: 18, lineHeight: 1.4 }}
              >
                {s.nameAr}
              </span>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="muted" style={{ padding: 10 }}>
            No surah matches “{filter}”.
          </div>
        )}
      </div>
    </aside>
  );
}

function Inspector({ word }: { word: WordDoc | null }) {
  if (!word) {
    return (
      <div className="muted" style={{ padding: 8, lineHeight: 1.7 }}>
        Click any word in the text to inspect its full morphology — segments, root, lemma,
        part of speech and grammatical features.
      </div>
    );
  }
  const ayahLoc = `${word.surahNo}:${word.ayahNo}`;
  return (
    <div>
      <MorphologyCard word={word} />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
        }}
      >
        <CollectButton
          locations={[ayahLoc]}
          criterion={{ kind: "manual", value: word.location }}
          label={`Collect ayah ${ayahLoc}`}
        />
        {word.root && (
          <Link to={`/roots/${encodeURIComponent(word.root)}`} className="chip link">
            see root <b className="quran" style={{ fontSize: 16, lineHeight: 1 }}>{word.root}</b>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Reader() {
  const params = useParams<{ surahNo: string; ayahNo?: string }>();
  const navigate = useNavigate();
  const surahNo = Number(params.surahNo);
  const targetAyahNo = params.ayahNo != null ? Number(params.ayahNo) : null;
  const narrow = useNarrow();

  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const [ayahs, setAyahs] = useState<AyahDoc[]>([]);
  const [wordsByAyah, setWordsByAyah] = useState<Map<number, WordDoc[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WordDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSurahs().then((all: SurahDoc[]) => {
      if (!cancelled) setSurahs(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One fetch per surah: ayahs + all words, grouped by ayahNo with a Map.
  useEffect(() => {
    if (!Number.isInteger(surahNo) || surahNo < 1 || surahNo > 114) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    Promise.all([listAyahs(surahNo), listWords(surahNo)]).then(
      ([ay, ws]: [AyahDoc[], WordDoc[]]) => {
        if (cancelled) return;
        const byAyah = new Map<number, WordDoc[]>();
        for (const w of ws) {
          const bucket = byAyah.get(w.ayahNo);
          if (bucket) bucket.push(w);
          else byAyah.set(w.ayahNo, [w]);
        }
        setAyahs(ay);
        setWordsByAyah(byAyah);
        setLoading(false);
      },
    ).catch(() => {
      if (!cancelled) {
        setAyahs([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [surahNo]);

  // Scroll the :ayahNo target into view once the surah has rendered.
  useEffect(() => {
    if (loading || targetAyahNo == null) return;
    const el = document.getElementById(`ayah-${surahNo}-${targetAyahNo}`);
    el?.scrollIntoView({ block: "center" });
  }, [loading, surahNo, targetAyahNo]);

  const surah = useMemo(
    () => surahs.find((s) => s.surahNo === surahNo),
    [surahs, surahNo],
  );

  const goTo = (n: number) => navigate(`/read/${n}`);

  if (!Number.isInteger(surahNo) || surahNo < 1 || surahNo > 114) {
    return (
      <div className="page">
        <div className="card page-narrow">
          <p>
            Surah <b>{params.surahNo}</b> not found — surah numbers run 1–114.
          </p>
          <Link to="/read/1">Go to Al-Fātiḥah</Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {!narrow && <SurahSidebar surahs={surahs} activeNo={surahNo} onPick={goTo} />}

      <main className="page" style={{ flex: 1, minWidth: 0 }}>
        {narrow && (
          <select
            value={surahNo}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => goTo(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 16 }}
            aria-label="Choose surah"
          >
            {surahs.map((s) => (
              <option key={s.surahNo} value={s.surahNo}>
                {s.surahNo}. {s.nameTranslit} — {s.nameAr}
              </option>
            ))}
          </select>
        )}

        {surah && (
          <header className="card" style={{ textAlign: "center", marginBottom: 18 }}>
            <div className="quran" style={{ fontSize: 42, lineHeight: 1.6 }}>
              {surah.nameAr}
            </div>
            <div style={{ fontWeight: 600 }}>
              {surah.nameTranslit} <span className="muted">· {surah.nameEn}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
              }}
            >
              <span className="chip">
                <b>{surah.revelation}</b>
              </span>
              <span className="chip">
                <b>{surah.ayahCount}</b> ayahs
              </span>
              <span className="chip">
                <b>{surah.wordCount}</b> words
              </span>
            </div>
          </header>
        )}

        {loading ? (
          <p className="muted">Loading surah…</p>
        ) : ayahs.length === 0 ? (
          <p className="muted">No ayahs found for this surah in the current database build.</p>
        ) : (
          ayahs.map((ayah: AyahDoc) => {
            const isTarget = targetAyahNo === ayah.ayahNo;
            return (
              <article
                key={ayah.location}
                id={`ayah-${ayah.surahNo}-${ayah.ayahNo}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                  marginBottom: 6,
                  background: isTarget ? "var(--accent-soft)" : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <Link to={`/read/${ayah.surahNo}/${ayah.ayahNo}`} className="chip link">
                    {ayah.location}
                  </Link>
                  <span className="chip">juz {ayah.juz}</span>
                  <span className="chip">page {ayah.page}</span>
                  {ayah.sajdaType && (
                    <span className="chip gold" title={`sajda: ${ayah.sajdaType}`}>
                      ۩ sajda
                    </span>
                  )}
                  <AudioButton ayahId={ayahIdOf(ayah)} />
                  <CollectButton
                    locations={[ayah.location]}
                    criterion={{ kind: "manual", value: ayah.location }}
                    label="⊕"
                  />
                </div>
                <AyahText
                  words={wordsByAyah.get(ayah.ayahNo) ?? []}
                  ayahNo={ayah.ayahNo}
                  selected={selected?.location ?? null}
                  onSelect={(w: WordDoc) => setSelected(w)}
                />
                <Translations ayah={ayah} />
              </article>
            );
          })
        )}
      </main>

      {!narrow && (
        <aside
          style={{
            width: 360,
            flexShrink: 0,
            overflowY: "auto",
            borderInlineStart: "1px solid var(--line)",
            background: "var(--panel)",
            padding: 16,
            minHeight: 0,
          }}
        >
          <Inspector word={selected} />
        </aside>
      )}

      {narrow && selected && (
        <div
          className="card"
          style={{
            position: "fixed",
            insetInline: 12,
            bottom: 12,
            maxHeight: "55vh",
            overflowY: "auto",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setSelected(null)} aria-label="Close inspector">
              ✕
            </button>
          </div>
          <Inspector word={selected} />
        </div>
      )}
    </div>
  );
}

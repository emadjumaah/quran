/**
 * Meaning — search the Quran by meaning, in any language (/meaning).
 *
 * Ayah vectors are local (int8, lazy-loaded); only the query is embedded,
 * via /api/embed (Vercel) or the user's own Gemini key.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAyahByLocation } from "../db";
import type { AyahDoc } from "../types";
import { readPathOf } from "../types";
import {
  getEndpoint,
  getUserKey,
  loadVectors,
  meaningSearch,
  setEndpoint,
  setUserKey,
  vectorsReady,
} from "../semantic";
import CollectButton from "../components/CollectButton";
import Translations from "../components/Translations";
import AudioButton, { ayahIdOf } from "../components/AudioButton";

const EXAMPLES = [
  "patience in hardship and loss",
  "forgiving people when angry",
  "رحمة الله بعباده",
  "the purpose of creation",
  "honesty in trade",
];

interface Row {
  ayah: AyahDoc;
  score: number;
}

export default function Meaning() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [vectorPct, setVectorPct] = useState<number | null>(null);
  const seq = useRef(0);

  const run = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    const my = ++seq.current;
    setBusy(true);
    setError(null);
    setNeedsSetup(false);
    setParams(text ? { q: text } : {}, { replace: true });
    try {
      if (!vectorsReady()) {
        setVectorPct(0);
        await loadVectors((pct) => setVectorPct(pct));
        setVectorPct(null);
      }
      const hits = await meaningSearch(text, 20);
      const ayahs = await Promise.all(
        hits.map(async (h) => {
          // ayahId is the global number; locate via meta-free arithmetic:
          // the ayah doc has _id `a<ayahId>` — fetch by location needs s:a,
          // so resolve through the id-based location stored on the doc.
          return { hit: h, ayah: await getAyahById(h.ayahId) };
        }),
      );
      if (my !== seq.current) return;
      setRows(
        ayahs
          .filter((x): x is { hit: (typeof hits)[number]; ayah: AyahDoc } => x.ayah != null)
          .map((x) => ({ ayah: x.ayah, score: x.hit.score })),
      );
    } catch (e) {
      if (my !== seq.current) return;
      if ((e as Error).message === "no-embedder") setNeedsSetup(true);
      else setError((e as Error).message);
      setRows(null);
    } finally {
      if (my === seq.current) setBusy(false);
    }
  };

  useEffect(() => {
    const q = params.get("q");
    if (q) void run(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page page-narrow">
      <h2>Search by meaning</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Describe what you are looking for — in English, العربية, français, Türkçe, any wording.
        Results are ranked by semantic closeness (Gemini vectors), not keywords.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        style={{ display: "flex", gap: 8, margin: "12px 0" }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. patience in hardship and loss"
          style={{ flex: 1 }}
        />
        <button className="primary" disabled={busy}>
          {busy ? "searching…" : "Search"}
        </button>
      </form>

      {vectorPct != null && (
        <div className="muted">loading meaning vectors… {vectorPct}% (one time, ~5 MB)</div>
      )}
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      {needsSetup && <SetupCard onDone={() => void run(query)} />}

      {!rows && !busy && !needsSetup && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="chip"
              style={{ border: "none", cursor: "pointer" }}
              onClick={() => {
                setQuery(ex);
                void run(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {rows && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
            <span className="muted">{rows.length} closest ayahs</span>
            <CollectButton
              locations={rows.map((r) => r.ayah.location)}
              criterion={{ kind: "search", value: `meaning: ${query.trim()}` }}
              label={`Collect all ${rows.length}`}
            />
          </div>
          {rows.map(({ ayah, score }) => (
            <div key={ayah.location} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Link className="chip link" to={readPathOf(ayah.location)}>
                  {ayah.location}
                </Link>
                <span className="chip">closeness {(score * 100).toFixed(1)}%</span>
                <span className="chip">juz {ayah.juz}</span>
                <AudioButton ayahId={ayahIdOf(ayah)} />
                <CollectButton
                  locations={[ayah.location]}
                  criterion={{ kind: "search", value: `meaning: ${query.trim()}` }}
                  label="⊕"
                />
              </div>
              <div className="quran" style={{ fontSize: 22, lineHeight: 2 }}>
                {ayah.textUthmani}
              </div>
              <Translations ayah={ayah} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Resolve an ayah by its global number via the doc _id ("a<n>"). */
async function getAyahById(ayahId: number): Promise<AyahDoc | null> {
  cache ??= new Map();
  const hit = cache.get(ayahId);
  if (hit) return hit;
  // location index is built once from the surah list (cheap: 114 rows)
  const { listSurahs } = await import("../db");
  const surahs = await listSurahs();
  let acc = 0;
  for (const s of surahs) {
    if (ayahId <= acc + s.ayahCount) {
      const doc = await getAyahByLocation(`${s.surahNo}:${ayahId - acc}`);
      if (doc) cache.set(ayahId, doc);
      return doc;
    }
    acc += s.ayahCount;
  }
  return null;
}
let cache: Map<number, AyahDoc> | null = null;

function SetupCard({ onDone }: { onDone: () => void }) {
  const [endpoint, setEp] = useState(getEndpoint());
  const [key, setKey] = useState(getUserKey() ?? "");
  return (
    <div className="card" style={{ margin: "10px 0" }}>
      <b>One-time setup needed</b>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        Ranking runs in your browser, but turning your query into a meaning-vector needs the
        Gemini API once per search. On the deployed site this happens automatically via{" "}
        <code>/api/embed</code>. Running locally, either point to a deployed endpoint or paste
        your own free Gemini key (
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          get one here
        </a>
        ) — it is stored only in this browser.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <label className="muted">
          Embed endpoint URL
          <input
            style={{ width: "100%" }}
            value={endpoint}
            onChange={(e) => setEp(e.target.value)}
          />
        </label>
        <label className="muted">
          — or your Gemini API key
          <input
            style={{ width: "100%" }}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza…"
          />
        </label>
        <div>
          <button
            className="primary"
            onClick={() => {
              setEndpoint(endpoint.trim() || "/api/embed");
              setUserKey(key.trim());
              onDone();
            }}
          >
            Save & search
          </button>
        </div>
      </div>
    </div>
  );
}

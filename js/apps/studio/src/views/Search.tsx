/**
 * Full-text search over the Quran (route /search).
 *
 * - FTS5 query box (debounced 300ms) → searchAyahs; syntax hint shown.
 * - Single Arabic tokens also probe searchRoots → "did you mean the root …?"
 * - Query state lives in the URL (?q=) so back/forward and reload work.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CollectButton from "../components/CollectButton";
import Translations from "../components/Translations";
import { listSurahs, searchAyahs, searchRoots } from "../db";
import type { AyahDoc, RootDoc, SurahDoc } from "../types";

const DISPLAY_CAP = 200;
const EXAMPLES: string[] = ["الرحمن", '"يا أيها الذين آمنوا"', "صبر"];

/** Arabic letters only (a plausible root / bare-word token). */
const ARABIC_TOKEN = /^[ء-ي]+$/;

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [input, setInput] = useState<string>(q);
  const [results, setResults] = useState<AyahDoc[] | null>(null);
  const [rootHits, setRootHits] = useState<RootDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [surahs, setSurahs] = useState<Map<number, SurahDoc>>(new Map());

  /** Guards against stale async responses (incl. StrictMode double-runs). */
  const seq = useRef(0);
  /** The last query this component itself wrote to the URL. */
  const lastPushed = useRef(q);

  // Surah names for result headers (cached in db.ts, cheap).
  useEffect(() => {
    let mounted = true;
    listSurahs()
      .then((list: SurahDoc[]) => {
        if (mounted) setSurahs(new Map(list.map((s: SurahDoc) => [s.surahNo, s])));
      })
      .catch(() => {
        /* names are decorative; results still render */
      });
    return () => {
      mounted = false;
    };
  }, []);

  // URL → input (back/forward navigation, reload, external links).
  useEffect(() => {
    if (q !== lastPushed.current) {
      lastPushed.current = q;
      setInput(q);
    }
  }, [q]);

  // Input → URL, debounced 300ms.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = input.trim();
      if (next === q) return;
      lastPushed.current = next;
      setSearchParams(next ? { q: next } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [input, q, setSearchParams]);

  // URL query → search results (+ parallel root suggestion).
  useEffect(() => {
    const id = ++seq.current;
    if (!q) {
      setResults(null);
      setRootHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    searchAyahs(q)
      .then((hits: AyahDoc[]) => {
        if (seq.current !== id) return;
        setResults(hits);
        setLoading(false);
      })
      .catch(() => {
        if (seq.current !== id) return;
        setResults([]);
        setLoading(false);
        setError(
          'Could not parse that query — check quotes and operators (bare terms, "quoted phrase", OR, prefix*).',
        );
      });

    const token = q.endsWith("*") ? q.slice(0, -1) : q;
    if (ARABIC_TOKEN.test(token)) {
      searchRoots(token, 5)
        .then((rs: RootDoc[]) => {
          if (seq.current === id) setRootHits(rs);
        })
        .catch(() => {
          if (seq.current === id) setRootHits([]);
        });
    } else {
      setRootHits([]);
    }
  }, [q]);

  const shown = results ? results.slice(0, DISPLAY_CAP) : [];
  const allLocations = results ? results.map((a: AyahDoc) => a.location) : [];

  return (
    <div className="page">
      <div className="page-narrow">
        <h2 style={{ marginTop: 0 }}>Search</h2>

        <input
          autoFocus
          dir="auto"
          value={input}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          placeholder="search the Quran text… e.g. الرحمن"
          style={{ width: "100%", fontSize: 17, padding: "12px 14px" }}
          aria-label="Full-text search query"
        />
        <div className="muted" style={{ marginTop: 6 }}>
          bare terms are AND-ed · "quoted phrase" · term OR term · prefix* for prefix match
        </div>

        {rootHits.length > 0 && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}
          >
            <span className="muted">Did you mean the root</span>
            {rootHits.map((r: RootDoc) => (
              <Link key={r.root} to={`/roots/${encodeURIComponent(r.root)}`} className="chip link">
                <b>{r.root}</b> ×{r.occurrences.toLocaleString()}
              </Link>
            ))}
            <span className="muted">?</span>
          </div>
        )}

        {!q && (
          <div className="card" style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Try one of these</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EXAMPLES.map((ex: string) => (
                <button key={ex} className="chip link" onClick={() => setInput(ex)}>
                  {ex}
                </button>
              ))}
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              Search runs over the clean (undiacritized) ayah text, entirely in your browser.
            </div>
          </div>
        )}

        {loading && (
          <div className="muted" style={{ marginTop: 18 }}>
            searching…
          </div>
        )}

        {error && !loading && (
          <div className="card" style={{ marginTop: 18, color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {q && !loading && !error && results && results.length === 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            No ayahs match <span className="quran" style={{ fontSize: 18 }}>{q}</span>.
            <div className="muted" style={{ marginTop: 6 }}>
              Try fewer terms, a prefix (e.g. رحم*), or OR between alternatives.
            </div>
          </div>
        )}

        {q && !loading && results && results.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                margin: "16px 0 10px",
              }}
            >
              <strong>
                {results.length.toLocaleString()} {results.length === 1 ? "ayah matches" : "ayahs match"}
              </strong>
              {results.length > DISPLAY_CAP && (
                <span className="muted">showing the first {DISPLAY_CAP}</span>
              )}
              <span style={{ flex: 1 }} />
              <CollectButton
                locations={allLocations}
                criterion={{ kind: "search", value: q }}
              />
            </div>

            <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {shown.map((a: AyahDoc, i: number) => {
                const s = surahs.get(a.surahNo);
                return (
                  <div
                    key={a.location}
                    style={{
                      padding: "12px 0",
                      borderBottom: i < shown.length - 1 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/read/${a.surahNo}/${a.ayahNo}`} style={{ fontWeight: 600 }}>
                        {s ? `${s.nameTranslit} ` : ""}
                        {a.location}
                      </Link>
                      <span className="chip">
                        juz <b>{a.juz}</b>
                      </span>
                      <span className="chip">
                        page <b>{a.page}</b>
                      </span>
                      <span style={{ flex: 1 }} />
                      <CollectButton
                        locations={[a.location]}
                        criterion={{ kind: "search", value: q }}
                        label="⊕"
                      />
                    </div>
                    <div className="quran" style={{ fontSize: 20, lineHeight: 2 }}>
                      {a.textUthmani}
                    </div>
                    <Translations ayah={a} />
                  </div>
                );
              })}
            </div>

            {results.length > DISPLAY_CAP && (
              <div className="muted" style={{ marginTop: 10 }}>
                {(results.length - DISPLAY_CAP).toLocaleString()} more matches not shown — refine the
                query, or collect all {results.length.toLocaleString()} above.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

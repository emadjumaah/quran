/**
 * Roots — the root explorer.
 *
 * /roots        → index: prefix search + top-100 roots table.
 * /roots/:root  → detail: header + collect, derived lemmas (filterable),
 *                 related roots (co-occurrence edges), grouped occurrences.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ayahLocationsOfRoot,
  getRoot,
  neighborsOfRoot,
  searchRoots,
  topRoots,
  wordsByLemma,
  wordsByRoot,
} from "../db";
import type { NeighborRoot } from "../db";
import type { RootDoc, SegmentDoc, WordDoc } from "../types";
import { VERB_FORM_ROMAN, label, readPathOf } from "../types";
import CollectButton from "../components/CollectButton";

const AYAH_CAP = 150;

function sortMushaf(ws: WordDoc[]): WordDoc[] {
  return [...ws].sort(
    (x: WordDoc, y: WordDoc) =>
      x.surahNo - y.surahNo || x.ayahNo - y.ayahNo || x.wordNo - y.wordNo,
  );
}

/** pos / derivation / verb-form chips for one matched word. */
function WordChips({ w, root }: { w: WordDoc; root: string }) {
  const seg: SegmentDoc | undefined =
    w.segments.find((s: SegmentDoc) => s.root === root) ??
    w.segments.find((s: SegmentDoc) => s.role === "stem");
  const pos = seg?.posEn ?? w.stemPos;
  return (
    <>
      {pos && <span className="chip">{pos}</span>}
      {seg?.derivation && (
        <span className="chip">
          <b>{label(seg.derivation)}</b>
        </span>
      )}
      {seg?.verbForm != null && (
        <span className="chip">
          form <b>{VERB_FORM_ROMAN[seg.verbForm - 1] ?? seg.verbForm}</b>
        </span>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Index mode                                                                */
/* ------------------------------------------------------------------------ */

function RootIndex() {
  const [query, setQuery] = useState("");
  const [roots, setRoots] = useState<RootDoc[] | null>(null);

  useEffect(() => {
    let alive = true;
    const q = query.trim();
    (q ? searchRoots(q, 50) : topRoots(100))
      .then((rs: RootDoc[]) => {
        if (alive) setRoots(rs);
      })
      .catch(() => {
        if (alive) setRoots([]);
      });
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <div className="page">
      <div className="page-narrow">
        <h2 style={{ marginTop: 0 }}>Roots</h2>
        <p className="muted" style={{ fontSize: 13.5, maxWidth: 640 }}>
          Every Arabic word grows from a root (جذر) — usually three consonants that carry a
          core meaning shared by all the words derived from it.
        </p>
        <input
          type="text"
          dir="rtl"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="ابحث عن جذر… (search roots by Arabic prefix)"
          style={{ width: "100%", marginBottom: 16, fontFamily: "var(--font-quran)" }}
        />
        <div className="card">
          {roots == null ? (
            <p className="muted">loading roots…</p>
          ) : roots.length === 0 ? (
            <p className="muted">
              No roots start with <span className="quran" style={{ fontSize: 18 }}>{query.trim()}</span>.
            </p>
          ) : (
            <>
              <div className="muted" style={{ marginBottom: 8 }}>
                {query.trim()
                  ? `${roots.length} matching roots`
                  : `top ${roots.length} roots by occurrences`}
              </div>
              <table className="data">
                <thead>
                  <tr>
                    <th>Root</th>
                    <th>Occurrences</th>
                    <th>Lemmas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roots.map((r: RootDoc) => (
                    <tr key={r._id}>
                      <td>
                        <Link
                          to={`/roots/${encodeURIComponent(r.root)}`}
                          className="quran"
                          style={{ fontSize: 24, lineHeight: 1.4 }}
                        >
                          {r.root}
                        </Link>
                      </td>
                      <td>{r.occurrences.toLocaleString()}</td>
                      <td>{r.lemmas.length}</td>
                      <td>
                        <Link to={`/roots/${encodeURIComponent(r.root)}`}>explore →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Detail mode                                                               */
/* ------------------------------------------------------------------------ */

function RootDetail({ root }: { root: string }) {
  const [rootDoc, setRootDoc] = useState<RootDoc | null | undefined>(undefined);
  const [words, setWords] = useState<WordDoc[] | null>(null);
  const [related, setRelated] = useState<NeighborRoot[] | null>(null);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);
  const [lemmaWords, setLemmaWords] = useState<Record<string, WordDoc[]>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    Promise.all([
      getRoot(root),
      wordsByRoot(root, 6000),
      neighborsOfRoot(root, 20).catch((): NeighborRoot[] => []),
    ])
      .then(([r, ws, rel]: [RootDoc | null, WordDoc[], NeighborRoot[]]) => {
        if (!mounted.current) return;
        setRootDoc(r);
        setWords(sortMushaf(ws));
        setRelated(rel);
      })
      .catch(() => {
        if (mounted.current) setRootDoc(null);
      });
    return () => {
      mounted.current = false;
    };
  }, [root]);

  const ayahLocs = useMemo<string[]>(
    () => (rootDoc ? ayahLocationsOfRoot(rootDoc) : []),
    [rootDoc],
  );

  const toggleLemma = (lemma: string) => {
    if (selectedLemma === lemma) {
      setSelectedLemma(null);
      return;
    }
    setSelectedLemma(lemma);
    if (!lemmaWords[lemma]) {
      wordsByLemma(lemma)
        .then((ws: WordDoc[]) => {
          if (mounted.current) {
            setLemmaWords((prev: Record<string, WordDoc[]>) => ({ ...prev, [lemma]: ws }));
          }
        })
        .catch(() => {
          if (mounted.current) {
            setLemmaWords((prev: Record<string, WordDoc[]>) => ({ ...prev, [lemma]: [] }));
          }
        });
    }
  };

  /** Occurrence source: all root words, or the intersection with the lemma. */
  const displayWords = useMemo<WordDoc[] | null>(() => {
    if (!words) return null;
    if (!selectedLemma) return words;
    const lw = lemmaWords[selectedLemma];
    if (!lw) return null; // lemma words still loading
    const locs = new Set(lw.map((w: WordDoc) => w.location));
    return words.filter((w: WordDoc) => locs.has(w.location));
  }, [words, selectedLemma, lemmaWords]);

  /** Group by ayah "s:a"; insertion order = mushaf order (words are sorted). */
  const groups = useMemo<[string, WordDoc[]][] | null>(() => {
    if (!displayWords) return null;
    const map = new Map<string, WordDoc[]>();
    for (const w of displayWords) {
      const key = `${w.surahNo}:${w.ayahNo}`;
      const arr = map.get(key);
      if (arr) arr.push(w);
      else map.set(key, [w]);
    }
    return [...map.entries()];
  }, [displayWords]);

  if (rootDoc === undefined) {
    return (
      <div className="page">
        <div className="page-narrow">
          <p className="muted">loading root…</p>
        </div>
      </div>
    );
  }

  if (rootDoc === null) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="card">
            <p>
              No root <span className="quran" style={{ fontSize: 22 }}>{root}</span> was found in
              the knowledge graph.
            </p>
            <Link to="/roots">← back to all roots</Link>
          </div>
        </div>
      </div>
    );
  }

  const shown = groups ? groups.slice(0, AYAH_CAP) : [];

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="muted" style={{ marginBottom: 10 }}>
          <Link to="/roots">Roots</Link> / detail
        </div>

        {/* Header */}
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}
        >
          <div className="quran" style={{ fontSize: 46, lineHeight: 1.3 }}>{rootDoc.root}</div>
          <div>
            <div style={{ fontWeight: 600 }}>
              {rootDoc.occurrences.toLocaleString()} occurrences
            </div>
            <div className="muted">
              {rootDoc.lemmas.length} derived {rootDoc.lemmas.length === 1 ? "lemma" : "lemmas"} ·{" "}
              {ayahLocs.length} ayahs
            </div>
          </div>
          <span style={{ marginInlineStart: "auto" }}>
            <CollectButton
              locations={ayahLocs}
              criterion={{ kind: "root", value: rootDoc.root }}
            />
          </span>
        </div>

        {/* Derived lemmas */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Derived lemmas</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Click a lemma to filter the occurrences below to that word form.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {rootDoc.lemmas.map((l: { lemma: string; occurrences: number }) => (
              <button
                key={l.lemma}
                className="chip link"
                onClick={() => toggleLemma(l.lemma)}
                style={
                  selectedLemma === l.lemma
                    ? { background: "var(--accent)", color: "#fff" }
                    : undefined
                }
              >
                <span className="quran" style={{ fontSize: 17, lineHeight: 1.3 }}>{l.lemma}</span>
                <span>({l.occurrences})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Related roots */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Related roots</h3>
          {related == null ? (
            <p className="muted">loading co-occurrence edges…</p>
          ) : related.length === 0 ? (
            <p className="muted">
              No co-occurrence edges for this root — the root network is not available in this
              build.
            </p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Roots that most often share an ayah with this one.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {related.map((e: NeighborRoot) => (
                  <Link
                    key={e.root}
                    to={`/roots/${encodeURIComponent(e.root)}`}
                    className="chip link"
                  >
                    <span className="quran" style={{ fontSize: 17, lineHeight: 1.3 }}>
                      {e.root}
                    </span>
                    <span>({e.w} shared ayahs)</span>
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <Link to={`/network/${encodeURIComponent(rootDoc.root)}`}>view as network →</Link>
              </div>
            </>
          )}
        </div>

        {/* Occurrences */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>
            Occurrences
            {selectedLemma && (
              <span className="muted" style={{ fontWeight: 400 }}>
                {" "}— filtered to lemma{" "}
                <span className="quran" style={{ fontSize: 17 }}>{selectedLemma}</span>
              </span>
            )}
          </h3>
          {groups == null ? (
            <p className="muted">loading occurrences…</p>
          ) : groups.length === 0 ? (
            <p className="muted">No occurrences to show.</p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                {groups.length > AYAH_CAP
                  ? `showing first ${AYAH_CAP} of ${groups.length} ayahs`
                  : `${groups.length} ${groups.length === 1 ? "ayah" : "ayahs"}`}
              </p>
              <div>
                {shown.map(([loc, ws]: [string, WordDoc[]]) => {
                  return (
                    <div
                      key={loc}
                      style={{
                        display: "flex",
                        gap: 14,
                        alignItems: "flex-start",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <Link
                        to={readPathOf(loc)}
                        className="chip link"
                        style={{ flexShrink: 0, marginTop: 6 }}
                      >
                        {loc}
                      </Link>
                      <div style={{ flex: 1 }}>
                        {ws.map((w: WordDoc) => (
                          <div
                            key={w.location}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span className="quran" style={{ fontSize: 25, lineHeight: 1.7 }}>
                              <span className="w sel">{w.textUthmani}</span>
                            </span>
                            <WordChips w={w} root={rootDoc.root} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export default function Roots() {
  const params = useParams<{ root?: string }>();
  if (!params.root) return <RootIndex />;
  const root = decodeURIComponent(params.root);
  // key resets lemma filter and loaded data when navigating between roots
  return <RootDetail key={root} root={root} />;
}

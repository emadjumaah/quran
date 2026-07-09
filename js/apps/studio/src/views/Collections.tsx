/**
 * Collections — manage ayah collections (the "gather related ayahs" flagship
 * feature). Index mode lists all collections; detail mode shows one collection
 * with its full ayah texts, rename/export/delete actions and a distraction-free
 * reading view for study or print.
 */
import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAyahByLocation, listSurahs } from "../db";
import type { AyahCollection, AyahDoc, SurahDoc } from "../types";
import { readPathOf } from "../types";
import Translations from "../components/Translations";
import {
  createCollection,
  deleteCollection,
  exportCollection,
  importCollection,
  removeAyah,
  renameCollection,
  useCollections,
} from "../store/collections";

/* ------------------------------------------------------------------ helpers */

function CriteriaChips({ criteria }: { criteria: AyahCollection["criteria"] }) {
  if (!criteria || criteria.length === 0) return null;
  return (
    <>
      {criteria.map((c, i) =>
        c.kind === "root" ? (
          <Link key={`${c.kind}-${c.value}-${i}`} to={`/roots/${encodeURIComponent(c.value)}`} className="chip link">
            root <b className="quran" style={{ fontSize: 15, lineHeight: 1 }}>{c.value}</b>
          </Link>
        ) : (
          <span key={`${c.kind}-${c.value}-${i}`} className="chip">
            {c.kind} <b>{c.value}</b>
          </span>
        ),
      )}
    </>
  );
}

/* -------------------------------------------------------------- index mode */

function CollectionsIndex() {
  const collections = useCollections();
  const navigate = useNavigate();

  const create = () => {
    const name = window.prompt("New collection name:", "My collection");
    if (name && name.trim()) {
      const c = createCollection(name.trim());
      navigate(`/collections/${c.id}`);
    }
  };

  const doImport = () => {
    const json = window.prompt("Paste collection JSON (from an Export):");
    if (!json) return;
    try {
      const parsed: unknown = JSON.parse(json);
      const p = parsed as { name?: unknown; ayahs?: unknown };
      const valid =
        typeof p.name === "string" &&
        Array.isArray(p.ayahs) &&
        p.ayahs.every((x: unknown) => typeof x === "string");
      if (!valid) {
        window.alert(
          "Could not import: the JSON must have a \"name\" string and an \"ayahs\" array of ayah locations.",
        );
        return;
      }
      const c = importCollection(json);
      navigate(`/collections/${c.id}`);
    } catch {
      window.alert("Could not import: that is not valid collection JSON.");
    }
  };

  return (
    <div className="page">
      <div className="page-narrow">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Collections</h2>
          <span className="muted">gather ayahs related by root, lemma, or search</span>
          <span style={{ flex: 1 }} />
          <button onClick={doImport}>Import JSON</button>
        </div>

        {collections.length === 0 ? (
          <div className="card" style={{ padding: "26px 28px" }}>
            <h3 style={{ marginTop: 0 }}>No collections yet</h3>
            <p style={{ color: "var(--ink-2)", maxWidth: 560 }}>
              Collections let you gather ayahs that belong together — every ayah sharing a
              root, the results of a search, or verses you pick by hand — then study,
              export, or print them as one continuous text.
            </p>
            <p style={{ color: "var(--ink-2)", maxWidth: 560 }}>
              Start from the <Link to="/roots">Roots explorer</Link> and collect every
              occurrence of a root, or run a <Link to="/search">Search</Link> and collect
              the matching ayahs. You can also create an empty collection here and add
              ayahs as you read.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="primary" onClick={create}>+ New collection</button>
              <button onClick={doImport}>Import JSON</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 16,
            }}
          >
            {collections.map((c: AyahCollection) => (
              <Link
                key={c.id}
                to={`/collections/${c.id}`}
                className="card"
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{c.name}</div>
                <div className="muted" style={{ marginBottom: 8 }}>
                  {c.ayahs.length} {c.ayahs.length === 1 ? "ayah" : "ayahs"} · updated{" "}
                  {new Date(c.updatedAt).toLocaleDateString()}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <CriteriaChips criteria={c.criteria} />
                </div>
              </Link>
            ))}
            <div
              className="card"
              role="button"
              tabIndex={0}
              onClick={create}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter" || e.key === " ") create();
              }}
              style={{
                display: "grid",
                placeItems: "center",
                minHeight: 96,
                cursor: "pointer",
                borderStyle: "dashed",
                boxShadow: "none",
                color: "var(--accent)",
                fontWeight: 600,
              }}
            >
              + New collection
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- detail mode */

function CollectionDetail({ id }: { id: string }) {
  const collections = useCollections();
  const navigate = useNavigate();
  const collection = collections.find((c: AyahCollection) => c.id === id);

  const [ayahMap, setAyahMap] = useState<Map<string, AyahDoc | null>>(() => new Map());
  const [surahMap, setSurahMap] = useState<Map<number, SurahDoc> | null>(null);
  const [reading, setReading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Surah names (cached in db.ts) for scholarly references like "Al-Baqarah 2:255".
  useEffect(() => {
    let mounted = true;
    listSurahs()
      .then((ss: SurahDoc[]) => {
        if (mounted) setSurahMap(new Map(ss.map((s: SurahDoc) => [s.surahNo, s])));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Batch-fetch any ayah texts we don't have yet.
  const locKey = collection ? collection.ayahs.join("|") : "";
  useEffect(() => {
    if (!collection) return;
    const missing = collection.ayahs.filter((loc: string) => !ayahMap.has(loc));
    if (missing.length === 0) return;
    let mounted = true;
    Promise.all(missing.map((loc: string) => getAyahByLocation(loc)))
      .then((docs: (AyahDoc | null)[]) => {
        if (!mounted) return;
        setAyahMap((prev: Map<string, AyahDoc | null>) => {
          const next = new Map(prev);
          missing.forEach((loc: string, i: number) => next.set(loc, docs[i]));
          return next;
        });
      })
      .catch(() => {
        if (!mounted) return;
        setAyahMap((prev: Map<string, AyahDoc | null>) => {
          const next = new Map(prev);
          missing.forEach((loc: string) => next.set(loc, null));
          return next;
        });
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey]);

  if (!collection) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="card" style={{ padding: "26px 28px" }}>
            <h3 style={{ marginTop: 0 }}>Collection not found</h3>
            <p className="muted">
              It may have been deleted, or it was created in a different browser
              (collections are stored locally).
            </p>
            <Link to="/collections">← Back to collections</Link>
          </div>
        </div>
      </div>
    );
  }

  const refLabel = (loc: string): string => {
    const [s] = loc.split(":");
    const su = surahMap?.get(Number(s));
    return su ? `${su.nameTranslit} ${loc}` : loc;
  };

  const startRename = () => {
    setNameDraft(collection.name);
    setEditing(true);
  };
  const commitRename = () => {
    const name = nameDraft.trim();
    if (name && name !== collection.name) {
      renameCollection(collection.id, name, collection.description);
    }
    setEditing(false);
  };

  const doExport = () => {
    const json = exportCollection(collection.id);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => window.alert("Collection JSON copied to clipboard — paste it into Import on another device."),
        () => window.prompt("Clipboard unavailable — copy the JSON below:", json),
      );
    } else {
      window.prompt("Copy the JSON below:", json);
    }
  };

  const doDelete = () => {
    if (window.confirm(`Delete collection “${collection.name}”? This cannot be undone.`)) {
      deleteCollection(collection.id);
      navigate("/collections");
    }
  };

  /* ---- reading view: just the text, for study or print ---- */
  if (reading) {
    return (
      <div className="page">
        <style>{`@media print { .topbar, .no-print { display: none !important; } .page { overflow: visible; } }`}</style>
        <div className="page-narrow">
          <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={() => window.print()}>Print</button>
            <button onClick={() => setReading(false)}>Exit reading view</button>
          </div>
          <h2 style={{ textAlign: "center", margin: "8px 0 2px" }}>{collection.name}</h2>
          {collection.description && (
            <p className="muted" style={{ textAlign: "center", marginTop: 4 }}>{collection.description}</p>
          )}
          <p className="muted" style={{ textAlign: "center", marginTop: 4 }}>
            {collection.ayahs.length} {collection.ayahs.length === 1 ? "ayah" : "ayahs"}
          </p>
          <div style={{ marginTop: 26 }}>
            {collection.ayahs.map((loc: string) => {
              const ayah = ayahMap.get(loc);
              return (
                <div key={loc} style={{ marginBottom: 30 }}>
                  {ayah === undefined ? (
                    <div className="muted">loading {loc}…</div>
                  ) : ayah === null ? (
                    <div className="muted">ayah {loc} is not available in this build</div>
                  ) : (
                    <>
                      <div className="quran">
                        {ayah.textUthmani} <span className="ayah-marker">﴿{ayah.ayahNo}﴾</span>
                      </div>
                      <div className="muted" style={{ marginTop: 2 }}>{refLabel(loc)}</div>
                      <Translations ayah={ayah} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ---- manage view ---- */
  return (
    <div className="page">
      <div className="page-narrow">
        <div className="muted" style={{ marginBottom: 10 }}>
          <Link to="/collections">← Collections</Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          {editing ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{ fontSize: 20, fontWeight: 600, minWidth: 240 }}
            />
          ) : (
            <h2 style={{ margin: 0, cursor: "text" }} title="Click to rename" onClick={startRename}>
              {collection.name}
            </h2>
          )}
          {!editing && <button onClick={startRename}>Rename</button>}
          <span style={{ flex: 1 }} />
          <button onClick={() => setReading(true)}>Reading view</button>
          <button onClick={doExport}>Export</button>
          <button onClick={doDelete} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
            Delete
          </button>
        </div>

        {collection.description && (
          <p style={{ color: "var(--ink-2)", margin: "4px 0 8px" }}>{collection.description}</p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 18 }}>
          <span className="chip">
            <b>{collection.ayahs.length}</b> {collection.ayahs.length === 1 ? "ayah" : "ayahs"}
          </span>
          <CriteriaChips criteria={collection.criteria} />
          <span className="muted">updated {new Date(collection.updatedAt).toLocaleDateString()}</span>
        </div>

        {collection.ayahs.length === 0 ? (
          <div className="card" style={{ padding: "24px 26px" }}>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              This collection is empty. Collect ayahs from the{" "}
              <Link to="/roots">Roots explorer</Link> or a <Link to="/search">Search</Link> —
              they will appear here in the order you add them.
            </p>
          </div>
        ) : (
          collection.ayahs.map((loc: string) => {
            const ayah = ayahMap.get(loc);
            return (
              <div key={loc} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link to={readPathOf(loc)} className="chip link">{refLabel(loc)}</Link>
                  <span style={{ flex: 1 }} />
                  <button
                    title="Remove from collection"
                    aria-label={`Remove ayah ${loc}`}
                    onClick={() => removeAyah(collection.id, loc)}
                    style={{ padding: "2px 9px", lineHeight: 1.4 }}
                  >
                    ✕
                  </button>
                </div>
                {ayah === undefined ? (
                  <div className="muted" style={{ marginTop: 8 }}>loading…</div>
                ) : ayah === null ? (
                  <div className="muted" style={{ marginTop: 8 }}>
                    ayah {loc} is not available in this build
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <div className="quran">
                      {ayah.textUthmani} <span className="ayah-marker">﴿{ayah.ayahNo}﴾</span>
                    </div>
                    <Translations ayah={ayah} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- root */

export default function Collections() {
  const { id } = useParams<{ id: string }>();
  return id ? <CollectionDetail key={id} id={id} /> : <CollectionsIndex />;
}

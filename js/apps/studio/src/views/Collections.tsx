/**
 * Collections — manage ayah collections (the "gather related ayahs" flagship
 * feature). Index mode lists all collections; detail mode shows one collection
 * with its full ayah texts, rename/export/delete actions and a distraction-free
 * reading view for study or print.
 */
import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAyahByLocation } from "../db";
import { num, t, useUILang } from "../i18n";
import type { AyahCollection, AyahDoc } from "../types";
import { readPathOf } from "../types";
import AyahRef from "../components/AyahRef";
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

const KIND_KEY: Record<string, string> = {
  root: "morph.root",
  lemma: "morph.lemma",
  search: "criteria.search",
  manual: "criteria.manual",
};

function CriteriaChips({ criteria }: { criteria: AyahCollection["criteria"] }) {
  useUILang();
  if (!criteria || criteria.length === 0) return null;
  return (
    <>
      {criteria.map((c, i) =>
        c.kind === "root" ? (
          <Link key={`${c.kind}-${c.value}-${i}`} to={`/roots/${encodeURIComponent(c.value)}`} className="chip link">
            {t("morph.root")} <b className="quran" style={{ fontSize: 15, lineHeight: 1 }}>{c.value}</b>
          </Link>
        ) : (
          <span key={`${c.kind}-${c.value}-${i}`} className="chip">
            {t(KIND_KEY[c.kind] ?? c.kind)} <b>{c.value}</b>
          </span>
        ),
      )}
    </>
  );
}

/* -------------------------------------------------------------- index mode */

function CollectionsIndex() {
  useUILang();
  const collections = useCollections();
  const navigate = useNavigate();

  const create = () => {
    const name = window.prompt(t("collect.namePrompt"), t("collect.myCollection"));
    if (name && name.trim()) {
      const c = createCollection(name.trim());
      navigate(`/collections/${c.id}`);
    }
  };

  const doImport = () => {
    const json = window.prompt(t("collections.import") + " (JSON):");
    if (!json) return;
    try {
      const parsed: unknown = JSON.parse(json);
      const p = parsed as { name?: unknown; ayahs?: unknown };
      const valid =
        typeof p.name === "string" &&
        Array.isArray(p.ayahs) &&
        p.ayahs.every((x: unknown) => typeof x === "string");
      if (!valid) {
        window.alert(t("notFound") + ' — {"name", "ayahs": ["s:a", …]}');
        return;
      }
      const c = importCollection(json);
      navigate(`/collections/${c.id}`);
    } catch {
      window.alert(t("notFound") + " — JSON");
    }
  };

  return (
    <div className="page">
      <div className="page-narrow">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{t("collections.title")}</h2>
          <span className="muted">{t("collections.sub")}</span>
          <span style={{ flex: 1 }} />
          <button onClick={doImport}>{t("collections.import")}</button>
        </div>

        {collections.length === 0 ? (
          <div className="card" style={{ padding: "26px 28px" }}>
            <h3 style={{ marginTop: 0 }}>{t("collections.none")}</h3>
            <p style={{ color: "var(--ink-2)", maxWidth: 560 }}>
              {t("collections.empty")} — <Link to="/roots">{t("roots.title")}</Link> ·{" "}
              <Link to="/search">{t("nav.search")}</Link> ·{" "}
              <Link to="/meaning">{t("nav.meaning")}</Link>
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="primary" onClick={create}>{t("collect.new")}</button>
              <button onClick={doImport}>{t("collections.import")}</button>
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
                  {num(c.ayahs.length)} {t("roots.inAyahs")} · {t("collections.updated")}{" "}
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
              {t("collect.new")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- detail mode */

function CollectionDetail({ id }: { id: string }) {
  useUILang();
  const collections = useCollections();
  const navigate = useNavigate();
  const collection = collections.find((c: AyahCollection) => c.id === id);

  const [ayahMap, setAyahMap] = useState<Map<string, AyahDoc | null>>(() => new Map());
  const [reading, setReading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

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
            <h3 style={{ marginTop: 0 }}>{t("notFound")}</h3>
            <Link to="/collections">← {t("collections.title")}</Link>
          </div>
        </div>
      </div>
    );
  }

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
        () => window.alert("✓ JSON"),
        () => window.prompt("JSON:", json),
      );
    } else {
      window.prompt("JSON:", json);
    }
  };

  const doDelete = () => {
    if (window.confirm(`${t("collections.delete")} “${collection.name}”?`)) {
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
            <button onClick={() => window.print()}>{t("collections.print")}</button>
            <button onClick={() => setReading(false)}>{t("collections.exit")}</button>
          </div>
          <h2 style={{ textAlign: "center", margin: "8px 0 2px" }}>{collection.name}</h2>
          {collection.description && (
            <p className="muted" style={{ textAlign: "center", marginTop: 4 }}>{collection.description}</p>
          )}
          <p className="muted" style={{ textAlign: "center", marginTop: 4 }}>
            {num(collection.ayahs.length)} {t("roots.inAyahs")}
          </p>
          <div style={{ marginTop: 26 }}>
            {collection.ayahs.map((loc: string) => {
              const ayah = ayahMap.get(loc);
              return (
                <div key={loc} style={{ marginBottom: 30 }}>
                  {ayah === undefined ? (
                    <div className="muted">{t("loading")}</div>
                  ) : ayah === null ? (
                    <div className="muted">{t("notFound")} — {loc}</div>
                  ) : (
                    <>
                      <div className="quran">
                        {ayah.textUthmani} <span className="ayah-marker">﴿{num(ayah.ayahNo)}﴾</span>
                      </div>
                      <div className="muted" style={{ marginTop: 2 }}><AyahRef location={loc} className="" /></div>
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
          <Link to="/collections">← {t("collections.title")}</Link>
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
            <h2 style={{ margin: 0, cursor: "text" }} title={t("collections.rename")} onClick={startRename}>
              {collection.name}
            </h2>
          )}
          {!editing && <button onClick={startRename}>{t("collections.rename")}</button>}
          <span style={{ flex: 1 }} />
          <button onClick={() => setReading(true)}>{t("collections.reading")}</button>
          <button onClick={doExport}>{t("collections.export")}</button>
          <button onClick={doDelete} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
            {t("collections.delete")}
          </button>
        </div>

        {collection.description && (
          <p style={{ color: "var(--ink-2)", margin: "4px 0 8px" }}>{collection.description}</p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 18 }}>
          <span className="chip">
            <b>{num(collection.ayahs.length)}</b> {t("roots.inAyahs")}
          </span>
          <CriteriaChips criteria={collection.criteria} />
          <span className="muted">
            {t("collections.updated")} {new Date(collection.updatedAt).toLocaleDateString()}
          </span>
        </div>

        {collection.ayahs.length === 0 ? (
          <div className="card" style={{ padding: "24px 26px" }}>
            <p style={{ margin: 0, color: "var(--ink-2)" }}>
              {t("collections.empty")} — <Link to="/roots">{t("roots.title")}</Link> ·{" "}
              <Link to="/search">{t("nav.search")}</Link>
            </p>
          </div>
        ) : (
          collection.ayahs.map((loc: string) => {
            const ayah = ayahMap.get(loc);
            return (
              <div key={loc} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AyahRef location={loc} />
                  <span style={{ flex: 1 }} />
                  <button
                    title={t("collections.remove")}
                    aria-label={t("collections.remove")}
                    onClick={() => removeAyah(collection.id, loc)}
                    style={{ padding: "2px 9px", lineHeight: 1.4 }}
                  >
                    ✕
                  </button>
                </div>
                {ayah === undefined ? (
                  <div className="muted" style={{ marginTop: 8 }}>{t("loading")}</div>
                ) : ayah === null ? (
                  <div className="muted" style={{ marginTop: 8 }}>{t("notFound")} — {loc}</div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <div
                      className="quran"
                      style={{ cursor: "pointer" }}
                      title={t("nav.reader")}
                      onClick={() => navigate(readPathOf(loc))}
                    >
                      {ayah.textUthmani} <span className="ayah-marker">﴿{num(ayah.ayahNo)}﴾</span>
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

/**
 * Collection schemas for quran-app.db (monlite).
 *
 * monlite structured collections must be opened with the same schema
 * everywhere — the converter that creates them and every consumer (Node,
 * browser). Import from here; never inline.
 *
 * `ayahs` is intentionally NOT here: it is a document-mode collection (the
 * fts() plugin opens it at init, which fixes its mode).
 */
export const SCHEMAS = {
  surahs: {
    surahNo: { type: "INTEGER", unique: true },
    nameAr: "TEXT",
    nameTranslit: "TEXT",
    nameEn: "TEXT",
    revelation: { type: "TEXT", index: true },
    chronoOrder: "INTEGER",
    ayahCount: "INTEGER",
    wordCount: "INTEGER",
    letterCount: "INTEGER",
  },
  words: {
    location: { type: "TEXT", unique: true },
    surahNo: { type: "INTEGER", index: true },
    ayahNo: "INTEGER",
    wordNo: "INTEGER",
    textClean: { type: "TEXT", index: true },
    root: { type: "TEXT", index: true },
    lemma: { type: "TEXT", index: true },
    segments: { type: "JSON" },
  },
  roots: {
    root: { type: "TEXT", unique: true },
    occurrences: { type: "INTEGER", index: true },
    lemmas: { type: "JSON" },
    locations: { type: "JSON" },
  },
  // Root co-occurrence edges (a, b = root texts; w = shared-ayah count).
  rootEdges: {
    a: { type: "TEXT", index: true },
    b: { type: "TEXT", index: true },
    w: { type: "INTEGER", index: true },
  },
  // Singleton documents (key = "stats" holds precomputed statistics).
  meta: {
    key: { type: "TEXT", unique: true },
  },
};

/**
 * فِهرسُ نِبراس الدلاليّ — a SEPARATE RAG corpus (rag.db), one row per chunk from
 * any SOURCE (quran, then tafsir + books). Indexed by @monlite/vector for
 * findSimilar / hybrid (FTS+vector), filterable by `source` — so نِبراس can cite
 * per book. Kept APART from the computed layers (Quran+معاجم+QAC only): adding
 * books here never touches «نحسب ونعرض». Embedding dim = 768 (gemini-embedding-001).
 */
export const RAG_DIM = 768;
export const RAG_SCHEMA = {
  source: { type: "TEXT", index: true }, // "quran" | "ibn-kathir" | …
  ref: { type: "TEXT", index: true },    // "2:255" | a book locator
  text: "TEXT",                          // the chunk (FTS + display + citation)
  embedding: { type: "JSON" },           // number[RAG_DIM] — indexed by @monlite/vector
};

/** Open a collection with its canonical schema. */
export function coll(db, name) {
  return db.collection(name, SCHEMAS[name] ? { schema: SCHEMAS[name] } : undefined);
}

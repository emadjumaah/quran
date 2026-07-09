# QKG — Architecture Feedback & Next Steps

*Written 2026-07-09, after building `quran-kg.db` and reviewing monlite.*

**monlite feedback from this session** (dogfooding notes):
- Opening a *structured* collection without re-passing its schema doesn't
  throw — it silently returns docs missing the column-backed fields. The docs
  promise a throw on a *different* schema; an *omitted* schema should probably
  throw too. Workaround used here: `js/shared/monlite-schemas.mjs` as the
  single source of truth for every consumer.
- The `fts()` plugin opens its target collections at init in document mode, so
  an FTS-indexed collection can't be structured. Fine for us (`ayahs` is
  document mode), worth documenting.
- `Monlite` has no `close()` — it's `$disconnect()`. A `close()` alias would
  match better-sqlite3/node:sqlite muscle memory.
- Stock `sql.js` lacks FTS5; the wasm README's quick start + `fts()` search
  fails with "no such module: fts5". The demo already solves this with
  `fts5-sql-bundle` — worth a note in the @monlite/wasm README.

## Where the data came from (your question)

`data/quran-morphology.txt` is the **Quranic Arabic Corpus v0.4** — the
academic morphological annotation of the Quran from the University of Leeds
(corpus.quran.com, Kais Dukes). I used its Arabic-script edition maintained at
github.com/mustafa0x/quran-morphology (the original uses Buckwalter
transliteration; this edition is the same data in readable Arabic). It gives
every one of the 130,030 segments its root, lemma, POS, and grammatical
features — this is the same data behind the word-by-word grammar on
corpus.quran.com. `data/quran-data.xml` (juz/hizb/ruku/page/sajda boundaries,
surah names/types) comes from Tanzil.net. Full table in `README.md` →
Provenance, and inside the DB itself: `SELECT * FROM provenance;`.

## The layered architecture I recommend

```
Python (build_qkg.py)          — the data refinery. Runs rarely.
   └─> quran-kg.db             — canonical relational SQLite. Source of truth.
        └─> Node converter      — reads quran-kg.db, writes app-shaped data
             └─> quran-app.db   — monlite database (document + structured collections)
                  ├─> npm package  "quran-kg"  (typed TS API, Node)
                  └─> Vite web app (browser, @monlite/wasm + sql.js)
```

Python stays exactly where it's strong (parsing, alignment, validation) and
where you said it should be: *getting the dbs ready*. Everything user-facing
is TypeScript.

## monlite fit — yes, and it's a genuinely good fit

I read through monlite (core, wasm, vector, fts, python). For the QKG app
layer it buys us, with zero extra services:

1. **Structured collections** — `surahs`, `ayahs`, `words`, `roots` as typed
   columns with indexes and FKs; Mongo-style typed queries in TS
   (`words.findMany({ where: { root: "رحم" } })`).
2. **FTS5 plugin** — instant keyword search over ayah clean text. This is a
   feature the relational DB doesn't have yet, and it's one `plugins:` line.
3. **Vector plugin** — the semantic layer later (see below), same file.
4. **@monlite/wasm** — the *same* database file and the *same* API run in the
   browser via sql.js. The Vite app and the Node package share one code path.
5. **Python interop** — monlite's Python package writes the same file format,
   so the pipeline could even emit app data directly from Python (document
   mode only — the Python port doesn't do structured collections, so I'd keep
   the converter in Node).

One caveat: monlite is a document store at heart. The deep *relational*
queries (root co-occurrence networks, corpus statistics, arbitrary joins) stay
on `quran-kg.db` with plain SQL — that's fine, it's the research interface.
The monlite file is the *application* interface: denormalized, app-shaped
documents (an ayah with its words and their morphology embedded) that a UI
can render with one `findById`.

## npm package — yes, feasible, two packages

- **`quran-kg-data`** — ships the database file(s), versioned like the data
  (e.g. `0.4.x` tracking QAC 0.4). ~52 MB is inside npm's limit but heavy;
  shipping a **slim app build** (drop the `letter` table and `features_raw`,
  ~20 MB, ~8–10 MB gzipped in the tarball) is comfortable. The full research
  DB can live in GitHub Releases.
- **`quran-kg`** — the typed API. Depends on `quran-kg-data`, uses
  `node:sqlite` (Node ≥22.5, zero native deps) or monlite. Browser entry point
  loads the same bytes via `@monlite/wasm`/sql.js.

This split is exactly how monlite's own packages are laid out, and it means
other developers get the whole linguistic map with `npm i quran-kg`.

## Do we need a vector DB?

**Not for the linguistic map** — root/lemma/morphology links are *exact*
relations; SQL joins answer them precisely and instantly. Embeddings would
add nothing there.

**Yes for the semantic layer** (phase 2): "find ayahs about patience in
hardship regardless of wording", cross-lingual search, clustering, a RAG
assistant. Scale is tiny by vector-DB standards — 6,236 ayah embeddings
(~10 MB at 384-dim) — so **monlite's vector plugin is more than enough**; we
do not need Qdrant/pgvector/anything external.

**Embedding model — decided (2026-07-09): Gemini.** All semantic vectors go
through the Gemini embedding API so future tests are consistent. The pipeline
is ready: `GEMINI_API_KEY=... node js/scripts/embed-ayahs.mjs` embeds every
ayah (clean Arabic + English translation when present, task type
RETRIEVAL_DOCUMENT, default `gemini-embedding-001` at 768 dims, resumable,
rate-limit aware) into `quran-kg.db` → table `ayah_embedding`. Get a key at
https://aistudio.google.com/apikey.

## Status & next steps

Done (as of 2026-07-09 evening):

1. ✅ **`quran-kg` npm package** — typed API, zero deps, 8/8 tests.
2. ✅ **Correctness audit** — 20-agent adversarial review; all confirmed
   findings fixed and re-verified; record in `AUDIT.md`.
3. ✅ **Translation layer** — Saheeh International attached to every ayah
   (`add_translation.py`; repeatable for any Tanzil translation key).
4. ✅ **Quran Studio** (`js/apps/studio`) — the React app: Reader (word-by-word
   morphology inspector), Roots, relations Network (canvas force graph),
   FTS Search, **Collections** (gather ayahs by root/search/manual with
   recorded criteria, reading mode, export), Dashboard. Typecheck clean,
   production build green.
5. ✅ **Gemini embedding pipeline** — `js/scripts/embed-ayahs.mjs`, ready to
   run the moment a `GEMINI_API_KEY` is provided.

6. ✅ **Embeddings run** (2026-07-09 night): all 6,236 ayahs embedded with
   `gemini-embedding-001` (768-dim) into `quran-kg.db`. Semantic search
   works in both English and Arabic:
   `node js/scripts/semantic-search.mjs "patience in hardship"`.
7. ✅ **git repository** initialized; first commit `b209aa1` (code + data
   sources; generated dbs, node_modules, archive/ and `.env` excluded).

Next:

1. **"Meaning search" view in Studio** — the vectors exist; the design
   question is where query-time embedding happens for a static site (user
   pastes their own Gemini key in the browser, or a tiny embed endpoint).
   Ship vectors to the app db (~19 MB at 768-dim; 256-dim ≈ 6 MB is the
   pragmatic browser choice).
2. **Deploy Studio** (it IS the online app): static build → GitHub Pages /
   Netlify / Cloudflare Pages (the ~48 MB db gzips to ~15 MB — consider a
   slim web build or lazy per-surah loading later).
3. **npm publish** — optional, not required for the app; do it when we want
   other developers building on the data (`quran-kg` + a data package).
4. **Phase 3 — enrichment**: qira'at, word-level audio timings, and a hadith
   cross-reference layer (the hadith project next door) — all attach to
   existing stable IDs without schema redesign. (Tafsir: explicitly out of
   scope per project decision 2026-07-09.)

Decisions recorded 2026-07-09 (late):
- **No Neo4j** — the graph is small (1,651 roots / 16,878 edges) and
  precomputed; SQL + the in-app canvas covers it. The Cypher export stays
  available for anyone who wants graph-algorithm experiments offline.
- **Translations**: English = Saheeh International (primary), French =
  Muhammad Hamidullah, Turkish = Diyanet İşleri — all three loaded;
  Studio shows the preferred language with a persistent switcher.
- **Audio**: one reciter, Shaykh Maḥmūd Khalīl al-Ḥuṣarī (murattal — the
  reference recitation for tajwīd clarity), 64 kbps per-ayah MP3s streamed
  from the Islamic Network CDN — nothing to host.
- **Semantic search serving**: ayah vectors are precomputed; only the QUERY
  needs one tiny Gemini embed call per search. A ~20-line proxy endpoint
  (Cloudflare Worker) keeps the key server-side; retrieval itself is local
  cosine — no per-ayah Gemini calls ever again.

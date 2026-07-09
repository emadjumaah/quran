# QKG — TypeScript workspace

The application layer of the Quran Knowledge Graph. Python (`../build_qkg.py`)
builds the canonical relational database; everything here consumes it.

```
js/
  packages/quran-kg/        the npm package: typed API over quran-kg.db
  apps/studio/              Quran Studio — the React app (reader, morphology,
                            roots, relations network, search, ayah collections)
  shared/
    monlite-schemas.mjs     single source of truth for monlite collection schemas
  scripts/
    convert-to-app-db.mjs   quran-kg.db -> quran-app.db (monlite + FTS + rootEdges + stats)
    embed-ayahs.mjs         semantic layer: Gemini embeddings for every ayah
                            (GEMINI_API_KEY=... node scripts/embed-ayahs.mjs)
    semantic-search.mjs     search ayahs by MEANING over those embeddings
                            (GEMINI_API_KEY=... node scripts/semantic-search.mjs "patience in loss")
```

## quran-kg (packages/quran-kg)

Typed, zero-dependency API over `../quran-kg.db` using `node:sqlite`
(Node ≥ 22.5 — no native builds).

```ts
import { openQuranKG } from "quran-kg";

const kg = openQuranKG("path/to/quran-kg.db");

kg.getSurah(1);                    // names, revelation, counts
kg.getAyah(1, 5);                  // ayah + its words with root/lemma/POS
kg.getWord(2, 255, 5);             // full segment-level morphology
kg.getRoot("رحم");                 // all lemmas of a root
kg.rootOccurrences("رحم");         // every location — the root map
kg.cooccurringRoots("رحم");       // roots sharing ayahs, ranked
kg.searchWords("الرحمن", { exact: true });
kg.sql("SELECT ... ");             // escape hatch: any read-only SQL
```

```bash
cd packages/quran-kg
pnpm build && pnpm test     # 8 integration tests against the real DB
```

## The monlite app database (scripts/convert-to-app-db.mjs)

Converts the relational DB into `../quran-app.db` — a
[monlite](https://github.com/qataruts/monlite) database with app-shaped
collections and full-text search:

| Collection | Docs | Shape |
|---|---|---|
| `surahs` | 114 | structured columns (surahNo, names, revelation, counts) |
| `ayahs` | 6,236 | document mode, **FTS-indexed** on `textClean` |
| `words` | 77,429 | structured (location/root/lemma indexed), morphology segments embedded as JSON |
| `roots` | 1,651 | structured, lemmas + every location embedded |

```bash
node scripts/convert-to-app-db.mjs
```

Because monlite's file format is identical across runtimes, `quran-app.db`
works from Node (`@monlite/core`), Python (`pip install monlite`), and the
browser (`@monlite/wasm` + sql.js) — the same file, the same query API. That
makes it the data file for Quran Studio, and later the home of ayah
embeddings via `@monlite/vector` (semantic search) without schema changes.

```ts
// e.g. in the browser or Node:
const ayahs = db.collection("ayahs");
await ayahs.search("الرحمن الرحيم");                  // FTS5, ranked
await db.collection("words").findMany({ where: { root: "رحم" } });
```

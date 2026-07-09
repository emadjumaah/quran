# Quran Studio — مصحف المعرفة

The browser face of the Quran Knowledge Graph: **the Quran as a connected web
of meaning**, not another mushaf app. Everything runs in the browser — the
entire knowledge graph loads as one monlite (SQLite WASM) file; there is no
server.

## The core loop

**read → tap a word → see its anatomy → follow its root → see its web →
collect the ayahs that share it.**

| View | What it does |
|---|---|
| **Reader** | The full mushaf in Amiri Quran type, word-by-word interactive: tap any word and the inspector shows its prefix/stem/suffix segments with root, lemma, POS (Arabic + English), verb form, aspect, mood, voice, case, person/gender/number. English translation under every ayah. |
| **Roots** | Every root as a first-class page: all derived lemmas with counts, every occurrence in the Quran grouped by ayah, related roots ranked by shared ayahs — and one button to **collect all its ayahs**. |
| **Network** | The root's semantic neighborhood as an interactive force-directed graph (canvas, no libraries): node size and edge width follow co-occurrence strength; click any node to re-center. |
| **Search** | Instant full-text search (FTS5) with phrase/prefix/OR syntax, URL-addressable queries, root suggestions — and one button to collect all results. |
| **Collections** | The research workbench: named collections of ayahs gathered by root, search, or hand-picking, with recorded criteria ("why these belong together"), a clean reading mode, print, JSON export/import. Stored locally, private by default. |
| **Dashboard** | The Quran in numbers: Meccan/Medinan balance, longest/shortest surahs, top roots, letter frequencies, and the 114 surahs as a revelation-order timeline. |

## Run

```bash
# one-time: build the app database (from js/)
node ../../scripts/convert-to-app-db.mjs

pnpm dev      # copies the db into public/ and starts Vite
pnpm build    # static production build (deployable to any static host)
```

## Data

`public/quran-app.db` is generated from the canonical `quran-kg.db`
(Quranic Arabic Corpus morphology + Tanzil text/structure + Saheeh
International translation — full provenance inside the database). The
knowledge graph is audited end-to-end; see `../../../AUDIT.md`.

Semantic search by meaning (Gemini embeddings) is the next layer — the
pipeline is ready in `../../scripts/embed-ayahs.mjs`.

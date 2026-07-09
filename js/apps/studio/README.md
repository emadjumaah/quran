# Quran Studio — مصحف المعرفة

The browser face of the Quran Knowledge Graph: **the Quran as a connected web
of meaning**, not another mushaf app. Everything runs in the browser — the
entire knowledge graph loads as one monlite (SQLite WASM) file; there is no
server. The interface is **Arabic-first (RTL)** with a one-tap English toggle;
ayah references show **Arabic surah names** («البقرة ٢٥٥», not "2:255").

## The core loop

**read → tap a word → see its anatomy → follow its root → see its web →
collect the ayahs that share it.**

| View | What it does |
|---|---|
| **المصحف / Reader** | Two modes: **صفحات** — continuous mushaf flow grouped by Madani page (default) — and **آيات** — ayah list with tools. Word-by-word interactive in both: tap any word for its prefix/stem/suffix segments with root, lemma, POS, verb form, case… Per-ayah recitation (al-Ḥuṣarī) and translation in en/fr/tr with a persistent language switcher. |
| **الجذور / Roots** | Every root as a first-class page: derived lemmas with counts, every occurrence grouped by ayah, related roots ranked by shared ayahs — and one button to **collect all its ayahs**. |
| **الشبكة / Network** | The root's semantic neighborhood as an interactive force-directed graph (canvas, no libraries): node size and edge width follow co-occurrence strength; click any node to re-center. |
| **البحث / Search** | Instant full-text search (FTS5) with phrase/prefix/OR syntax, URL-addressable queries, root suggestions — collect all results in one tap; every result opens at its place in the mushaf. |
| **بحث بالمعنى / Meaning** | Search by meaning in any language (Gemini vectors, local ranking): "patience in hardship" finds the right ayahs regardless of wording. |
| **المجموعات / Collections** | The research workbench: named collections of ayahs gathered by root, meaning, search, or hand-picking, with recorded criteria, a clean reading mode, print, JSON export/import. Stored locally, private by default. |
| **إحصاءات / Dashboard** | The Quran in numbers: Meccan/Medinan balance, longest/shortest surahs, top roots, letter frequencies, revelation-order timeline. |

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

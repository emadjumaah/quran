# Tafsir source data (for نِبراس's book corpus)

Verse-anchored `{ref, text}` JSONL, one object per line (`ref = "surah:ayah"`). These
are **source data** kept for future re-embedding; the shipped browser artifacts are
`apps/studio/public/rag-<id>.bin` (int8) + `rag-<id>.json`, built by
`scripts/build-book-embeddings.mjs`.

| file | id | tafsir | notes |
|---|---|---|---|
| `muyassar.jsonl` | `muyassar` | التفسير الميسّر (مجمع الملك فهد) | concise, explanatory, 6236 āyāt |
| `jalalayn.jsonl` | `jalalayn` | تفسير الجلالين (المحلّي والسيوطي) | very concise, word-gloss style, 6236 āyāt |

## Where these came from
Extracted from an **alquran.cloud** MySQL dump (`editions` + `ayah_edition`) via
`scripts/extract-alquran-editions.mjs` (editions 1 = ar.muyassar, 103 = ar.jalalayn).
**That dump contains only these two Arabic tafsirs** (plus translations + audio).

## Getting more tafsirs (future)
Other tafsirs (السعدي · المختصر · ابن كثير · أضواء البيان · الطبري · القرطبي …) come from
other sources — e.g. **tafsir.app**, or open datasets (spa5k/tafsir_api, quran-json,
al-maktaba). Prefer **verse-anchored** ones (each passage keyed to an āyah) so they drop
straight into the `{ref, text}` shape. Concise tafsirs → browser (int8, lazy). Heavy
encyclopedic tafsirs → the reserved server `rag.db` path (or a desktop build).

## To add a book
1. Produce `{ref, text}` JSONL.
2. `GEMINI_API_KEY=… node scripts/build-book-embeddings.mjs <id> file.jsonl` → writes
   `public/rag-<id>.bin` + `.json`.
3. Register `{ id, label }` in `apps/studio/src/rag.ts` (`BOOK_SOURCES`).

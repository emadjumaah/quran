# quran-kg

Typed API over the **Quran Knowledge Graph** — every surah, ayah, word,
morphological segment, root, and lemma of the Quran, with full grammatical
metadata, in a single SQLite database.

- **Data**: [Quranic Arabic Corpus v0.4](https://corpus.quran.com) morphology
  (roots, lemmas, POS, verb form, aspect, mood, voice, case,
  person/gender/number) + [Tanzil](https://tanzil.net) text and structure
  (juz, hizb, rub, ruku, page, manzil, sajda).
- **Zero dependencies**: uses `node:sqlite` (Node ≥ 22.5), read-only.
- **Fully typed**: every entity and every grammatical feature.

```ts
import { openQuranKG } from "quran-kg";

const kg = openQuranKG("path/to/quran-kg.db");

kg.getSurah(1);
// { nameAr: "الفاتحة", nameTranslit: "Al-Faatiha", revelation: "Meccan", ... }

kg.getAyah(1, 5).words.map((w) => w.root);
// ["—", "عبد", "—", "عون"]

kg.getWord(2, 255, 5)?.segments;
// [{ text: "هُوَ", role: "stem", pos: "PRON", posAr: "ضمير", person: 3, ... }]

kg.getRoot("رحم");
// { occurrences: 339, lemmas: [{ lemma: "رَحِيم", occurrences: 116 }, ...] }

kg.rootOccurrences("رحم");      // every location — the "root map"
kg.cooccurringRoots("رحم");     // roots sharing ayahs, ranked
kg.searchWords("الرحمن", { exact: true });
kg.sql("SELECT ...");            // escape hatch: any read-only SQL
```

## The database

`quran-kg.db` is built by the deterministic Python pipeline in the parent
repository (`build_qkg.py`) and validates itself on every rebuild: canonical
counts (114 surahs, 6,236 ayahs, 77,429 words, 130,030 segments),
referential integrity, POS coverage, and 100% word alignment between the
Uthmani and plain text editions.

## API

| Method | Returns |
|---|---|
| `listSurahs()` / `getSurah(n)` | surah metadata (names, revelation, counts) |
| `listAyahs(s)` / `getAyah(s, a)` | ayah text + structure (+ words with root/lemma/POS) |
| `getWord(s, a, w)` | one word with its full segment-level morphology |
| `searchWords(text, {exact, limit})` | words by clean (diacritic-free) text |
| `getRoot(root)` | root with all derived lemmas and counts |
| `rootOccurrences(root)` | every location of the root in the Quran |
| `cooccurringRoots(root, minShared)` | roots co-occurring in the same ayahs |
| `topRoots(limit)` | roots ranked by frequency |
| `stats()` | global entity counts |
| `sql(query, ...params)` | raw read-only SQL against the full schema |

## License

MIT for this package. Data: Quranic Arabic Corpus (GPL, Kais Dukes) and
Tanzil (CC BY 3.0) — see the `provenance` table inside the database.

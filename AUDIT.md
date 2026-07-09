# QKG Correctness Audit — 2026-07-09

A 20-agent multi-dimension audit of `quran-kg.db` and its pipeline: seven
independent domain audits (canonical counts, feature decoder, text fidelity,
structural metadata, Arabic terminology, deep linguistic spot checks, code
review), every critical/major claim independently reproduced by an
adversarial verifier before being accepted.

## Verdict

The decoder, structural metadata, and linguistic content are **sound**:

- **Feature decoder**: all 7 systematic checks exact — ACC particle/case
  disambiguation (2,292 vs 10,532 segments), IMPV three-way split
  (verb aspect 1,872 / lām al-amr 78 / ism fiʿl 6), bare-P
  preposition/plural split (12,992 vs 390), PGN parsing incl. partial tags,
  voice (1,151 passive = raw tag count), mood/verb-form/family counts all
  match the raw QAC tag inventory exactly.
- **Structure**: all 30 juz starts, 604-page Madani mapping, hizb/rub/ruku/
  manzil divisions, the 15 canonical sajdas (4 obligatory per Tanzil), and
  revelation/chronological ordering verified against external references.
- **Linguistics**: 12 deep spot checks (بسم، الرحمن، نعبد، آمنوا، يخادعون،
  استوقد، أنزلناه، وليكتب، يتساءلون، مستقيم، الم…) — root, lemma,
  segmentation, verb form, mood (incl. jussive after lām al-amr), voice,
  case: **all correct**, matching corpus.quran.com.

## Defects found and fixed (all independently confirmed, then fixed)

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | critical | `text_uthmani` of **95:1 and 97:1** still contained the basmala: Tanzil writes it there with a shadda on the bā (بِّسْمِ — idgham, as surahs 94/96 end in ب), which the exact-match stripper missed | stripper now matches both basmala forms |
| 2 | major | `ayah.word_count` counted clean-text whitespace tokens (Σ=77,800) while `surah.word_count` counted QAC words (Σ=77,429) — two tokenizations in one schema | `ayah.word_count` now = COUNT(word) — one tokenization everywhere |
| 3 | major | Merged clean tokens (371 merges across 367 ayahs — «يا أيها» ×142, «يا قوم» ×38 …) were stored space-less («ياأيها»), breaking substring search; two merges even altered letters («يابنؤم», «وألو») | merged tokens now keep their internal space — `text_clean` is letter-exact source text, fully searchable |
| 4 | major | `pos_tag` glossary: **NV** labeled "اسم فعل أمر" though it covers all three ism-fiʿl classes (هيهات = ماضٍ; أفٍّ/وي = مضارع); **EMPH** labeled "لام التوكيد" though 243/1,244 EMPH segments are nūn of emphasis | renamed to «اسم فعل» and «توكيد: لام التوكيد أو نون التوكيد» |
| 5 | minor | `letter` table disagreed with `letter_count` by 2 (consequence of #3) | resolved by #3 |
| 6 | minor | PREV Arabic name lacked the shadda (حرف كاف ≠ حرف كافّ) | fixed («حرف كافّ (ما الكافّة)») |
| 7 | minor | NV segments' aspect (أمر/ماضٍ/مضارع) was dropped by the verbs-only rule | aspect now kept for NV segments |
| 8 | minor | Dead/misleading branches in `decode_features` (NOM-on-P, duplicated P fallback) | removed |
| 9 | info | "Inna and **her** sisters" → conventional "its sisters"; verb forms I–XII had no glossary entries | fixed; 12 أوزان entries added (فَعَلَ … اِفْعَوْعَلَ) |

## Known conventions (documented, not defects)

- **Two Uthmani encodings**: `word.text_uthmani` follows the QAC
  Arabic-script edition; `ayah.text_uthmani` follows Tanzil. They differ in
  hamza-carrier/tatweel conventions in ~15 ayahs (e.g. ٱلْـَٔانَ), plus a
  letter-level divergence at 12:39/12:41 (يَٰصَىٰحِبَىِ vs يَٰصَٰحِبَىِ)
  and a space inside 37:130's word 3 (إِلْ يَاسِينَ) — all upstream source
  differences, preserved faithfully per layer.
- **Every headline count reconciles with QAC v0.4 exactly**:
  - *Words 77,429* match the official QAC v0.4 data file location-for-location
    (the "77,430" often cited on the QAC site differs by one from QAC's own
    file).
  - *Segments 130,030 vs the Buckwalter file's 128,219*: the Arabic-script
    edition deliberately re-segments 1,303 words (demonstratives, vocatives,
    يومئذ, fused pronouns) — same 77,429 word locations in both.
  - *Roots 1,651 vs 1,642*: hamza-orthography respellings between editions
    (e.g. ابد→أبد); the delta decomposes precisely, no decode error.
  - *Lemmas 4,776 vs the cited 3,382/3,680*: QAC's cited figures count
    non-verb lemmas only (verbs live in a separate concordance); the v0.4
    file itself carries ~4,800. Three final-sukun duplicates inherited from
    upstream (وَسَطْ/وَسَط, أَكْبَرْ/أَكْبَر, قَسَمْ/قَسَم).
  - *Letters 330,709* follows the Tanzil Simple (imlāʾī) convention: every
    Arabic base letter incl. standalone hamza, excluding the 112 unnumbered
    basmalas.
- **Multi-stem words** (563, e.g. عَمَّ = عَن + ما): word-level
  root/lemma/POS roll up from the *first* stem; the full analysis is always
  in `segment`.
- **Assimilated pronouns**: in forms like إِنَّآ the pronoun segment's
  surface is آ (the ن absorbed into the shadda) — correct annotation, but
  don't search pronoun segments by surface نا alone.
- **Categories**: DEM/REL are categorized `pronoun`, T/LOC `adverb`
  (finer than QAC's umbrella "nominal") — deliberate, for UI filtering.
- **Ruku count** follows the 556 convention; **sajda types** follow Tanzil
  (4 obligatory, 11 recommended); debated revelation types (55, 13, …)
  follow Tanzil's metadata.

Rebuild `quran-kg.db` with `python3 build_qkg.py` — the validation report at
the end of every build re-checks counts, integrity, and alignment.

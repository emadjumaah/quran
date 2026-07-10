# Post-Pass-C heavy work — consolidated plan (owner: "be ready")

Everything discussed, to execute after Pass C finalizes the محكم→تفصيل network.
Grouped; not strict order — owner picks.

## A. Finalize محكم→تفصيل (immediately after Pass C)
- Harvest Pass C verdicts → apply confirm/reweight/reject + gaps (keep originals; add reviewed columns).
- Facet refinements: facet-1 gate on verb-lemma حَرَّم (drop الأشهر الحرم false positives);
  facet-2 branching-vs-terminal by تفصيل-degree.
- Export FINAL reviewed findings (MD + JSON) + archive raw. Commit both remotes.

## B. Ship «الآيات الجوامع» — rendered ON the QCF page
- Jawami view: browse principles by kind; each hub → its typed تفصيل (بيان/مثال/جزاء/توكيد).
- In the mushaf/reader: mark جوامع; tap → its تفصيل set highlighted across pages.
- N2 توكيد self-restatement graph (nearly free from the data — المثاني made visible).

## C. Mushaf visual — full authenticity (heavy)
- QUL mushaf-layout with line_type → exact 15-line grid, real surah-header lines,
  centered lines, basmala at true positions.
- Hizb/rub ۞ margin markers at exact spots; sajda marks; juz/hizb furniture.
- Real ornamental border artwork; two-page spread option (book feel); page-turn animation/swipe.
- Latency polish (preload ± window; offline "download full mushaf" pack).

## D. Reader settings ⚙ (spec in READER-SETTINGS.md)
- Panel + useSettings() store. Ship ✓ items: script Uthmani⇄simple, font family/size,
  numerals, sepia theme, translation on/off + inline/side, reader mode.
- Bookmarks · khatma/progress · reading history · reciter picker · playback speed ·
  range/ayah repeat (partly done) · juz/hizb section navigation.

## E. World-firsts backlog (WORLD-FIRSTS.md)
- فروق التنزيل diff engine (twin catalog ready, 14,313 pairs).
- التفصيل الموضوعي (composite engine w/ نظم الدرر; printed PDF = private validation).
- الوجوه والنظائر محسوبة · خرائط النظم · ميزان المقاييس.
- N4 grammar genome · N5 iltifāt register · N6 rhyme atlas.

## F. Within-method resources (ROADMAP.md)
- القراءات (variant readings) · computed tajwīd coloring · QAC syntactic treebank ·
  QurAna pronoun corpus · 2nd morphology provider · more معاجم (al-Ayn, Taj al-Arus).

## G. Platform
- Loading strategy: measure db after features; lazy-load heavy layers if burden (safe technique in LOADING-STRATEGY.md).
- Electron desktop app via GitHub Actions on qataruts/quran.
- npm publish (optional): quran-kg + data package.

All raw pass data preserved (data/passes/). Swarms default to Sonnet.

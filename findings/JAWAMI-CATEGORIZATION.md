# تصنيف الجوامع — Categorizing the محكمات (design + first computed facet)

Neutral, computed enrichment of the الجوامع layer. Inspired by the observation
that Shahrour's محكم/تفصيل frame suggests categorizing the principle verses —
but grounded in our own content-blind data, staying computed-not-authoritative.

## Empirical convergence (recorded)
Every verse in Shahrour's «19 محكمات» that we checked was independently
classified by the Pass A swarm as p=2 / kind=حكم, with no knowledge of Shahrour
(6:151-153, 5:3, 4:22-23, 7:33, 2:275, 2:183, 5:38, 24:2). The structure is
really in the text; his lens is one legitimate reading of it.

## Facet 1 — الأحكام الحاصرة (COMPUTED, FINAL)
Linguistic features from Pass A + morphology (columns on ayah_principle):
- تحريم صريح — the VERB حَرَّم (root ح-ر-م, form II) only: **15 جوامع** —
  البقرة ١٧٣/٢٧٥، النساء ٢٣، المائدة ٣/٨٧/٩٦، الأنعام ١٥١، الأعراف ٣٢/٣٣،
  التوبة ٢٩، النحل ١١٥، الإسراء ٣٣، النور ٣، الفرقان ٦٨. (the classical
  المحرمات set — clean.)
- حصر/قصر (إنّما / استثناء): 158
- أمر أو نهي: 626
REFINEMENT APPLIED: the gate is now `root='حرم' AND pos_basic='V'` (segment
morphology), so the noun حَرام/حُرُم "sacred" (الأشهر الحرم، المسجد الحرام) no
longer counts. The حكم-kind ∩ verb-تحريم set = 14 آيات (الأحكام الحاصرة للمحرمات).

## Facet 2 — درجة التفرّع (COMPUTED, FINAL — on the reviewed Pass B/C network)
Grade each جامعة by its **surviving** تفصيل-degree in ayah_tafsil (out-degree =
what it elaborates into; in-degree = whether a higher آية elaborates *it*):
- **أصل جامع** (out≥8, in=0 — a network root): **36**
- **متفرّع** (out≥1, in≥1 — an internal node): **895**
- **موجز** (out≥1, in=0 — a leaf hub): **52**
- **مجرّد** (out=0 — stands alone): **49**
Widest roots: 7:27, 7:40 (22 each), 19:65, 54:40 (20), 41:42 (19), 15:9, 92:15
(17)… Finer than any flat closed-list; emerges from our own verified data.

## Shahrour as a «عدسة» (lens), not the app's voice
If surfaced: an OPTIONAL attributed overlay «قراءة شحرور — ١٩ آية», one named
reading among others (like a manual thematic mushaf overlay), never THE
محكمات. App stays neutral: computed categories + verified تفصيل; reader judges.

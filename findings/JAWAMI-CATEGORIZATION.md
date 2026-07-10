# تصنيف الجوامع — Categorizing the محكمات (design + first computed facet)

Neutral, computed enrichment of the الجوامع layer. Inspired by the observation
that Shahrour's محكم/تفصيل frame suggests categorizing the principle verses —
but grounded in our own content-blind data, staying computed-not-authoritative.

## Empirical convergence (recorded)
Every verse in Shahrour's «19 محكمات» that we checked was independently
classified by the Pass A swarm as p=2 / kind=حكم, with no knowledge of Shahrour
(6:151-153, 5:3, 4:22-23, 7:33, 2:275, 2:183, 5:38, 24:2). The structure is
really in the text; his lens is one legitimate reading of it.

## Facet 1 — الأحكام الحاصرة (COMPUTED, ready)
Linguistic features from Pass A + morphology (columns on ayah_principle):
- تحريم صريح (root ح-ر-م present): 28 جوامع — النساء ٢٣، المائدة ٣،
  الأنعام ١٥١، الأعراف ٣٣، البقرة ١٧٣/٢٧٥…  (the classical المحرمات set)
- حصر/قصر (إنّما / استثناء): 158
- أمر أو نهي: 626
KNOWN REFINEMENT: root ح-ر-م conflates the verb حَرَّمَ (prohibit) with the
adjective حَرام/حُرُم (sacred) — so 2:144/2:194/9:36 (الأشهر الحرم، المسجد
الحرام) are false positives. Fix: gate on the VERB lemma (حَرَّم) via segment
lemma, not the bare root. Cheap, next pass.

## Facet 2 — درجة التفرّع (DEFERRED to full Pass B)
Grade each محكم by تفصيل-degree (COUNT in ayah_tafsil):
- حاكم يتفرّع (branching): 6:151(16), 6:152(22), 6:153(18), 7:33(16).
- حدّ منتهٍ (terminal, 0 تفصيل): 5:38 (theft), 24:2 (zina), 2:183 (fasting).
Finer than any flat closed-list, emerges from our data. Compute after Pass B.

## Shahrour as a «عدسة» (lens), not the app's voice
If surfaced: an OPTIONAL attributed overlay «قراءة شحرور — ١٩ آية», one named
reading among others (like a manual thematic mushaf overlay), never THE
محكمات. App stays neutral: computed categories + verified تفصيل; reader judges.

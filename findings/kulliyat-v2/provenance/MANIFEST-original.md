# data/passes — raw classification data archive

Complete, preserved output of every classification pass in the محكم→تفصيل
pipeline. Nothing an agent judged is discarded — kept for review, audit, and
future uses that may open new doors. Refreshed by `js/scripts/archive-passes.mjs`
+ the journal/transcript copy step (see the commit that added this file).

## Complete exports (machine-readable, the useful raw data)
- **pass-a-full.jsonl** — every one of the 6,236 ayahs: `{loc, id, p, kind}`,
  including the p=0 (not-principle) verdicts. The complete principle-map.
- **pass-b-full.jsonl** — every judged جامعة with its full تفصيل selection:
  `{hub, kind, count, tafsil:[{loc, rel}]}`, including empty selections and the
  relation types بيان/مثال/جزاء/توكيد. Regenerate any time from quran-kg.db.
- **pass-c-full.jsonl** — the adversarial review of every Pass B link:
  `{hub, hub_ok, links:[{loc, rel, verdict, rel_fixed?}], missed?}` with verdict
  ∈ confirm/reweight/reject. 1,006 hubs reviewed · 10,446 confirm · 690 reweight
  · 1,285 reject · 0 weak hubs · 866 gap suggestions. Rejects are kept here
  (never destroyed); the app view simply excludes them → 11,139 surviving links.

## Raw workflow journals (one result line per agent, as produced)
- **journals/passA-1of2-fable.jsonl** — Pass A ayahs 1–960 (Fable, wf_473184f8)
- **journals/passA-2of2-fable.jsonl** — Pass A ayahs 961–6236 (Fable, wf_994cf4a2)
- **journals/passB-fable-b0-26.jsonl** — Pass B batches 0–26 (Fable, wf_4fd3dae1)
- **journals/passB-opus-cont.jsonl** — Pass B Opus continuation (wf_150efc28)
- **journals/passB-sonnet-rest.jsonl** — Pass B batches 34–85 (Sonnet, wf_a23e3f75)
- **journals/passC-review.jsonl** — Pass C adversarial review, all 126 batches
  (Sonnet, wf_0215faa2)

## Deepest record
- **agent-transcripts.tgz** — the full per-agent transcripts (tool calls +
  reasoning) for all pass workflows. The complete process record, compressed.

## Provenance note
Multi-tier by budget: Fable → Opus → Sonnet, one identical rubric throughout;
`ayah_tafsil` / `ayah_principle` dedup by key so the tiers merge coherently.
The Pass C review (adversarial re-check) runs before anything is finalized.

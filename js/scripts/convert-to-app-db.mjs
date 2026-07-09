/**
 * Convert the canonical relational QKG (quran-kg.db) into an app-shaped
 * monlite database (quran-app.db): document/structured collections + FTS,
 * ready for the quran-kg npm package, a Vite web app (@monlite/wasm), or
 * any monlite consumer (Node/Python/browser).
 *
 * Collections:
 *   surahs  — one doc per surah (structured columns for hot fields)
 *   ayahs   — one doc per ayah, FTS-indexed on clean text
 *   words   — one doc per word with its morphology segments embedded
 *   roots   — one doc per root with lemmas + every location embedded
 *
 * Usage:  node scripts/convert-to-app-db.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { createDb } from "@monlite/core";
import { fts } from "@monlite/fts";
import { SCHEMAS } from "../shared/monlite-schemas.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../quran-kg.db");
const DEST = path.resolve(HERE, "../../quran-app.db");

if (fs.existsSync(DEST)) fs.unlinkSync(DEST);
const src = new DatabaseSync(SRC, { readOnly: true });
const db = createDb(DEST, {
  plugins: [fts({ ayahs: ["textClean"] })],
});

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// --- surahs -----------------------------------------------------------------
const surahs = db.collection("surahs", { schema: SCHEMAS.surahs });
await surahs.createMany({
  data: src.prepare("SELECT * FROM surah ORDER BY surah_no").all().map((r) => ({
    surahNo: r.surah_no,
    nameAr: r.name_ar,
    nameTranslit: r.name_translit,
    nameEn: r.name_en,
    revelation: r.revelation,
    chronoOrder: r.chrono_order,
    ayahCount: r.ayah_count,
    rukuCount: r.ruku_count,
    hasBismillah: !!r.has_bismillah,
    wordCount: r.word_count,
    letterCount: r.letter_count,
  })),
});
log("surahs: 114");

// --- ayahs --------------------------------------------------------------------
// Document mode: the fts() plugin opens "ayahs" at init, which fixes the
// collection's mode — structured schema would conflict. 6,236 docs query
// fine via JSON paths (monlite auto-indexes hot paths).
const ayahs = db.collection("ayahs");
const hasTranslations = src
  .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='translation'")
  .get().n;
const translationsByAyah = new Map();
if (hasTranslations) {
  for (const t of src
    .prepare("SELECT ayah_id, lang, text FROM translation")
    .iterate()) {
    const m = translationsByAyah.get(t.ayah_id) ?? {};
    m[t.lang] = t.text;
    translationsByAyah.set(t.ayah_id, m);
  }
  log(`translations loaded for ${translationsByAyah.size} ayahs`);
}

const ayahRows = src.prepare("SELECT * FROM ayah ORDER BY ayah_id").all();
await ayahs.createMany({
  data: ayahRows.map((r) => ({
    _id: `a${r.ayah_id}`,
    location: r.location,
    surahNo: r.surah_no,
    ayahNo: r.ayah_no,
    textUthmani: r.text_uthmani,
    textClean: r.text_clean,
    juz: r.juz,
    hizb: r.hizb,
    rub: r.rub,
    ruku: r.ruku,
    page: r.page,
    manzil: r.manzil,
    sajdaType: r.sajda_type,
    wordCount: r.word_count,
    letterCount: r.letter_count,
    ...(translationsByAyah.has(r.ayah_id)
      ? { translations: translationsByAyah.get(r.ayah_id) }
      : {}),
  })),
});
log(`ayahs: ${ayahRows.length}`);

// --- words (with embedded segments) -----------------------------------------
const segsByWord = new Map();
for (const g of src
  .prepare(
    `SELECT g.*, p.name_en AS pos_en, p.name_ar AS pos_ar, r.root_ar, l.lemma_ar
     FROM segment g
     JOIN pos_tag p ON p.tag = g.pos
     LEFT JOIN root r ON r.root_id = g.root_id
     LEFT JOIN lemma l ON l.lemma_id = g.lemma_id
     ORDER BY g.seg_id`,
  )
  .iterate()) {
  const seg = {
    text: g.text,
    role: g.role,
    pos: g.pos,
    posEn: g.pos_en,
    posAr: g.pos_ar,
  };
  for (const [k, v] of Object.entries({
    root: g.root_ar,
    lemma: g.lemma_ar,
    verbForm: g.verb_form,
    aspect: g.aspect,
    mood: g.mood,
    voice: g.voice,
    caseMark: g.case_mark,
    state: g.state,
    person: g.person,
    gender: g.gender,
    number: g.number,
    derivation: g.derivation,
    family: g.family,
  }))
    if (v != null) seg[k] = v;
  const list = segsByWord.get(g.word_id) ?? [];
  list.push(seg);
  segsByWord.set(g.word_id, list);
}
log("segments grouped");

const words = db.collection("words", { schema: SCHEMAS.words });
const wordRows = src
  .prepare(
    `SELECT w.*, r.root_ar, l.lemma_ar FROM word w
     LEFT JOIN root r ON r.root_id = w.root_id
     LEFT JOIN lemma l ON l.lemma_id = w.lemma_id
     ORDER BY w.word_id`,
  )
  .all();
const BATCH = 5000;
for (let i = 0; i < wordRows.length; i += BATCH) {
  await words.createMany({
    data: wordRows.slice(i, i + BATCH).map((r) => ({
      _id: `w${r.word_id}`,
      location: r.location,
      surahNo: r.surah_no,
      ayahNo: r.ayah_no,
      wordNo: r.word_no,
      textUthmani: r.text_uthmani,
      textClean: r.text_clean,
      root: r.root_ar,
      lemma: r.lemma_ar,
      stemPos: r.stem_pos,
      segments: segsByWord.get(r.word_id) ?? [],
    })),
  });
}
log(`words: ${wordRows.length}`);

// --- roots (with lemmas + locations embedded) --------------------------------
const lemmasByRoot = new Map();
for (const r of src
  .prepare(
    `SELECT root_id, lemma_ar, occurrences FROM lemma
     WHERE root_id IS NOT NULL ORDER BY occurrences DESC`,
  )
  .iterate()) {
  const list = lemmasByRoot.get(r.root_id) ?? [];
  list.push({ lemma: r.lemma_ar, occurrences: r.occurrences });
  lemmasByRoot.set(r.root_id, list);
}
const locsByRoot = new Map();
for (const r of src
  .prepare(
    `SELECT g.root_id, w.location FROM segment g
     JOIN word w ON w.word_id = g.word_id
     WHERE g.root_id IS NOT NULL ORDER BY g.seg_id`,
  )
  .iterate()) {
  const list = locsByRoot.get(r.root_id) ?? [];
  list.push(r.location);
  locsByRoot.set(r.root_id, list);
}
const roots = db.collection("roots", { schema: SCHEMAS.roots });
// Classical lexicon meanings (add_meanings.py): ship the two most useful in
// the app — Mufradat (Quran-specific gloss) and Maqayis (semantic essence).
const MEANING_TITLES = {
  mufradat: "المفردات في غريب القرآن — الراغب الأصفهاني",
  maqayis: "مقاييس اللغة — ابن فارس",
};
const hasMeanings = src
  .prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='root_meaning'")
  .get().n;
const meaningsByRoot = new Map();
if (hasMeanings) {
  for (const m of src
    .prepare(
      "SELECT root_id, source_key, text FROM root_meaning WHERE source_key IN ('mufradat','maqayis') ORDER BY CASE source_key WHEN 'mufradat' THEN 0 ELSE 1 END",
    )
    .iterate()) {
    const list = meaningsByRoot.get(m.root_id) ?? [];
    list.push({ key: m.source_key, title: MEANING_TITLES[m.source_key], text: m.text });
    meaningsByRoot.set(m.root_id, list);
  }
  log(`root meanings loaded for ${meaningsByRoot.size} roots`);
}
const rootRows = src.prepare("SELECT * FROM root ORDER BY root_id").all();
for (let i = 0; i < rootRows.length; i += BATCH) {
  await roots.createMany({
    data: rootRows.slice(i, i + BATCH).map((r) => ({
      _id: `r${r.root_id}`,
      root: r.root_ar,
      occurrences: r.occurrences,
      lemmas: lemmasByRoot.get(r.root_id) ?? [],
      locations: locsByRoot.get(r.root_id) ?? [],
      ...(meaningsByRoot.has(r.root_id) ? { meanings: meaningsByRoot.get(r.root_id) } : {}),
    })),
  });
}
log(`roots: ${rootRows.length}`);

// --- root co-occurrence edges (for the network view) -------------------------
const rootEdges = db.collection("rootEdges", { schema: SCHEMAS.rootEdges });
const edgeRows = src
  .prepare(
    `SELECT r1.root_ar AS a, r2.root_ar AS b, COUNT(DISTINCT s1.ayah_id) AS w
     FROM segment s1
     JOIN segment s2 ON s2.ayah_id = s1.ayah_id AND s2.root_id > s1.root_id
     JOIN root r1 ON r1.root_id = s1.root_id
     JOIN root r2 ON r2.root_id = s2.root_id
     GROUP BY s1.root_id, s2.root_id
     HAVING w >= 3`,
  )
  .all();
for (let i = 0; i < edgeRows.length; i += BATCH) {
  await rootEdges.createMany({ data: edgeRows.slice(i, i + BATCH) });
}
log(`rootEdges: ${edgeRows.length} (shared-ayah weight >= 3)`);

// --- meta/stats singleton ------------------------------------------------------
const meta = db.collection("meta", { schema: SCHEMAS.meta });
const counts = {};
for (const [k, sql] of Object.entries({
  surahs: "SELECT COUNT(*) n FROM surah",
  ayahs: "SELECT COUNT(*) n FROM ayah",
  words: "SELECT COUNT(*) n FROM word",
  segments: "SELECT COUNT(*) n FROM segment",
  letters: "SELECT COUNT(*) n FROM letter",
  roots: "SELECT COUNT(*) n FROM root",
  lemmas: "SELECT COUNT(*) n FROM lemma",
}))
  counts[k] = src.prepare(sql).get().n;
await meta.create({
  data: {
    key: "stats",
    counts,
    topRoots: src
      .prepare("SELECT root_ar AS root, occurrences FROM root ORDER BY occurrences DESC LIMIT 30")
      .all(),
    letterFreq: src
      .prepare("SELECT letter, COUNT(*) AS freq FROM letter GROUP BY letter ORDER BY freq DESC")
      .all(),
    translations: hasTranslations
      ? src.prepare("SELECT DISTINCT source_key FROM translation").all().map((r) => r.source_key)
      : [],
  },
});
log("meta/stats written");

// --- smoke checks --------------------------------------------------------------
const nAyahs = await ayahs.count();
const nWords = await words.count();
const hits = await ayahs.search("الرحمن الرحيم");
const mercy = await roots.findFirst({ where: { root: "رحم" } });
console.log(`\nchecks: ayahs=${nAyahs} words=${nWords} fts-hits=${hits.length}`);
console.log(`root رحم: ${mercy.occurrences} occurrences, ${mercy.lemmas.length} lemmas`);
if (nAyahs !== 6236 || nWords !== 77429) throw new Error("count mismatch!");

await db.$disconnect();
src.close();
log(`done -> ${DEST} (${(fs.statSync(DEST).size / 1e6).toFixed(1)} MB)`);

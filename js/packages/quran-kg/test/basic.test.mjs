import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { openQuranKG } from "../dist/index.js";

const DB = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../quran-kg.db",
);
const kg = openQuranKG(DB);

test("canonical counts", () => {
  const s = kg.stats();
  assert.equal(s.surahs, 114);
  assert.equal(s.ayahs, 6236);
  assert.equal(s.words, 77429);
  assert.equal(s.segments, 130030);
});

test("surah metadata", () => {
  const fatiha = kg.getSurah(1);
  assert.equal(fatiha.nameTranslit, "Al-Faatiha");
  assert.equal(fatiha.revelation, "Meccan");
  assert.equal(fatiha.ayahCount, 7);
  assert.equal(kg.listSurahs().length, 114);
});

test("ayah with words", () => {
  const a = kg.getAyah(1, 5);
  assert.equal(a.words.length, 4);
  assert.equal(a.words[0].textClean, "إياك");
  assert.ok(a.textUthmani.length > 0);
});

test("word morphology", () => {
  const w = kg.getWord(1, 2, 2); // لله
  assert.ok(w.segments.length >= 2);
  const stem = w.segments.find((s) => s.role === "stem");
  assert.equal(stem.root, "أله");
});

test("root info and occurrences", () => {
  const r = kg.getRoot("رحم");
  assert.ok(r.occurrences > 300);
  assert.ok(r.lemmas.some((l) => l.lemma.includes("رَحْمٰن") || l.lemma.includes("رَحْم")));
  const occ = kg.rootOccurrences("رحم", 10);
  assert.equal(occ.length, 10);
  assert.match(occ[0].location, /^\d+:\d+:\d+:\d+$/);
});

test("search by clean text", () => {
  const hits = kg.searchWords("الرحمن", { exact: true });
  assert.ok(hits.length >= 40);
  assert.ok(hits.every((w) => w.textClean === "الرحمن"));
});

test("co-occurring roots", () => {
  const co = kg.cooccurringRoots("رحم", 5, 10);
  assert.equal(co.length, 10);
  assert.ok(co[0].sharedAyahs >= co[1].sharedAyahs);
});

test("raw sql escape hatch", () => {
  const [row] = kg.sql("SELECT COUNT(*) AS n FROM ayah WHERE sajda_type IS NOT NULL");
  assert.equal(row.n, 15);
});

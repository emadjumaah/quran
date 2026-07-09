/**
 * quran-kg — typed API over the Quran Knowledge Graph (quran-kg.db).
 *
 * Zero dependencies: uses node:sqlite (Node >= 22.5), read-only.
 *
 * ```ts
 * import { openQuranKG } from "quran-kg";
 * const kg = openQuranKG("../../quran-kg.db");
 * kg.getAyah(1, 5);                 // ayah + words + morphology
 * kg.getRoot("رحم");                // all lemmas of a root
 * kg.rootOccurrences("رحم");        // every location of the root
 * kg.cooccurringRoots("رحم");      // roots sharing ayahs with it
 * kg.searchWords("رحمة");           // find words by clean text
 * ```
 */
import { DatabaseSync } from "node:sqlite";
import type {
  Ayah,
  CooccurringRoot,
  RootInfo,
  RootOccurrence,
  Segment,
  Stats,
  Surah,
  Word,
} from "./types.js";

export * from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function surahFromRow(r: Row): Surah {
  return {
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
  };
}

function ayahFromRow(r: Row): Ayah {
  return {
    ayahId: r.ayah_id,
    surahNo: r.surah_no,
    ayahNo: r.ayah_no,
    location: r.location,
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
  };
}

function wordFromRow(r: Row): Word {
  return {
    wordId: r.word_id,
    ayahId: r.ayah_id,
    surahNo: r.surah_no,
    ayahNo: r.ayah_no,
    wordNo: r.word_no,
    location: r.location,
    textUthmani: r.text_uthmani,
    textClean: r.text_clean,
    root: r.root_ar ?? null,
    lemma: r.lemma_ar ?? null,
    stemPos: r.stem_pos,
    segmentCount: r.segment_count,
  };
}

function segmentFromRow(r: Row): Segment {
  return {
    segId: r.seg_id,
    wordId: r.word_id,
    segNo: r.seg_no,
    location: r.location,
    text: r.text,
    posBasic: r.pos_basic,
    role: r.role,
    pos: r.pos,
    posEn: r.pos_en,
    posAr: r.pos_ar,
    root: r.root_ar ?? null,
    lemma: r.lemma_ar ?? null,
    verbForm: r.verb_form,
    aspect: r.aspect,
    mood: r.mood,
    voice: r.voice,
    caseMark: r.case_mark,
    state: r.state,
    person: r.person,
    gender: r.gender,
    number: r.number,
    derivation: r.derivation,
    family: r.family,
    featuresRaw: r.features_raw,
  };
}

const WORD_SQL = `
  SELECT w.*, r.root_ar, l.lemma_ar
  FROM word w
  LEFT JOIN root r ON r.root_id = w.root_id
  LEFT JOIN lemma l ON l.lemma_id = w.lemma_id`;

const SEGMENT_SQL = `
  SELECT g.*, p.name_en AS pos_en, p.name_ar AS pos_ar, r.root_ar, l.lemma_ar
  FROM segment g
  JOIN pos_tag p ON p.tag = g.pos
  LEFT JOIN root r ON r.root_id = g.root_id
  LEFT JOIN lemma l ON l.lemma_id = g.lemma_id`;

export class QuranKG {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath, { readOnly: true });
  }

  close(): void {
    this.db.close();
  }

  // -- structure -----------------------------------------------------------

  listSurahs(): Surah[] {
    return (this.db.prepare("SELECT * FROM surah ORDER BY surah_no").all() as Row[]).map(
      surahFromRow,
    );
  }

  getSurah(surahNo: number): Surah | null {
    const r = this.db.prepare("SELECT * FROM surah WHERE surah_no = ?").get(surahNo) as
      | Row
      | undefined;
    return r ? surahFromRow(r) : null;
  }

  getAyah(surahNo: number, ayahNo: number): (Ayah & { words: Word[] }) | null {
    const r = this.db
      .prepare("SELECT * FROM ayah WHERE surah_no = ? AND ayah_no = ?")
      .get(surahNo, ayahNo) as Row | undefined;
    if (!r) return null;
    const words = (
      this.db
        .prepare(`${WORD_SQL} WHERE w.ayah_id = ? ORDER BY w.word_no`)
        .all(r.ayah_id) as Row[]
    ).map(wordFromRow);
    return { ...ayahFromRow(r), words };
  }

  /** All ayahs of a surah (without words — call getAyah for the deep view). */
  listAyahs(surahNo: number): Ayah[] {
    return (
      this.db
        .prepare("SELECT * FROM ayah WHERE surah_no = ? ORDER BY ayah_no")
        .all(surahNo) as Row[]
    ).map(ayahFromRow);
  }

  // -- words & morphology ---------------------------------------------------

  getWord(
    surahNo: number,
    ayahNo: number,
    wordNo: number,
  ): (Word & { segments: Segment[] }) | null {
    const r = this.db
      .prepare(`${WORD_SQL} WHERE w.location = ?`)
      .get(`${surahNo}:${ayahNo}:${wordNo}`) as Row | undefined;
    if (!r) return null;
    const segments = (
      this.db
        .prepare(`${SEGMENT_SQL} WHERE g.word_id = ? ORDER BY g.seg_no`)
        .all(r.word_id) as Row[]
    ).map(segmentFromRow);
    return { ...wordFromRow(r), segments };
  }

  /** Find words by their clean (diacritic-free) text. */
  searchWords(textClean: string, opts: { exact?: boolean; limit?: number } = {}): Word[] {
    const { exact = false, limit = 100 } = opts;
    const sql = exact
      ? `${WORD_SQL} WHERE w.text_clean = ? ORDER BY w.word_id LIMIT ?`
      : `${WORD_SQL} WHERE w.text_clean LIKE '%' || ? || '%' ORDER BY w.word_id LIMIT ?`;
    return (this.db.prepare(sql).all(textClean, limit) as Row[]).map(wordFromRow);
  }

  // -- roots & lemmas --------------------------------------------------------

  getRoot(root: string): RootInfo | null {
    const r = this.db
      .prepare("SELECT root_id, root_ar, occurrences FROM root WHERE root_ar = ?")
      .get(root) as Row | undefined;
    if (!r) return null;
    const lemmas = this.db
      .prepare(
        `SELECT lemma_ar AS lemma, occurrences FROM lemma
         WHERE root_id = ? ORDER BY occurrences DESC`,
      )
      .all(r.root_id) as { lemma: string; occurrences: number }[];
    return { rootId: r.root_id, root: r.root_ar, occurrences: r.occurrences, lemmas };
  }

  /** Every location where the root appears — the "root map". */
  rootOccurrences(root: string, limit = 10_000): RootOccurrence[] {
    return this.db
      .prepare(
        `SELECT g.location, w.surah_no AS surahNo, w.ayah_no AS ayahNo,
                w.word_no AS wordNo, w.text_uthmani AS word,
                w.text_clean AS wordClean, g.pos, g.derivation,
                g.verb_form AS verbForm
         FROM segment g
         JOIN root r ON r.root_id = g.root_id AND r.root_ar = ?
         JOIN word w ON w.word_id = g.word_id
         ORDER BY g.seg_id LIMIT ?`,
      )
      .all(root, limit) as unknown as RootOccurrence[];
  }

  /** Roots that share at least `minShared` ayahs with the given root. */
  cooccurringRoots(root: string, minShared = 2, limit = 50): CooccurringRoot[] {
    return this.db
      .prepare(
        `SELECT r2.root_ar AS root, COUNT(DISTINCT s1.ayah_id) AS sharedAyahs
         FROM segment s1
         JOIN root r1 ON r1.root_id = s1.root_id AND r1.root_ar = ?
         JOIN segment s2 ON s2.ayah_id = s1.ayah_id AND s2.root_id != s1.root_id
         JOIN root r2 ON r2.root_id = s2.root_id
         GROUP BY s2.root_id HAVING sharedAyahs >= ?
         ORDER BY sharedAyahs DESC LIMIT ?`,
      )
      .all(root, minShared, limit) as unknown as CooccurringRoot[];
  }

  /** Top roots by occurrence count. */
  topRoots(limit = 50): { root: string; occurrences: number }[] {
    return this.db
      .prepare(
        `SELECT root_ar AS root, occurrences FROM root
         ORDER BY occurrences DESC LIMIT ?`,
      )
      .all(limit) as unknown as { root: string; occurrences: number }[];
  }

  // -- misc -------------------------------------------------------------------

  stats(): Stats {
    const one = (sql: string) => (this.db.prepare(sql).get() as Row).n as number;
    return {
      surahs: one("SELECT COUNT(*) n FROM surah"),
      ayahs: one("SELECT COUNT(*) n FROM ayah"),
      words: one("SELECT COUNT(*) n FROM word"),
      segments: one("SELECT COUNT(*) n FROM segment"),
      letters: one("SELECT COUNT(*) n FROM letter"),
      roots: one("SELECT COUNT(*) n FROM root"),
      lemmas: one("SELECT COUNT(*) n FROM lemma"),
    };
  }

  /** Escape hatch: run any read-only SQL against the knowledge graph. */
  sql<T = Row>(query: string, ...params: (string | number)[]): T[] {
    return this.db.prepare(query).all(...params) as T[];
  }
}

export function openQuranKG(dbPath: string): QuranKG {
  return new QuranKG(dbPath);
}

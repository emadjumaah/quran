/** Entity types of the Quran Knowledge Graph (quran-kg.db). */

export interface Surah {
  surahNo: number;
  nameAr: string;
  nameTranslit: string;
  nameEn: string;
  revelation: "Meccan" | "Medinan";
  chronoOrder: number;
  ayahCount: number;
  rukuCount: number;
  hasBismillah: boolean;
  wordCount: number;
  letterCount: number;
}

export interface Ayah {
  ayahId: number;
  surahNo: number;
  ayahNo: number;
  /** "s:a" */
  location: string;
  textUthmani: string;
  textClean: string;
  juz: number;
  hizb: number;
  rub: number;
  ruku: number;
  page: number;
  manzil: number;
  sajdaType: string | null;
  wordCount: number;
  letterCount: number;
}

export interface Word {
  wordId: number;
  ayahId: number;
  surahNo: number;
  ayahNo: number;
  wordNo: number;
  /** "s:a:w" */
  location: string;
  textUthmani: string;
  textClean: string | null;
  root: string | null;
  lemma: string | null;
  stemPos: string | null;
  segmentCount: number;
}

export interface Segment {
  segId: number;
  wordId: number;
  segNo: number;
  /** "s:a:w:g" */
  location: string;
  text: string;
  posBasic: "N" | "V" | "P";
  role: "prefix" | "stem" | "suffix";
  pos: string;
  posEn: string;
  posAr: string;
  root: string | null;
  lemma: string | null;
  verbForm: number | null;
  aspect: "PERF" | "IMPF" | "IMPV" | null;
  mood: "IND" | "SUBJ" | "JUS" | null;
  voice: "ACT" | "PASS" | null;
  caseMark: "NOM" | "ACC" | "GEN" | null;
  state: "INDEF" | null;
  person: 1 | 2 | 3 | null;
  gender: "M" | "F" | null;
  number: "S" | "D" | "P" | null;
  derivation: "ACT_PCPL" | "PASS_PCPL" | "VN" | null;
  family: string | null;
  featuresRaw: string;
}

export interface RootInfo {
  rootId: number;
  root: string;
  occurrences: number;
  lemmas: { lemma: string; occurrences: number }[];
}

export interface RootOccurrence {
  location: string;
  surahNo: number;
  ayahNo: number;
  wordNo: number;
  word: string;
  wordClean: string | null;
  pos: string;
  derivation: string | null;
  verbForm: number | null;
}

export interface CooccurringRoot {
  root: string;
  sharedAyahs: number;
}

export interface Stats {
  surahs: number;
  ayahs: number;
  words: number;
  segments: number;
  letters: number;
  roots: number;
  lemmas: number;
}

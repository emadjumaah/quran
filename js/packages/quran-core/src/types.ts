/**
 * **وثائقُ المصحف** — صورةُ ما في `quran-app.db` (monlite) كما تُقرأ.
 *
 * نُقلت من `apps/studio/src/types.ts` في التقسيم الصامت (ف١) لأنّ مسبارَ الصوت
 * يستوردها، **ومصدرُها واحدٌ بين التطبيقين**: مشكاةُ تُعيد تصديرَها من ملفّها
 * ولا تنسخها، فلا تتباعد صورتان لوثيقةٍ واحدة.
 */

export interface SurahDoc {
  _id: string;
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

export interface AyahDoc {
  _id: string; // "a<ayahId>"
  location: string; // "s:a"
  surahNo: number;
  ayahNo: number;
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
  /** Translations by language code (e.g. { en: "..." }); present when built. */
  translations?: Record<string, string>;
}

export interface SegmentDoc {
  text: string;
  role: "prefix" | "stem" | "suffix";
  pos: string;
  posEn: string;
  posAr: string;
  root?: string;
  lemma?: string;
  verbForm?: number;
  aspect?: "PERF" | "IMPF" | "IMPV";
  mood?: "IND" | "SUBJ" | "JUS";
  voice?: "ACT" | "PASS";
  caseMark?: "NOM" | "ACC" | "GEN";
  state?: "INDEF";
  person?: 1 | 2 | 3;
  gender?: "M" | "F";
  number?: "S" | "D" | "P";
  derivation?: "ACT_PCPL" | "PASS_PCPL" | "VN";
  family?: string;
}

export interface WordDoc {
  _id: string; // "w<wordId>"
  location: string; // "s:a:w"
  surahNo: number;
  ayahNo: number;
  wordNo: number;
  textUthmani: string;
  textClean: string;
  root: string | null;
  lemma: string | null;
  stemPos: string | null;
  segments: SegmentDoc[];
}

export interface RootDoc {
  _id: string; // "r<rootId>"
  root: string;
  occurrences: number;
  lemmas: { lemma: string; occurrences: number }[];
  /** every word location "s:a:w" where the root appears */
  locations: string[];
  /** classical lexicon meanings (Mufradat, Maqayis) — present when built */
  meanings?: { key: string; title: string; text: string }[];
}

/** Root co-occurrence edge (precomputed at convert time). */
export interface RootEdgeDoc {
  a: string; // root text (a < b lexically not guaranteed; a is rootA)
  b: string;
  w: number; // number of shared ayahs
}

/** A user collection of ayahs, persisted locally in the browser. */
export interface AyahCollection {
  id: string;
  name: string;
  description?: string;
  /** why these ayahs belong together, e.g. { kind: "root", value: "رحم" } */
  criteria?: { kind: "root" | "lemma" | "search" | "manual"; value: string }[];
  /** ayah locations "s:a" in insertion order */
  ayahs: string[];
  createdAt: number;
  updatedAt: number;
}

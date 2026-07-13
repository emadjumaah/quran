/**
 * The per-verse unified index (verse-index.json): given any āyah, its network
 * role — chiefly its فروق التنزيل twin-count. (The Quran's topic layer is now the
 * 90 computed محاور in kulliyat.ts; the old hand-picked thematic tree was retired.)
 */
import { useEffect, useState } from "react";

/* --------------------------- per-verse unified index --------------------------- */
// verse record: [topicId, kindCode, gradeCode, tafsilDeg, elaborates, twins, muhkamaId]
type VRec = [number, number, number, number, number, number, number];
interface VerseIndex {
  meta: { kinds: Record<string, number>; grades: Record<string, number> };
  sections: { title: string; theme: string }[];
  topics: { title: string; sec: number }[];
  muhkamat: { title: string; kubra: string; section: number }[];
  verses: Record<string, VRec>;
}
let vidx: VerseIndex | null = null;
let vloading: Promise<VerseIndex> | null = null;
const KIND_AR = ["", "حكم", "أخلاق", "عقيدة", "سنة", "وعد"];
const GRADE_AR = ["", "أصل جامع", "متفرّع", "موجز", "مجرّد"];

export function loadVerseIndex(): Promise<VerseIndex> {
  if (vidx) return Promise.resolve(vidx);
  vloading ??= fetch(`${import.meta.env.BASE_URL}verse-index.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`verse-index: ${r.status}`))))
    .then((d: VerseIndex) => (vidx = d))
    .catch((e) => {
      vloading = null;
      throw e;
    });
  return vloading;
}

export interface VerseInfo {
  topic: string | null;
  section: string | null;
  sectionIdx: number | null; // for /mawdui/:sectionIdx
  jamiaKind: string | null;
  grade: string | null;
  muhkama: string | null;
  tafsilDeg: number;
  elaborates: number;
  twins: number;
}
/** Synchronous lookup once loadVerseIndex() has resolved; null before that. */
export function verseInfo(loc: string): VerseInfo | null {
  if (!vidx) return null;
  const r = vidx.verses[loc];
  if (!r) return null;
  const topic = r[0] >= 0 ? vidx.topics[r[0]] : null;
  return {
    topic: topic?.title ?? null,
    section: topic ? vidx.sections[topic.sec]?.title ?? null : null,
    sectionIdx: topic ? topic.sec : null,
    jamiaKind: r[1] ? KIND_AR[r[1]] : null,
    grade: r[2] ? GRADE_AR[r[2]] : null,
    muhkama: r[6] >= 0 ? vidx.muhkamat[r[6]]?.title ?? null : null,
    tafsilDeg: r[3],
    elaborates: r[4],
    twins: r[5],
  };
}

export function useVerseIndex(): boolean {
  const [ready, setReady] = useState<boolean>(!!vidx);
  useEffect(() => {
    let live = true;
    loadVerseIndex().then(() => live && setReady(true)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

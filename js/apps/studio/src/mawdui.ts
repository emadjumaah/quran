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

/* ------------------------- traditional المواضيع (curated) -------------------------
 * The retained, hand-organized thematic tree: 12 أبواب → topics → verses. This is a
 * TRADITIONAL/متوارث classification (not computed) — presented in its own section,
 * clearly labelled, never mixed into the computed المحاور. Each verse sits under the
 * topic it was assigned; topics roll up into the 12 sections.
 */
export interface TradSection { idx: number; title: string; topics: number; verses: number; }
export interface TradTopic { id: number; title: string; verses: string[]; }

const locCmp = (a: string, b: string) => {
  const [sa, aa] = a.split(":").map(Number);
  const [sb, ab] = b.split(":").map(Number);
  return sa - sb || aa - ab;
};

let tradIdx: { sections: TradSection[]; byTopic: Map<number, string[]>; secTopics: Map<number, number[]> } | null = null;
function buildTradIdx() {
  if (tradIdx || !vidx) return tradIdx;
  const byTopic = new Map<number, string[]>();
  for (const [loc, r] of Object.entries(vidx.verses)) {
    const tid = r[0];
    if (tid < 0) continue;
    let arr = byTopic.get(tid);
    if (!arr) byTopic.set(tid, (arr = []));
    arr.push(loc);
  }
  for (const arr of byTopic.values()) arr.sort(locCmp);
  const secTopics = new Map<number, number[]>();
  vidx.topics.forEach((tp, id) => {
    if (!byTopic.has(id)) return; // drop empty topics
    let arr = secTopics.get(tp.sec);
    if (!arr) secTopics.set(tp.sec, (arr = []));
    arr.push(id);
  });
  // topics inside a section: by size, the richest first
  for (const arr of secTopics.values()) arr.sort((a, b) => (byTopic.get(b)?.length ?? 0) - (byTopic.get(a)?.length ?? 0));
  const sections: TradSection[] = vidx.sections.map((s, idx) => {
    const tids = secTopics.get(idx) ?? [];
    const verses = tids.reduce((n, id) => n + (byTopic.get(id)?.length ?? 0), 0);
    return { idx, title: s.title, topics: tids.length, verses };
  });
  tradIdx = { sections, byTopic, secTopics };
  return tradIdx;
}

/** The 12 traditional أبواب with their topic + verse counts (mushaf-natural order). */
export function tradSections(): TradSection[] {
  return buildTradIdx()?.sections ?? [];
}
/** One باب → its topics, each with its verses (mushaf order). Null before load / bad idx. */
export function tradSection(idx: number): { title: string; topics: TradTopic[] } | null {
  const ti = buildTradIdx();
  if (!ti || !vidx) return null;
  const s = vidx.sections[idx];
  if (!s) return null;
  const topics = (ti.secTopics.get(idx) ?? []).map((id) => ({
    id,
    title: vidx!.topics[id].title,
    verses: ti.byTopic.get(id) ?? [],
  }));
  return { title: s.title, topics };
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

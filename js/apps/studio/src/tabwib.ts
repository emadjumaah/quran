/**
 * التبويب الموضوعي المحسوب — وحدات السياق × المحاور المنبثقة (tabwib-v1.json).
 * كل وحدةٍ مسندة لمحورٍ بإسنادٍ شبكي (صلات آياتها المفحوصة) أو تقريبي (تقارب
 * المعنى ≥0.55) — فالمصحف كله مبوَّب بوحداته المسماة، من حسابنا وتسميتنا.
 */

interface TabwibEntry { ax: number[]; mode: "evidence" | "approx" | "outside"; cos?: number }
interface TabwibData { meta: Record<string, unknown>; units: TabwibEntry[] }

let data: TabwibData | null = null;
let loading: Promise<TabwibData | null> | null = null;
/** axisId -> [{unit index, approx?}] */
let byAxis: Map<number, { u: number; approx: boolean }[]> | null = null;

export function loadTabwib(): Promise<TabwibData | null> {
  if (data) return Promise.resolve(data);
  loading ??= fetch(`${import.meta.env.BASE_URL}tabwib-v1.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? (r.json() as Promise<TabwibData>) : null))
    .then((d) => {
      if (!d) return null;
      data = d;
      byAxis = new Map();
      d.units.forEach((e, u) => {
        for (const ax of e.ax) {
          const list = byAxis!.get(ax) ?? [];
          list.push({ u, approx: e.mode === "approx" });
          byAxis!.set(ax, list);
        }
      });
      return d;
    })
    .catch(() => null);
  return loading;
}

export function unitsOfAxis(axisId: number): { u: number; approx: boolean }[] {
  return byAxis?.get(axisId) ?? [];
}

export interface Bab { id: number; name: string; axes: number[]; units: number; rules: number }
interface AbwabData { meta: Record<string, unknown>; babs: Bab[] }
let abwab: AbwabData | null = null;
let abwabLoading: Promise<AbwabData | null> | null = null;

export function loadAbwab(): Promise<AbwabData | null> {
  if (abwab) return Promise.resolve(abwab);
  abwabLoading ??= fetch(`${import.meta.env.BASE_URL}abwab-v1.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? (r.json() as Promise<AbwabData>) : null))
    .then((d) => (abwab = d));
  return abwabLoading;
}
export const babsList = (): Bab[] => abwab?.babs ?? [];
export const babOf = (id: number): Bab | null => abwab?.babs.find((b) => b.id === id) ?? null;

export interface Topic { id: number; name: string; units: number[] }
export interface TopicBab { id: number; name: string; unitsCount: number; topics: Topic[] }
interface TopicsData { meta: Record<string, unknown>; babs: TopicBab[] }
let topics: TopicsData | null = null;
let topicsLoading: Promise<TopicsData | null> | null = null;

export function loadTopics(): Promise<TopicsData | null> {
  if (topics) return Promise.resolve(topics);
  topicsLoading ??= fetch(`${import.meta.env.BASE_URL}topics-v1.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? (r.json() as Promise<TopicsData>) : null))
    .then((d) => (topics = d));
  return topicsLoading;
}
export const topicBabsList = (): TopicBab[] => topics?.babs ?? [];
export const topicBabOf = (id: number): TopicBab | null => topics?.babs.find((b) => b.id === id) ?? null;

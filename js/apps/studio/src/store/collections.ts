/**
 * Ayah collections — the "collect related ayahs" feature.
 *
 * Persistence: localStorage (small, synchronous, survives reloads). The shape
 * mirrors a monlite collection so it can later sync to a server-side monlite
 * file via @monlite/sync without changing callers.
 */
import { useSyncExternalStore } from "react";
import type { AyahCollection } from "../types";

const KEY = "quran-studio:collections:v1";

let state: AyahCollection[] = load();
const listeners = new Set<() => void>();

function load(): AyahCollection[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function useCollections(): AyahCollection[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function createCollection(
  name: string,
  criteria?: AyahCollection["criteria"],
): AyahCollection {
  const c: AyahCollection = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    criteria: criteria ?? [],
    ayahs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state = [...state, c];
  persist();
  return c;
}

export function renameCollection(id: string, name: string, description?: string) {
  state = state.map((c) =>
    c.id === id ? { ...c, name, description, updatedAt: Date.now() } : c,
  );
  persist();
}

export function deleteCollection(id: string) {
  state = state.filter((c) => c.id !== id);
  persist();
}

/** Add ayah locations ("s:a"); duplicates are ignored; order preserved. */
export function addAyahs(id: string, locations: string[], criterion?: { kind: "root" | "lemma" | "search" | "manual"; value: string }) {
  state = state.map((c) => {
    if (c.id !== id) return c;
    const have = new Set(c.ayahs);
    const added = locations.filter((l) => !have.has(l));
    const criteria = criterion
      ? [...(c.criteria ?? []).filter((x) => !(x.kind === criterion.kind && x.value === criterion.value)), criterion]
      : c.criteria;
    return { ...c, ayahs: [...c.ayahs, ...added], criteria, updatedAt: Date.now() };
  });
  persist();
}

export function removeAyah(id: string, location: string) {
  state = state.map((c) =>
    c.id === id
      ? { ...c, ayahs: c.ayahs.filter((a) => a !== location), updatedAt: Date.now() }
      : c,
  );
  persist();
}

export function getCollection(id: string): AyahCollection | undefined {
  return state.find((c) => c.id === id);
}

/** Export a collection as shareable JSON. */
export function exportCollection(id: string): string {
  const c = getCollection(id);
  return JSON.stringify(c, null, 2);
}

export function importCollection(json: string): AyahCollection {
  const c = JSON.parse(json) as AyahCollection;
  c.id = `c${Date.now().toString(36)}`;
  state = [...state, c];
  persist();
  return c;
}

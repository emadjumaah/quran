/**
 * Reading controller store — the "current ayah" for navigation/recitation and
 * the reading options (repeat, continue). Separate from word-selection (which
 * drives the morphology inspector). One selected ayah location "s:a".
 */
import { useSyncExternalStore } from "react";

interface ReadingState {
  selected: string | null; // "s:a" — the focused ayah for nav + play controls
  repeat: number; // repeat each ayah N extra times (0 = once)
  continueAfter: boolean; // keep reciting following ayahs
}

let state: ReadingState = {
  selected: null,
  repeat: Number(localStorage.getItem("quran-studio:repeat") ?? 0),
  continueAfter: localStorage.getItem("quran-studio:continue") !== "false",
};
const listeners = new Set<() => void>();
const emit = () => {
  const snap = `${state.selected}|${state.repeat}|${state.continueAfter}`;
  cache = snap;
  listeners.forEach((l) => l());
};
let cache = `${state.selected}|${state.repeat}|${state.continueAfter}`;

export function setSelectedAyah(loc: string | null) {
  state = { ...state, selected: loc };
  emit();
}
export function setRepeat(n: number) {
  state = { ...state, repeat: Math.max(0, n) };
  localStorage.setItem("quran-studio:repeat", String(state.repeat));
  emit();
}
export function setContinueAfter(v: boolean) {
  state = { ...state, continueAfter: v };
  localStorage.setItem("quran-studio:continue", String(v));
  emit();
}

export function useReading(): ReadingState {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
  );
  return state;
}

export const getSelectedAyah = () => state.selected;

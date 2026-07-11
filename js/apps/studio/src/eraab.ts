/**
 * الإعراب — grammatical parsing per verse, from «المجتبى من مشكل إعراب القرآن»
 * لأحمد الخراط (نشر مجمع الملك فهد). Legitimate grammar (نحو), not tafsir. Keyed
 * by "sora:aya"; ~5895 verses. Lazy-loaded (public/eraab.json, ~1.9MB) only when
 * the reader first opens an إعراب panel, then cached. «نعرض نصَّ الإعراب».
 */
import { useEffect, useState } from "react";

export interface EraabEntry {
  /** the grammatical prose, verbatim */
  t: string;
  /** printed page in the King Fahd Complex edition (for citation) */
  p?: number;
}

let cache: Record<string, EraabEntry> | null = null;
let inflight: Promise<Record<string, EraabEntry>> | null = null;

export function loadEraab(): Promise<Record<string, EraabEntry>> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch(`${import.meta.env.BASE_URL}eraab.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: Record<string, EraabEntry>) => {
      cache = d;
      return d;
    })
    .catch(() => {
      cache = {};
      return cache;
    });
  return inflight;
}

/** The إعراب for one location. `undefined` while loading, `null` if none. Only
 *  fetches when `enabled` (so the reader loads the file on first open, not on
 *  every verse render). */
export function useEraab(location: string, enabled: boolean): EraabEntry | null | undefined {
  const [entry, setEntry] = useState<EraabEntry | null | undefined>(
    cache ? cache[location] ?? null : undefined,
  );
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    if (cache) {
      setEntry(cache[location] ?? null);
      return;
    }
    setEntry(undefined);
    loadEraab().then((d) => {
      if (alive) setEntry(d[location] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [location, enabled]);
  return entry;
}

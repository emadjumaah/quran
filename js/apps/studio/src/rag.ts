/**
 * نِبراس's book/tafsir retrieval — the SERVER RAG corpus (rag.db) via /api/retrieve.
 *
 * The āyāt stay ON THE PHONE (int8, client-side مثلها/meaning-search). This module
 * adds ONLY the server-side book/tafsir sources, retrieved and CITED per source —
 * so نِبراس draws on verses (client) AND books (server) without duplicating the
 * āyāt vectors, and the computed layers stay Quran+معاجم+QAC only.
 *
 * INERT until a source is registered in BOOK_SOURCES (i.e. until a book is
 * indexed into rag.db + listed here) — retrieveBooks then returns [] and نِبراس
 * behaves exactly as today.
 */
export interface BookHit {
  ref: string;     // locator within the source (e.g. "2:255" for verse-anchored tafsir)
  text: string;    // the passage
  source: string;  // which book — matches a BOOK_SOURCES id
  distance: number;
}

/** Registered book/tafsir sources. Empty until the first is indexed into rag.db;
 *  add `{ id, label }` once `ingest-rag.mjs` has loaded a source. */
export const BOOK_SOURCES: { id: string; label: string }[] = [];

export const hasBooks = (): boolean => BOOK_SOURCES.length > 0;
export const bookLabel = (id: string): string => BOOK_SOURCES.find((s) => s.id === id)?.label ?? id;

/** Retrieve the nearest book passages for a query. Returns [] (inert) when no
 *  source is registered, or on any error — نِبراس degrades to verses-only. */
export async function retrieveBooks(query: string, opts?: { source?: string; topK?: number }): Promise<BookHit[]> {
  if (!hasBooks()) return [];
  const text = query.trim().slice(0, 800);
  if (!text) return [];
  try {
    const res = await fetch("/api/retrieve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, source: opts?.source, topK: opts?.topK ?? 6 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.hits) ? (data.hits as BookHit[]) : [];
  } catch {
    return [];
  }
}

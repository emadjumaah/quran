/**
 * نِبراس's book/tafsir retrieval facade — BROWSER-side (no server RAG). The source
 * registry + search live in books.ts; this is the نِبراس-facing wrapper. The āyāt
 * stay in the browser too, so نِبراس draws on verses (client) AND books (client),
 * citing each — while the computed layers stay Quran+معاجم+QAC only. The server
 * rag.db path is reserved for a future desktop/heavy build.
 */
import { searchBooks, BOOK_SOURCES, EMBEDDED_SOURCES, bookLabel, type BookHit } from "./books";

export { BOOK_SOURCES, bookLabel };
export type { BookHit };
// نِبراس's semantic search needs embeddings (.bin); display-only books are excluded.
export const hasBooks = (): boolean => EMBEDDED_SOURCES.length > 0;

/** Retrieve the nearest book passages for a query (client-side). [] if none/error. */
export async function retrieveBooks(query: string, opts?: { source?: string; topK?: number }): Promise<BookHit[]> {
  if (!hasBooks()) return [];
  const text = query.trim().slice(0, 800);
  if (!text) return [];
  try {
    const sources = opts?.source ? [opts.source] : EMBEDDED_SOURCES.map((s) => s.id);
    return await searchBooks(text, sources, opts?.topK ?? 6);
  } catch {
    return [];
  }
}

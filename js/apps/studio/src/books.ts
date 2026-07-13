/**
 * نِبراس's book/tafsir search — BROWSER-side, on demand, no server RAG.
 *
 * Each book ships as `rag-<source>.bin` (int8 vectors, same format as the āyāt's
 * quran-embeddings.bin) + `rag-<source>.json` ([{ref,text}]). A book is lazy-loaded
 * the first time نِبراس uses it (then cached), and searched by a local cosine scan —
 * exactly like مثلها/meaning-search. Only the QUERY embedding touches the server
 * (`/api/embed`), which already exists. Heavy tafsirs stay for the desktop/server path.
 */
import { embedQuery } from "./semantic";

/** Registered book/tafsir sources — each ships as public/rag-<id>.bin + .json. */
export const BOOK_SOURCES: { id: string; label: string }[] = [
  { id: "muyassar", label: "التفسير الميسّر" },
  { id: "jalalayn", label: "تفسير الجلالين" },
];
export const bookLabel = (id: string): string => BOOK_SOURCES.find((s) => s.id === id)?.label ?? id;

interface Book {
  dim: number;
  count: number;
  scales: Float32Array;
  data: Int8Array;
  meta: { ref: string; text: string }[];
}

const loaded = new Map<string, Book | null>();
const loading = new Map<string, Promise<Book | null>>();

function loadBook(source: string): Promise<Book | null> {
  const done = loaded.get(source);
  if (done !== undefined) return Promise.resolve(done);
  const inflight = loading.get(source);
  if (inflight) return inflight;
  const p = (async (): Promise<Book | null> => {
    try {
      const base = import.meta.env.BASE_URL;
      const [binRes, jsonRes] = await Promise.all([
        fetch(`${base}rag-${source}.bin?v=${__DATA_VERSION__}`),
        fetch(`${base}rag-${source}.json?v=${__DATA_VERSION__}`),
      ]);
      if (!binRes.ok || !jsonRes.ok) { loaded.set(source, null); return null; }
      const buf = await binRes.arrayBuffer();
      const headerLen = new DataView(buf).getUint32(0, true);
      const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headerLen)));
      const { dim, count } = header as { dim: number; count: number };
      const scalesOff = 4 + headerLen;
      const book: Book = {
        dim, count,
        scales: new Float32Array(buf.slice(scalesOff, scalesOff + count * 4)),
        data: new Int8Array(buf, scalesOff + count * 4, count * dim),
        meta: await jsonRes.json(),
      };
      loaded.set(source, book);
      return book;
    } catch {
      loaded.set(source, null);
      return null;
    } finally {
      loading.delete(source);
    }
  })();
  loading.set(source, p);
  return p;
}

export interface BookHit { ref: string; text: string; source: string; score: number }

/** Top passages of one book for an already-embedded (L2-normed) query vector. */
export async function searchBook(source: string, q: Float32Array, topK: number): Promise<BookHit[]> {
  const b = await loadBook(source);
  if (!b) return [];
  const { dim, count, scales, data, meta } = b;
  const scored: { r: number; s: number }[] = new Array(count);
  for (let r = 0; r < count; r++) {
    let dot = 0;
    const base = r * dim;
    for (let i = 0; i < dim; i++) dot += data[base + i] * q[i];
    scored[r] = { r, s: dot * scales[r] };
  }
  scored.sort((a, c) => c.s - a.s);
  return scored.slice(0, topK).map(({ r, s }) => ({ ref: meta[r].ref, text: meta[r].text, source, score: s }));
}

/** Embed the query once, then search the given sources; merged, top-scored first. */
export async function searchBooks(query: string, sources: string[], topK: number): Promise<BookHit[]> {
  const q = await embedQuery(query);
  const per = Math.max(3, Math.ceil(topK / Math.max(1, sources.length)) + 1);
  const all = (await Promise.all(sources.map((s) => searchBook(s, q, per)))).flat();
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, topK);
}

// ── tafsir BY REF (verse-anchored) — direct lookup, no vectors ────────────────
// The reader's «تفسير» button needs a verse's tafsir text, not a semantic search.
// We load only the source's .json (ref → text), not the .bin.
const textMaps = new Map<string, Map<string, string> | null>();
const textLoading = new Map<string, Promise<Map<string, string> | null>>();

function loadTafsirText(source: string): Promise<Map<string, string> | null> {
  const done = textMaps.get(source);
  if (done !== undefined) return Promise.resolve(done);
  const inflight = textLoading.get(source);
  if (inflight) return inflight;
  const p = (async (): Promise<Map<string, string> | null> => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}rag-${source}.json?v=${__DATA_VERSION__}`);
      if (!res.ok) { textMaps.set(source, null); return null; }
      const arr = (await res.json()) as { ref: string; text: string }[];
      const m = new Map(arr.map((x) => [x.ref, x.text]));
      textMaps.set(source, m);
      return m;
    } catch {
      textMaps.set(source, null);
      return null;
    } finally {
      textLoading.delete(source);
    }
  })();
  textLoading.set(source, p);
  return p;
}

/** All registered tafsirs' text for one āyah (loc "s:a"), in registry order. */
export async function tafsirFor(loc: string): Promise<{ source: string; label: string; text: string }[]> {
  const out: { source: string; label: string; text: string }[] = [];
  for (const s of BOOK_SOURCES) {
    const m = await loadTafsirText(s.id);
    const text = m?.get(loc);
    if (text) out.push({ source: s.id, label: s.label, text });
  }
  return out;
}

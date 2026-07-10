/**
 * QCF (KFGQPC Madina mushaf) foundation — lazy per-page fonts + layout data.
 *
 * Each Madani page has its own font (p<N>.woff2) whose glyphs render the exact
 * printed shapes; the layout says which word (by our location "s:a:w") sits on
 * which line with which glyph code. So a page renders pixel-identical to print
 * while every word stays real, interactive text — the base all layers ride on.
 */

export interface MushafWord {
  key: string; // "s:a:w" — our word id; all features attach here
  code: string; // QCF v2 glyph
  ayah: string; // "s:a"
  end?: boolean; // ayah-number marker glyph
}
export interface MushafLine {
  line: number;
  words: MushafWord[];
}

const FONT_BASE = `${import.meta.env.BASE_URL}mushaf/fonts`;
const loaded = new Set<number>();
const loading = new Map<number, Promise<void>>();

/** Font-family name used in CSS for a given page. */
export const pageFont = (page: number) => `QCF_P${page}`;

/** Ensure the QCF font for a page is loaded (idempotent, cached). */
export function loadPageFont(page: number): Promise<void> {
  if (loaded.has(page)) return Promise.resolve();
  let p = loading.get(page);
  if (!p) {
    p = (async () => {
      const face = new FontFace(pageFont(page), `url(${FONT_BASE}/p${page}.woff2) format("woff2")`);
      await face.load();
      (document.fonts as FontFaceSet).add(face);
      loaded.add(page);
    })().catch((e) => {
      loading.delete(page);
      throw e;
    });
    loading.set(page, p);
  }
  return p;
}

// --- layout data (all pages, loaded once; small, gzips well) -----------------
let layout: Record<string, MushafLine[]> | null = null;
let layoutPromise: Promise<void> | null = null;

export function loadLayout(): Promise<void> {
  if (layout) return Promise.resolve();
  layoutPromise ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}mushaf/layout.json?v=${__DATA_VERSION__}`);
    if (!res.ok) throw new Error(`mushaf layout not found (HTTP ${res.status})`);
    layout = (await res.json()).pages;
  })().catch((e) => {
    layoutPromise = null;
    throw e;
  });
  return layoutPromise;
}

export const pageLines = (page: number): MushafLine[] => layout?.[String(page)] ?? [];
export const mushafReady = () => layout !== null;

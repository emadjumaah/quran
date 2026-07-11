/**
 * Omni resolution — the shared brain behind every search box that "understands
 * how Muslims reference the Quran". One query → ranked jump targets:
 *   «البقرة ٢٥٥» · "2:255" · «٢ ٢٥٥» · baqarah 255 · surah names (ar/translit)
 *   «جزء ١٥» / juz 15 · «صفحة ٣٠٢» / page 302 · «آية الكرسي» · any Arabic token
 *   → roots + text hits · anything → search by meaning ↵
 *
 * Extracted from the ⌘K Omnibox so the same logic drives the on-page reader
 * search bar (InlineOmni) without duplicating a line of it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAyahByLocation,
  getRoot,
  listSurahs,
  searchAyahs,
  searchRoots,
  surahNameAr,
} from "./db";
import { num, t } from "./i18n";
import type { SurahDoc } from "./types";
import { readPathOf } from "./types";
import { resolveRootReady } from "./searchForms";

export interface OmniItem {
  key: string;
  kind: "ayah" | "surah" | "juz" | "page" | "root" | "text" | "meaning";
  label: string;
  sub?: string;
  to: string;
}

/** well-known ayah names */
const ALIASES: Record<string, string> = {
  "آية الكرسي": "2:255",
  "اية الكرسي": "2:255",
  "آية الدين": "2:282",
  "آية النور": "24:35",
  "خواتيم البقرة": "2:285",
  "أول سورة نزلت": "96:1",
};

const toWestern = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const stripAl = (s: string) => s.replace(/^ال/, "").replace(/[إأآ]/g, "ا");

export interface SurahIndexEntry {
  s: SurahDoc;
  ar: string;
  tr: string;
  en: string;
}

export function buildSurahIndex(surahs: SurahDoc[]): SurahIndexEntry[] {
  return surahs.map((s) => ({
    s,
    ar: stripAl(s.nameAr.replace(/\s/g, "")),
    tr: s.nameTranslit.toLowerCase().replace(/[^a-z]/g, ""),
    en: s.nameEn.toLowerCase(),
  }));
}

/** Resolve a raw query into ranked jump targets. Pure (async) — no React. */
export async function resolveOmni(raw0: string, surahIndex: SurahIndexEntry[]): Promise<OmniItem[]> {
  const raw = raw0.trim();
  if (!raw) return [];
  const out: OmniItem[] = [];
  const w = toWestern(raw);

  // alias
  const alias = ALIASES[raw] ?? ALIASES[raw.replace(/\s+/g, " ")];
  if (alias) {
    out.push({
      key: "alias",
      kind: "ayah",
      label: `${raw} — ${surahNameAr(Number(alias.split(":")[0]))} ${num(alias.split(":")[1])}`,
      to: readPathOf(alias),
    });
  }

  // s:a or "s a"
  const ref = w.match(/^(\d{1,3})[:\s](\d{1,3})$/);
  if (ref) {
    const loc = `${ref[1]}:${ref[2]}`;
    if (await getAyahByLocation(loc)) {
      out.push({
        key: "ref",
        kind: "ayah",
        label: `${surahNameAr(Number(ref[1]))} ${num(Number(ref[2]))}`,
        to: readPathOf(loc),
      });
    }
  }

  // juz / صفحة / page
  const juz = w.match(/^(?:جزء|juz)\s*(\d{1,2})$/i);
  if (juz) {
    const n = Number(juz[1]);
    if (n >= 1 && n <= 30)
      out.push({ key: "juz", kind: "juz", label: `${t("reader.juz")} ${num(n)}`, to: `/goto/juz/${n}` });
  }
  const page = w.match(/^(?:صفحة|page|ص)\s*(\d{1,3})$/i);
  if (page) {
    const n = Number(page[1]);
    if (n >= 1 && n <= 604)
      out.push({ key: "page", kind: "page", label: `${t("reader.page")} ${num(n)}`, to: `/goto/page/${n}` });
  }

  // «سورة ٢٥٥» — surah name + ayah number
  const nameNum = w.match(/^(.+?)\s+(\d{1,3})$/);
  const nameQuery = (nameNum ? nameNum[1] : w).trim();
  const ayahNo = nameNum ? Number(nameNum[2]) : null;
  if (!/^\d+$/.test(nameQuery)) {
    const nq = stripAl(nameQuery.replace(/\s/g, ""));
    const nqLat = nameQuery.toLowerCase().replace(/[^a-z]/g, "");
    for (const { s, ar, tr, en } of surahIndex) {
      const hit =
        (nq.length >= 2 && ar.includes(nq)) ||
        (nqLat.length >= 3 && (tr.includes(nqLat) || en.includes(nqLat)));
      if (hit) {
        const a = ayahNo && ayahNo <= s.ayahCount ? ayahNo : null;
        out.push({
          key: `s${s.surahNo}${a ?? ""}`,
          kind: a ? "ayah" : "surah",
          label: a ? `${s.nameAr} ${num(a)}` : s.nameAr,
          sub: a ? undefined : `${num(s.ayahCount)} ${t("reader.ayahs")}`,
          to: a ? `/read/${s.surahNo}/${a}` : `/read/${s.surahNo}`,
        });
        if (out.length > 8) break;
      }
    }
  }

  // Arabic token → root (resolve the typed WORD to its root first)
  if (/^[ء-ي]{2,}$/.test(raw)) {
    const seenRoots = new Set<string>();
    try {
      const resolved = await resolveRootReady(raw);
      if (resolved) {
        const rd = await getRoot(resolved).catch(() => null);
        if (rd) {
          seenRoots.add(resolved);
          out.push({
            key: `rr${resolved}`,
            kind: "root",
            label: resolved,
            sub: `${t("morph.root")} · ${num(rd.occurrences)}`,
            to: `/roots/${encodeURIComponent(resolved)}`,
          });
        }
      }
    } catch {
      /* resolver is optional */
    }
    try {
      const roots = await searchRoots(raw, 3);
      for (const r of roots) {
        if (seenRoots.has(r.root)) continue;
        out.push({
          key: `r${r.root}`,
          kind: "root",
          label: r.root,
          sub: `${t("morph.root")} · ${num(r.occurrences)}`,
          to: `/roots/${encodeURIComponent(r.root)}`,
        });
      }
    } catch {
      /* roots are optional */
    }
  }

  // text hits (only for queries with an Arabic word)
  if (/[ء-ي]{2,}/.test(raw)) {
    try {
      const hits = await searchAyahs(raw);
      for (const a of hits.slice(0, 4))
        out.push({
          key: `t${a.location}`,
          kind: "text",
          label: a.textClean.length > 60 ? `${a.textClean.slice(0, 60)}…` : a.textClean,
          sub: `${surahNameAr(a.surahNo)} ${num(a.ayahNo)}`,
          to: readPathOf(a.location),
        });
      if (hits.length > 4)
        out.push({
          key: "more-text",
          kind: "text",
          label: `${t("nav.search")}: ${raw} (${num(hits.length)})`,
          to: `/search?q=${encodeURIComponent(raw)}`,
        });
    } catch {
      /* fts syntax errors are fine here */
    }
  }

  // meaning search, always last
  out.push({
    key: "meaning",
    kind: "meaning",
    label: `${t("search.mode.meaning")}: ${raw} ↵`,
    to: `/search?m=1&q=${encodeURIComponent(raw)}`,
  });

  return out;
}

/** React hook: debounced omni resolution + a lazily-loaded surah index. */
export function useOmniResults(q: string): OmniItem[] {
  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const [items, setItems] = useState<OmniItem[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    void listSurahs().then(setSurahs);
  }, []);

  const surahIndex = useMemo(() => buildSurahIndex(surahs), [surahs]);

  useEffect(() => {
    const id = ++seq.current;
    if (!q.trim()) {
      setItems([]);
      return;
    }
    const timer = setTimeout(() => {
      void resolveOmni(q, surahIndex).then((out) => {
        if (seq.current === id) setItems(out);
      });
    }, 160);
    return () => clearTimeout(timer);
  }, [q, surahIndex]);

  return items;
}

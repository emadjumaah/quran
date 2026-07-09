/**
 * صندوق واحد لكل شيء — the omnibox (⌘K / Ctrl+K / «/»).
 *
 * One input that understands how Muslims actually reference the Quran:
 *   «البقرة ٢٥٥» · "2:255" · «٢ ٢٥٥» · baqarah 255 · surah names (ar/translit)
 *   «جزء ١٥» / juz 15 · «صفحة ٣٠٢» / page 302 · «آية الكرسي» and friends
 *   any Arabic token → roots + text hits · anything → search by meaning ↵
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAyahByLocation, listSurahs, searchAyahs, searchRoots } from "../db";
import { num, t, useUILang } from "../i18n";
import type { SurahDoc } from "../types";
import { readPathOf } from "../types";
import { surahNameAr } from "../db";

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

interface Item {
  key: string;
  kind: "ayah" | "surah" | "juz" | "page" | "root" | "text" | "meaning";
  label: string;
  sub?: string;
  to: string;
}

export default function Omnibox() {
  useUILang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setItems([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      void listSurahs().then(setSurahs);
    }
  }, [open]);

  const surahIndex = useMemo(
    () =>
      surahs.map((s) => ({
        s,
        ar: stripAl(s.nameAr.replace(/\s/g, "")),
        tr: s.nameTranslit.toLowerCase().replace(/[^a-z]/g, ""),
        en: s.nameEn.toLowerCase(),
      })),
    [surahs],
  );

  // resolve query → items
  useEffect(() => {
    const id = ++seq.current;
    const raw = q.trim();
    if (!raw) {
      setItems([]);
      return;
    }
    const run = async () => {
      const out: Item[] = [];
      const w = toWestern(raw);

      // alias
      const alias = ALIASES[raw] ?? ALIASES[raw.replace(/\s+/g, " ")];
      if (alias) {
        out.push({
          key: `alias`,
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
            key: `ref`,
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
          const hit = (nq.length >= 2 && ar.includes(nq)) || (nqLat.length >= 3 && (tr.includes(nqLat) || en.includes(nqLat)));
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

      // Arabic token → roots
      if (/^[ء-ي]{2,}$/.test(raw)) {
        try {
          const roots = await searchRoots(raw, 3);
          for (const r of roots)
            out.push({
              key: `r${r.root}`,
              kind: "root",
              label: r.root,
              sub: `${t("morph.root")} · ${num(r.occurrences)}`,
              to: `/roots/${encodeURIComponent(r.root)}`,
            });
        } catch { /* roots are optional */ }
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
        } catch { /* fts syntax errors are fine here */ }
      }

      // meaning search, always last
      out.push({
        key: "meaning",
        kind: "meaning",
        label: `${t("search.mode.meaning")}: ${raw} ↵`,
        to: `/search?m=1&q=${encodeURIComponent(raw)}`,
      });

      if (seq.current === id) {
        setItems(out);
        setActive(0);
      }
    };
    const timer = setTimeout(() => void run(), 160);
    return () => clearTimeout(timer);
  }, [q, surahIndex]);

  const go = (item: Item) => {
    setOpen(false);
    navigate(item.to);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="⌘K">
        ⌕
      </button>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(false)} title="⌘K">
        ⌕
      </button>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgb(0 0 0 / 0.35)",
          zIndex: 70,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          paddingTop: "12vh",
        }}
      >
        <div
          className="card"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "min(620px, 92vw)", padding: 10 }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("omni.placeholder")}
            style={{ width: "100%", fontSize: 17, padding: "12px 14px" }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && items[active]) {
                go(items[active]);
              }
            }}
          />
          {items.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: "50vh", overflowY: "auto" }}>
              {items.map((item, i) => (
                <div
                  key={item.key}
                  onClick={() => go(item)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: i === active ? "var(--accent-soft)" : undefined,
                  }}
                >
                  <span className="chip" style={{ fontSize: 10.5, minWidth: 52, justifyContent: "center" }}>
                    {t(`omni.${item.kind}`)}
                  </span>
                  <span
                    className={item.kind === "text" || item.kind === "root" ? "quran" : undefined}
                    style={{ fontSize: item.kind === "text" ? 17 : 15, lineHeight: 1.6, flex: 1, minWidth: 0 }}
                  >
                    {item.label}
                  </span>
                  {item.sub && <span className="muted">{item.sub}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="muted" style={{ marginTop: 8, textAlign: "center" }}>
            {t("omni.hint")}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * MushafRealPage — a single Madani page rendered with its QCF font, pixel-close
 * to the printed mushaf, while every word stays real interactive text. All
 * layers (word tap → morphology, ayah select, recitation highlight) attach via
 * the word `key` ("s:a:w"). This is the base other features render on top of.
 */
import { useEffect, useRef, useState } from "react";
import { loadLayout, loadPageFont, pageFont, pageLines } from "../mushaf";
import type { MushafLine, MushafWord } from "../mushaf";
import { num } from "../i18n";

export default function MushafRealPage({
  page,
  selectedWord,
  playingAyah,
  onWord,
  onAyah,
}: {
  page: number;
  selectedWord?: string | null; // "s:a:w"
  playingAyah?: string | null; // "s:a"
  onWord?: (key: string) => void;
  onAyah?: (loc: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setReady(false);
    setErr(false);
    Promise.all([loadLayout(), loadPageFont(page)])
      .then(() => mounted.current && setReady(true))
      .catch(() => mounted.current && setErr(true));
    // warm the neighbouring pages' fonts for instant turns
    if (page > 1) void loadPageFont(page - 1).catch(() => {});
    if (page < 604) void loadPageFont(page + 1).catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [page]);

  if (err) return <div className="muted" style={{ textAlign: "center", padding: 24 }}>—</div>;
  if (!ready)
    return (
      <section className="mushaf-page" style={{ minHeight: 300, display: "grid", placeItems: "center" }}>
        <span className="muted">…</span>
      </section>
    );

  const lines: MushafLine[] = pageLines(page);
  const fam = pageFont(page);

  return (
    <section className="mushaf-page qcf">
      {lines.map((ln) => {
        // surah header / basmala lines can be short → center; full lines justify
        const full = ln.words.length >= 4;
        return (
          <div
            key={ln.line}
            className="qcf-line"
            style={{ justifyContent: full ? "space-between" : "center" }}
          >
            {ln.words.map((w: MushafWord) => {
              const sel = selectedWord === w.key;
              const playing = playingAyah === w.ayah;
              return (
                <span
                  key={w.key}
                  className={`qcf-w${sel ? " sel" : ""}${playing ? " play" : ""}`}
                  style={{ fontFamily: `"${fam}"` }}
                  role="button"
                  title={w.ayah}
                  onClick={() => (w.end ? onAyah?.(w.ayah) : onWord?.(w.key))}
                >
                  {w.code}
                </span>
              );
            })}
          </div>
        );
      })}
      <div className="page-no">﴾ {num(page)} ﴿</div>
    </section>
  );
}

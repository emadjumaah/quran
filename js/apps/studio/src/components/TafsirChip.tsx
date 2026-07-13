/**
 * «تفسير» — the verse's tafsir, shown inline in the reader beside الإعراب. Tapping
 * loads (lazily) and shows the registered tafsirs for this āyah, one below the
 * other, each attributed to its source (التفسير الميسّر · تفسير الجلالين …). Direct
 * by-ref lookup — no search, no server. Clearly sourced, never presented as ours.
 */
import { useEffect, useState } from "react";
import { tafsirFor } from "../books";
import { getUILang, useUILang } from "../i18n";

export function TafsirChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  useUILang();
  const ar = getUILang() === "ar";
  return (
    <button className={`chip${open ? " on" : ""}`} onClick={onToggle} title={ar ? "تفسيرُ الآية من المصادر" : "the verse's tafsir"}>
      {ar ? "تفسير" : "Tafsir"}
    </button>
  );
}

export function TafsirPanel({ location, open }: { location: string; open: boolean }) {
  useUILang();
  const ar = getUILang() === "ar";
  const [items, setItems] = useState<{ source: string; label: string; text: string }[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    tafsirFor(location).then((r) => live && setItems(r)).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [open, location]);
  if (!open) return null;
  return (
    <div className="tafsir-panel">
      {items === null ? (
        <div className="muted" style={{ fontSize: 13, padding: "4px 2px" }}>{ar ? "…" : "…"}</div>
      ) : items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, padding: "4px 2px" }}>{ar ? "لا يوجد تفسيرٌ لهذه الآية في المصادر." : "No tafsir for this verse."}</div>
      ) : (
        items.map((t) => (
          <div key={t.source} className="tafsir-entry">
            <div className="tafsir-src">◆ {t.label}</div>
            <div className="tafsir-text">{t.text}</div>
          </div>
        ))
      )}
    </div>
  );
}

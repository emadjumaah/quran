/**
 * «سبب النزول» — the occasion of a verse's revelation, shown inline in the reader.
 * The chip appears ONLY on verses that actually have a recorded sabab (checked via
 * a tiny index, so we never load the full books just to decide). Tapping shows the
 * sabab from the registered أسباب-النزول books, attributed — a cited source, kept
 * separate from مشكاة's computed layers.
 */
import { useEffect, useState } from "react";
import { asbabFor, hasAsbab, loadAsbabIndex } from "../books";
import { getUILang, useUILang } from "../i18n";

export function AsbabChip({ location, open, onToggle }: { location: string; open: boolean; onToggle: () => void }) {
  useUILang();
  const ar = getUILang() === "ar";
  const [avail, setAvail] = useState(false);
  useEffect(() => {
    let live = true;
    loadAsbabIndex().then(() => live && setAvail(hasAsbab(location)));
    return () => { live = false; };
  }, [location]);
  if (!avail) return null;
  return (
    <button className={`chip${open ? " on" : ""}`} onClick={onToggle} title={ar ? "سببُ نزول الآية" : "occasion of revelation"}>
      {ar ? "سبب النزول" : "Occasion"}
    </button>
  );
}

export function AsbabPanel({ location, open }: { location: string; open: boolean }) {
  useUILang();
  const ar = getUILang() === "ar";
  const [items, setItems] = useState<{ source: string; label: string; text: string }[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    asbabFor(location).then((r) => live && setItems(r)).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [open, location]);
  if (!open) return null;
  return (
    <div className="tafsir-panel">
      {items === null ? (
        <div className="muted" style={{ fontSize: 13, padding: "4px 2px" }}>…</div>
      ) : items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, padding: "4px 2px" }}>{ar ? "لا سببَ منصوصٌ لهذه الآية." : "No recorded occasion for this verse."}</div>
      ) : (
        items.map((t) => (
          <div key={t.source} className="tafsir-entry asbab-entry">
            <div className="tafsir-src asbab-src">◆ {t.label}</div>
            <div className="tafsir-text">{t.text}</div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * «تفسير» — the verse's tafsir, shown inline in the reader beside الإعراب. Tapping
 * loads (lazily) and shows the registered tafsirs for this āyah, one below the
 * other, each attributed to its source (التفسير الميسّر · تفسير الجلالين …). Direct
 * by-ref lookup — no search, no server. Clearly sourced, never presented as ours.
 */
import { useEffect, useState } from "react";
import { TAFSIR_SOURCES, bookTextAt, bookLabel } from "../books";
import { getUILang, useUILang } from "../i18n";
import { setSettings, useSettings } from "../settings";

export function TafsirChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  useUILang();
  const ar = getUILang() === "ar";
  return (
    <button className={`chip${open ? " on" : ""}`} onClick={onToggle} title={ar ? "تفسيرُ الآية من المصادر" : "the verse's tafsir"}>
      {ar ? "تفسير" : "Tafsir"}
    </button>
  );
}

/**
 * One tafsir at a time, picked by a pill — each book's text is loaded (and cached)
 * only when selected, so opening تفسير never pulls all books at once (a verse's
 * tafsir, not a 19 MB download). Default = the first source (التفسير الميسّر).
 */
export function TafsirPanel({ location, open }: { location: string; open: boolean }) {
  useUILang();
  const ar = getUILang() === "ar";
  // the chosen tafsir is a persisted preference (settings.tafsir) — set here or in ⚙
  const pref = useSettings().tafsir;
  const sel = TAFSIR_SOURCES.some((s) => s.id === pref) ? pref : (TAFSIR_SOURCES[0]?.id ?? "");
  const [text, setText] = useState<string | null | undefined>(undefined); // undefined=loading · null=none
  useEffect(() => {
    if (!open || !sel) return;
    let live = true;
    setText(undefined);
    bookTextAt(sel, location).then((x) => live && setText(x)).catch(() => live && setText(null));
    return () => { live = false; };
  }, [open, location, sel]);
  if (!open) return null;
  return (
    <div className="tafsir-panel">
      <div className="tafsir-tabs" role="tablist">
        {TAFSIR_SOURCES.map((s) => (
          <button
            key={s.id}
            className={`tafsir-tab${sel === s.id ? " on" : ""}`}
            role="tab"
            aria-selected={sel === s.id}
            onClick={() => setSettings({ tafsir: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="tafsir-entry">
        <div className="tafsir-src">◆ {bookLabel(sel)}</div>
        <div className="tafsir-text">
          {text === undefined
            ? "…"
            : text ?? (ar ? "لا نصَّ لهذه الآية في هذا المصدر." : "No text for this verse in this source.")}
        </div>
      </div>
    </div>
  );
}

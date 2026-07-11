/**
 * EraabChip / EraabPanel — surfaces الإعراب (grammatical parse) for a verse in
 * the Reader, from «المجتبى من مشكل إعراب القرآن» للخراط. Same controlled
 * chip-in-toolbar / panel-beneath-the-verse pattern as TafsilChip, so opening it
 * never displaces the آية. The data file loads on first open (lazy).
 */
import { getUILang, num, t, useUILang } from "../i18n";
import { useEraab } from "../eraab";

const SRC = "المجتبى من مشكل إعراب القرآن — أ.د. أحمد الخراط · مجمع الملك فهد";

/** Toolbar chip. Always available in آيات mode; the panel says so if this
 *  particular verse has no entry (the book omits a few). */
export default function EraabChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ar = getUILang() === "ar";
  return (
    <button
      className={`chip${open ? " on" : ""}`}
      onClick={onToggle}
      style={{ border: "none", cursor: "pointer" }}
      title={ar ? "إعراب الآية (المجتبى للخراط)" : "grammatical parse"}
    >
      {ar ? "الإعراب" : "Iʿrāb"} {open ? "▾" : "◂"}
    </button>
  );
}

export function EraabPanel({ location, open }: { location: string; open: boolean }) {
  useUILang();
  const ar = getUILang() === "ar";
  const entry = useEraab(location, open);
  if (!open) return null;
  return (
    <div className="jw-panel eraab-panel">
      {entry === undefined ? (
        <div className="muted">{t("loading")}</div>
      ) : entry === null ? (
        <div className="muted">
          {ar
            ? "لم يُفرِد «المجتبى» إعرابًا لهذه الآية (يُعنى بالمُشكِل منها)."
            : "no separate entry for this verse in al-Mujtabā."}
        </div>
      ) : (
        <>
          <div className="eraab-text" dir="rtl">{entry.t}</div>
          <div className="eraab-src muted">
            {SRC}
            {entry.p ? ` · ص ${num(entry.p)}` : ""}
          </div>
        </>
      )}
    </div>
  );
}

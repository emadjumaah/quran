/**
 * The one on-page search bar — a simple, identical bar shown at the top of every
 * page that needs search. It filters that page's own content (via lib/fuzzy),
 * so the reader sees the page and searches it immediately. Not a popup.
 */
import { getUILang, useUILang } from "../i18n";

export default function PageSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  useUILang();
  const ar = getUILang() === "ar";
  return (
    <div className="page-search">
      <span className="page-search-icon" aria-hidden>⌕</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (ar ? "ابحث في هذه الصفحة…" : "search this page…")}
        aria-label={placeholder ?? (ar ? "بحث في الصفحة" : "search this page")}
      />
      {value && (
        <button className="page-search-clear" onClick={() => onChange("")} aria-label={ar ? "مسح" : "clear"}>
          ✕
        </button>
      )}
    </div>
  );
}

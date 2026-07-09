import { useSyncExternalStore } from "react";
import type { AyahDoc } from "../types";

const LANG_NAMES: Record<string, string> = { en: "English", fr: "Français", tr: "Türkçe" };
const KEY = "quran-studio:lang";

let currentLang = localStorage.getItem(KEY) ?? "en";
const listeners = new Set<() => void>();

export function setPreferredLang(lang: string) {
  currentLang = lang;
  localStorage.setItem(KEY, lang);
  listeners.forEach((l) => l());
}

export function usePreferredLang(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentLang,
  );
}

/**
 * Translation line for an ayah in the user's preferred language, with small
 * chips to switch language (preference persists across the whole app).
 */
export default function Translations({ ayah }: { ayah: AyahDoc }) {
  const lang = usePreferredLang();
  const t = ayah.translations ?? {};
  const langs = Object.keys(t);
  if (langs.length === 0) return null;
  const active = t[lang] != null ? lang : langs[0];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.65 }}>{t[active]}</div>
      {langs.length > 1 && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {langs.map((l) => (
            <button
              key={l}
              className="chip"
              onClick={() => setPreferredLang(l)}
              style={{
                border: "none",
                cursor: "pointer",
                fontSize: 10.5,
                padding: "1px 8px",
                ...(l === active ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}),
              }}
              title={`Show ${LANG_NAMES[l] ?? l} translation everywhere`}
            >
              {LANG_NAMES[l] ?? l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

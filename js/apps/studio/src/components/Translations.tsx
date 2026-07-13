import { useSyncExternalStore } from "react";
import { getUILang, useUILang } from "../i18n";
import type { AyahDoc } from "../types";

const LANG_NAMES: Record<string, string> = { en: "English", fr: "Français", tr: "Türkçe" };
const LANG_NAMES_AR: Record<string, string> = { en: "الإنجليزية", fr: "الفرنسية", tr: "التركية" };
const langName = (l: string) =>
  getUILang() === "ar" ? (LANG_NAMES_AR[l] ?? l) : (LANG_NAMES[l] ?? l);
const LANG_KEY = "quran-studio:lang"; // preferred translation language
const SHOW_KEY = "quran-studio:translations"; // "on" | "off" | absent = auto by UI lang

/* preferred translation language ------------------------------------------- */
let currentLang = localStorage.getItem(LANG_KEY) ?? "en";
/* visibility preference ------------------------------------------------------ */
let showPref: string | null = localStorage.getItem(SHOW_KEY);

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function setPreferredLang(lang: string) {
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  notify();
}

/** null = automatic (shown in English UI, hidden in Arabic UI). */
export function setTranslationsPref(v: "on" | "off" | null) {
  showPref = v;
  if (v == null) localStorage.removeItem(SHOW_KEY);
  else localStorage.setItem(SHOW_KEY, v);
  notify();
}

function useTransState(): { lang: string; visible: boolean } {
  useUILang();
  useSyncExternalStore(subscribe, () => `${currentLang}|${showPref}`);
  const visible = showPref === "on" || (showPref == null && getUILang() !== "ar");
  return { lang: currentLang, visible };
}

/**
 * Translation line for an ayah.
 *
 * Arabic UI (default): nothing is shown except a faint «ت» icon at the ayah's
 * edge — tap to reveal the translation for that ayah, with a pin to keep
 * translations always on. English UI: shown by default, with a subtle hide-all.
 */
export default function Translations({ ayah, open }: { ayah: AyahDoc; open?: boolean }) {
  const { lang, visible } = useTransState();
  const trans = ayah.translations ?? {};
  const langs = Object.keys(trans);
  if (langs.length === 0) return null;
  const active = trans[lang] != null ? lang : langs[0];

  // controlled by the reader's «ترجمة» chip (open); English UI still shows by default (visible)
  if (!visible && !open) return null;

  const ar = getUILang() === "ar";
  return (
    <div className="tafsir-panel">
      <div className="tafsir-entry translate-entry">
        <div className="tafsir-src translate-src">◆ {ar ? "الترجمة" : "Translation"} · {langName(active)}</div>
        <div className="tafsir-text" dir="ltr" style={{ textAlign: "start" }}>{trans[active]}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center" }}>
          {langs.length > 1 &&
          langs.map((l) => (
            <button
              key={l}
              className="chip"
              onClick={() => setPreferredLang(l)}
              style={{
                border: "none",
                cursor: "pointer",
                fontSize: 10.5,
                padding: "1px 8px",
                ...(l === active
                  ? { background: "var(--accent-soft)", color: "var(--accent)" }
                  : {}),
              }}
            >
              {langName(l)}
            </button>
          ))}
        {!visible ? (
          <>
            <button
              className="chip"
              style={{ border: "none", cursor: "pointer", fontSize: 10.5, padding: "1px 8px" }}
              title="إظهار الترجمة تحت كل آية"
              onClick={() => setTranslationsPref("on")}
            >
              📌 دائمًا
            </button>
          </>
        ) : (
          <button
            className="chip"
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 10.5,
              padding: "1px 8px",
              opacity: 0.6,
            }}
            title="إخفاء الترجمات · hide translations"
            onClick={() => setTranslationsPref("off")}
          >
            ✕
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

/**
 * TadabburChip / TadabburPanel — «مساعد التدبّر» in the reader (آيات mode). Same
 * controlled chip/panel pattern as الإعراب. On open it asks /api/tadabbur, which
 * reflects on the verse using ONLY our material (text · إعراب · nearest verses).
 * Framed honestly: «إعانةٌ على التدبّر بأدواتنا — ليست تفسيرًا»، مولَّدةٌ بالـAI.
 */
import { useEffect, useState } from "react";
import type { AyahDoc } from "../types";
import { getUILang, useUILang } from "../i18n";
import { askTadabbur } from "../tadabbur";

export default function TadabburChip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ar = getUILang() === "ar";
  return (
    <button
      className={`chip tadabbur-chip${open ? " on" : ""}`}
      onClick={onToggle}
      style={{ border: "none", cursor: "pointer" }}
      title={ar ? "مساعد التدبّر — إعانةٌ بالذكاء الاصطناعي من أدواتنا، لا تفسير" : "reflection helper (AI, from our tools — not tafsir)"}
    >
      <span className="ai-spark" aria-hidden /> {ar ? "تدبّر" : "Reflect"} {open ? "▾" : "◂"}
    </button>
  );
}

export function TadabburPanel({ ayah, ayahId, open }: { ayah: AyahDoc; ayahId: number; open: boolean }) {
  useUILang();
  const ar = getUILang() === "ar";
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setLoading(true);
    setError(null);
    askTadabbur(ayah, ayahId)
      .then((tx) => {
        setText(tx);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (open && text === null && !loading && !error) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="jw-panel tadabbur-panel">
      <div className="tadabbur-frame">
        <span className="ai-spark" aria-hidden />{" "}
        {ar
          ? "إعانةٌ على التدبّر بأدواتنا (الآية · إعرابها · أقربُ الآيات إليها معنًى) — ليست تفسيرًا، ومولَّدةٌ بالذكاء الاصطناعي."
          : "AI-assisted reflection organised from our own tools (verse · إعراب · nearest verses) — not tafsir."}
      </div>
      {loading ? (
        <div className="muted">{ar ? "…يُنشئ التدبّر" : "…generating"}</div>
      ) : error ? (
        <div className="muted">
          {ar ? "تعذّر توليد التدبّر" : "couldn't generate"} — {error}{" "}
          <button className="chip link" onClick={run} style={{ border: "none" }}>
            ↻ {ar ? "أعِد" : "retry"}
          </button>
        </div>
      ) : text ? (
        <>
          <div className="tadabbur-text" dir="rtl">{text}</div>
          <button className="chip link" onClick={run} style={{ border: "none", marginTop: 8 }}>
            ↻ {ar ? "أعِد التوليد" : "regenerate"}
          </button>
        </>
      ) : null}
    </div>
  );
}

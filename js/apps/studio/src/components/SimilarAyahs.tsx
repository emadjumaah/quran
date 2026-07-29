import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ayahByLocationMap, getAyahByGlobalNo, surahNameAr } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import { nearestUnits, type SiyaqUnit } from "../siyaq";
import type { AyahDoc } from "../types";
import { readPathOf } from "../types";
import { similarOf } from "../similar";
import { classOf, loadKulliyat } from "../kulliyat";
import { useSettings } from "../settings";
import AyahRef from "./AyahRef";
import TierBadge from "./TierBadge";
import CollectButton from "./CollectButton";
import { EnQuoteLine } from "./EnVerse";
import AudioButton, { ayahIdOf } from "./AudioButton";

interface Row {
  ayah: AyahDoc;
  score: number;
}

// one-time introductory pulse: the first «مثلها» chip with neighbours to ever
// render in this browser glows briefly, then never again.
const PULSE_KEY = "quran-studio:similar-seen";
let pulseAvailable = (() => {
  try {
    return !localStorage.getItem(PULSE_KEY);
  } catch {
    return false;
  }
})();

/**
 * «مثلها» — the flagship semantic-neighbours feature (precomputed Gemini
 * neighbours, no API). A gold, first-class chip that shows a live neighbour
 * count and expands into a shared panel (also reused by the صفحات popup). It
 * hides itself when an ayah has no close neighbours — never a dead-end.
 */
export default function SimilarAyahs({
  ayahId,
  location,
  open: openProp,
  onToggle,
}: {
  ayahId: number;
  location: string;
  /** controlled mode (reader): the panel is rendered by the parent BELOW the
   *  verse, so it never sits inside the toolbar's flex row. */
  open?: boolean;
  onToggle?: () => void;
}) {
  useUILang();
  const { layers } = useSettings();
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const [count, setCount] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);

  // cheap: only the neighbour COUNT (no per-ayah text resolution) for the badge
  useEffect(() => {
    let live = true;
    similarOf(ayahId).then((ns) => live && setCount(ns.length));
    return () => {
      live = false;
    };
  }, [ayahId]);

  // claim the one-time pulse for the first visible chip
  useEffect(() => {
    if (count && count > 0 && pulseAvailable) {
      pulseAvailable = false;
      try {
        localStorage.setItem(PULSE_KEY, "1");
      } catch {
        /* private mode */
      }
      setPulse(true);
    }
  }, [count]);

  if (!layers.similar) return null;
  if (count === 0) return null; // no close neighbours → no dead-end affordance

  return (
    <>
      <button
        className={`chip similar${open ? " open" : ""}${pulse ? " similar-cta-pulse" : ""}`}
        onClick={() => (controlled ? onToggle?.() : setOpenState((v) => !v))}
        style={{ cursor: "pointer" }}
        title={t("similar.title")}
      >
        <span className="ai-spark" aria-hidden /> {t("similar.chip")}
      </button>
      {!controlled && open && <SimilarAyahsPanel ayahId={ayahId} location={location} />}
    </>
  );
}

/**
 * The shared neighbour list — rendered identically inline (آيات view) and
 * inside the صفحات popup. Self-fetching: resolves each neighbour's full text
 * once on mount. Each row can be sampled with a preview ▶ (does not move the
 * reader) and opened fully (navigates, then fires onNavigate to close a popup).
 */
export function SimilarAyahsPanel({
  ayahId,
  location,
  onNavigate,
}: {
  ayahId: number;
  location: string;
  onNavigate?: () => void;
}) {
  useUILang();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  // «مقاطعُ قريبةٌ منها» — جاراتُ مقطعِ الآية من متّجهات وحدات السياق، محسوبةٌ
  // محليًّا بلا نداء (قرار المالك 2026-07-21). الآيةُ تُشبَّه بالآية، والمقطعُ بالمقطع.
  const [units, setUnits] = useState<{ unit: SiyaqUnit; score: number }[] | null>(null);
  // المقطعُ يُقرأ في مودالٍ مكانَه ولا يُقتلع القارئُ من موضعه (قرار المالك 2026-07-21)
  const [peek, setPeek] = useState<SiyaqUnit | null>(null);
  const [peekTexts, setPeekTexts] = useState<Map<string, AyahDoc> | null>(null);
  useEffect(() => {
    if (!peek || peekTexts) return;
    void ayahByLocationMap().then(setPeekTexts).catch(() => {});
  }, [peek, peekTexts]);
  useEffect(() => {
    if (!peek) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setPeek(null);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [peek]);
  useEffect(() => {
    let live = true;
    nearestUnits(location, 4).then((u) => live && setUnits(u)).catch(() => live && setUnits([]));
    return () => { live = false; };
  }, [location]);

  useEffect(() => {
    let live = true;
    (async () => {
      await loadKulliyat().catch(() => {});
      const ns = await similarOf(ayahId);
      const resolved = await Promise.all(
        ns.map(async (n) => ({ score: n.score, ayah: await getAyahByGlobalNo(n.ayahId) })),
      );
      const list = resolved.flatMap((r): Row[] => (r.ayah ? [{ ayah: r.ayah, score: r.score }] : []));
      // deepest first — nudge the more foundational neighbours up (closeness still leads)
      list.sort((a, b) => (b.score + 0.1 * (classOf(b.ayah.location)?.jamiya ?? 0)) - (a.score + 0.1 * (classOf(a.ayah.location)?.jamiya ?? 0)));
      if (live) setRows(list);
    })();
    return () => {
      live = false;
    };
  }, [ayahId]);

  return (
    <div className="similar-panel">
      {rows === null ? (
        <span className="muted">{t("loading")}</span>
      ) : rows.length === 0 ? (
        <span className="muted">{t("notFound")}</span>
      ) : (
        rows.map((r) => (
          <div key={r.ayah.location} className="similar-row">
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <AyahRef location={r.ayah.location} />
              <span className="chip gold" style={{ fontSize: 10.5 }}>
                {num(Math.round(r.score * 100))}٪
              </span>
              <TierBadge loc={r.ayah.location} />
              <AudioButton ayahId={ayahIdOf(r.ayah)} preview />
              <CollectButton
                locations={[r.ayah.location]}
                criterion={{ kind: "search", value: `مثل ${location}` }}
                label="⊕"
              />
            </div>
            <div
              className="quran"
              style={{ fontSize: 19, lineHeight: 1.9, cursor: "pointer" }}
              title={t("nav.reader")}
              onClick={() => {
                navigate(readPathOf(r.ayah.location));
                onNavigate?.();
              }}
            >
              {r.ayah.textUthmani}
            </div>
            <EnQuoteLine doc={r.ayah} />
          </div>
        ))
      )}
      {units && units.length > 0 && (
        <div className="similar-units">
          <div className="similar-units-h">
            {getUILang() === "ar" ? "مقاطعُ قريبةٌ منها" : "Passages close to it"}
            <span className="muted"> · {getUILang() === "ar" ? "من وحدات السياق المحسوبة" : "computed context units"}</span>
          </div>
          {units.map((u) => (
            <button
              key={u.unit.i}
              className="similar-unit"
              onClick={() => setPeek(u.unit)}
              title={getUILang() === "ar" ? "اقرأ المقطع هنا" : "read the passage here"}
            >
              <span className="similar-unit-name">{u.unit.name}</span>
              <span className="muted similar-unit-span">
                {surahNameAr(u.unit.s)} {num(u.unit.a1)}–{num(u.unit.a2)} · {num(Math.round(u.score * 100))}٪
              </span>
            </button>
          ))}
        </div>
      )}
      {peek && (
        <>
          <div className="sheet-backdrop" onClick={() => setPeek(null)} />
          <div className="word-sheet card" role="dialog" aria-modal="true" aria-label={peek.name}>
            <div className="word-sheet-grip" aria-hidden />
            <button className="word-sheet-close" onClick={() => setPeek(null)} aria-label={getUILang() === "ar" ? "إغلاق" : "close"}>✕</button>
            <div className="word-sheet-body">
              <div className="ws-ayah" style={{ textAlign: "start" }}>
                <div className="ws-ayah-ref muted">
                  {peek.name} · {surahNameAr(peek.s)} {num(peek.a1)}–{num(peek.a2)}
                </div>
              </div>
              <div className="mv-verses">
                {Array.from({ length: peek.a2 - peek.a1 + 1 }, (_, k) => `${peek.s}:${peek.a1 + k}`).map((loc) => {
                  const a = peekTexts?.get(loc);
                  return (
                    <div key={loc} className="mv-v">
                      <span className="mv-v-ref">{surahNameAr(peek.s)} {num(loc.split(":")[1])}</span>
                      <span className="quran mv-v-text">{a?.textUthmani ?? a?.textClean ?? "…"}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  className="chip"
                  onClick={() => {
                    navigate(readPathOf(`${peek.s}:${peek.a1}`));
                    setPeek(null);
                    onNavigate?.();
                  }}
                >
                  {getUILang() === "ar" ? "افتحْ في المصحف ←" : "open in the reader →"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

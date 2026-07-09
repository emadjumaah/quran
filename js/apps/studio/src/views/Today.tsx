/**
 * صفحة اليوم — the home surface ("/").
 *
 * A calm card-stack: the date-seeded ayah of the day with its recitation,
 * translation, root (with classical gloss) and closest-in-meaning siblings —
 * plus a «واصل القراءة» chip restoring the last reading position.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAyahByGlobalNo, getRoot, surahNameAr, wordsOfAyah } from "../db";
import { num, t, useUILang } from "../i18n";
import type { AyahDoc, RootDoc, WordDoc } from "../types";
import { readPathOf } from "../types";
import AudioButton, { ayahIdOf } from "../components/AudioButton";
import AyahRef from "../components/AyahRef";
import CollectButton from "../components/CollectButton";
import SimilarAyahs from "../components/SimilarAyahs";
import Translations from "../components/Translations";

export const LAST_READ_KEY = "quran-studio:last-read"; // "s:a"

/** Deterministic ayah of the day: same for everyone on the same date. */
function ayahOfTheDay(): number {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 6236) + 1;
}

export default function Today() {
  useUILang();
  const navigate = useNavigate();
  const [ayah, setAyah] = useState<AyahDoc | null>(null);
  const [roots, setRoots] = useState<RootDoc[]>([]);
  const lastRead = localStorage.getItem(LAST_READ_KEY);

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await getAyahByGlobalNo(ayahOfTheDay());
      if (!a || !alive) return;
      setAyah(a);
      const words: WordDoc[] = await wordsOfAyah(a.surahNo, a.ayahNo);
      const uniqueRoots = [...new Set(words.map((w) => w.root).filter((r): r is string => !!r))];
      const docs = await Promise.all(uniqueRoots.slice(0, 3).map((r) => getRoot(r)));
      if (alive) setRoots(docs.filter((d): d is RootDoc => !!d));
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {lastRead && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <Link className="chip link" to={readPathOf(lastRead)} style={{ fontSize: 14, padding: "6px 16px" }}>
              ↩ {t("today.continue")} — {surahNameAr(Number(lastRead.split(":")[0]))}{" "}
              {num(lastRead.split(":")[1])}
            </Link>
          </div>
        )}

        <div className="muted" style={{ textAlign: "center", marginBottom: 6 }}>
          {t("today.ayah")}
        </div>

        {ayah ? (
          <div className="card" style={{ padding: "26px 30px" }}>
            <div
              className="quran"
              style={{ fontSize: 30, lineHeight: 2.3, textAlign: "center", cursor: "pointer" }}
              title={t("nav.reader")}
              onClick={() => navigate(readPathOf(ayah.location))}
            >
              {ayah.textUthmani}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 12,
              }}
            >
              <AyahRef location={ayah.location} />
              <AudioButton ayahId={ayahIdOf(ayah)} />
              <SimilarAyahs ayahId={ayahIdOf(ayah)} location={ayah.location} />
              <CollectButton
                locations={[ayah.location]}
                criterion={{ kind: "manual", value: ayah.location }}
                label="⊕"
              />
            </div>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <Translations ayah={ayah} />
            </div>
          </div>
        ) : (
          <div className="card muted" style={{ textAlign: "center" }}>
            {t("loading")}
          </div>
        )}

        {roots.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="muted" style={{ marginBottom: 10 }}>
              {t("today.roots")}
            </div>
            {roots.map((r) => (
              <div key={r.root} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "6px 0" }}>
                <Link to={`/roots/${encodeURIComponent(r.root)}`} className="quran" style={{ fontSize: 22, minWidth: 56 }}>
                  {r.root}
                </Link>
                <span className="muted" dir="rtl" style={{ lineHeight: 1.9, flex: 1 }}>
                  {r.meanings?.[0]?.text
                    ? r.meanings[0].text.slice(0, 130) + (r.meanings[0].text.length > 130 ? "…" : "")
                    : `${num(r.occurrences)} ${t("roots.times")}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 18 }}
        >
          <Link className="chip" to="/read/1" style={{ textDecoration: "none" }}>
            {t("nav.reader")}
          </Link>
          <Link className="chip" to="/roots" style={{ textDecoration: "none" }}>
            {t("nav.roots")}
          </Link>
          <Link className="chip" to="/search" style={{ textDecoration: "none" }}>
            {t("nav.search")}
          </Link>
          <Link className="chip" to="/network" style={{ textDecoration: "none" }}>
            {t("nav.network")}
          </Link>
        </div>
      </div>
    </div>
  );
}

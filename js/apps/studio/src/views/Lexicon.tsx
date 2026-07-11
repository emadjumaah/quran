/**
 * معجم الجوامع — the fingerprint of each principle-kind. For حكم/أخلاق/عقيدة/
 * سنة/وعد: its distinctive roots (far commoner inside that kind than in the
 * Qur'an at large), its language patterns (أمر/حصر/تحريم), and its grade mix.
 * Data: jawami-lexicon.json (scripts/export-jawami-lexicon.mjs).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUILang, num, t, useUILang } from "../i18n";

interface Kind {
  kind: string;
  count: number;
  grades: Record<string, number>;
  patterns: { amr: number; hasr: number; tahrim: number };
  roots: { root: string; n: number; score: number }[];
}
interface Lexicon {
  meta: { principles: number; kinds: number };
  kinds: Kind[];
}

const GRADES = ["أصل جامع", "متفرّع", "موجز", "مجرّد"];

export default function Lexicon() {
  useUILang();
  const [d, setD] = useState<Lexicon | null>(null);
  const ar = getUILang() === "ar";

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}jawami-lexicon.json?v=${__DATA_VERSION__}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setD(j))
      .catch(() => {});
  }, []);

  if (!d) {
    return (
      <div className="page page-narrow">
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="fr-wrap">
        <header className="jw-header">
          <h1 className="jw-title">{ar ? "معجم الجوامع" : "Lexicon of the principles"}</h1>
          <p className="jw-lead">
            {ar
              ? "بصمةُ كلِّ نوعٍ من أنواع الجوامع: الجذورُ التي تُميّزه (تكثر في جوامعه أكثر من كثرتها في القرآن كلِّه)، وأنماطُه اللغوية (أمرٌ · حصرٌ · تحريم)، وتوزيعُ درجاته — محسوبةً من الجوامع وجذور نصِّها."
              : "The fingerprint of each principle-kind: the roots that mark it (commoner inside its جوامع than in the whole Qur'an), its language patterns, and its grade mix — computed from the جوامع and their roots."}
          </p>
          <div className="jw-stats">
            <span className="chip"><b>{num(d.meta.principles)}</b> {ar ? "آية جامعة" : "principles"}</span>
            <span className="chip"><b>{num(d.meta.kinds)}</b> {ar ? "أنواع" : "kinds"}</span>
          </div>
        </header>

        <div className="lx-list">
          {d.kinds.map((k) => (
            <div key={k.kind} className="lx-card">
              <div className="lx-head">
                <span className="lx-kind quran">{k.kind}</span>
                <span className="lx-count">{num(k.count)} {ar ? "جامعة" : "principles"}</span>
                <span className="spacer" style={{ flex: 1 }} />
                {k.patterns.amr > 0 && <span className="chip">{ar ? "أمر/نهي" : "command"} {num(k.patterns.amr)}</span>}
                {k.patterns.hasr > 0 && <span className="chip">{ar ? "حصر" : "restriction"} {num(k.patterns.hasr)}</span>}
                {k.patterns.tahrim > 0 && <span className="chip gold">{ar ? "تحريم" : "prohibition"} {num(k.patterns.tahrim)}</span>}
              </div>

              <div className="lx-grades">
                {GRADES.filter((g) => k.grades[g]).map((g) => (
                  <span key={g} className="lx-grade">
                    <b>{num(k.grades[g])}</b> {g}
                  </span>
                ))}
              </div>

              <div className="muted" style={{ fontSize: 12.5, margin: "10px 0 6px" }}>
                {ar ? "أكثرُ جذوره تمييزًا" : "most distinctive roots"}
              </div>
              <div className="lx-roots">
                {k.roots.map((r) => (
                  <Link key={r.root} to={`/roots/${encodeURIComponent(r.root)}`} className="chip lx-root">
                    <span className="quran" style={{ fontSize: 15 }}>{r.root}</span>
                    <span className="muted"> ×{num(r.n)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

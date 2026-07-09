import { Link } from "react-router-dom";
import type { SegmentDoc, WordDoc } from "../types";
import { VERB_FORM_ROMAN, label } from "../types";

function Chip({ k, v }: { k?: string; v: string | number | null | undefined }) {
  if (v == null || v === "") return null;
  return (
    <span className="chip">
      {k ? `${k} ` : ""}
      <b>{label(v)}</b>
    </span>
  );
}

function SegmentCard({ g }: { g: SegmentDoc }) {
  return (
    <div className="card" style={{ padding: "10px 14px", marginBottom: 10 }}>
      <div className="muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label(g.role)} — {g.posEn}
      </div>
      <div className="quran" style={{ fontSize: 22, lineHeight: 1.6 }}>
        {g.text} <span className="muted" style={{ fontFamily: "var(--font-ui)" }}>{g.posAr}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {g.root && (
          <Link to={`/roots/${encodeURIComponent(g.root)}`} className="chip link">
            root <b>{g.root}</b>
          </Link>
        )}
        {g.lemma && <Chip k="lemma" v={g.lemma} />}
        {g.verbForm && <Chip k="form" v={VERB_FORM_ROMAN[g.verbForm - 1]} />}
        <Chip v={g.aspect} />
        <Chip v={g.mood} />
        <Chip v={g.voice} />
        <Chip k="case" v={g.caseMark} />
        <Chip v={g.state} />
        <Chip v={g.derivation} />
        <Chip k="person" v={g.person} />
        <Chip v={g.gender} />
        <Chip v={g.number} />
        {g.family && <Chip k="family" v={g.family} />}
      </div>
    </div>
  );
}

/** Full morphology breakdown of one word: its segments with all features. */
export default function MorphologyCard({ word }: { word: WordDoc }) {
  return (
    <div>
      <div className="muted">{word.location}</div>
      <div className="quran" style={{ textAlign: "center", fontSize: 34 }}>{word.textUthmani}</div>
      <div className="muted" style={{ textAlign: "center", marginBottom: 12 }}>
        {word.textClean}
        {word.root ? <> · root {word.root}</> : null}
      </div>
      {word.segments.map((g, i) => (
        <SegmentCard key={i} g={g} />
      ))}
    </div>
  );
}

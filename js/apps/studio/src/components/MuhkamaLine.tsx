/**
 * The verse's computed place in the الكلّيّات classification, as ONE small chip
 * that sits inline with the reader's other tools: «◆ كلّيّة» (gold) or a tier
 * chip «جامعة ↑ الفرقان ٥٩» linking to the كلّيّة it belongs under. From
 * kulliyat.json (see docs/kulliyat-algorithm-design.md).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { surahNameAr } from "../db";
import { getUILang, num } from "../i18n";
import { kulliyaOf, useKulliyat } from "../kulliyat";
import { loadMarks, markOf } from "../marks";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

export default function MuhkamaLine({ location }: { location: string }) {
  const ready = useKulliyat();
  const [marksReady, setMarksReady] = useState(false);
  useEffect(() => { void loadMarks().then(() => setMarksReady(true)); }, []);
  const ar = getUILang() === "ar";
  void ar;
  if (!ready || !marksReady) return null;

  // every tier opens the verse's own clear classification page — not the general list
  const to = `/aya/${location.split(":")[0]}/${location.split(":")[1]}`;

  // الوسمُ من المصدر الواحد (marks.ts): جامعةٌ · كبرى · قاعدة — وما سواه بلا
  // وسمٍ، فأكثرُ المصحف تفصيلٌ وتكرارُ وسمِه تحت كلِّ آيةٍ لا يفيد.
  const m = markOf(location);
  if (!m) return null;
  if (m.kind === "جامعة") {
    return (
      <Link to="/kulliyat" className="chip mk-chip g" title={m.why}>◆ {m.label}</Link>
    );
  }
  const k = m.kind === "قاعدة" ? kulliyaOf(location) : null;
  return (
    <Link to={to} className={`chip mk-chip ${m.cls}`} title={m.why}>
      {m.label}{k && <span className="mk-up"> ↑ {arName(k)}</span>}
    </Link>
  );
}

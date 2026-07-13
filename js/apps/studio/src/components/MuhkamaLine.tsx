/**
 * The verse's computed place in the الكلّيّات classification — its tier
 * (كلّيّة / جامعة / تفصيل) and the كلّيّة it belongs under. From kulliyat.json
 * (see docs/kulliyat-methodology.md). Renders nothing for unclassified verses.
 */
import { Link } from "react-router-dom";
import { surahNameAr } from "../db";
import { getUILang, num } from "../i18n";
import { classOf, kulliyaOf, useKulliyat } from "../kulliyat";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

export default function MuhkamaLine({ location }: { location: string }) {
  const ready = useKulliyat();
  const ar = getUILang() === "ar";
  if (!ready) return null;
  const cls = classOf(location);
  if (!cls) return null;

  if (cls.tier === "كلّية") {
    return (
      <div className="mk-line mk-line-root" title={ar ? "من كلّيّات القرآن المحسوبة — من أعلى الآيات جامعيّةً" : "a computed kulliyya"}>
        ◆ {ar ? "آيةٌ كلّيّة" : "kulliyya"}
        <Link to="/kulliyat" className="mk-line-chip" style={{ textDecoration: "none" }}>{ar ? "الكلّيّات ←" : "all →"}</Link>
      </div>
    );
  }
  const k = kulliyaOf(location);
  return (
    <div className="mk-line" title={ar ? "مرتبةُ الآية والكلّيّةُ التي تندرجُ تحتها (محسوبة)" : "computed tier + the kulliyya it belongs under"}>
      <span className={`kl-badge ${cls.tier === "جامعة" ? "j" : "t"}`}>{cls.tier}</span>
      <span className="mk-line-lbl">{ar ? "تندرجُ تحت:" : "under:"}</span>
      {k ? (
        <Link to={`/read/${k.split(":")[0]}/${k.split(":")[1]}`} className="mk-line-chip quran">{arName(k)}</Link>
      ) : (
        <span className="muted">—</span>
      )}
    </div>
  );
}

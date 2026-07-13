/**
 * The selected ayah's place in our maps — its موضوع (topic + section), its
 * محكمة, whether it's itself a جامعة (kind/grade), and its network role
 * (تفصيل out/in, فروق twins). All from the unified verse-index; the reader taps
 * a verse and sees where it sits — no tafsīr.
 */
import { Link } from "react-router-dom";
import { getUILang, num, useUILang } from "../i18n";
import { useVerseIndex, verseInfo } from "../mawdui";

export default function VerseContext({ location }: { location: string | null }) {
  useUILang();
  const ready = useVerseIndex();
  if (!location || !ready) return null;
  const info = verseInfo(location);
  if (!info || (!info.topic && !info.twins)) return null;
  const ar = getUILang() === "ar";

  return (
    <div className="vc">
      <div className="vc-title">{ar ? "موضع الآية" : "This verse in the maps"}</div>

      {info.topic && (
        <Link to={info.sectionIdx != null ? `/mawdui/${info.sectionIdx}` : "/mawdui"} className="vc-row">
          <span className="vc-lbl">{ar ? "الموضوع" : "topic"}</span>
          <span className="vc-body">
            <span className="vc-val">{info.topic}</span>
            {info.section && <span className="vc-sub">{info.section}</span>}
          </span>
        </Link>
      )}

      {info.twins > 0 && (
        <div className="vc-net">
          <Link to="/furuq" className="chip link">
            {ar ? `${num(info.twins)} فرق تنزيل` : `${info.twins} furūq`}
          </Link>
        </div>
      )}
    </div>
  );
}

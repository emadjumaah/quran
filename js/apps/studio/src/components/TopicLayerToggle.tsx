/**
 * The one control that ties the two topic lenses together: المحاور (computed) ⇄
 * المواضيع (traditional). Sits at the top of both pages so a reader flips between
 * the two without hunting the menu. Equal footing — each labelled by its nature.
 */
import { Link, useLocation } from "react-router-dom";
import { getUILang, useUILang } from "../i18n";

export default function TopicLayerToggle() {
  useUILang();
  const ar = getUILang() === "ar";
  const onComputed = useLocation().pathname.startsWith("/tabwib");
  return (
    <div className="layer-toggle" role="tablist" aria-label={ar ? "طبقةُ الموضوعات" : "topic layer"}>
      <Link to="/tabwib" className={`lt-opt${onComputed ? " on" : ""}`} role="tab" aria-selected={onComputed}>
        <span className="ai-spark" aria-hidden /> {ar ? "مواضيع مشكاة" : "Mishkat topics"}
        <span className="lt-sub">{ar ? "محسوبة" : "computed"}</span>
      </Link>
      <Link to="/mawadi" className={`lt-opt${!onComputed ? " on" : ""}`} role="tab" aria-selected={!onComputed} title={ar ? "التبويب التقليدي المنقول — يُعرض للمقارنة بجوار المحسوب" : "the traditional curated index — kept for comparison beside the computed"}>
        {ar ? "التبويب التقليدي" : "Traditional index"}
        <span className="lt-sub">{ar ? "منقول · للمقارنة" : "curated · for comparison"}</span>
      </Link>
    </div>
  );
}

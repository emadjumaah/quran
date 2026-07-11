/**
 * MushafLink — the one explicit affordance for jumping a verse into the mushaf.
 * Verses across the app open their own dropdown (تفصيل / relations) on click;
 * going to the position in the mushaf is deliberate, via this small link/button.
 * Stops propagation so it never also toggles the card it sits inside.
 */
import { Link } from "react-router-dom";
import { getUILang } from "../i18n";
import { readPathOf } from "../types";

export default function MushafLink({
  loc,
  compact = false,
}: {
  loc: string;
  /** icon-only (no label) — for tight rows */
  compact?: boolean;
}) {
  const ar = getUILang() === "ar";
  return (
    <Link
      to={readPathOf(loc)}
      className="mushaf-link"
      title={ar ? "افتح الموضع في المصحف" : "open this position in the mushaf"}
      onClick={(e) => e.stopPropagation()}
      aria-label={ar ? "المصحف" : "mushaf"}
    >
      <span aria-hidden>↗</span>
      {!compact && <span className="mushaf-link-lbl">{ar ? "المصحف" : "read"}</span>}
    </Link>
  );
}

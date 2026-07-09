import { Link } from "react-router-dom";
import { surahNameAr } from "../db";
import { num, useUILang } from "../i18n";
import { readPathOf } from "../types";

/** Reference chip for an ayah: Arabic surah name + ayah number, linked to
 *  its place in the Reader (e.g. «النساء ١٢» instead of "4:12"). */
export default function AyahRef({
  location,
  className,
}: {
  /** "s:a" or "s:a:w" */
  location: string;
  className?: string;
}) {
  useUILang();
  const [s, a] = location.split(":").map(Number);
  return (
    <Link className={className ?? "chip link"} to={readPathOf(`${s}:${a}`)}>
      {surahNameAr(s)} {num(a)}
    </Link>
  );
}

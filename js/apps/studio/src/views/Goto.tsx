/** Resolves /goto/juz/:n and /goto/page/:n to the first ayah of that division. */
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { firstAyahOf } from "../db";
import { t } from "../i18n";

export default function Goto() {
  const { kind, n } = useParams<{ kind: string; n: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    void firstAyahOf(kind === "juz" ? "juz" : "page", Number(n)).then((loc) => {
      if (!alive) return;
      navigate(loc ? `/read/${loc.split(":")[0]}/${loc.split(":")[1]}` : "/read/1", {
        replace: true,
      });
    });
    return () => {
      alive = false;
    };
  }, [kind, n, navigate]);
  return (
    <div className="page">
      <div className="page-narrow muted">{t("loading")}</div>
    </div>
  );
}

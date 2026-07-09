import { useState } from "react";
import { addAyahs, createCollection, useCollections } from "../store/collections";
import { num, t, useUILang } from "../i18n";

/**
 * "Collect" button: adds ayah locations ("s:a") to a chosen (or new)
 * collection. `criterion` records WHY these ayahs belong together.
 */
export default function CollectButton({
  locations,
  criterion,
  label: btnLabel,
}: {
  locations: string[];
  criterion?: { kind: "root" | "lemma" | "search" | "manual"; value: string };
  label?: string;
}) {
  useUILang();
  const collections = useCollections();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const collect = (id: string) => {
    addAyahs(id, locations, criterion);
    setOpen(false);
    setDone(id);
    setTimeout(() => setDone(null), 1600);
  };

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button className="primary" onClick={() => setOpen(!open)} disabled={locations.length === 0}>
        {done
          ? t("collect.done")
          : (btnLabel ?? `${t("collect.ayahs")} (${num(locations.length)})`)}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "110%",
            insetInlineEnd: 0,
            zIndex: 30,
            minWidth: 240,
            padding: 10,
          }}
        >
          {collections.map((c) => (
            <button
              key={c.id}
              style={{ display: "block", width: "100%", marginBottom: 6, textAlign: "start" }}
              onClick={() => collect(c.id)}
            >
              {c.name} <span className="muted">({num(c.ayahs.length)})</span>
            </button>
          ))}
          <button
            style={{ display: "block", width: "100%" }}
            onClick={() => {
              const name = prompt(
                t("collect.namePrompt"),
                criterion ? `${criterion.value}` : t("collect.myCollection"),
              );
              if (name) collect(createCollection(name).id);
            }}
          >
            {t("collect.new")}
          </button>
        </div>
      )}
    </span>
  );
}

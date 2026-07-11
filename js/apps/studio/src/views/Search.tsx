/**
 * البحث — one search page, two modes (route /search, ?q=&m=1).
 *
 *   «نصّي»    (default) — FTS5 text search, debounced as you type.
 *   «بالمعنى»            — semantic search over Gemini vectors (submit to run:
 *                          each query costs one embedding call).
 *
 * Old /meaning links redirect here with m=1.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CollectButton from "../components/CollectButton";
import Translations from "../components/Translations";
import AyahRef from "../components/AyahRef";
import AudioButton, { ayahIdOf } from "../components/AudioButton";
import { SimilarAyahsPanel } from "../components/SimilarAyahs";
import { similarOf } from "../similar";
import { getAyahByGlobalNo, getAyahByLocation, searchAyahs, searchRoots } from "../db";
import { getUILang, num, t, useUILang } from "../i18n";
import type { AyahDoc, RootDoc } from "../types";
import { readPathOf } from "../types";
import {
  getEndpoint,
  getUserKey,
  loadVectors,
  meaningSearch,
  setEndpoint,
  setUserKey,
  vectorsReady,
} from "../semantic";

const DISPLAY_CAP = 200;
const TEXT_EXAMPLES = ["الرحمن", '"يا أيها الذين آمنوا"', "صبر*"];
const MEANING_EXAMPLES_AR = [
  "الصبر عند الشدة والفقد",
  "العفو عند الغضب",
  "رحمة الله بعباده",
  "الغاية من الخلق",
  "الصدق في البيع والتجارة",
];
const MEANING_EXAMPLES_EN = [
  "patience in hardship and loss",
  "forgiving people when angry",
  "the purpose of creation",
  "honesty in trade",
];

/** Arabic letters only (a plausible root / bare-word token). */
const ARABIC_TOKEN = /^[ء-ي]+$/;

const LINKS_EXAMPLES = ["٢:٢٥٥", "١١٢:١", "٣٦:١", "٥٥:١٣", "١:١"];
const MODE_LABELS: Record<Mode, [string, string]> = {
  meaning: ["بالمعنى", "By meaning"],
  links: ["ارتباطات آية", "Verse links"],
  text: ["بالنص", "By text"],
};
const toWestern = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
/** Parse "s:a" (Arabic or western digits) → a valid location, else null. */
const parseLoc = (s: string): string | null => {
  const m = toWestern(s).trim().match(/^(\d{1,3})\s*[:：\-]\s*(\d{1,3})$/);
  if (!m) return null;
  const su = Number(m[1]);
  const ay = Number(m[2]);
  if (su < 1 || su > 114 || ay < 1) return null;
  return `${su}:${ay}`;
};

type Mode = "meaning" | "links" | "text";

interface Hit {
  ayah: AyahDoc;
  score?: number;
}

/** One result row — identical look in both modes (score chip when present).
 *  Tapping the verse opens its «آيات ذات صلة» (semantic neighbours) inline;
 *  the مصحف opens only via the explicit button — so a result is a place to
 *  explore, not a trapdoor into the reader. */
function ResultRow({ hit, criterion }: { hit: Hit; criterion: string }) {
  useUILang();
  const navigate = useNavigate();
  const { ayah, score } = hit;
  const ar = getUILang() === "ar";
  const gid = ayahIdOf(ayah);
  const [showRelated, setShowRelated] = useState(false);
  const [relCount, setRelCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    similarOf(gid).then((ns) => live && setRelCount(ns.length));
    return () => {
      live = false;
    };
  }, [gid]);

  const openReader = () => navigate(readPathOf(ayah.location));
  const hasRelated = relCount != null && relCount > 0;
  // tap the verse → related dropdown when there are neighbours, else the reader
  const onVerseTap = () => (hasRelated ? setShowRelated((v) => !v) : openReader());

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <AyahRef location={ayah.location} />
        {score != null && (
          <span className="chip">
            {t("meaning.closeness")} <b>{num((score * 100).toFixed(1))}٪</b>
          </span>
        )}
        <span className="chip">
          {t("reader.juz")} <b>{num(ayah.juz)}</b>
        </span>
        <span className="chip">
          {t("reader.page")} <b>{num(ayah.page)}</b>
        </span>
        <span style={{ flex: 1 }} />
        <AudioButton ayahId={gid} />
        <button
          className="chip"
          onClick={openReader}
          title={ar ? "افتح الآية في المصحف" : "open in the reader"}
          style={{ border: "none", cursor: "pointer" }}
        >
          ↗ {ar ? "المصحف" : "read"}
        </button>
        <CollectButton
          locations={[ayah.location]}
          criterion={{ kind: "search", value: criterion }}
          label="⊕"
        />
      </div>
      <div
        className="quran"
        style={{ fontSize: 21, lineHeight: 2, cursor: "pointer" }}
        title={hasRelated ? (ar ? "آياتٌ ذات صلة" : "related verses") : t("nav.reader")}
        onClick={onVerseTap}
      >
        {ayah.textUthmani}
      </div>
      {hasRelated && (
        <button
          className={`chip similar${showRelated ? " open" : ""}`}
          onClick={() => setShowRelated((v) => !v)}
          style={{ cursor: "pointer", marginTop: 4 }}
          title={ar ? "آياتٌ ذات صلة بالمعنى" : "semantically related verses"}
        >
          ✦ {ar ? "آياتٌ ذات صلة" : "related"}
          <span className="count-badge">{num(relCount!)}</span>
          <span style={{ marginInlineStart: 4 }}>{showRelated ? "▾" : "◂"}</span>
        </button>
      )}
      {showRelated && hasRelated && (
        <SimilarAyahsPanel ayahId={gid} location={ayah.location} />
      )}
      <Translations ayah={ayah} />
    </div>
  );
}

export default function Search() {
  useUILang();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // «اسأل القرآن» is the AI hub: meaning is the default; ?m=links shows a verse's
  // AI-computed semantic neighbours; ?m=text is plain FTS. (old ?m=1 / /meaning
  // links resolve to meaning too, since "1" is neither "text" nor "links".)
  const mParam = searchParams.get("m");
  const mode: Mode = mParam === "text" ? "text" : mParam === "links" ? "links" : "meaning";

  const [input, setInput] = useState<string>(q);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [rootHits, setRootHits] = useState<RootDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [vectorPct, setVectorPct] = useState<number | null>(null);
  const [linkVerse, setLinkVerse] = useState<AyahDoc | null>(null); // links mode: the verse whose neighbours we show

  const seq = useRef(0);
  const lastPushed = useRef(q);

  const setMode = (m: Mode) => {
    seq.current++;
    setHits(null);
    setError(null);
    setNeedsSetup(false);
    setLoading(false);
    const params: Record<string, string> = {};
    if (input.trim()) params.q = input.trim();
    if (m !== "meaning") params.m = m; // meaning is the default → no param
    setSearchParams(params, { replace: true });
  };

  // URL → input (back/forward navigation, reload, external links).
  useEffect(() => {
    if (q !== lastPushed.current) {
      lastPushed.current = q;
      setInput(q);
    }
  }, [q]);

  // TEXT mode: input → URL, debounced.
  useEffect(() => {
    if (mode !== "text") return;
    const timer = setTimeout(() => {
      const next = input.trim();
      if (next === q) return;
      lastPushed.current = next;
      // keep m=text so the debounced URL write doesn't fall back to meaning
      setSearchParams(next ? { q: next, m: "text" } : { m: "text" }, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, q, mode, setSearchParams]);

  // TEXT mode: URL query → FTS results + root suggestions.
  useEffect(() => {
    if (mode !== "text") return;
    const id = ++seq.current;
    if (!q) {
      setHits(null);
      setRootHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    searchAyahs(q)
      .then((res: AyahDoc[]) => {
        if (seq.current !== id) return;
        setHits(res.map((ayah) => ({ ayah })));
        setLoading(false);
      })
      .catch(() => {
        if (seq.current !== id) return;
        setHits([]);
        setLoading(false);
        setError(t("search.hint"));
      });
    const token = q.endsWith("*") ? q.slice(0, -1) : q;
    if (ARABIC_TOKEN.test(token)) {
      searchRoots(token, 5)
        .then((rs) => seq.current === id && setRootHits(rs))
        .catch(() => seq.current === id && setRootHits([]));
    } else {
      setRootHits([]);
    }
  }, [q, mode]);

  // MEANING mode: run on demand (submit / examples / URL restore).
  const runMeaning = async (text: string) => {
    const query = text.trim();
    if (!query) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    setNeedsSetup(false);
    setRootHits([]);
    lastPushed.current = query;
    setSearchParams({ q: query, m: "1" }, { replace: true });
    try {
      if (!vectorsReady()) {
        setVectorPct(0);
        await loadVectors((pct) => setVectorPct(pct));
      }
      const found = await meaningSearch(query, 20);
      const resolved = await Promise.all(
        found.map(async (h) => ({ score: h.score, ayah: await getAyahByGlobalNo(h.ayahId) })),
      );
      if (seq.current !== id) return;
      setHits(
        resolved.flatMap((x): Hit[] => (x.ayah != null ? [{ score: x.score, ayah: x.ayah }] : [])),
      );
    } catch (e) {
      if (seq.current !== id) return;
      if ((e as Error).message === "no-embedder") setNeedsSetup(true);
      else setError((e as Error).message);
      setHits(null);
    } finally {
      if (seq.current === id) {
        setLoading(false);
        setVectorPct(null);
      }
    }
  };

  // LINKS mode: submitting just writes the URL; the reactive effect below
  // resolves the verse — so mount, deep links, back/forward and examples all
  // behave identically (no fragile mount-once path).
  const runLinks = (text: string) => {
    const s = text.trim();
    lastPushed.current = s;
    setSearchParams(s ? { q: s, m: "links" } : { m: "links" }, { replace: true });
  };

  // LINKS mode: q → the verse whose AI-computed neighbours we show.
  useEffect(() => {
    if (mode !== "links") return;
    const id = ++seq.current;
    const arNow = getUILang() === "ar";
    if (!q) {
      setLinkVerse(null);
      setError(null);
      return;
    }
    const loc = parseLoc(q);
    if (!loc) {
      setLinkVerse(null);
      setError(arNow ? "اكتب مرجع الآية هكذا: ٢:٢٥٥ (سورة:آية)" : "enter a verse like 2:255 (surah:ayah)");
      return;
    }
    setError(null);
    getAyahByLocation(loc)
      .then((a) => {
        if (seq.current !== id) return;
        setLinkVerse(a);
        if (!a) setError(arNow ? "لا توجد آية بهذا المرجع." : "no verse at that reference.");
      })
      .catch(() => {});
  }, [q, mode]);

  // Restore a MEANING search from the URL once (deep links, reload).
  const restored = useRef(false);
  useEffect(() => {
    if (mode === "meaning" && q && !restored.current) {
      restored.current = true;
      void runMeaning(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "meaning") void runMeaning(input);
    else if (mode === "links") void runLinks(input);
  };

  const ar = getUILang() === "ar";
  const criterion = mode === "meaning" ? `معنى: ${q}` : mode === "links" ? `ارتباطات: ${q}` : q;
  const shown = hits ? hits.slice(0, DISPLAY_CAP) : [];
  const examples =
    mode === "meaning"
      ? ar
        ? MEANING_EXAMPLES_AR
        : MEANING_EXAMPLES_EN
      : mode === "links"
        ? LINKS_EXAMPLES
        : TEXT_EXAMPLES;

  return (
    <div className="page">
      <div className="page-narrow">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{ar ? "البحث الدلالي" : "Semantic search"}</h2>
          <span
            className="chip"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", gap: 0, padding: 2, flexWrap: "wrap" }}
          >
            {(["meaning", "links", "text"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "3px 12px",
                  background: mode === m ? "var(--accent-soft)" : "transparent",
                  color: mode === m ? "var(--accent)" : "var(--muted)",
                  fontWeight: mode === m ? 600 : 400,
                }}
              >
                {ar ? MODE_LABELS[m][0] : MODE_LABELS[m][1]}
              </button>
            ))}
          </span>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            autoFocus
            dir={mode === "links" ? "ltr" : ar ? undefined : "auto"}
            value={input}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            placeholder={
              mode === "meaning"
                ? t("meaning.placeholder")
                : mode === "links"
                  ? ar ? "مرجع آية، مثل ٢:٢٥٥" : "a verse, e.g. 2:255"
                  : t("search.placeholder")
            }
            style={{ flex: 1, fontSize: 17, padding: "12px 14px" }}
            aria-label={ar ? "البحث الدلالي" : "Semantic search"}
          />
          {(mode === "meaning" || mode === "links") && (
            <button className="primary" disabled={loading}>
              {mode === "links" ? (ar ? "اعرض" : "Show") : loading ? t("meaning.searching") : t("meaning.search")}
            </button>
          )}
        </form>
        <div className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
          {mode === "meaning"
            ? ar
              ? "اسأل بلغتك، فنعيدُ آياتِ القرآن الأقربَ معنًى — نسترجع، لا نُولّد · بتضمينات Gemini"
              : "Ask in your words; we return the Qur'an's own verses closest in meaning — retrieval, not generation · Gemini embeddings"
            : mode === "links"
              ? ar
                ? "أدخل مرجع آية لتظهر أقربُ آيات القرآن إليها معنًى — روابطُ محسوبةٌ مسبقًا بالذكاء الاصطناعي (تضمينات Gemini)"
                : "Enter a verse to see the Qur'an's verses closest to it in meaning — precomputed AI links (Gemini embeddings)"
              : t("search.hint")}
        </div>

        {vectorPct != null && (
          <div className="muted" style={{ marginTop: 8 }}>
            {t("meaning.loadingVectors")} {num(vectorPct)}%
          </div>
        )}
        {needsSetup && <SetupCard onDone={() => void runMeaning(input)} />}

        {mode === "text" && rootHits.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span className="muted">{t("search.rootHint")}</span>
            {rootHits.map((r: RootDoc) => (
              <Link key={r.root} to={`/roots/${encodeURIComponent(r.root)}`} className="chip link">
                <b>{r.root}</b> ×{num(r.occurrences)}
              </Link>
            ))}
            <span className="muted">؟</span>
          </div>
        )}

        {!q && !loading && !needsSetup && (
          <div className="card" style={{ marginTop: 18 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {examples.map((ex: string) => (
                <button
                  key={ex}
                  className="chip link"
                  onClick={() => {
                    setInput(ex);
                    if (mode === "meaning") void runMeaning(ex);
                    else if (mode === "links") void runLinks(ex);
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "links" && linkVerse && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <AyahRef location={linkVerse.location} />
              <span style={{ flex: 1 }} />
              <AudioButton ayahId={ayahIdOf(linkVerse)} />
              <Link to={readPathOf(linkVerse.location)} className="chip link" style={{ textDecoration: "none" }}>
                ↗ {ar ? "المصحف" : "read"}
              </Link>
            </div>
            <div className="quran" style={{ fontSize: 22, lineHeight: 2 }}>{linkVerse.textUthmani}</div>
            <Translations ayah={linkVerse} />
            <div style={{ margin: "12px 0 2px", fontWeight: 600 }}>
              {ar ? "أقربُ آيات القرآن إليها معنًى:" : "the Qur'an's verses closest to it in meaning:"}
            </div>
            <SimilarAyahsPanel ayahId={ayahIdOf(linkVerse)} location={linkVerse.location} />
          </div>
        )}

        {loading && vectorPct == null && (
          <div className="muted" style={{ marginTop: 18 }}>
            {t("loading")}
          </div>
        )}

        {error && !loading && (
          <div className="card" style={{ marginTop: 18, color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {q && !loading && !error && hits && hits.length === 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            {t("notFound")} — <span className="quran" style={{ fontSize: 18 }}>{q}</span>
          </div>
        )}

        {q && !loading && hits && hits.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "16px 0 10px" }}>
              <strong>
                {num(hits.length)} {mode === "meaning" ? t("meaning.results") : t("search.results")}
              </strong>
              {hits.length > DISPLAY_CAP && (
                <span className="muted">
                  {t("showing")} {num(DISPLAY_CAP)}
                </span>
              )}
              <span style={{ flex: 1 }} />
              <CollectButton
                locations={hits.map((h) => h.ayah.location)}
                criterion={{ kind: "search", value: criterion }}
                label={`${t("search.collectAll")} (${num(hits.length)})`}
              />
            </div>
            <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {shown.map((h) => (
                <ResultRow key={h.ayah.location} hit={h} criterion={criterion} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */


function SetupCard({ onDone }: { onDone: () => void }) {
  useUILang();
  const [endpoint, setEp] = useState(getEndpoint());
  const [key, setKey] = useState(getUserKey() ?? "");
  return (
    <div className="card" style={{ margin: "12px 0" }}>
      <b>{t("meaning.setup.title")}</b>
      <p className="muted" style={{ lineHeight: 1.7 }}>
        {t("meaning.setup.body")}{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          {t("meaning.setup.getKey")}
        </a>
        )
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <label className="muted">
          {t("meaning.setup.endpoint")}
          <input dir="ltr" style={{ width: "100%" }} value={endpoint} onChange={(e) => setEp(e.target.value)} />
        </label>
        <label className="muted">
          {t("meaning.setup.orKey")}
          <input
            dir="ltr"
            style={{ width: "100%" }}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza…"
          />
        </label>
        <div>
          <button
            className="primary"
            onClick={() => {
              setEndpoint(endpoint.trim() || "/api/embed");
              setUserKey(key.trim());
              onDone();
            }}
          >
            {t("meaning.setup.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

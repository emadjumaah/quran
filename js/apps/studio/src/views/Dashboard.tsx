/**
 * Dashboard — corpus statistics overview (/dashboard).
 *
 * Stat tiles · Meccan/Medinan split bars · longest/shortest surahs ·
 * top roots + letter frequency (from the precomputed stats doc) ·
 * revelation-order strip. All charts are plain CSS bars.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getStats, listSurahs, topRoots } from "../db";
import type { RootDoc, SurahDoc } from "../types";

const MECCAN_COLOR = "var(--accent)";
const MEDINAN_COLOR = "var(--gold)";

/** Fallback totals shown when the stats doc is missing from this db build. */
const STATIC_COUNTS: { key: string; label: string; value: number }[] = [
  { key: "surahs", label: "Surahs", value: 114 },
  { key: "ayahs", label: "Ayahs", value: 6236 },
  { key: "words", label: "Words", value: 77429 },
  { key: "segments", label: "Segments", value: 130030 },
  { key: "roots", label: "Roots", value: 1651 },
  { key: "lemmas", label: "Lemmas", value: 4776 },
];

const fmt = (n: number): string => n.toLocaleString("en-US");

// --- defensive readers for the untyped stats doc ---------------------------

type StatsDoc = Record<string, unknown>;

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function liveCount(stats: StatsDoc | null, key: string): number | null {
  if (!stats) return null;
  const counts = asRecord(stats.counts);
  return (counts ? asNumber(counts[key]) : null) ?? asNumber(stats[key]);
}

interface NamedCount {
  name: string;
  count: number;
}

/** Normalize stats.topRoots ([{root, occurrences}] in the current converter). */
function extractRootStats(stats: StatsDoc | null): NamedCount[] {
  const raw = stats?.topRoots;
  if (!Array.isArray(raw)) return [];
  const out: NamedCount[] = [];
  for (const item of raw as unknown[]) {
    const o = asRecord(item);
    if (!o) continue;
    const name = typeof o.root === "string" ? o.root : null;
    const count = asNumber(o.occurrences) ?? asNumber(o.count) ?? asNumber(o.freq);
    if (name && count != null) out.push({ name, count });
  }
  return out;
}

/** Normalize stats.letterFreq ([{letter, freq}] or a {letter: n} record). */
function extractLetterStats(stats: StatsDoc | null): NamedCount[] {
  const raw = stats?.letterFreq ?? stats?.letterFrequencies ?? stats?.letters;
  const out: NamedCount[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw as unknown[]) {
      const o = asRecord(item);
      if (!o) continue;
      const name =
        typeof o.letter === "string" ? o.letter : typeof o.char === "string" ? o.char : null;
      const count = asNumber(o.freq) ?? asNumber(o.count) ?? asNumber(o.occurrences);
      if (name && count != null) out.push({ name, count });
    }
  } else {
    const rec = asRecord(raw);
    if (rec) {
      for (const [k, v] of Object.entries(rec)) {
        const n = asNumber(v);
        if (n != null) out.push({ name: k, count: n });
      }
    }
  }
  return out.sort((a: NamedCount, b: NamedCount) => b.count - a.count);
}

// --- small presentational pieces --------------------------------------------

function StatTile({ label, value, live }: { label: string; value: number; live: boolean }) {
  return (
    <div
      className="card"
      style={{ flex: "1 1 130px", minWidth: 120, padding: "12px 16px" }}
      title={live ? undefined : "Static value — the live stats document is not in this db build"}
    >
      <div
        className="muted"
        style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, marginTop: 2 }}>{fmt(value)}</div>
    </div>
  );
}

function LegendSwatch({ color, text }: { color: string; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }}
      />
      <span className="muted">{text}</span>
    </span>
  );
}

/** Two-segment 100% horizontal bar: Meccan (accent) vs Medinan (gold). */
function SplitBar({ title, meccan, medinan }: { title: string; meccan: number; medinan: number }) {
  const total = meccan + medinan;
  const pct = total > 0 ? (meccan / total) * 100 : 50;
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 5,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
        <span className="muted">
          Meccan {fmt(meccan)} ({Math.round(pct)}%) · Medinan {fmt(medinan)} (
          {Math.round(100 - pct)}%)
        </span>
      </div>
      <div style={{ display: "flex", gap: 2, height: 14 }} role="img" aria-label={`${title}: ${fmt(meccan)} Meccan, ${fmt(medinan)} Medinan`}>
        <div
          title={`Meccan — ${fmt(meccan)}`}
          style={{ width: `${pct}%`, background: MECCAN_COLOR, borderRadius: "4px 0 0 4px" }}
        />
        <div
          title={`Medinan — ${fmt(medinan)}`}
          style={{ flex: 1, background: MEDINAN_COLOR, borderRadius: "0 4px 4px 0" }}
        />
      </div>
    </div>
  );
}

/** Horizontal bar list — one row per item, width scaled to the max count. */
function BarList({
  items,
  labelWidth,
  linkTo,
}: {
  items: NamedCount[];
  labelWidth: number;
  linkTo?: (name: string) => string;
}) {
  const max = Math.max(...items.map((i: NamedCount) => i.count), 1);
  return (
    <div>
      {items.map((i: NamedCount) => (
        <div
          key={i.name}
          title={`${i.name} — ${fmt(i.count)} occurrences`}
          style={{
            display: "grid",
            gridTemplateColumns: `${labelWidth}px 1fr 64px`,
            alignItems: "center",
            gap: 10,
            padding: "3px 0",
          }}
        >
          {linkTo ? (
            <Link to={linkTo(i.name)} className="quran" style={{ fontSize: 18, lineHeight: 1.5 }}>
              {i.name}
            </Link>
          ) : (
            <span className="quran" style={{ fontSize: 18, lineHeight: 1.5 }}>
              {i.name}
            </span>
          )}
          <div style={{ height: 10, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${(i.count / max) * 100}%`,
                height: "100%",
                background: "var(--accent)",
                borderRadius: "0 4px 4px 0",
              }}
            />
          </div>
          <span
            className="muted"
            style={{ fontVariantNumeric: "tabular-nums", textAlign: "end" }}
          >
            {fmt(i.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SurahTable({ title, rows }: { title: string; rows: SurahDoc[] }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Surah</th>
            <th style={{ textAlign: "end" }}>Ayahs</th>
            <th style={{ textAlign: "end" }}>Words</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s: SurahDoc) => (
            <tr key={s.surahNo}>
              <td className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {s.surahNo}
              </td>
              <td>
                <Link to={`/read/${s.surahNo}`}>{s.nameTranslit}</Link>{" "}
                <span className="quran" style={{ fontSize: 16, lineHeight: 1.2, display: "inline" }}>
                  {s.nameAr}
                </span>
              </td>
              <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>
                {fmt(s.ayahCount)}
              </td>
              <td style={{ textAlign: "end", fontVariantNumeric: "tabular-nums" }}>
                {fmt(s.wordCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- the view ----------------------------------------------------------------

export default function Dashboard() {
  const [surahs, setSurahs] = useState<SurahDoc[]>([]);
  const [stats, setStats] = useState<StatsDoc | null>(null);
  const [rootStats, setRootStats] = useState<NamedCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, statsDoc] = await Promise.all([
        listSurahs(),
        getStats().catch(() => null as StatsDoc | null),
      ]);
      if (cancelled) return;
      setSurahs(all);
      setStats(statsDoc);
      let roots = extractRootStats(statsDoc).slice(0, 20);
      if (statsDoc && roots.length === 0) {
        // stats doc exists but has no usable top-roots list: derive live.
        try {
          const docs = await topRoots(20);
          roots = docs.map((r: RootDoc) => ({ name: r.root, count: r.occurrences }));
        } catch {
          roots = [];
        }
      }
      if (!cancelled) {
        setRootStats(roots);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const revelation = useMemo(() => {
    let meccanSurahs = 0;
    let medinanSurahs = 0;
    let meccanWords = 0;
    let medinanWords = 0;
    for (const s of surahs) {
      if (s.revelation === "Meccan") {
        meccanSurahs += 1;
        meccanWords += s.wordCount;
      } else {
        medinanSurahs += 1;
        medinanWords += s.wordCount;
      }
    }
    return { meccanSurahs, medinanSurahs, meccanWords, medinanWords };
  }, [surahs]);

  const chrono = useMemo(
    () => [...surahs].sort((a: SurahDoc, b: SurahDoc) => a.chronoOrder - b.chronoOrder),
    [surahs],
  );
  const longest = useMemo(
    () => [...surahs].sort((a: SurahDoc, b: SurahDoc) => b.wordCount - a.wordCount).slice(0, 8),
    [surahs],
  );
  const shortest = useMemo(
    () => [...surahs].sort((a: SurahDoc, b: SurahDoc) => a.wordCount - b.wordCount).slice(0, 8),
    [surahs],
  );
  const letters = useMemo(() => extractLetterStats(stats).slice(0, 15), [stats]);

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading statistics…</p>
      </div>
    );
  }

  if (surahs.length === 0) {
    return (
      <div className="page">
        <div className="card page-narrow">
          <p>No surah data found in the current database build.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</div>
          <div className="muted">
            Corpus statistics from the Quran knowledge graph
            {stats == null && " — live stats document not in this build; totals shown are static"}
          </div>
        </header>

        {/* stat tiles */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          {STATIC_COUNTS.map((t: { key: string; label: string; value: number }) => {
            const live = liveCount(stats, t.key);
            return (
              <StatTile key={t.key} label={t.label} value={live ?? t.value} live={live != null} />
            );
          })}
        </div>

        {/* Meccan vs Medinan + revelation-order strip */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600 }}>Meccan &amp; Medinan</div>
            <div style={{ display: "flex", gap: 14 }}>
              <LegendSwatch color={MECCAN_COLOR} text="Meccan" />
              <LegendSwatch color={MEDINAN_COLOR} text="Medinan" />
            </div>
          </div>
          <SplitBar
            title="Surahs"
            meccan={revelation.meccanSurahs}
            medinan={revelation.medinanSurahs}
          />
          <SplitBar
            title="Words"
            meccan={revelation.meccanWords}
            medinan={revelation.medinanWords}
          />

          <div style={{ borderTop: "1px solid var(--line)", margin: "14px 0", paddingTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Revelation order</div>
            <div className="muted" style={{ marginBottom: 8 }}>
              All 114 surahs in traditional chronological order — click a square to read.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {chrono.map((s: SurahDoc) => (
                <Link
                  key={s.surahNo}
                  to={`/read/${s.surahNo}`}
                  title={`${s.chronoOrder}. ${s.nameTranslit} — ${s.revelation}, surah ${s.surahNo}`}
                  aria-label={`${s.chronoOrder}. ${s.nameTranslit}, ${s.revelation}, surah ${s.surahNo}`}
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    display: "block",
                    background: s.revelation === "Meccan" ? MECCAN_COLOR : MEDINAN_COLOR,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* longest / shortest surahs */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <SurahTable title="Longest surahs by words" rows={longest} />
          <SurahTable title="Shortest surahs by words" rows={shortest} />
        </div>

        {/* top roots + letter frequency (need the stats doc) */}
        {stats == null ? (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Top roots &amp; letter frequency</div>
            <p className="muted" style={{ margin: 0 }}>
              Not available in this build — the precomputed stats document is missing. Re-run the
              converter to enable these charts. Browse roots on the{" "}
              <Link to="/roots">Roots</Link> page instead.
            </p>
          </div>
        ) : (
          <div className="grid-2">
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Top 20 roots</div>
              <div className="muted" style={{ marginBottom: 10 }}>
                By word occurrences — click a root to explore it.
              </div>
              {rootStats.length > 0 ? (
                <BarList
                  items={rootStats}
                  labelWidth={64}
                  linkTo={(name: string) => `/roots/${encodeURIComponent(name)}`}
                />
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  Root statistics are not available in this build.
                </p>
              )}
            </div>
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Letter frequency</div>
              <div className="muted" style={{ marginBottom: 10 }}>
                The 15 most frequent letters across the whole text.
              </div>
              {letters.length > 0 ? (
                <BarList items={letters} labelWidth={32} />
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  Letter statistics are not available in this build.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

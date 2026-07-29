/**
 * «مشكاةُ تعرف عن هذه الآية» — قلبُ رؤية 2026-07-29: الأدواتُ تأتي إلى الآية
 * التي بين يدي القارئ، لا العكس. حين تُعلَّم آيةٌ يظهر تحتها سطرُ معرفةٍ خاصٌّ
 * بها وحدَها، من ثلاث طبقاتٍ لا يملكها غيرُنا:
 *
 *   ↔ شبيهُها      — من فروق التنزيل: آيةٌ توأمٌ تُعرض محاذاةً كلمةً بكلمة،
 *                    والفرقُ مميَّزٌ بلونه (٢٬٠٣١ آيةً لها شبيه).
 *   ⇄ صلاتُها      — من الشبكة المفحوصة: ما فحصه قارئٌ مستقلٌّ من صلاتها
 *                    (بيان · مثال · جزاء · توكيد · مثانٍ).
 *   ◈ وجهُ لفظٍ     — من الوجوه والنظائر: كلمةٌ فيها معناها هنا غيرُ معناها
 *                    في مواضعَ أخرى، بمعناها في هذا الموضع.
 *
 * كلُّ زرٍّ يفتح لوحتَه في المكان، ويصل بقسمه الكامل. البياناتُ تُجلب كسولةً
 * عند أول تعليمٍ وتبقى في الذاكرة (فروق ٦٨٢ك · وجوه ١٥ك · الشبكةُ محمَّلةٌ أصلًا).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { surahNameAr } from "../db";
import { num } from "../i18n";
import { readPathOf } from "../types";
import { loadFuruq, sides, type Furq } from "../furuq";
import { allVerseLocs, classOf, loadKulliyat, useKulliyat } from "../kulliyat";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

// ─── فهارسُ الموضع الواحد (تُبنى مرةً في الجلسة) ─────────────────────────────
let furuqByLoc: Map<string, Furq[]> | null = null;
async function loadFuruqIndex(): Promise<Map<string, Furq[]>> {
  if (furuqByLoc) return furuqByLoc;
  const d = await loadFuruq();
  const m = new Map<string, Furq[]>();
  for (const f of d.furuq) {
    if (f.cat === "تطابق") continue; // المتطابقةُ ليست «فرقًا» يُعرض هنا
    for (const loc of [f.a, f.b]) {
      const l = m.get(loc) ?? [];
      l.push(f);
      m.set(loc, l);
    }
  }
  for (const l of m.values()) l.sort((x, y) => y.eq - x.eq);
  return (furuqByLoc = m);
}

export interface WajhHit { lemma: string; sense: string; othersN: number }
let wujuhByLoc: Map<string, WajhHit[]> | null = null;
let wujuhLoading: Promise<Map<string, WajhHit[]>> | null = null;
function loadWujuhIndex(): Promise<Map<string, WajhHit[]>> {
  if (wujuhByLoc) return Promise.resolve(wujuhByLoc);
  wujuhLoading ??= fetch(`${import.meta.env.BASE_URL}wujuh.json?v=${__DATA_VERSION__}`)
    .then((r) => r.json())
    .then((d: { words: { lemma: string; faces: { verses: string[]; sense: string }[] }[] }) => {
      const m = new Map<string, WajhHit[]>();
      for (const w of d.words ?? []) {
        for (const face of w.faces) {
          for (const v of face.verses) {
            const l = m.get(v) ?? [];
            l.push({ lemma: w.lemma, sense: face.sense, othersN: w.faces.length - 1 });
            m.set(v, l);
          }
        }
      }
      return (wujuhByLoc = m);
    })
    .catch(() => (wujuhByLoc = new Map()));
  return wujuhLoading;
}

/** الصلاتُ الواردةُ أيضًا: القاعدةُ تشير إلى مفصِّلاتها — والمفصِّلةُ يجب أن
 *  ترى قاعدتَها من عندها (فهرسٌ عكسيٌّ يُبنى مرة). */
let inbound: Map<string, { loc: string; rel: string }[]> | null = null;
async function loadInbound(): Promise<Map<string, { loc: string; rel: string }[]>> {
  if (inbound) return inbound;
  await loadKulliyat();
  const m = new Map<string, { loc: string; rel: string }[]>();
  for (const loc of allVerseLocs()) {
    const c = classOf(loc);
    if (!c?.rels) continue;
    for (const [rel, locs] of Object.entries(c.rels)) {
      for (const b of locs) {
        const l = m.get(b) ?? [];
        if (!l.some((x) => x.loc === loc)) l.push({ loc, rel: `${rel} ←` });
        m.set(b, l);
      }
    }
  }
  return (inbound = m);
}

// ─── لوحاتُ العرض ────────────────────────────────────────────────────────────
/** محاذاةُ التوأم: سطران كلمةً بكلمة والفرقُ مميَّز (عرضٌ مصغّرٌ من فروق التنزيل) */
export function TwinPanel({ loc, pairs }: { loc: string; pairs: Furq[] }) {
  return (
    <div className="ak-panel">
      {pairs.slice(0, 2).map((f, i) => {
        const { a, b } = sides(f.ops);
        const other = f.a === loc ? f.b : f.a;
        return (
          <div key={i} className="ak-twin">
            <div className="ak-twin-h">
              <Link to={readPathOf(other)} className="chip link">{arName(other)}</Link>
              <span className="muted ak-note">الفرقُ مميَّزٌ بلونه</span>
            </div>
            {[{ segs: a, side: "a" as const, ref: f.a }, { segs: b, side: "b" as const, ref: f.b }].map((row) => (
              <div key={row.side} className="ak-line quran" dir="rtl">
                <span className="ak-ref">{arName(row.ref)}</span>{" "}
                {row.segs.map((g, gi) => (
                  <span key={gi} className={g.diff ? (g.form ? "fr-diff fr-form" : `fr-diff fr-diff-${row.side}`) : undefined}>{g.text} </span>
                ))}
              </div>
            ))}
          </div>
        );
      })}
      <div className="ak-more">
        {pairs.length > 2 && <span className="muted">وغيرُها {num(pairs.length - 2)} · </span>}
        <Link to="/furuq" className="chip link">قسمُ فروق التنزيل ←</Link>
      </div>
    </div>
  );
}

export function LinksPanel({ loc, links }: { loc: string; links: { loc: string; rel: string }[] }) {
  return (
    <div className="ak-panel">
      <div className="ak-links">
        {links.slice(0, 10).map((x) => (
          <Link key={x.loc + x.rel} to={readPathOf(x.loc)} className="chip" title={x.rel}>
            {x.rel} · {arName(x.loc)}
          </Link>
        ))}
        {links.length > 10 && <span className="chip">+{num(links.length - 10)}</span>}
      </div>
      <div className="ak-more">
        <span className="muted ak-note">كلُّ صلةٍ فحصها قارئٌ مستقلٌّ بمقطعَي سياقها · </span>
        <Link to={`/aya/${loc.split(":")[0]}/${loc.split(":")[1]}`} className="chip link">بطاقةُ الآية ←</Link>
      </div>
    </div>
  );
}

export function WujuhPanel({ hits }: { hits: WajhHit[] }) {
  return (
    <div className="ak-panel">
      {hits.slice(0, 2).map((h, i) => (
        <p key={i} className="ak-wajh">
          <b className="quran">{h.lemma}</b> — معناها في هذا الموضع: {h.sense}
          {h.othersN > 0 && <span className="muted"> · ولها {num(h.othersN)} {h.othersN === 1 ? "وجهٌ آخر" : "أوجهٌ أخرى"} في التنزيل</span>}
        </p>
      ))}
      <div className="ak-more"><Link to="/wujuh" className="chip link">الوجوهُ والنظائر ←</Link></div>
    </div>
  );
}

// ─── الخطّاف: معارفُ الموضع للوحة الآية ─────────────────────────────────────
export function useAyahKnowledge(loc: string): { twins: Furq[] | null; links: { loc: string; rel: string }[] | null; wujuh: WajhHit[] | null } {
  const kullReady = useKulliyat();
  const [twins, setTwins] = useState<Furq[] | null>(null);
  const [wujuh, setWujuh] = useState<WajhHit[] | null>(null);
  const [links, setLinks] = useState<{ loc: string; rel: string }[] | null>(null);

  useEffect(() => {
    let live = true;
    loadFuruqIndex().then((m) => live && setTwins(m.get(loc) ?? []));
    loadWujuhIndex().then((m) => live && setWujuh(m.get(loc) ?? []));
    loadInbound().then((rev) => {
      if (!live) return;
      const out: { loc: string; rel: string }[] = [];
      const c = classOf(loc);
      if (c?.rels) for (const [rel, locs] of Object.entries(c.rels)) for (const b of locs) out.push({ loc: b, rel: `→ ${rel}` });
      if (c?.mutual) for (const b of c.mutual) out.push({ loc: b, rel: "مثانٍ" });
      for (const x of rev.get(loc) ?? []) if (!out.some((o) => o.loc === x.loc)) out.push(x);
      setLinks(out);
    });
    return () => { live = false; };
  }, [loc, kullReady]);

  return { twins, links, wujuh };
}

// ─── السطرُ المستقل (يبقى للاستعمال خارج لوحة الآية إن لزم) ─────────────────
export default function AyahKnows({ loc, initialOpen }: { loc: string; initialOpen?: "twin" | "links" | "wujuh" }) {
  const { twins, links, wujuh } = useAyahKnowledge(loc);
  const [open, setOpen] = useState<"twin" | "links" | "wujuh" | null>(initialOpen ?? null);
  const prevLoc = useRef(loc);
  useEffect(() => {
    if (prevLoc.current !== loc) { setOpen(null); prevLoc.current = loc; }
  }, [loc]);

  const has = useMemo(() => ({
    twin: (twins?.length ?? 0) > 0,
    links: (links?.length ?? 0) > 0,
    wujuh: (wujuh?.length ?? 0) > 0,
  }), [twins, links, wujuh]);

  if (!has.twin && !has.links && !has.wujuh) return null;

  const toggle = (k: "twin" | "links" | "wujuh") => setOpen(open === k ? null : k);
  return (
    <div className="ak-wrap">
      <div className="ak-row">
        <span className="ak-label">مشكاةُ تعرف عنها:</span>
        {has.twin && (
          <button className={`chip ak-chip${open === "twin" ? " on" : ""}`} onClick={() => toggle("twin")}
            title="آيةٌ تشبهها لفظًا — تُعرض محاذاةً كلمةً بكلمة والفرقُ مميَّز">
            ↔ {twins!.length === 1 ? "لها شبيهٌ يفترق بكلمات"
              : twins!.length === 2 ? "لها شبيهان يفترقان بكلمات"
              : `لها ${num(twins!.length)} ${twins!.length <= 10 ? "أشباهٍ تفترق" : "شبيهًا يفترق"} بكلمات`}
          </button>
        )}
        {has.links && (
          <button className={`chip ak-chip${open === "links" ? " on" : ""}`} onClick={() => toggle("links")}
            title="صلاتٌ فحصها قارئٌ مستقلٌّ بمقطعَي سياقها — من الشبكة المفحوصة">
            ⇄ {links!.length === 1 ? "صلةٌ مفحوصة"
              : links!.length === 2 ? "صلتان مفحوصتان"
              : `${num(links!.length)} ${links!.length <= 10 ? "صلاتٍ مفحوصة" : "صلةً مفحوصة"}`}
          </button>
        )}
        {has.wujuh && (
          <button className={`chip ak-chip${open === "wujuh" ? " on" : ""}`} onClick={() => toggle("wujuh")}
            title="كلمةٌ في هذه الآية معناها هنا غيرُ معناها في مواضع أخرى — من الوجوه والنظائر">
            ◈ لفظٌ ذو وجوه: <span className="quran">{wujuh![0].lemma}</span>
          </button>
        )}
      </div>
      {open === "twin" && has.twin && <TwinPanel loc={loc} pairs={twins!} />}
      {open === "links" && has.links && <LinksPanel loc={loc} links={links!} />}
      {open === "wujuh" && has.wujuh && <WujuhPanel hits={wujuh!} />}
    </div>
  );
}

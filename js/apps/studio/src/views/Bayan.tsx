/**
 * البيان — تدبر لغة القرآن الخاصة، على ثلاث طبقات:
 *  · بطاقات محرَّرة (bayan.json) وبطاقات آلية (bayan-auto.json): خريطة استعمالٍ
 *    محسوبة حتميًّا (usage_map.py) جنبًا إلى جنب مع قراءاتٍ منقولة منسوبة.
 *  · مكتبة البيان (bayan-lib-*.json): تسعة كتبٍ مهيكلة بثلاث عائلات —
 *    المداخل بالحرف، والمتشابه بالسورة، وعلوم القرآن بالأنواع؛ كتابٌ يُجلب عند طلبه.
 *  · فهرس المطروق (bayan-tariq.json): أين طرق العلماءُ هذا الجذر/الموضع في متوننا
 *    المفهرسة — يصل البطاقة المحسوبة بمظانّها من الكتب (منهجية البيان §٦).
 * Routes: /bayan + /bayan/:id (و?root= لتصفية المكتبة) — البناء: scripts/build-bayan-cards.mjs.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { surahNameAr } from "../db";
import { getUILang, num, useUILang } from "../i18n";
import { readPathOf } from "../types";
import PageSearch from "../components/PageSearch";
import { fuzzyMatch } from "../lib/fuzzy";
import { bayanCardEn, bayanSideEn, bayanTypeEn, loadBayanEn } from "../lib/enNames";

interface Occ { loc: string; form: string; unit: string; txt: string }
interface Side {
  name: string; total: number; makki: number; madani: number;
  aspects: Record<string, number>; colloc: [string, number][]; occ: Occ[];
}
interface Reading { src: string; quote: string }
interface Card {
  id: string; title: string; type: string; kashf: string; roots?: string[];
  readings: Reading[]; sides: Side[]; contrast: Record<string, [string, number][]> | null;
}
interface BayanData { types: Record<string, string>; cards: Card[] }
interface LibEntry { id: string; head: string; roots: string[]; text: string; aya?: string[]; sura?: string }
interface LibBookMeta { id: string; label: string; mode: LibMode; count: number; groups: number }
interface LibHit { b: string; i: string; h: string; r: string[] }
type LibMode = "term" | "aya" | "naw";
interface Tariq { roots: Record<string, [string, number][]>; ayas: Record<string, [string, string][]> }

interface AutoSide { root: string; total: number; makki: number; madani: number; colloc: [string, number][]; occ: { loc: string; form: string; unit: string }[]; capped: boolean }
interface AutoCard { id: string; head: string; group?: string; roots: string[]; sides: AutoSide[]; contrast: Record<string, [string, number][]>; reading: Reading }

let cache: BayanData | null = null;
let libIndexCache: LibBookMeta[] | null = null;
let libHitsCache: LibHit[] | null = null;
const libBookCache = new Map<string, LibEntry[]>();
let autoCache: AutoCard[] | null = null;
let tariqCache: Tariq | null = null;
const autoWaiters: (() => void)[] = [];
function loadAuto(done: () => void) {
  if (autoCache) { done(); return; }
  autoWaiters.push(done);
  if (autoWaiters.length > 1) return;
  fetch(`${import.meta.env.BASE_URL}bayan-auto.json?v=${__DATA_VERSION__}`)
    .then((r) => r.json())
    .then((d: { cards: AutoCard[] }) => { autoCache = d.cards; autoWaiters.splice(0).forEach((f) => f()); })
    .catch(() => { autoCache = []; autoWaiters.splice(0).forEach((f) => f()); });
}

function useBayan(): BayanData | null {
  const [data, setData] = useState<BayanData | null>(cache);
  useEffect(() => {
    if (cache) return;
    fetch(`${import.meta.env.BASE_URL}bayan.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then((d: BayanData) => { cache = d; setData(d); })
      .catch(() => setData(null));
  }, []);
  return data;
}

/** فهرس المطروق — يُجلب مرةً عند أول بطاقة تُفتح */
function useTariq(): Tariq | null {
  const [t, setT] = useState<Tariq | null>(tariqCache);
  useEffect(() => {
    if (tariqCache) return;
    fetch(`${import.meta.env.BASE_URL}bayan-tariq.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then((d: Tariq) => { tariqCache = d; setT(d); })
      .catch(() => setT(null));
  }, []);
  return t;
}

const BOOK_LABEL: Record<string, string> = {
  furuqaskari: "الفروق اللغوية", basair: "بصائر ذوي التمييز", wujuhaskari: "الوجوه والنظائر",
  nuzha: "نزهة الأعين النواظر", damghani: "قاموس القرآن", durra: "درة التنزيل",
  malak: "ملاك التأويل", burhan: "البرهان", itqan: "الإتقان",
};
const FAMILY: Record<LibMode, string> = {
  term: "كتب المداخل والفروق — دخولها بالحرف",
  aya: "كتب المتشابه — دخولها بالسورة",
  naw: "كتب علوم القرآن — دخولها بالأنواع",
};

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

/** «أين طُرق هذا عند العلماء» — جسر البطاقة المحسوبة إلى مظانّها في المكتبة (§٦):
 *  بالجذر (كتب المداخل) وبالموضع (كتب المتشابه والأنواع). */
function TariqPanel({ roots, locs = [] }: { roots: string[]; locs?: string[] }) {
  const t = useTariq();
  if (!t) return null;
  const byRoot = roots.map((r) => ({ root: r, books: t.roots[r] ?? [] })).filter((x) => x.books.length);
  // صفُّ المواضع لكتب المتشابه والأنواع وحدها — فكتبُ المداخل مستوفاةٌ في صفّ الجذور
  const VERSE_BOOKS = new Set(["durra", "malak", "burhan", "itqan"]);
  const seen = new Set<string>();
  const byAya: { loc: string; bid: string; eid: string }[] = [];
  for (const loc of locs) {
    for (const [bid, eid] of t.ayas[loc] ?? []) {
      if (!VERSE_BOOKS.has(bid) || seen.has(loc + bid)) continue;
      seen.add(loc + bid);
      byAya.push({ loc, bid, eid });
    }
  }
  if (!byRoot.length && !byAya.length) {
    return (
      <p className="by-intro">
        لم نجد لهذه الجذور ولا لمواضعها مدخلًا في متوننا المفهرسة التسعة — وهذا وصفٌ لفهرسنا لا حكمٌ على العلم كله.
      </p>
    );
  }
  return (
    <div className="by-tariq">
      {byRoot.map(({ root, books }) => (
        <p key={root} className="by-seg">
          <Link to={`/mujam/${root}`} className="chip gold" title="خريطة الجذر في المعجم">{root}</Link>
          {books.map(([bid, n]) => (
            <Link key={bid} to={`/bayan?root=${encodeURIComponent(root)}&book=${bid}`} className="chip link">
              {BOOK_LABEL[bid] ?? bid} <b>{num(n)}</b>
            </Link>
          ))}
        </p>
      ))}
      {byAya.length > 0 && (
        <p className="by-seg">
          <span className="chip gold" title="مواضع البطاقة التي عُرض لها في كتب المتشابه والأنواع">مواضعها</span>
          {byAya.slice(0, 10).map(({ loc, bid, eid }) => (
            <Link key={bid + eid} to={`/bayan?book=${bid}&entry=${eid}`} className="chip link">
              {arName(loc)} — {BOOK_LABEL[bid] ?? bid}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}

/** لوحة طرفٍ واحد: العدّادان ثم المصاحبات ثم المواضع كلها قابلة للطي */
function SidePanel({ s }: { s: Side }) {
  const arUI = getUILang() === "ar";
  const aspects = Object.entries(s.aspects).filter(([, n]) => n > 0);
  return (
    <details className="by-side">
      <summary>
        <b>{arUI ? s.name : (bayanSideEn(s.name) ?? s.name)}</b>
        <span className="chip">{num(s.total)} {arUI ? "موضعًا" : "occurrences"}</span>
        <span className="chip">{arUI ? `مكي ${num(s.makki)} · مدني ${num(s.madani)}` : `Meccan ${num(s.makki)} · Medinan ${num(s.madani)}`}</span>
        {aspects.length > 0 && (
          <span className="chip">{aspects.map(([k, n]) => `${k} ${num(n)}`).join(" · ")}</span>
        )}
      </summary>
      {s.colloc.length > 0 && (
        <p className="by-colloc">
          <b>{arUI ? "أعلى المصاحبات:" : "Top companions:"}</b> {s.colloc.map(([l, n]) => `${l} ${num(n)}`).join(" · ")}
        </p>
      )}
      <ul className="by-occ">
        {s.occ.map((o, i) => (
          <li key={i}>
            <Link to={readPathOf(o.loc)} className="by-ref">{arName(o.loc)}</Link>{" "}
            <span className="quran">{o.form}</span>
            <span className="by-unit" title="وحدة السياق المعتمدة">{o.unit !== "—" ? ` — ${o.unit}` : ""}</span>
            <div className="by-aya">{o.txt}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CardPage({ card, types }: { card: Card; types: Record<string, string> }) {
  const ar = getUILang() === "ar";
  const [, forceEn] = useState(0);
  useEffect(() => { if (!ar) loadBayanEn().then(() => forceEn((n) => n + 1)); }, [ar]);
  const en = ar ? null : bayanCardEn(card.id);
  return (
    <div>
      <p>
        <Link to="/bayan" className="chip">{ar ? "← كل البطاقات" : "← all cards"}</Link>{" "}
        <span className="chip gold">{ar ? (types[card.type] ?? card.type) : (bayanTypeEn(card.type) ?? card.type)}</span>
      </p>
      <h2>{ar ? card.title : (en?.title ?? card.title)}</h2>
      <p className="by-kashf">
        <b>{ar ? "من استعمال المصحف:" : "From the Quran's own usage:"}</b> {ar ? card.kashf : (en?.kashf ?? card.kashf)}
      </p>
      <h3>{ar ? "خريطة الاستعمال المحسوبة" : "Computed usage map"}</h3>
      {card.sides.map((s) => <SidePanel key={s.name} s={s} />)}
      {card.contrast && (
        <details className="by-side">
          <summary><b>{ar ? "بصمة الافتراق" : "Divergence fingerprint"}</b>{ar ? " — لمّات تصاحب طرفًا ولا تصاحب الآخر" : " — words that accompany one side only"}</summary>
          {Object.entries(card.contrast).map(([k, v]) => (
            <p key={k} className="by-colloc"><b>{ar ? `ينفرد ${k}:` : `only with ${bayanSideEn(k) ?? k}:`}</b> {v.map(([l, n]) => `${l} ${num(n)}`).join(" · ")}</p>
          ))}
        </details>
      )}
      <h3>{ar ? "قراءات مستشهد بها" : "Classical scholars' readings"}</h3>
      {card.readings.map((r, i) => (
        <blockquote key={i} className="by-reading">
          <p>«{r.quote}»</p>
          {!ar && en?.readings[i] && <p className="by-reading-en">{en.readings[i]}</p>}
          <footer>— {r.src}</footer>
        </blockquote>
      ))}
      {ar && <>
      <h3>أين طُرق هذا عند العلماء</h3>
      <p className="by-intro">مظانُّ جذور البطاقة ومواضعها في كتب المكتبة التسعة — اضغط لتقرأ المدخل بنصه.</p>
      <TariqPanel roots={card.roots ?? []} locs={[...new Set(card.sides.flatMap((s) => s.occ.map((o) => o.loc)))]} />
      </>}
      <details className="by-side">
        <summary><b>{ar ? "منهج البطاقة" : "Method"}</b></summary>
        <p className="by-method">
          {ar
            ? "كل رقمٍ في الخريطة حسابٌ حتميٌّ من نص المصحف والمدونة الصرفية الأكاديمية ووحدات السياق المعتمدة، يعاد إنتاجه بسكربتٍ معلنٍ في مستودع المشروع؛ والقراءات منقولةٌ بنصها منسوبةً إلى مصادرها — الحساب يصف، والمنقول يفسر، والقارئ يتدبر."
            : "Every number in the map is computed deterministically from the Quranic text and the academic morphology corpus, reproducible by a published script; the scholars' readings are quoted verbatim with attribution, and their English renderings are aided translations. The computation describes; the quotation explains; the reader reflects."}
        </p>
      </details>
    </div>
  );
}

/** لوحة جذرٍ في بطاقة آلية: عدّادات ومصاحبات ومواضع (بلا نص آية — الرابط للمصحف) */
function AutoSidePanel({ s }: { s: AutoSide }) {
  return (
    <details className="by-side">
      <summary>
        <b>{s.root}</b>
        <span className="chip">{num(s.total)} موضعًا</span>
        <span className="chip">مكي {num(s.makki)} · مدني {num(s.madani)}</span>
        <Link to={`/mujam/${s.root}`} className="chip" onClick={(e) => e.stopPropagation()}>المعجم</Link>
      </summary>
      {s.colloc.length > 0 && (
        <p className="by-colloc"><b>أعلى المصاحبات:</b> {s.colloc.map(([l, n]) => `${l} ${num(n)}`).join(" · ")}</p>
      )}
      <ul className="by-occ">
        {s.occ.map((o, i) => (
          <li key={i}>
            <Link to={readPathOf(o.loc)} className="by-ref">{arName(o.loc)}</Link>{" "}
            <span className="quran">{o.form}</span>
            <span className="by-unit">{o.unit ? ` — ${o.unit}` : ""}</span>
          </li>
        ))}
      </ul>
      {s.capped && <p className="by-intro">عُرضت الأوائل — البقية كاملة في المعجم.</p>}
    </details>
  );
}

function AutoCardPage({ card }: { card: AutoCard }) {
  return (
    <div>
      <p>
        <Link to="/bayan" className="chip">← البيان</Link>{" "}
        <span className="chip" title="ولّدها الحساب من الفهرس المسند — بلا تحرير بشري ولا تعليل آلي">بطاقة آلية التوليد</span>
        {card.group && card.group !== "متفرقات" && <span className="chip gold">{card.group}</span>}
      </p>
      <h2>{card.head}</h2>
      <p className="by-kashf">خريطتا الجذرين محسوبتان حتميًّا من المصحف، والنص المنقول من مدخل الكتاب — بلا تحريرٍ بشري: الحساب يصف، والمنقول يفسر، والقارئ يتدبر.</p>
      <h3>خريطة الاستعمال المحسوبة</h3>
      {card.sides.map((s) => <AutoSidePanel key={s.root} s={s} />)}
      {card.contrast && Object.values(card.contrast).some((v) => v.length) && (
        <details className="by-side">
          <summary><b>بصمة الافتراق</b></summary>
          {Object.entries(card.contrast).map(([k, v]) => v.length ? (
            <p key={k} className="by-colloc"><b>ينفرد {k}:</b> {v.map(([l, n]) => `${l} ${num(n)}`).join(" · ")}</p>
          ) : null)}
        </details>
      )}
      <h3>القراءة المنقولة</h3>
      <blockquote className="by-reading">
        <p>«{card.reading.quote}»</p>
        <footer>— {card.reading.src}</footer>
      </blockquote>
      <h3>أين طُرق هذا عند العلماء</h3>
      <TariqPanel roots={card.roots} locs={[...new Set(card.sides.flatMap((s) => s.occ.map((o) => o.loc)))]} />
    </div>
  );
}

/** نصٌّ طويل يُعرض على دفعات — كتب الأنواع فصولٌ كاملة، فلا تُصبّ دفعةً واحدة */
function LongText({ text }: { text: string }) {
  const STEP = 2600;
  const [shown, setShown] = useState(STEP);
  const cut = useMemo(() => {
    if (text.length <= shown) return text;
    const w = text.slice(0, shown);
    const stop = Math.max(w.lastIndexOf("."), w.lastIndexOf("؟"), w.lastIndexOf("!"));
    return stop > shown * 0.6 ? w.slice(0, stop + 1) : w;
  }, [text, shown]);
  return (
    <>
      <p className="by-lib-text">{cut}{cut.length < text.length ? "…" : ""}</p>
      {cut.length < text.length && (
        <p className="by-seg">
          <button className="chip" onClick={() => setShown((n) => n + STEP * 2)}>تابع القراءة</button>
          <span className="by-unit">عُرض {num(Math.round((cut.length / text.length) * 100))}٪ من المدخل</span>
        </p>
      )}
    </>
  );
}

/** مدخل المكتبة: الرأس والجذور والآيات المسندة، ثم النص المنقول (يُجلب كتابُه عند الفتح) */
function LibItem({ head, roots, src, entry, open, onOpen }:
  { head: string; roots: string[]; src: string; entry?: LibEntry; open?: boolean; onOpen?: () => void }) {
  return (
    <details className="by-lib-item" open={open} onToggle={(ev) => { if ((ev.target as HTMLDetailsElement).open) onOpen?.(); }}>
      <summary>
        <b>{head}</b>
        {roots.slice(0, 6).map((r) => (
          <Link key={r} to={`/mujam/${r}`} className="chip" title="خريطة الجذر في المعجم" onClick={(e) => e.stopPropagation()}>{r}</Link>
        ))}
        {src && <span className="by-unit">— {src}</span>}
      </summary>
      {entry?.aya && entry.aya.length > 0 && (
        <p className="by-seg">
          {entry.aya.slice(0, 12).map((a) => (
            <Link key={a} to={readPathOf(a)} className="chip link" title="اقرأ الموضع في المصحف">{arName(a)}</Link>
          ))}
        </p>
      )}
      {entry ? <LongText text={entry.text} /> : <p className="by-intro">…</p>}
    </details>
  );
}

/** مكتبة البيان: تسعة كتبٍ بثلاث عائلات، كلٌّ بباب دخوله؛ وبحثٌ عابر للكتب */
function BayanLib({ q, root, book, entry, onPick }:
  { q: string; root: string; book: string; entry: string; onPick: (b: string, r: string) => void }) {
  const ar = getUILang() === "ar";
  const [index, setIndex] = useState<LibBookMeta[] | null>(libIndexCache);
  const [hits, setHits] = useState<LibHit[] | null>(libHitsCache);
  const [letter, setLetter] = useState("");
  const [sura, setSura] = useState("");
  const [deep, setDeep] = useState(false);
  const [, force] = useState(0);
  const bookId = book;

  useEffect(() => {
    if (libIndexCache) return;
    fetch(`${import.meta.env.BASE_URL}bayan-lib.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then((d: { books: LibBookMeta[]; hits: LibHit[] }) => {
        libIndexCache = d.books; libHitsCache = d.hits ?? [];
        setIndex(d.books); setHits(libHitsCache);
      })
      .catch(() => setIndex(null));
  }, []);

  const load = (id: string) => {
    if (libBookCache.has(id)) return;
    libBookCache.set(id, []);   // حجزٌ يمنع الجلب مرتين
    fetch(`${import.meta.env.BASE_URL}bayan-lib-${id}.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then((d: { entries: LibEntry[] }) => { libBookCache.set(id, d.entries); force((n) => n + 1); })
      .catch(() => force((n) => n + 1));
  };
  useEffect(() => { if (bookId) load(bookId); setLetter(""); setSura(""); }, [bookId]);
  useEffect(() => { if (entry && bookId) load(bookId); }, [entry, bookId]);
  // البحث في المتون (اختياري): يجلب الكتب التسعة كاملةً
  useEffect(() => { if (deep && index) index.forEach((b) => load(b.id)); }, [deep, index]);
  useEffect(() => { setDeep(false); }, [q]);

  const firstTerm = (h: string) =>
    h.replace(/^و?الفرق بين\s+/, "").replace(/^بصيرة ف[ىي]\.*\s*/, "")
      .replace(/^\(?\s*\d+\s*[-–]\s*باب\s+/, "").replace(/^باب\s+/, "")
      .replace(/^ال/, "").replace(/\s+/g, " ").trim();

  const meta = (index ?? []).find((x) => x.id === bookId);
  const mode: LibMode = meta?.mode ?? "term";
  const loadedLen = libBookCache.get(bookId)?.length ?? -1;
  const totalLoaded = (index ?? []).reduce((n, b) => n + (libBookCache.get(b.id)?.length ?? 0), 0);
  const labelOf = (id: string) => (index ?? []).find((b) => b.id === id)?.label ?? id;
  const entryOf = (bid: string, eid: string) => (libBookCache.get(bid) ?? []).find((e) => e.id === eid);

  /** البحث والتصفية بالجذر يجريان على دليل الرؤوس الخفيف — والنص يُجلب عند فتح المدخل */
  const found = useMemo(() => {
    if (!hits) return [] as LibHit[];
    if (root) return hits.filter((h) => h.r.includes(root) && (!bookId || h.b === bookId));
    if (!q.trim()) return [];
    const shallow = hits.filter((h) => fuzzyMatch(q, h.h) || h.r.some((r) => fuzzyMatch(q, r)));
    if (!deep) return shallow;
    const seen = new Set(shallow.map((h) => h.b + h.i));
    const deepHits: LibHit[] = [];
    for (const b of index ?? []) {
      for (const e of libBookCache.get(b.id) ?? []) {
        if (!seen.has(b.id + e.id) && fuzzyMatch(q, e.text))
          deepHits.push({ b: b.id, i: e.id, h: e.head, r: e.roots });
      }
    }
    return [...shallow, ...deepHits];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, q, root, bookId, deep, totalLoaded]);

  const entries = useMemo(() => {
    let es = libBookCache.get(bookId) ?? [];
    if (mode === "term" && letter) es = es.filter((e) => firstTerm(e.head).startsWith(letter));
    else if (mode === "aya" && sura) es = es.filter((e) => e.sura === sura);
    else if (mode === "term" || mode === "aya") es = [];
    return es;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, letter, sura, mode, loadedLen]);

  const letters = useMemo(() => {
    if (mode !== "term") return [];
    const c = new Map<string, number>();
    for (const e of libBookCache.get(bookId) ?? []) {
      const l = firstTerm(e.head).charAt(0);
      if (l) c.set(l, (c.get(l) ?? 0) + 1);
    }
    const ORDER = "ءأإآابتثجحخدذرزسشصضطظعغفقكلمنهوي";
    return [...c.entries()].sort((a, b2) => ORDER.indexOf(a[0]) - ORDER.indexOf(b2[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, mode, loadedLen]);

  const suras = useMemo(() => {
    if (mode !== "aya") return [];
    const c = new Map<string, number>();
    for (const e of libBookCache.get(bookId) ?? []) if (e.sura) c.set(e.sura, (c.get(e.sura) ?? 0) + 1);
    return [...c.entries()];   // ترتيب ورودها في الكتاب = ترتيب المصحف
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, mode, loadedLen]);

  const shown = entries.slice(0, 120);
  const foundShown = found.slice(0, 120);
  const single = entry ? (libBookCache.get(bookId) ?? []).find((e) => e.id === entry) : undefined;
  const browsing = !q.trim() && !root && !entry;
  return (
    <section>
      <p className="by-intro">
        {ar
          ? "تسعةُ كتبٍ من كتب البيان وعلوم القرآن، مهيكلةً مدخلًا مدخلًا: النصُّ منقولٌ منسوبٌ بنصه، والجذورُ مسندةٌ إلى جذور المصحف، والآياتُ موصولةٌ بمواضعها — اختر الكتاب، أو ابحث في الكتب كلها."
          : "Nine structured books; attributed text, anchored roots and verses. Pick a book or search across all."}
      </p>

      {browsing && !bookId && (["term", "aya", "naw"] as LibMode[]).map((m) => {
        const books = (index ?? []).filter((b) => b.mode === m);
        if (!books.length) return null;
        return (
          <div key={m}>
            <h4 className="by-group">{FAMILY[m]}</h4>
            <div className="by-grid">
              {books.map((b) => {
                const [title, author] = b.label.split("—").map((x) => x.trim());
                return (
                  <button key={b.id} className="fr-card by-tile by-book" onClick={() => onPick(b.id, "")}>
                    <b>{title}</b>
                    <span className="by-tile-kashf">{author}</span>
                    <span className="chip">{num(b.count)} مدخلًا</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {browsing && bookId && (
        <>
          <p className="by-seg">
            <button className="chip" onClick={() => onPick("", "")}>← {ar ? "كل الكتب" : "all books"}</button>
            <b>{meta?.label}</b>
          </p>
          {mode === "term" && (
            <p className="by-letters">
              {letters.map(([l, n]) => (
                <button key={l} className={"chip" + (letter === l ? " gold" : "")}
                  title={num(n)} onClick={() => setLetter(letter === l ? "" : l)}>{l}</button>
              ))}
            </p>
          )}
          {mode === "aya" && (
            <p className="by-letters">
              {suras.map(([s, n]) => (
                <button key={s} className={"chip" + (sura === s ? " gold" : "")}
                  onClick={() => setSura(sura === s ? "" : s)}>{s} <b>{num(n)}</b></button>
              ))}
            </p>
          )}
          {!libBookCache.has(bookId) && <p>…</p>}
          {libBookCache.has(bookId) && mode === "term" && !letter && (
            <p className="by-intro">{ar ? "اختر حرفًا من الفهرس، أو اكتب في البحث أعلى الصفحة." : "Pick a letter or search above."}</p>
          )}
          {libBookCache.has(bookId) && mode === "aya" && !sura && (
            <p className="by-intro">{ar ? "اختر سورةً من الفهرس أعلاه — الكتاب يسير على ترتيب المصحف." : "Pick a sura above."}</p>
          )}
        </>
      )}

      {root && (
        <p className="by-seg">
          <button className="chip" onClick={() => onPick("", "")}>← {ar ? "كل الكتب" : "all books"}</button>
          <span className="chip gold">الجذر {root}</span>
          <span className="by-unit">{num(found.length)} مدخلًا مطروقًا في متوننا</span>
        </p>
      )}

      {/* التصفح داخل كتابٍ مفتوح — المدخلات كاملةً بنصوصها (والكتاب معلومٌ فلا يُعاد اسمه) */}
      {browsing && shown.map((e) => (
        <LibItem key={e.id} head={e.head} roots={e.roots} src="" entry={e} open={shown.length <= 3} />
      ))}
      {browsing && entries.length > shown.length && (
        <p className="by-intro">{ar ? `و${num(entries.length - shown.length)} مدخلًا آخر — ضيّق باختيارٍ آخر.` : "narrow your selection"}</p>
      )}

      {/* مدخلٌ بعينه (رابطٌ مباشر من بطاقةٍ أو من مشاركة) */}
      {entry && (
        <>
          <p className="by-seg">
            <button className="chip" onClick={() => onPick("", "")}>← {ar ? "كل الكتب" : "all books"}</button>
            <b>{meta?.label}</b>
          </p>
          {single
            ? <LibItem head={single.head} roots={single.roots} src="" entry={single} open />
            : <p className="by-intro">…</p>}
        </>
      )}

      {/* البحث/الجذر — من دليل الرؤوس، ونصُّ المدخل يُجلب عند فتحه */}
      {!browsing && !entry && (
        <>
          {q.trim() !== "" && (
            <p className="by-seg">
              <span className="by-unit">{num(foundShown.length)} من {num(found.length)} مدخلًا مطابقًا</span>
              {!deep && (
                <button className="chip link" onClick={() => setDeep(true)}>
                  {ar ? "ابحث في نصوص الكتب أيضًا" : "search full texts"}
                </button>
              )}
              {deep && <span className="chip">شمل البحثُ نصوصَ الكتب</span>}
            </p>
          )}
          {foundShown.map((h) => (
            <LibItem key={h.b + h.i} head={h.h} roots={h.r} src={labelOf(h.b)}
              entry={entryOf(h.b, h.i)} onOpen={() => load(h.b)} />
          ))}
          {found.length > foundShown.length && (
            <p className="by-intro">{ar ? `و${num(found.length - foundShown.length)} مدخلًا آخر — ضيّق البحث.` : "narrow your search for more"}</p>
          )}
          {!found.length && <p className="by-intro">{ar ? "لا مدخل مطابقًا في الكتب التسعة." : "no match"}</p>}
        </>
      )}
    </section>
  );
}

/** طرفا البطاقة باسمَيهما وعددَيهما — «خوف ٤٨ ↔ خشية ١٢٤».
 *  كان العرضُ أرقامًا متجاورةً بلا أسماء («٤٨ · ١٢٤ موضعًا») فلا يُقرأ. */
function SidesBar({ sides }: { sides: { name: string; total: number }[] }) {
  const max = Math.max(1, ...sides.map((s) => s.total));
  return (
    <span className="by-sides">
      {sides.slice(0, 3).map((s, i) => (
        <span className="by-sd" key={i} title={`${s.name}: ${num(s.total)} موضعًا`}>
          <span className="by-sd-n">{s.name}</span>
          <span className="by-sd-v">{num(s.total)}</span>
          <span className="by-sd-bar"><i style={{ width: `${Math.round((s.total / max) * 100)}%` }} /></span>
        </span>
      ))}
    </span>
  );
}

export default function Bayan() {
  useUILang();
  const ar = getUILang() === "ar";
  const data = useBayan();
  const [, forceEn] = useState(0);
  useEffect(() => { if (!ar) loadBayanEn().then(() => forceEn((n) => n + 1)); }, [ar]);
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const root = params.get("root") ?? "";
  const book = params.get("book") ?? "";
  const entry = params.get("entry") ?? "";
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<"cards" | "lib">(root || book || entry ? "lib" : "cards");
  const [group, setGroup] = useState("");
  const [, forceAuto] = useState(0);
  useEffect(() => {
    if (seg === "cards" || (id && id.startsWith("auto-"))) loadAuto(() => forceAuto((n) => n + 1));
  }, [seg, id]);
  useEffect(() => { if (root || book || entry) setSeg("lib"); }, [root, book, entry]);

  const pickBook = (b: string, r: string) => {
    const p = new URLSearchParams();
    if (r) p.set("root", r);
    if (b) p.set("book", b);
    setParams(p, { replace: true });
  };

  const cardHits = useMemo(() => {
    if (!data) return [];
    if (!q.trim()) return data.cards;
    // «سؤالُ اللفظ»: كلمتان متقاربتان تجدان بطاقتَهما ولو اختلف ترتيبُهما —
    // كلُّ كلمةٍ من السؤال يجب أن تصيب البطاقةَ في عنوانها أو كشفها أو طرفيها
    const toks = q.trim().split(/\s+/).filter(Boolean);
    const hitCard = (c: Card, t: string) =>
      fuzzyMatch(t, c.title) || fuzzyMatch(t, c.kashf) || c.sides.some((sd) => fuzzyMatch(t, sd.name));
    return data.cards.filter((c) => toks.every((t) => hitCard(c, t)));
  }, [data, q]);

  if (!data) return <div className="page"><p style={{ padding: 40, textAlign: "center" }}>…</p></div>;

  const card = id ? data.cards.find((c) => c.id === id) : undefined;
  if (id && card) {
    return <div className="page" dir={getUILang() === "ar" ? "rtl" : "ltr"}><div className="bayan-page"><CardPage card={card} types={data.types} /></div></div>;
  }
  if (id && id.startsWith("auto-")) {
    const ac = autoCache?.find((c) => c.id === id);
    return (
      <div className="page" dir={getUILang() === "ar" ? "rtl" : "ltr"}><div className="bayan-page">
        {ac ? <AutoCardPage card={ac} /> : <p style={{ padding: 40, textAlign: "center" }}>…</p>}
      </div></div>
    );
  }

  const order = ["farq", "sigha", "mushtarak", "istimal"];
  const searching = q.trim() !== "";
  const showCards = (seg === "cards" || searching) && !root && !entry;

  // زمر البطاقات الآلية: الحقول الدلالية المحسوبة (lexnet) — الكبيرة أقسامًا مسماة والباقي «متفرقات»
  const autoGroups = (() => {
    if (!autoCache) return [] as [string, number][];
    const c = new Map<string, number>();
    for (const a of autoCache) {
      const g = a.group && a.group !== "متفرقات" ? a.group : "متفرقات";
      c.set(g, (c.get(g) ?? 0) + 1);
    }
    const big = [...c.entries()].filter(([g, n]) => g !== "متفرقات" && n >= 4).sort((x, y) => y[1] - x[1]);
    const misc = [...c.entries()].filter(([g, n]) => g === "متفرقات" || n < 4).reduce((n, [, v]) => n + v, 0);
    return misc ? [...big, ["متفرقات", misc] as [string, number]] : big;
  })();

  return (
    <div className="page" dir={getUILang() === "ar" ? "rtl" : "ltr"}>
    <div className="bayan-page">
      <h2>{ar ? "البيان — لماذا هذه الكلمةُ لا أختُها؟" : "Bayān — why this word, not its sister?"}</h2>
      <p className="by-intro">
        {ar
          ? "لكل كلمةٍ في التنزيل موضعُها: لِمَ ﴿خشية﴾ هنا و﴿خوف﴾ هناك؟ اكتب كلمتين متقاربتين في البحث — أو افتح بطاقةً — فترى أين وردت كلٌّ منهما وبأيِّ صيغةٍ ومع أيِّ ألفاظٍ وأين افترقتا، محسوبًا من المصحف كلِّه؛ ثم ما قاله أعلامُ اللغة منقولًا منسوبًا، ثم مظانَّها من كتب البيان التسعة."
          : "Why this word and not its sister? Type two close words — computed usage maps, attributed classical readings, and a nine-book structured library."}
      </p>
      {!searching && !root && !entry && seg === "cards" && data.cards.length > 0 && (() => {
        // بطاقةُ اليوم من المحرَّرة — مدخلٌ واحدٌ مقروء بدل جدارِ عناوين.
        // تُنتقى ذاتُ الطرفين فصاعدًا: المقارنةُ هي فائدةُ البطاقة، والمفردةُ لا تصلح صدرًا.
        const pool = data.cards.filter((x) => x.sides.length >= 2 && x.kashf);
        const list = pool.length ? pool : data.cards;
        const day = Math.floor(Date.now() / 864e5);
        const c = list[day % list.length];
        return (
          <Link to={`/bayan/${c.id}`} className="by-hero">
            <span className="by-hero-eyebrow">{ar ? `بطاقةٌ من البيان · ${data.types[c.type] ?? ""}` : `A card from Bayān · ${bayanTypeEn(c.type) ?? ""}`}</span>
            <b className="by-hero-title">{ar ? c.title : (bayanCardEn(c.id)?.title ?? c.title)}</b>
            <span className="by-hero-kashf">{ar ? c.kashf : (bayanCardEn(c.id)?.kashf ?? c.kashf)}</span>
            <SidesBar sides={c.sides} />
            <span className="by-hero-go">{ar ? "افتحِ البطاقة — خريطةُ الاستعمال وقراءاتُ الأعلام ←" : "open the card ←"}</span>
          </Link>
        );
      })()}
      <PageSearch value={q} onChange={setQ} placeholder={ar ? "اكتب كلمتين متقاربتين: خوف خشية · بخل شح — أو كلمةً أو جذرًا…" : "two close words: e.g. khawf khashya…"} />
      {!searching && ar && (
        <p className="by-tabs">
          <button className={"by-tab" + (seg === "cards" && !root && !entry ? " on" : "")}
            onClick={() => { setSeg("cards"); if (root || book || entry) pickBook("", ""); }}>
            {ar ? "البطاقات" : "Cards"} ({autoCache ? num(data.cards.length + autoCache.length) : num(data.cards.length) + "+"})
          </button>
          <button className={"by-tab" + (seg === "lib" || root || entry ? " on" : "")} onClick={() => setSeg("lib")}>
            {ar ? "المكتبة — تسعة كتب" : "Library — nine books"}
          </button>
        </p>
      )}

      {showCards && order.map((ty) => {
        const cards = cardHits.filter((c) => c.type === ty);
        if (!cards.length) return null;
        return (
          <section key={ty}>
            <h3>{ar ? data.types[ty] : (bayanTypeEn(ty) ?? data.types[ty])}</h3>
            <div className="by-grid">
              {cards.map((c) => (
                <Link key={c.id} to={`/bayan/${c.id}`} className="fr-card by-tile by-tile-ed">
                  <b>{ar ? c.title : (bayanCardEn(c.id)?.title ?? c.title)}</b>
                  <span className="by-tile-kashf">{ar ? c.kashf : (bayanCardEn(c.id)?.kashf ?? c.kashf)}</span>
                  <SidesBar sides={c.sides} />
                  <span className="by-grade g" title="بطاقةٌ محرَّرةٌ بمراجعة">محرَّرة</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {showCards && ar && autoCache && (() => {
        const hits = searching
          ? autoCache.filter((c) => fuzzyMatch(q, c.head) || c.roots.some((r) => fuzzyMatch(q, r)))
          : group
            ? autoCache.filter((c) => (group === "متفرقات"
                ? !c.group || c.group === "متفرقات" || (autoGroups.find(([g]) => g === c.group)?.[1] ?? 0) < 4
                : c.group === group))
            : autoCache;
        if (!hits.length) return null;
        const lim = hits.slice(0, searching ? 60 : group ? 400 : 90);
        const tile = (c: AutoCard) => (
          <Link key={c.id} to={`/bayan/${c.id}`} className="fr-card by-tile">
            <b>{c.head}</b>
            <SidesBar sides={c.sides.map((s) => ({ name: s.root, total: s.total }))} />
            <span className="by-grade" title="ولّدها الحساب: الخريطةُ حتميّةٌ والنصُّ منقول، بلا تحريرٍ ولا تعليل">مولَّدة</span>
          </Link>
        );
        return (
          <section>
            <h3>
              {ar ? "البطاقات الآلية" : "Generated cards"}{" "}
              <span className="chip" title="ولّدها الحساب من فهرس الفروق المسند — الخريطة حتمية والنص منقول، بلا تحرير بشري">{num(hits.length)}</span>
            </h3>
            {!searching && (
              <>
                <p className="by-intro">
                  {ar ? "مصنّفةٌ بالحقول الدلالية المحسوبة — اختر حقلًا لتقرأ بطاقاته." : "grouped by computed semantic fields"}
                </p>
                <p className="by-letters">
                  <button className={"chip" + (group === "" ? " gold" : "")} onClick={() => setGroup("")}>الكل <b>{num(autoCache.length)}</b></button>
                  {autoGroups.map(([g, n]) => (
                    <button key={g} className={"chip" + (group === g ? " gold" : "")} onClick={() => setGroup(group === g ? "" : g)}>
                      {g} <b>{num(n)}</b>
                    </button>
                  ))}
                </p>
              </>
            )}
            <div className="by-grid">{lim.map(tile)}</div>
            {lim.length < hits.length && (
              <p className="by-intro">
                {ar ? `عُرضت ${num(lim.length)} من ${num(hits.length)} — اختر حقلًا دلاليًّا أعلاه أو ابحث لتصل إلى بقيتها.` : "pick a field or search for more"}
              </p>
            )}
          </section>
        );
      })()}

      {ar && (seg === "lib" || searching || root || entry) && (
        <>
          <h3>مكتبة البيان</h3>
          <BayanLib q={q} root={root} book={book} entry={entry} onPick={pickBook} />
        </>
      )}
    </div>
    </div>
  );
}

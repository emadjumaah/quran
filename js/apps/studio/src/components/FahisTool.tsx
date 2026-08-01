/**
 * «افحص فكرة» — قلبُ قسم فاحص: يكتب الزائرُ فكرتَه فيُجاب **بحسابٍ على المصحف**
 * لا برأي. بلا ذكاءٍ اصطناعيّ في هذا المسار: كلُّ رقمٍ هنا يُعاد فيُطابق.
 *
 * والفرقُ الذي يبرّر وجودَ الأداة: أن يُسأل نموذجٌ لغويٌّ فيُجيب بكلامٍ معقولٍ
 * أمرٌ متاحٌ للجميع. أمّا أن يُقال في نقرةٍ «لفظُك ورد ٤٣ مرّةً، وهذه مواضعُها،
 * ويشاركه في هذا العدد ١٢٧ لفظًا آخرَ فلا دلالةَ في العدد» — فهذا ما لا يُتاح
 * إلا لمن يملك النصَّ موسومًا.
 *
 * ثلاثةُ قوالبَ في هذه الدفعة: **العدد** و**الكلّيّة** — وهما محسوبان تمامًا —
 * و**الإعراب**، وهو جلبٌ بالمرساة: لا يُعطي قولًا واحدًا بل يضع أهلَ الصنعة
 * متجاورين بالأقدميّة، فإن اختلفوا رأى القارئُ الخلافَ وحكم عليه.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allAyahs, fuzzyRoots, listWords, wordsByLemma, wordsByRoot, wordsByText } from "../db";
import { normalizeAr } from "../lib/arabicSearch";
import { type RefHit, refsForAyah, refsForRoot } from "../lib/refs";
import { type Card, examineOpen } from "../lib/fahisOpen";
import { num } from "../i18n";
import type { AyahDoc } from "../types";

type Qalab = "adad" | "kulliya" | "iraab" | "dalala" | "open";

/** تعبئةٌ مسبقةٌ من أزرار «أعِد الفحصَ بنفسك» في البطاقات — فالحسابُ يُعاد أمام القارئ فيُطابق */
export interface FahisToolInitial {
  qalab?: Qalab;
  word?: string;
  loc?: string;
  claimed?: string;
  autorun?: boolean;
}

/** نصُّ الآيات مطبَّعًا ومحاطًا بفراغٍ — ليُطابَق المتّصلُ متّصلًا لا مبعثرًا */
interface Corpus {
  rows: { loc: string; n: string; t: string }[];
  /** لفظٌ مطبَّع → كم مرّةً ورد في المصحف (لحساب معدّل الصدفة) */
  freq: Map<string, number>;
}

let corpusPromise: Promise<Corpus> | null = null;
function loadCorpus(): Promise<Corpus> {
  corpusPromise ??= allAyahs().then((ayahs: AyahDoc[]) => {
    const rows = ayahs.map((a) => ({ loc: a.location, n: ` ${normalizeAr(a.textClean || a.textUthmani)} `, t: a.textClean }));
    const freq = new Map<string, number>();
    for (const r of rows) for (const w of r.n.trim().split(" ")) if (w) freq.set(w, (freq.get(w) ?? 0) + 1);
    return { rows, freq };
  });
  return corpusPromise;
}

/**
 * العدُّ **بصيغ اللفظ لا برسمه** (رصده المالك 2026-07-31).
 *
 * كان القالبُ يعدّ الرسمَ المكتوبَ وحدَه، فمن سأل عن «شهر» أُجيب بأربعةٍ —
 * وهي مواضعُ الرسم المجرّد لا مواضعُ اللفظ. واللفظُ في المصحف يجري بصيغه:
 * شهر · شهرًا · الشهر · والشهر · بالشهر · شهرين · أشهر · الأشهر · الشهور.
 * فالعدُّ الصحيح على **الجذع** (اللفظ بصيغه) لا على الحروف المكتوبة.
 *
 * ويُعرض **جدولُ الصيغ** بأعدادها، فيرى السائلُ ما عُدّ بعينه ويحكم: أهذه
 * الصيغُ من دعواه أم بعضُها؟ فلا يُخفى وراء رقمٍ واحدٍ ما يُختلف فيه.
 */
interface Morph {
  lemma: string | null;
  /** الصيغُ مصنَّفةً بعددها الصرفيّ — فالدعوى غالبًا في المفرد وحدَه */
  groups: { key: "S" | "D" | "P"; label: string; total: number; forms: { form: string; n: number }[] }[];
  singular: number;
  total: number;
  ayat: number;
}

async function morphCount(raw: string): Promise<Morph | null> {
  const q = normalizeAr(raw).trim();
  if (!q || q.includes(" ")) return null; // العدُّ الصرفيُّ للفظٍ مفردٍ لا لعبارة
  const seed = await wordsByText(q).catch(() => []);
  const lemma = seed.find((w) => w.lemma)?.lemma ?? null;
  const all = lemma ? await wordsByLemma(lemma, 4000).catch(() => []) : seed;
  if (!all.length) return null;
  // وسمُ الصرف يترك المفردَ بلا علامة، ويعلّم المثنّى بـD والجمعَ بـP
  const buckets: Record<"S" | "D" | "P", Map<string, number>> = { S: new Map(), D: new Map(), P: new Map() };
  const ayat = new Set<string>();
  for (const w of all) {
    const n = w.segments?.find((g) => g.role === "stem")?.number;
    const k: "S" | "D" | "P" = n === "D" ? "D" : n === "P" ? "P" : "S";
    buckets[k].set(w.textClean, (buckets[k].get(w.textClean) ?? 0) + 1);
    ayat.add(`${w.surahNo}:${w.ayahNo}`);
  }
  const LABEL = { S: "المفرد", D: "المثنّى", P: "الجمع" } as const;
  const groups = (["S", "D", "P"] as const)
    .map((key) => ({
      key,
      label: LABEL[key],
      total: [...buckets[key].values()].reduce((a, b) => a + b, 0),
      forms: [...buckets[key].entries()].map(([form, n]) => ({ form, n })).sort((a, b) => b.n - a.n),
    }))
    .filter((g) => g.total > 0);
  return {
    lemma,
    groups,
    singular: groups.find((g) => g.key === "S")?.total ?? 0,
    total: all.length,
    ayat: ayat.size,
  };
}

/** توزيعُ أعداد الجذوع في المصحف — لمعدّل الصدفة على أساسٍ صرفيٍّ لا رسميّ */
let lemmaFreqP: Promise<number[]> | null = null;
function lemmaFreq(): Promise<number[]> {
  lemmaFreqP ??= (async () => {
    const counts = new Map<string, number>();
    for (let s = 1; s <= 114; s++) {
      for (const w of await listWords(s).catch(() => [])) {
        if (w.lemma) counts.set(w.lemma, (counts.get(w.lemma) ?? 0) + 1);
      }
    }
    return [...counts.values()];
  })();
  return lemmaFreqP;
}

/** السوابقُ التي تلتصق بأوّل الكلمة فلا تُعدّ لفظًا آخر */
const PREFIX = "(?:[وف]?(?:ب|ك|ل|ال|بال|كال|لل)?)";

interface Hit { loc: string; t: string; n: number }
interface Result {
  phrase: string;
  bare: { hits: Hit[]; total: number };
  withPrefix: { hits: Hit[]; total: number };
  /** كم لفظًا آخرَ في المصحف يرد بالعدد نفسِه — معدّلُ الصدفة */
  sameCount: number | null;
  distinctWords: number;
}

function examine(corpus: Corpus, raw: string): Result | null {
  const q = normalizeAr(raw).trim();
  if (!q) return null;
  const words = q.split(" ").filter(Boolean);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bareRe = new RegExp(` ${words.map(esc).join(" ")} `, "g");
  const preRe = new RegExp(` ${PREFIX}${esc(words[0])}${words.slice(1).map((w) => ` ${esc(w)}`).join("")} `, "g");

  const count = (re: RegExp) => {
    const hits: Hit[] = [];
    let total = 0;
    for (const r of corpus.rows) {
      re.lastIndex = 0;
      const m = r.n.match(re);
      if (!m?.length) continue;
      hits.push({ loc: r.loc, t: r.t, n: m.length });
      total += m.length;
    }
    return { hits, total };
  };

  const bare = count(bareRe);
  const withPrefix = count(preRe);

  // معدّلُ الصدفة يُحسب للّفظ المفرد وحدَه — فالعبارةُ المركّبة لا نظيرَ لها يُعدّ
  let sameCount: number | null = null;
  if (words.length === 1 && bare.total > 0) {
    sameCount = 0;
    for (const c of corpus.freq.values()) if (c === bare.total) sameCount++;
    sameCount = Math.max(0, sameCount - 1); // لا يُعدّ اللفظُ نفسُه
  }
  return { phrase: q, bare, withPrefix, sameCount, distinctWords: corpus.freq.size };
}

/**
 * لوحُ الإعراب — الأربعةُ متجاورين ومعهم طبقةُ المعاني، مرتَّبين بالأقدميّة.
 * والمقصودُ إظهارُ **خلافهم** لا إخفاؤه: أوّلُ بطاقةٍ عندنا تبيّنت به، إذ خالف
 * الزجّاجُ (ت٣١١) مكّيًّا والعكبريَّ في ٦:٢٠ فلم يستقم الإطلاق.
 */
function IraabPanel({ loc }: { loc: string }) {
  const [hits, setHits] = useState<RefHit[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setHits(null);
    refsForAyah(loc, { ranks: [1, 3, 5] }).then((h) => { setHits(h); setOpen(h[0]?.book.id ?? null); });
  }, [loc]);

  if (!hits) return <p className="hint">…</p>;
  if (!hits.length) return <p className="hint">لا مدخلَ لهذا الموضع عند المراجع المرساةِ بالآية. وهذا يقع: التغطيةُ ٩٠٪ لا ١٠٠٪، والنقصُ يُعلن ولا يُستر.</p>;

  return (
    <div className="iraab">
      <p className="hint" style={{ margin: "0 0 10px" }}>
        {num(hits.length)} مرجعًا لهذا الموضع، بالأقدميّة. وإذا اختلفوا فالخلافُ
        نفسُه هو المقصود — يُعرض ولا يُكتم.
      </p>
      {hits.map((h) => (
        <div className="bk-open" key={h.book.id}>
          <button onClick={() => setOpen(open === h.book.id ? null : h.book.id)}>
            <span className="nm">{h.book.label}</span>
            <span className="au">{h.book.author}{h.book.died ? ` (ت ${num(h.book.died)})` : ""}</span>
            <span className="rk">الرتبة {num(h.book.rank)}</span>
          </button>
          {open === h.book.id && (
            <div className="body">{h.texts.map((t, i) => <p key={i}>{t}</p>)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * لوحُ الدلالة — أثقلُ القوالب وأنفعُها. القولُ «هذا اللفظ يعني كذا» لا يُحسم
 * بمعجمٍ وحدَه ولا برأي، بل بثلاثةٍ مجتمعة:
 *   ١) **الاستقراءُ التامّ**: كلُّ ما في المصحف من مادّة اللفظ — لأنّ المسألةَ
 *      الدلاليّةَ تُفحص على كلِّ المواضع لا على ما وافقها (الميثاق §ج٢).
 *   ٢) **المعاجم** (الرتبة ٢): ما وضعته العربُ للمادّة، والأقدمُ مقدَّم.
 *   ٣) **معاني القرآن** (الرتبة ٣): وهي أقدمُ من التفسير المدوَّن، فتحسم دعوى
 *      «التراثُ أقحم معنًى».
 * والآلةُ تعرض هذه الثلاثةَ ثمّ **تسأل ولا تحكم**: أيستقيم معناك في هذه كلِّها؟
 * فالحكمُ الدلاليُّ هو الموضعُ الوحيدُ الذي يلزم فيه فهمٌ، ولا نتقمّصه بحساب.
 */
function DalalaPanel({ word }: { word: string }) {
  const [root, setRoot] = useState<string | null>(null);
  const [occ, setOcc] = useState<{ loc: string; t: string }[] | null>(null);
  const [lex, setLex] = useState<RefHit[]>([]);
  const [maani, setMaani] = useState<RefHit[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setRoot(null); setOcc(null); setLex([]); setMaani([]);
    (async () => {
      // المادّةُ تُلتمس من أقرب الجذور رسمًا إلى اللفظ المكتوب
      const rs = await fuzzyRoots(word, 1);
      const r = rs[0]?.doc?.root ?? null;
      if (!live) return;
      setRoot(r);
      if (!r) { setOcc([]); return; }
      const ws = await wordsByRoot(r, 3000);
      if (!live) return;
      setOcc(ws.map((w) => ({ loc: `${w.surahNo}:${w.ayahNo}`, t: w.textClean })));
      refsForRoot(r).then((h) => live && setLex(h));
      // معاني القرآن تُجلب لأوّل موضعٍ من المادّة — شاهدًا على استعمالها
      const first = ws[0];
      if (first) refsForAyah(`${first.surahNo}:${first.ayahNo}`, { ranks: [3] }).then((h) => live && setMaani(h));
    })();
    return () => { live = false; };
  }, [word]);

  if (occ === null) return <p className="hint">…</p>;
  if (!root) return <p className="hint">لم تُعرف مادّةُ هذا اللفظ. جرّب صيغةً مجرّدةً منه.</p>;

  const byAyah = new Map<string, string[]>();
  for (const o of occ) { const a = byAyah.get(o.loc) ?? []; a.push(o.t); byAyah.set(o.loc, a); }
  const forms = [...new Set(occ.map((o) => o.t))];

  return (
    <div className="iraab">
      <div className="nums" style={{ marginBottom: 12 }}>
        <div><b>{root}</b><span>المادّة</span></div>
        <div><b>{num(occ.length)}</b><span>موضعًا في المصحف</span></div>
        <div><b>{num(byAyah.size)}</b><span>آيةً</span></div>
        <div><b>{num(forms.length)}</b><span>صيغةً مشتقّة</span></div>
      </div>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        المسألةُ الدلاليّةُ تُفحص على <b>كلِّ</b> هذه المواضع لا على ما وافقها —
        فإن لم يستقم معناك في موضعٍ واحدٍ منها لزمه قيدٌ أو تعذّر إطلاقُه. والنظرُ
        لك: نعرض المادّةَ ولا نقضي عنك.
      </p>
      <div className="locs" style={{ marginBottom: 14 }}>
        {forms.slice(0, 40).map((f) => <span key={f} style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "2px 8px", fontSize: ".9rem" }}>{f}</span>)}
      </div>
      {[...lex, ...maani].map((h) => (
        <div className="bk-open" key={h.book.id}>
          <button onClick={() => setOpen(open === h.book.id ? null : h.book.id)}>
            <span className="nm">{h.book.label}</span>
            <span className="au">{h.book.author}{h.book.died ? ` (ت ${num(h.book.died)})` : ""}</span>
            <span className="rk">الرتبة {num(h.book.rank)}</span>
          </button>
          {open === h.book.id && <div className="body">{h.texts.map((t, i) => <p key={i}>{t}</p>)}</div>}
        </div>
      ))}
      <div className="sample" style={{ marginTop: 8 }}>
        {[...byAyah.entries()].slice(0, 6).map(([l]) => (
          <div key={l}><Link to={`/aya/${l.replace(":", "/")}`} style={{ opacity: .7, fontSize: ".84rem" }}>{l}</Link></div>
        ))}
      </div>
    </div>
  );
}

export default function FahisTool({ initial }: { initial?: FahisToolInitial }) {
  const [qalab, setQalab] = useState<Qalab>(initial?.qalab ?? "adad");
  const [word, setWord] = useState(initial?.word ?? "");
  const [loc, setLoc] = useState(initial?.loc ?? "");
  const [claimed, setClaimed] = useState(initial?.claimed ?? "");
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [ran, setRan] = useState<string | null>(
    initial?.autorun && initial.word && initial.qalab !== "iraab" ? initial.word.trim() : null,
  );
  const [morph, setMorph] = useState<Morph | null | undefined>(undefined);
  const [prose, setProse] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [same, setSame] = useState<number | null>(null);

  useEffect(() => { loadCorpus().then(setCorpus).catch(() => {}); }, []);

  // العدُّ الصرفيُّ يُشغَّل مع كلِّ فحصٍ في قالبَي العدد والكلّيّة
  useEffect(() => {
    if (!ran || (qalab !== "adad" && qalab !== "kulliya")) { setMorph(undefined); setSame(null); return; }
    let live = true;
    setMorph(undefined); setSame(null);
    morphCount(ran).then(async (m) => {
      if (!live) return;
      setMorph(m);
      if (m) {
        const f = await lemmaFreq();
        if (live) setSame(Math.max(0, f.filter((c) => c === m.total).length - 1));
      }
    });
    return () => { live = false; };
  }, [ran, qalab]);
  const res = useMemo(() => (corpus && ran ? examine(corpus, ran) : null), [corpus, ran]);

  const run = () => setRan(word.trim());
  const n = Number(claimed.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const claimN = Number.isFinite(n) && claimed.trim() ? n : null;

  /** النتيجةُ تُشتقّ من الحساب لا تُكتب: وهذا شرطُ أن يكون فاحصًا لا رأيًا */
  let verdict: { k: "تستقيم" | "تحتاج تقييدًا" | "لا تستقيم"; why: string } | null = null;
  if (res) {
    if (qalab === "adad" && claimN !== null) {
      // العبرةُ بعدد **صيغ اللفظ** لا برسمه — وإليه يُنسب الحكم
      const m = morph?.total ?? null;
      const sg = morph?.singular ?? null;
      if (sg !== null && sg === claimN) verdict = { k: "تستقيم", why: `المفردُ بصيغه كلِّها ${num(sg)} — مطابقٌ لما ذُكر. (والمجموعُ مع المثنّى والجمع ${num(m ?? 0)}.)` };
      else if (m !== null && m === claimN) verdict = { k: "تستقيم", why: `اللفظُ بصيغه كلِّها — مفردًا ومثنًّى وجمعًا — ${num(m)}، مطابقٌ لما ذُكر.` };
      else if (res.bare.total === claimN) verdict = { k: "تحتاج تقييدًا", why: `الرسمُ المجرّدُ وحدَه ${num(res.bare.total)} — مطابقٌ لما ذُكر، لكنّ اللفظ بصيغه كلِّها ${m !== null ? num(m) : "أكثر"}. فالمقصودُ رسمٌ لا لفظ، ويلزم التصريحُ به.` };
      else if (res.withPrefix.total === claimN) verdict = { k: "تحتاج تقييدًا", why: `العددُ يصحّ بالرسم وسوابقِه (${num(res.withPrefix.total)})، واللفظُ بصيغه كلِّها ${m !== null ? num(m) : "أكثر"}.` };
      else verdict = { k: "لا تستقيم", why: `المفردُ ${sg !== null ? num(sg) : "—"}، والمجموعُ بالمثنّى والجمع ${m !== null ? num(m) : "—"}، وبالرسم المجرّد ${num(res.bare.total)} — ولا يوافق ${num(claimN)} واحدٌ منها.` };
    } else if (qalab === "kulliya") {
      verdict = res.withPrefix.total === 0
        ? { k: "تستقيم", why: morph ? `لم يرد رسمُ اللفظ، لكنّ له في المصحف ${num(morph.total)} موضعًا بصيغٍ أخرى — فانظر جدولَ الصيغ قبل الحكم.` : "لم يرد هذا اللفظُ في المصحف في أيِّ موضعٍ — والقولُ السالبُ يستقيم بهذا، ما لم يكن للّفظ رسمٌ آخر." }
        : { k: "لا تستقيم", why: `ورد في ${num(res.withPrefix.hits.length)} آيةً — ويكفي في تقييد الكلّيّة موضعٌ واحد، وأوّلُه ${res.withPrefix.hits[0].loc}.` };
    }
  }

  const shown = qalab === "kulliya" ? res?.withPrefix : res?.bare;
  const computed = qalab === "adad" || qalab === "kulliya";

  return (
    <div className="fahis-tool">
      <style>{`
        .fahis-tool { border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
        .fahis-tool .tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .fahis-tool .tabs button { border: 1px solid var(--line); background: none; color: inherit;
          border-radius: 999px; padding: 5px 14px; cursor: pointer; font: inherit; font-size: .9rem; }
        .fahis-tool .tabs button[data-on="1"] { background: currentColor; }
        .fahis-tool .tabs button[data-on="1"] span { color: var(--bg, #fff); mix-blend-mode: difference; }
        .fahis-tool .form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .fahis-tool input { font: inherit; font-size: 16px; padding: 9px 12px; border-radius: 9px;
          border: 1px solid var(--line); background: transparent; color: inherit; }
        .fahis-tool input.w { flex: 1 1 220px; min-width: 0; }
        .fahis-tool input.n { width: 110px; }
        .fahis-tool .go { border: 0; border-radius: 9px; padding: 10px 20px; cursor: pointer; font: inherit;
          font-weight: 600; background: var(--gold, #c9a227); color: #1a1a1a; }
        .fahis-tool .go:disabled { opacity: .45; cursor: default; }
        .fahis-tool .hint { font-size: .84rem; opacity: .58; margin: 8px 0 0; line-height: 1.7; }
        .fahis-tool .out { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
        .fahis-tool .nums { display: flex; gap: 22px; flex-wrap: wrap; margin-bottom: 14px; }
        .fahis-tool .nums b { display: block; font-size: 1.6rem; font-variant-numeric: tabular-nums; line-height: 1.2; }
        .fahis-tool .nums span { font-size: .82rem; opacity: .62; }
        .fahis-tool .vd { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 14px; }
        .fahis-tool .vd b { font-size: 1.05rem; }
        .fahis-tool .vd p { margin: 5px 0 0; opacity: .82; line-height: 1.8; }
        .fahis-tool .locs { display: flex; flex-wrap: wrap; gap: 6px; }
        .fahis-tool .locs a { font-size: .84rem; font-variant-numeric: tabular-nums; text-decoration: none;
          border: 1px solid var(--line); border-radius: 7px; padding: 2px 8px; opacity: .85; }
        .fahis-tool .sample { margin-top: 12px; font-size: .92rem; line-height: 2.1; opacity: .9; }
        .fahis-tool .sample div { padding: 5px 0; border-bottom: 1px dotted var(--line); }
        .fahis-tool .open-box textarea { width: 100%; font: inherit; font-size: 16px; line-height: 1.9;
          padding: 11px 13px; border-radius: 10px; border: 1px solid var(--line); background: transparent;
          color: inherit; resize: vertical; }
        .fahis-tool .open-go { display: flex; gap: 12px; align-items: center; margin-top: 9px; flex-wrap: wrap; }
        .fahis-tool .oc-lines { margin: 10px 0 0; padding-inline-start: 20px; }
        .fahis-tool .oc-lines li { margin-bottom: 8px; line-height: 1.95; opacity: .88; }
        .fahis-tool .open-card .vd { margin-top: 14px; }
        .fahis-tool .oc-ev { margin-top: 12px; font-size: .87rem; opacity: .72; }
        .fahis-tool .oc-ev summary { cursor: pointer; }
        .fahis-tool .oc-ev li { margin: 6px 0; line-height: 1.8; }
        .fahis-tool .counts { display: grid; gap: 10px; margin-bottom: 16px; }
        .fahis-tool .cg { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .fahis-tool .cg[data-main="1"] { border-color: color-mix(in oklab, var(--gold, #c9a227) 55%, transparent); }
        .fahis-tool .cg[data-sum="1"] { border-style: dashed; opacity: .8; }
        .fahis-tool .cg-h { display: flex; align-items: baseline; gap: 9px; margin-bottom: 6px; }
        .fahis-tool .cg-h b { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
        .fahis-tool .cg-h span { font-size: .9rem; opacity: .7; }
        .fahis-tool .cg .locs span { border: 1px solid var(--line); border-radius: 7px; padding: 2px 9px; font-size: .88rem; }
        .fahis-tool .cg .locs b { opacity: .5; font-weight: 600; }
        .fahis-tool .bk-open { border-bottom: 1px solid var(--line); }
        .fahis-tool .bk-open:last-child { border-bottom: 0; }
        .fahis-tool .bk-open > button { display: flex; align-items: baseline; gap: 9px; width: 100%;
          background: none; border: 0; color: inherit; font: inherit; text-align: start;
          padding: 11px 2px; cursor: pointer; flex-wrap: wrap; }
        .fahis-tool .bk-open .nm { font-weight: 600; }
        .fahis-tool .bk-open .au { opacity: .6; font-size: .88rem; }
        .fahis-tool .bk-open .rk { margin-inline-start: auto; opacity: .5; font-size: .78rem; white-space: nowrap; }
        .fahis-tool .bk-open .body { padding: 0 2px 14px; }
        .fahis-tool .bk-open .body p { margin: 0 0 9px; line-height: 2.05; opacity: .88; font-size: .95rem; }
      `}</style>

      <div className="tabs">
        <button data-on={qalab === "adad" ? 1 : 0} onClick={() => { setQalab("adad"); setRan(null); }}><span>قالبُ العدد</span></button>
        <button data-on={qalab === "kulliya" ? 1 : 0} onClick={() => { setQalab("kulliya"); setRan(null); }}><span>قالبُ الكلّيّة</span></button>
        <button data-on={qalab === "iraab" ? 1 : 0} onClick={() => { setQalab("iraab"); setRan(null); }}><span>قالبُ الإعراب</span></button>
        <button data-on={qalab === "dalala" ? 1 : 0} onClick={() => { setQalab("dalala"); setRan(null); }}><span>قالبُ الدلالة</span></button>
        <button data-on={qalab === "open" ? 1 : 0} onClick={() => { setQalab("open"); setRan(null); }}><span>اعرِضْ فكرةً نثرًا</span></button>
      </div>

      {qalab === "open" ? (
        <div className="open-box">
          <textarea
            value={prose} onChange={(e) => setProse(e.target.value)} dir="rtl" lang="ar" rows={3}
            placeholder="اكتب الفكرةَ بلغتك — مثل: سمعتُ أنّ كلمة «شهر» وردت اثنتي عشرة مرّة في القرآن"
          />
          <div className="open-go">
            <button
              className="go"
              disabled={busy || prose.trim().length < 8}
              onClick={async () => {
                setBusy(true); setErr(null); setCard(null);
                try { setCard(await examineOpen(prose.trim())); }
                catch (e) { setErr(e instanceof Error ? e.message : "تعذّر"); }
                finally { setBusy(false); }
              }}
            >{busy ? "…يُفحص" : "افحص"}</button>
            <span className="hint" style={{ margin: 0 }}>
              يُصنَّف قولُك، ثمّ <b>يُشغَّل الحسابُ عندنا</b>، ثمّ تُصاغ البطاقةُ من مخرَجه — فلا يُذكر رقمٌ لم نحسبه.
            </span>
          </div>
        </div>
      ) : (
        <>
      <div className="form">
        {qalab === "iraab" ? (
          <input
            className="w" value={loc} onChange={(e) => setLoc(e.target.value)} dir="ltr"
            placeholder="الموضع — مثل: 6:20" inputMode="text"
          />
        ) : (
          <input
            className="w" value={word} onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder={qalab === "adad" ? "اللفظُ أو العبارة — مثل: الصلاة" : "اللفظُ الذي تقول إنّه ليس في القرآن"}
            dir="rtl" lang="ar"
          />
        )}
        {qalab === "adad" && (
          <input className="n" value={claimed} onChange={(e) => setClaimed(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()} placeholder="العددُ المدَّعى" inputMode="numeric" />
        )}
        {qalab !== "iraab" && (
          <button className="go" onClick={run} disabled={!corpus || !word.trim()}>
            {corpus ? "افحص" : "…"}
          </button>
        )}
      </div>
      <p className="hint">
        {qalab === "adad"
          ? "العبرةُ بصيغ اللفظ لا برسمه، **والمفردُ يُفصل عن المثنّى والجمع** — فأكثرُ ما يُذكر من أعدادٍ إنّما هو في المفرد. وتُعرض الصيغُ في كلِّ قسمٍ ليرى السائلُ ما عُدّ بعينه."
          : qalab === "kulliya"
          ? "القولُ السالب («لا يوجد في القرآن كذا») يُختبر بموضعٍ واحد. ويُبحث باللفظ وسوابقِه."
          : qalab === "iraab"
          ? "لا يُعطيك فاحصٌ قولًا واحدًا في الإعراب — بل يضع أهلَ الصنعة متجاورين بالأقدميّة، فإن اختلفوا رأيتَ الخلافَ وحكمتَ عليه."
          : "اكتب اللفظَ الذي تريد بحثَ معناه، فتُعرض عليك مادّتُه كلُّها في المصحف ومعها المعاجمُ ومعاني القرآن — ثمّ تنظر أنت: أيستقيم هذا المعنى في هذه كلِّها؟"}
      </p>
        </>
      )}

      {qalab === "open" && err && <p className="hint" style={{ color: "#b4483a" }}>تعذّر: {err}</p>}
      {qalab === "open" && card && (
        <div className="out open-card">
          {card.why && <p className="hint" style={{ marginTop: 0 }}>صُنّفت: <b>{card.kind}</b> — {card.why}</p>}
          {card.lines.length > 0 && <ol className="oc-lines">{card.lines.map((l, i) => <li key={i}>{l}</li>)}</ol>}
          <div className="vd"><b>النتيجة: {card.verdict}</b>{card.limit && <p>حدودُ النتيجة: {card.limit}</p>}</div>
          {card.evidence.length > 0 && (
            <details className="oc-ev">
              <summary>المعطى المحسوبُ الذي بُنيت عليه ({num(card.evidence.length)})</summary>
              <ul>{card.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {qalab === "iraab" && /^\d{1,3}\s*:\s*\d{1,3}$/.test(loc.trim()) && (
        <div className="out"><IraabPanel loc={loc.trim().replace(/\s/g, "")} /></div>
      )}

      {qalab === "dalala" && ran && <div className="out"><DalalaPanel word={ran} /></div>}

      {computed && res && shown && (
        <div className="out">
          {/* العددُ يُفصَّل بالعدد الصرفيّ — فالقولُ غالبًا في المفرد وحدَه،
              وخلطُ المفرد بالمثنّى والجمع يُخفي محلَّ النزاع */}
          {morph && (
            <div className="counts">
              {morph.groups.map((g) => (
                <div className="cg" key={g.key} data-main={g.key === "S" ? 1 : 0}>
                  <div className="cg-h"><b>{num(g.total)}</b><span>{g.label}</span></div>
                  <div className="locs">
                    {g.forms.map((f) => (
                      <span key={f.form}>{f.form} <b>{num(f.n)}</b></span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="cg" data-sum="1">
                <div className="cg-h"><b>{num(morph.total)}</b><span>المجموع في {num(morph.ayat)} آية</span></div>
              </div>
            </div>
          )}

          <div className="nums">
            <div><b>{num(res.bare.total)}</b><span>بالرسم المجرّد</span></div>
            <div><b>{num(res.withPrefix.total)}</b><span>بالرسم وسوابقِه</span></div>
            {same !== null && <div><b>{num(same)}</b><span>لفظًا آخرَ بالعدد نفسِه</span></div>}
          </div>

          {verdict && (
            <div className="vd">
              <b>{verdict.k}</b>
              <p>{verdict.why}</p>
              {res.sameCount !== null && res.sameCount > 0 && (
                <p style={{ fontSize: ".88rem", opacity: .68 }}>
                  ومعدّلُ الصدفة: يشارك هذا اللفظَ في عدده {num(res.sameCount)} لفظًا آخرَ من {num(res.distinctWords)} —
                  فالعددُ وحدَه لا يدلّ على مقصدٍ ما لم يُضَمَّ إليه دليلٌ من اللفظ أو التركيب.
                </p>
              )}
            </div>
          )}

          {shown.hits.length > 0 && (
            <>
              <div className="locs">
                {shown.hits.slice(0, 60).map((h) => (
                  <Link key={h.loc} to={`/aya/${h.loc.replace(":", "/")}`}>{h.loc}</Link>
                ))}
                {shown.hits.length > 60 && <span style={{ opacity: .6, fontSize: ".84rem" }}>…و{num(shown.hits.length - 60)} غيرُها</span>}
              </div>
              <div className="sample">
                {shown.hits.slice(0, 3).map((h) => (
                  <div key={h.loc}><b style={{ opacity: .6, fontSize: ".8rem" }}>{h.loc}</b> — {h.t}</div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

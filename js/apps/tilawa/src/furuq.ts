/**
 * **مادّةُ التثبيت — فروقُ التنزيل مقروءةً مفارقَ.**
 *
 * الحافظُ لا يُخطئ في مطلع الآية؛ يُخطئ **عند نقطة التفرّع**: يبلغ العبارةَ
 * المشتركةَ بين موضعين فينزلق إلى نظيرتها في سورةٍ أخرى ويمضي. فالمقصودُ ههنا
 * أن يُقرأ من كلّ زوجٍ **موضعُ افتراقه** لا وجودُ الشبه فيه.
 *
 * **والمادّةُ محسوبةٌ سلفًا لا تُبنى ههنا**: `furuq.json` من الحزمة المشتركة
 * (مُخرَجُ `scripts/compute-furuq.mjs`) يحمل لكلّ زوجٍ **محاذاةً مصفوفة** —
 * `ops` — المشتركُ فيها نصًّا، والمفترقُ في صندوق. فموضعُ المفرق **يُقرأ ولا
 * يُستنبط**.
 *
 * ## وثلاثةُ أحكامٍ تحكم هذا الملفّ
 *
 * **١) الحدُّ المعلن: المفرقُ يُقرأ داخلَ الآية لا في مطلعها وحدَه.** سلسلةٌ
 * مشتركةٌ **ثلاثُ كلماتٍ فأكثر** يتلوها افتراقٌ — **أينما وقعت**. وبالمطلع
 * وحدَه ٣٧٥ زوجًا، وبالمفرق الداخليّ **١٬٠٦٠** — والفرقُ بينهما فرقُ بابٍ صغيرٍ
 * وبابٍ ذي شأن.
 *
 * **٢) وما يُعرض للقارئ نصُّ المصحف عندنا لا نصُّ المادّة.** كلماتُ `ops`
 * **مجرّدةٌ من الضبط** ومكتوبةٌ بالإملاء المعتاد (مصدرُها عمودٌ إملائيٌّ في
 * قاعدة مشكاة)، ورسمُ المصحف غيرُها: ﴿ٱلسَّمَٰوَٰتِ﴾ لا «السماوات». فلا يُعرض
 * منها حرفٌ ألبتّة — إنّما تُقرأ منها **مواضعُ الكلمات**، ثمّ يُقصّ المعروضُ من
 * `mushaf-text.json` نفسِه الذي تُرسم منه الصفحة. **وهذا عينُ قاعدة المشروع**:
 * لا حرفَ قرآنٍ مكتوبٌ بيدٍ ولا محوَّلٌ عن أصله.
 *
 * **٣) والمحاذاةُ تُتحقَّق قبل أن يُسأل بها.** ترقيمُ كلمات المادّة وترقيمُ
 * كلماتنا مصدرُهما واحد، **ولكن لا يُؤمَن التقاءُ عدَدين**: فيُقابَل كلُّ موضعٍ
 * بكلمته على **هيكل الرسم** (`rasmOf`)، فما لم يطابق زوجُه كلمةً كلمةً **خرج من
 * المادّة معدودًا** ولم يُسأل به. وفي مصحفنا موضعٌ واحدٌ يخرج بهذا: ﴿بَعْدَ مَا﴾
 * يصلها الجدولُ كلمةً واحدةً ويشقّها الرسمُ اثنتين.
 */
import { LAST_AYAH, globalIdOf, normalizeAr } from "@mishkat/quran-core";
import type { HuntFork, HuntIndex, HuntPair } from "@mishkat/quran-core/lib/sawt/align";
import { ayahTokens, type Mushaf } from "./mushaf";

/**
 * عنصرُ المحاذاة: **نصٌّ** مشتركٌ بين الآيتين · **`["~", أ, ب]`** صيغتان لكلمةٍ
 * واحدة · **`["-", نص]`** انفردت به «أ» · **`["+", نص]`** انفردت به «ب».
 */
export type Op = string | string[];

/** المحاذاةُ الموضعيّة: أيُّ الآيتين نُوفذت، وكم كلمةً طُويت قبل النافذة وبعدها */
export interface Win {
  s: "a" | "b";
  pre: number;
  post: number;
}

/** زوجٌ كما هو في `furuq.json` — أسماؤها أسماءُ مفاتيحه */
export interface RawPair {
  a: string;
  b: string;
  tier: string;
  cat: string;
  eq: number;
  morph?: 1;
  taq?: 1;
  win?: Win;
  ops: Op[];
}

export interface RawFuruq {
  meta: { pairs: number; categories: Record<string, number>; engine: string };
  furuq: RawPair[];
}

/** **الحدُّ المعلن** — أدنى سلسلةٍ مشتركةٍ قبل المفرق (ح١ §١) */
export const MIN_LEAD = 3;

/** **مفرقٌ واحد** — موضعُ افتراقٍ بعد سلسلةٍ مشتركة، بمواضعه في الآيتين */
export interface Fork {
  /** طولُ المشترك قبله — كلماتٍ */
  lead: number;
  /** رقمُ أوّل كلمةٍ من وجه «أ» (مبدوءٌ بواحد) وعدّتُها — و`0` أن لا وجهَ لها */
  atA: number;
  lenA: number;
  atB: number;
  lenB: number;
  /** أوقع في ذيل المحاذاة فكان أحدُ وجهيه **انتهاءَ نصٍّ** لا كلمة؟ */
  end: boolean;
}

/**
 * **قراءةُ المفارق من محاذاةٍ واحدة.**
 *
 * تُمشى `ops` بمؤشّرَي كلماتٍ (واحدٌ لكلّ آية)، فكلَّما انقطعت سلسلةُ المشترك
 * قُرئت **كتلةُ الافتراق** كلُّها مفرقًا واحدًا — فالإبدالُ ذو الكلمتين مفرقٌ
 * واحدٌ لا مفرقان.
 *
 * **ووجهٌ خالٍ لا يُعرض خاليًا**: زوجٌ زادت فيه إحداهما كلمةً — وجهُ الأخرى
 * حينئذٍ لا كلمةَ فيه. فإن كان بعد الكتلة مشتركٌ **ضُمّ إلى الوجهين معًا** فصارا
 * نصّين يُقابَلان؛ وإن كانت الكتلةُ في الذيل فلا شيءَ بعدها — فيُعلَم الوجهُ
 * **انتهاءً** (`end`)، ويُقال في الصفحة «تنتهي ههنا» بلا حرفٍ يُختلق.
 *
 * **والمؤشّرُ يبتدئ من `pre`** في الجهة المنوفذة — فالمحاذاةُ الموضعيّةُ تطوي
 * صدرَ الآية الأطول، وترقيمُ كلماتها يمضي من أوّلها لا من أوّل النافذة.
 */
export function forksOf(ops: Op[], win: Win | null): Fork[] {
  const out = [];
  let iA = win && win.s === "a" ? win.pre : 0;
  let iB = win && win.s === "b" ? win.pre : 0;
  let run = 0;
  let k = 0;
  while (k < ops.length) {
    if (typeof ops[k] === "string") {
      run++;
      iA++;
      iB++;
      k++;
      continue;
    }
    const atA = iA;
    const atB = iB;
    const lead = run;
    let j = k;
    while (j < ops.length && typeof ops[j] !== "string") {
      const o = ops[j];
      if (o[0] === "~") {
        iA++;
        iB++;
      } else if (o[0] === "-") iA++;
      else iB++;
      j++;
    }
    let lenA = iA - atA;
    let lenB = iB - atB;
    let end = false;
    if (lenA === 0 || lenB === 0) {
      if (j < ops.length) {
        lenA++;
        lenB++;
      } else end = true;
    }
    out.push({ lead, atA: atA + 1, lenA, atB: atB + 1, lenB, end });
    run = 0;
    k = j;
  }
  return out;
}

/**
 * **مواضعُ الافتراق في الآيتين** — أرقامُ الكلمات التي انفردت بها كلُّ آية.
 *
 * وهي غيرُ وجهَي السؤال: الوجهُ قد يُوسَّع بكلمةٍ مشتركةٍ ليستبين، **أمّا الإبرازُ
 * على المتن فلا يقع إلّا على ما افترق حقًّا** — فلا تُلوَّن كلمةٌ هي في الآيتين
 * سواء.
 */
export function marksOf(ops: Op[], win: Win | null): { a: number[]; b: number[] } {
  const a = [];
  const b = [];
  let iA = win && win.s === "a" ? win.pre : 0;
  let iB = win && win.s === "b" ? win.pre : 0;
  for (const o of ops) {
    if (typeof o === "string") {
      iA++;
      iB++;
    } else if (o[0] === "~") {
      a.push(++iA);
      b.push(++iB);
    } else if (o[0] === "-") a.push(++iA);
    else b.push(++iB);
  }
  return { a, b };
}

/**
 * **هيكلُ الرسم** — به تُقابَل كلمةُ المادّة بكلمة المصحف.
 *
 * المطبِّعُ واحدٌ على الطرفين (`normalizeAr` من محلِّل العربيّة — لا مطبِّعَ ثانٍ
 * يُنشأ ههنا)، ثمّ **ثلاثُ طيّاتٍ معلنةٍ للرسم**: تُطرح حروفُ المدّ (فـ﴿ٱلسَّمَٰوَٰتِ﴾
 * تلقى «السماوات»)، ويُطوى تكرارُ الحرف (فـ﴿ٱلَّيْلَ﴾ تلقى «الليل»)، وتُردّ الصادُ
 * سينًا (فـ﴿وَيَبْصُۜطُ﴾ تلقى «يبسط»). **وهي للمقابلة لا للعرض** — ولا يُعرض من
 * هذا شيءٌ ألبتّة.
 */
export function rasmOf(w: string): string {
  return normalizeAr(w)
    .replace(/[اوي\s]/g, "")
    .replace(/ص/g, "س")
    .replace(/(.)\1+/g, "$1");
}

/** أتقع كلمةُ المصحف وكلمةُ المادّة على هيكلِ رسمٍ واحد؟ */
export function sameWord(w: string | undefined, c: string): boolean {
  return w !== undefined && rasmOf(w) === rasmOf(c);
}

/**
 * **أتطابق المحاذاةُ كلماتِنا كلمةً كلمة؟** — يُمشى `ops` على الآيتين معًا،
 * فيُقابَل كلُّ موضعٍ بهيكل كلمته، **ويُختم بأن تنتهي العدّةُ إلى آخر الآية**
 * (وفي المنوفذة: إلى آخرها ناقصًا ما طُوي بعد النافذة). فما اختلّ فيه موضعٌ
 * واحدٌ لا يُسأل به.
 */
export function alignsWith(p: RawPair, wa: string[], wb: string[]): boolean {
  let iA = p.win && p.win.s === "a" ? p.win.pre : 0;
  let iB = p.win && p.win.s === "b" ? p.win.pre : 0;
  let ok = true;
  for (const o of p.ops) {
    if (typeof o === "string") {
      if (!sameWord(wa[iA++], o)) ok = false;
      if (!sameWord(wb[iB++], o)) ok = false;
    } else if (o[0] === "~") {
      if (!sameWord(wa[iA++], o[1])) ok = false;
      if (!sameWord(wb[iB++], o[2])) ok = false;
    } else if (o[0] === "-") {
      if (!sameWord(wa[iA++], o[1])) ok = false;
    } else if (!sameWord(wb[iB++], o[1])) ok = false;
  }
  if (p.win) {
    const len = p.win.s === "a" ? wa.length : wb.length;
    if ((p.win.s === "a" ? iA : iB) + p.win.post !== len) ok = false;
  } else if (iA !== wa.length || iB !== wb.length) ok = false;
  return ok;
}

/** **كلماتُ آيةٍ من رسم المصحف** — بقسمة الصفحة نفسِها، وعلاماتُ الوقف مطروحة
 *  (رموزُ قراءةٍ لا كلماتٍ تُنطق — وهو عينُ ما يفعله `wordsBetween`) */
export const wordsOf = (m: Mushaf, id: number): string[] =>
  ayahTokens(id, m.ayahs[id - 1].text)
    .filter((t) => t.no)
    .map((t) => t.text);

/** **علاقةُ آيتين** — إمّا ذاتُ مفارقَ تُسأل بوجهيها، وإمّا توأمٌ تامٌّ لا مفرقَ فيه */
export interface Pairing {
  /** مفتاحُها في السجلّ — «٢:٤٩|٧:١٤١» بترتيب المصحف */
  key: string;
  a: string;
  b: string;
  idA: number;
  idB: number;
  cat: string;
  /** محاذاتُها كما هي — منها تُقرأ مواضعُ الافتراق للإبراز على المتن */
  ops: Op[];
  win: Win | null;
  /** مفارقُها المستوفيةُ الحدَّ — فارغةٌ في التوأم التامّ */
  forks: Fork[];
  /** **توأمٌ تامّ**: لا مفرقَ في محاذاته ألبتّة (تطابقٌ أو اشتمال) */
  twin: boolean;
  /** مدى العبارة المشتركة في كلٍّ — للتوأم التامّ وحدَه */
  span?: { atA: number; lenA: number; atB: number; lenB: number };
}

/** **مجموعةُ توائمَ** — موضعان فأكثر لعبارةٍ واحدةٍ بلا مفرق */
export interface TwinGroup {
  key: string;
  /** مواضعُها بترتيب المصحف، ومعها مدى العبارة في كلٍّ */
  places: { loc: string; id: number; at: number; len: number }[];
}

export interface Furuq {
  /** أزواجُ المفرق — مرتّبةٌ على ترتيب المصحف */
  pairs: Pairing[];
  twins: TwinGroup[];
  /** ما لكلِّ آيةٍ من علاقاتٍ — بالرقم العامّ */
  byAyah: Map<number, Pairing[]>;
  /** ما لكلِّ آيةٍ من مجموعات التوائم */
  twinsByAyah: Map<number, TwinGroup[]>;
  /** **أرقامُ المادّة تُنشر ولا تُخفى** (ح١ §٥/٣) */
  counts: {
    all: number;
    misaligned: number;
    twinPairs: number;
    twinGroups: number;
    forkPairs: number;
    questions: number;
    belowLead: number;
    minLead: number;
  };
}

const idOf = (loc: string): number => {
  const [s, a] = loc.split(":").map(Number);
  return globalIdOf(s, a);
};

/**
 * **بناءُ المادّة مرّةً واحدةً عند فتح الباب** — لا في كلّ سؤال.
 *
 * ويمرّ كلُّ زوجٍ بثلاثة: تُتحقَّق محاذاتُه بكلماتنا، ثمّ يُفرَز توأمًا تامًّا أو
 * ذا مفارق، ثمّ **تُصفَّى مفارقُه بالحدّ المعلن**. وما سقط يُعدّ ولا يُطوى.
 */
export function buildFuruq(m: Mushaf, raw: RawFuruq): Furuq {
  const pairs: Pairing[] = [];
  const twinPairs: Pairing[] = [];
  let misaligned = 0;
  let belowLead = 0;
  let questions = 0;

  for (const p of raw.furuq) {
    const idA = idOf(p.a);
    const idB = idOf(p.b);
    const wa = wordsOf(m, idA);
    const wb = wordsOf(m, idB);
    if (!alignsWith(p, wa, wb)) {
      misaligned++;
      continue;
    }
    const key = idA <= idB ? `${p.a}|${p.b}` : `${p.b}|${p.a}`;
    const base = { key, a: p.a, b: p.b, idA, idB, cat: p.cat, ops: p.ops, win: p.win ?? null };
    if (!p.ops.some((o) => typeof o !== "string")) {
      /* توأمٌ تامّ: مدى العبارة المشتركة — الآيةُ كلُّها، أو النافذةُ في الأطول */
      const preA = p.win && p.win.s === "a" ? p.win.pre : 0;
      const preB = p.win && p.win.s === "b" ? p.win.pre : 0;
      twinPairs.push({
        ...base,
        forks: [],
        twin: true,
        span: { atA: preA + 1, lenA: p.ops.length, atB: preB + 1, lenB: p.ops.length },
      });
      continue;
    }
    const forks = forksOf(p.ops, p.win ?? null).filter((f) => f.lead >= MIN_LEAD);
    if (!forks.length) {
      belowLead++;
      continue;
    }
    questions += forks.length;
    pairs.push({ ...base, forks, twin: false });
  }

  pairs.sort((x, y) => x.idA - y.idA || x.idB - y.idB);
  const byAyah = new Map<number, Pairing[]>();
  for (const p of pairs) {
    for (const id of [p.idA, p.idB]) {
      const list = byAyah.get(id);
      if (list) list.push(p);
      else byAyah.set(id, [p]);
    }
  }

  const twins = groupTwins(twinPairs);
  const twinsByAyah = new Map<number, TwinGroup[]>();
  for (const g of twins) {
    for (const pl of g.places) {
      const list = twinsByAyah.get(pl.id);
      if (list) list.push(g);
      else twinsByAyah.set(pl.id, [g]);
    }
  }

  return {
    pairs,
    twins,
    byAyah,
    twinsByAyah,
    counts: {
      all: raw.furuq.length,
      misaligned,
      twinPairs: twinPairs.length,
      twinGroups: twins.length,
      forkPairs: pairs.length,
      questions,
      belowLead,
      minLead: MIN_LEAD,
    },
  };
}

/**
 * **التوائمُ تُجمع ولا تُترك أزواجًا**: عبارةٌ في ثلاثة مواضعَ يصفها الكتالوجُ
 * ثلاثةَ أزواج، فلو سُئل عنها زوجًا زوجًا **لأُخفي عن الحافظ موضعُها الثالث** —
 * وهو أحوجُ ما يكون إليه. فتُوصل الأزواجُ المشتركةُ في موضعٍ مجموعةً واحدة.
 */
function groupTwins(list: Pairing[]): TwinGroup[] {
  const at = new Map<string, { loc: string; id: number; at: number; len: number }>();
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const add = (loc: string, id: number, a: number, len: number) => {
    if (!parent.has(loc)) {
      parent.set(loc, loc);
      at.set(loc, { loc, id, at: a, len });
    }
  };
  for (const p of list) {
    add(p.a, p.idA, p.span!.atA, p.span!.lenA);
    add(p.b, p.idB, p.span!.atB, p.span!.lenB);
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map<string, TwinGroup>();
  for (const loc of parent.keys()) {
    const root = find(loc);
    const g = groups.get(root);
    if (g) g.places.push(at.get(loc)!);
    else groups.set(root, { key: "", places: [at.get(loc)!] });
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.places.sort((x, y) => x.id - y.id);
    g.key = g.places.map((p) => p.loc).join("|");
  }
  out.sort((x, y) => x.places[0].id - y.places[0].id);
  return out;
}

/* ═══════════════ السؤالُ المولَّد ═══════════════ */

/** **أكثرُ ما يُعرض من المشترك** — سياقٌ يكفي للتذكّر ولا يُغرِق الوجهين */
export const LEAD_SHOWN = 7;

/**
 * **سؤالُ المفرق** — مولَّدٌ من المحاذاة، **معروضُه كلُّه مقصوصٌ من رسم المصحف**.
 */
export interface Question {
  pair: Pairing;
  fork: Fork;
  /** أيُّ الآيتين يُسأل عنها — والوجهُ الصوابُ وجهُها */
  side: "a" | "b";
  /** موضعُ المسؤول عنها ورقمُه العامّ */
  loc: string;
  id: number;
  /** المشتركُ قبل المفرق — كلماتٍ من الآية المسؤول عنها */
  lead: string[];
  /** أقُصّ صدرُ المشترك؟ — فيُنبَّه عليه بنقاطٍ ولا يُوهَم أنّه مطلعُ الآية */
  clipped: boolean;
  /** وجهُ «أ» ووجهُ «ب» — و`null` وجهُ الانتهاء (لا كلمةَ فيه) */
  faceA: string[] | null;
  faceB: string[] | null;
}

/**
 * **يُولّد سؤالَ مفرقٍ بعينه عن جهةٍ بعينها.**
 *
 * **وكلماتُ الآيتين تُمرَّر إليه ولا يقرؤها بنفسه** — فيصير دالّةً صافيةً تُشغَّل
 * كما هي في البوّابة على نصّ المصحف نفسِه، فلا يُفحص غيرُ المولِّد العامل.
 */
export function questionOf(
  pair: Pairing,
  fork: Fork,
  side: "a" | "b",
  wa: string[],
  wb: string[],
): Question {
  const mine = side === "a" ? wa : wb;
  const at = side === "a" ? fork.atA : fork.atB;
  const shown = Math.min(fork.lead, LEAD_SHOWN);
  return {
    pair,
    fork,
    side,
    loc: side === "a" ? pair.a : pair.b,
    id: side === "a" ? pair.idA : pair.idB,
    lead: mine.slice(at - 1 - shown, at - 1),
    clipped: fork.lead > shown || at - 1 - shown > 0,
    faceA: fork.lenA ? wa.slice(fork.atA - 1, fork.atA - 1 + fork.lenA) : null,
    faceB: fork.lenB ? wb.slice(fork.atB - 1, fork.atB - 1 + fork.lenB) : null,
  };
}

/** عبارةُ التوأم التامّ من موضعٍ من مواضعها — قصًّا من كلمات ذلك الموضع */
export function twinText(place: TwinGroup["places"][number], words: string[]): string[] {
  return words.slice(place.at - 1, place.at - 1 + place.len);
}

let loading: Promise<RawFuruq> | null = null;

/** **تُجلب مرّةً واحدةً** — ولا تُحمَّل ألبتّة لمن لم يفتح الباب */
export function loadFuruq(): Promise<RawFuruq> {
  loading ??= fetch(`${import.meta.env.BASE_URL}furuq.json`).then((r) => {
    if (!r.ok) throw new Error(`مادّةُ التثبيت لم تُجلب (${r.status})`);
    return r.json() as Promise<RawFuruq>;
  });
  return loading;
}

/* ═══════════════ فهرسُ النظائر — مادّةُ الاصطياد الصوتيّ (ن٢) ═══════════════ */

/**
 * **كم كلمةً تُضمّ إلى فرع النظيرة ممّا يليها في المصحف.**
 *
 * المفرقُ قد يقع في آخر الآية — ﴿كَذَّبَتْ قَوْمُ لُوطٍۭ بِٱلنُّذُرِ﴾ نظيرةُ ﴿كَذَّبَتْ
 * قَوْمُ لُوطٍ ٱلْمُرْسَلِينَ﴾، ومفرقُها كلمتُها الأخيرة — فلا يبقى بعده من النظيرة
 * إلّا كلمةٌ واحدةٌ لا تبلغ عتبةَ الثلاث أبدًا. **والانزلاقُ إنّما يثبت بما يمضي
 * فيه المنزلق**: فيُضمّ إلى الفرع ما بعد النظيرة من المصحف بقدرٍ معلَن.
 */
export const BRANCH_TAIL = 12;

/**
 * **يُبنى الفهرسُ ههنا ويُسلَّم إلى المحاذاة إعدادًا** — فهي لا تفتح ملفًّا ولا
 * تعرف «فروق التنزيل»، وما تعرفه: آيةٌ لها فرعٌ ونقاطُ افتراق.
 *
 * **ومفتاحُ الزوج هو مفتاحُ سجلّ الخلط نفسُه** (`Pairing.key`) — فما يُصطاد في
 * التسميع يقع في السطر الذي يُسأل عنه في التدريب، **فتكتمل الحلقة** بلا جسرٍ
 * بين ترقيمين.
 *
 * @param pairs أزواجُ المفرق كما بناها `buildFuruq` — مصفّاةً بالحدّ المعلن
 * @param wordsAt كلماتُ آيةٍ برقمها العامّ؛ **تُمرَّر ولا تُقرأ ههنا** فتُشغَّل
 *   هذه الدالّةُ نفسُها في البوّابة على نصّ المصحف عينِه
 */
export function huntIndexOf(pairs: Pairing[], wordsAt: (id: number) => string[]): HuntIndex {
  /** فرعُ آيةٍ — يُبنى مرّةً **ويُشارَك** بين كلّ أزواجها، فلا يُكرَّر في الذاكرة */
  const branches = new Map<number, string[]>();
  const branchOf = (id: number): string[] => {
    const had = branches.get(id);
    if (had) return had;
    const own = wordsAt(id).map(normalizeAr);
    const b = own.slice();
    for (let n = id + 1; n <= LAST_AYAH && b.length < own.length + BRANCH_TAIL; n++) {
      for (const w of wordsAt(n)) b.push(normalizeAr(w));
    }
    branches.set(id, b);
    return b;
  };

  const ix: HuntIndex = new Map();
  const put = (loc: string, p: HuntPair) => {
    const list = ix.get(loc);
    if (list) list.push(p);
    else ix.set(loc, [p]);
  };

  for (const p of pairs) {
    const wa = wordsAt(p.idA);
    const wb = wordsAt(p.idB);
    /** الوجهُ **رسمًا مقصوصًا من المصحف** — و`null` وجهُ الانتهاء (لا كلمةَ فيه) */
    const face = (w: string[], at: number, len: number): string | null =>
      len ? w.slice(at - 1, at - 1 + len).join(" ") : null;
    const forksA: HuntFork[] = p.forks.map((f) => ({
      here: f.atA,
      there: f.atB,
      faceHere: face(wa, f.atA, f.lenA),
      faceThere: face(wb, f.atB, f.lenB),
    }));
    const forksB: HuntFork[] = p.forks.map((f) => ({
      here: f.atB,
      there: f.atA,
      faceHere: face(wb, f.atB, f.lenB),
      faceThere: face(wa, f.atA, f.lenA),
    }));
    put(p.a, { key: p.key, there: p.b, branch: branchOf(p.idB), forks: forksA });
    put(p.b, { key: p.key, there: p.a, branch: branchOf(p.idA), forks: forksB });
  }
  /* **نظائرُ كلّ آيةٍ على ترتيب المصحف** — فما تساوى فيه فرعان حُكم بأوّلهما،
     ولا يتقلّب الحكمُ بتقلّب ترتيب المادّة في ملفّها. */
  for (const list of ix.values()) list.sort((x, y) => idOf(x.there) - idOf(y.there));
  return ix;
}

let hunting: { m: Mushaf; ix: HuntIndex } | null = null;

/**
 * **يُبنى مرّةً ويُمسَك** — ولا يُبنى ألبتّة لمن لم يُسمِّع في حالٍ تصطاد، ولا
 * تُجلب مادّتُه (٦٩٨ ك.ب) على قارئٍ يقرأ.
 */
export function loadHuntIndex(m: Mushaf): Promise<HuntIndex> {
  if (hunting && hunting.m === m) return Promise.resolve(hunting.ix);
  return loadFuruq().then((raw) => {
    const ix = huntIndexOf(buildFuruq(m, raw).pairs, (id) => wordsOf(m, id));
    hunting = { m, ix };
    return ix;
  });
}

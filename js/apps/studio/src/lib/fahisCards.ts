/**
 * بطاقاتُ فاحص — الأنواعُ والمحمّل.
 *
 * المصدرُ الحاكم `js/data/fahis/cards.json`، يفحصه `js/scripts/fahis-lint.mjs`
 * ثم ينشر نسخةَ العرض إلى `public/fahis-cards.json` — فلا تصل بطاقةٌ إلى
 * المتصفّح إلا وقد مرّت على فاحص اللسان (النبرةُ · لا اسمَ باحثٍ · لا تفاسير).
 */

/** الأنواعُ الثمانية — القولُ يُصنَّف بالآلة التي تفحصه (FAHIS-INSTRUMENT) */
export type FahisKind =
  | "kulliya" | "adadiya" | "sarfiya" | "qiraat"
  | "dalaliya" | "irabiya" | "taraduf" | "kharij";

/** صيغُ الحكم الستُّ — المعجمُ الثابتُ للقسم، ألوانُها تُبنى في ر٢ */
export type FahisVerdict =
  | "tastaqim" | "taqyid" | "la-tastaqim"
  | "lam-yatabayyan" | "mawquf" | "kharij-babina";

/** جدولُ الصيغ: ما عُدّ بعينه — فلا يُخفى وراء رقمٍ خلافٌ في حدِّ المعدود */
export interface SighaTable {
  title?: string;
  groups: { label: string; forms: { form: string; n: number }[]; more?: number }[];
}

export interface FahisEvidence {
  text: string;
  /** رتبةُ السند ١–٥، وnull لسطر المنهج الذي لا شاهدَ رتبةٍ فيه */
  rank: number | null;
  /** شاهدٌ يجري خلافَ القول المفحوص — يُعلَّم ولا يُكتم */
  counter: boolean;
}

export interface FahisCardData {
  id: string;
  /** رقمُ الاستشهاد الثابت — بأقدميّة النشر، لا يتزحزح ولا يُعاد استعمالُه */
  n: number;
  title: string;
  claim: string;
  /** سطرُ التيسير: القولُ بلسانٍ لا مصطلحَ فيه */
  plain: string;
  kinds: FahisKind[];
  kindDetail: string;
  verdict: FahisVerdict;
  verdictDetail: string;
  scope: string;
  evidence: FahisEvidence[];
  sighaTable: SighaTable | null;
  limit: string;
  tool: { qalab: string; [k: string]: unknown } | null;
  toolNote?: string;
  lemmas: string[];
  topics: string[];
  date: string;
  batch: number;
  revisions: { date: string; what: string; why: string }[];
}

/** المعجمُ الثابت: عنوانُ كلِّ حالةٍ وشرحُها — يظهر بلفظه في كلِّ موضعٍ فلا يتبدّل */
export const VERDICT_META: Record<FahisVerdict, { label: string; gloss: string }> = {
  "tastaqim": { label: "تستقيم", gloss: "وافق القولُ الشواهدَ كما صيغ" },
  "taqyid": { label: "تحتاج تقييدًا", gloss: "جوهرُها صحيحٌ، وإطلاقُها لا يثبت" },
  "la-tastaqim": { label: "لا تستقيم", gloss: "لم تُقِمْها الشواهدُ على ما صيغت به" },
  "lam-yatabayyan": { label: "لم يتبيّن", gloss: "الشواهدُ لا تحسم، فنقف ولا نرجّح" },
  "mawquf": { label: "موقوفٌ لقلّة المادّة", gloss: "المادّةُ لا تكفي للفحص — وهو حكمٌ مشرِّفٌ لا نقص" },
  "kharij-babina": { label: "خارجَ بابنا", gloss: "لا آلةَ لنا فيه فلا نتكلّف حكمًا" },
};

export const KIND_LABEL: Record<FahisKind, string> = {
  kulliya: "كلّيّة", adadiya: "عدديّة", sarfiya: "صرفيّة", qiraat: "قراءات",
  dalaliya: "دلاليّة", irabiya: "إعرابيّة", taraduf: "ترادفٌ وفروق", kharij: "خارجَ بابنا",
};

/** التاريخ بأرقامٍ عربيّة — لصفحاتِ القسم العربيّةِ الوجه */
export const arDigits = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

/** وصلةُ «أعد الفحصَ بنفسك» — تفتح قالبَ الأداة مملوءًا */
export function toolHref(tool: NonNullable<FahisCardData["tool"]>): string {
  const w = (tool.lafz ?? tool.phrase ?? tool.word ?? tool.loc ?? "") as string;
  const p = new URLSearchParams({ q: tool.qalab, w });
  if (tool.n !== undefined) p.set("n", String(tool.n));
  return `/fahis/tool?${p.toString()}`;
}

let cardsPromise: Promise<FahisCardData[]> | null = null;

export function loadFahisCards(): Promise<FahisCardData[]> {
  cardsPromise ??= fetch(`${import.meta.env.BASE_URL}fahis-cards.json?v=${__DATA_VERSION__}`)
    .then((r) => {
      if (!r.ok) throw new Error(`fahis-cards.json: ${r.status}`);
      return r.json();
    })
    .then((d: { cards: FahisCardData[] }) => d.cards);
  return cardsPromise;
}

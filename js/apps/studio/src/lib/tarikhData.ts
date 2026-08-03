/**
 * بياناتُ باب «تاريخ النص» — الأنواعُ والمحمّلاتُ الكسولة.
 *
 * المصدرُ الحاكم لقطةُ `js/data/tarikh-sources/` (الوثيقةُ المختومة v1 وأشجارُها
 * وسجلاتُها)، يبني منها `js/scripts/build-tarikh.mjs` ملفّاتِ العرض. وكلُّ نصٍّ
 * حكميٍّ هنا **منقولٌ حرفًا من v1** — لا صياغةَ من التطبيق.
 *
 * الكسل: فهرسُ الدعاوى ملفٌّ واحدٌ صغير، وكلُّ عنقودٍ ملفٌّ مستقلٌّ لا يُجلب
 * إلا حين يُطلب — فلا يُشحن عنقودٌ قبل فتح دعواه.
 */
import type { GradeId } from "./tarikhTheme";

export interface TarikhField { label: string; note: string | null; inline: string | null; raw: string }
export interface TarikhRuling { raw: string; grades: GradeId[]; body: string }
export interface TarikhClusterRef { ref: string; id: string | null; inSnapshot: boolean }

export interface TarikhClaim {
  id: string; n: number; title: string; route: string;
  grade: GradeId; grades: GradeId[]; rulingsCount: number;
  fields: { claim: TarikhField; manqul: TarikhField; wathaiqi?: TarikhField; hukm: TarikhField; hudud?: TarikhField; yughayyir: TarikhField };
  rulings: TarikhRuling[];
  clusters: TarikhClusterRef[];
  witnessRefs: string[];
  qaydRefs: string[];
}

export interface TarikhWitness { id: string; title: string; raw: string }
export interface TarikhGrade { id: GradeId; label: string; gloss: string }
export interface TarikhClusterBrief {
  id: string; nodes: number; edges: number; records: number; works: number;
  eventTags: string[]; earliestWitness: { record: string; work_ar: string; death_ah: number } | null;
  chronoSuspect: number; nameNodes: number; withJami: number;
}

export interface TarikhClaims {
  version: number;
  source: { doc: string; rev: string; sha256: string; method: { doc: string; sha256: string } };
  head: { title: string; meta: { label: string; raw: string }[] };
  howToRead: { n: number; raw: string }[];
  qoyud: { id: string; raw: string }[];
  grades: TarikhGrade[];
  documentary: { witnesses: TarikhWitness[]; generalLimit: string; preamble: string };
  claims: TarikhClaim[];
  conclusion: { title: string; items: { n: number; raw: string }[] };
  externalRefs: { title: string; raw: string };
  sealLog: { title: string; items: { raw: string }[] };
  clusterIndex: TarikhClusterBrief[];
  /** الميثاقُ الحاكم منقولًا حرفًا — سلّمُ الأدلّة وقواعدُ الفحص وحدودُ المنهج */
  method: {
    title: string; aim: string;
    ladder: { title: string; items: string[] };
    rules: { title: string; items: string[] };
    limits: { title: string; items: string[] };
  };
  /** وصفُ حجم المدوّنة كلِّها، منقولًا من صدر الوثيقة */
  corpusNote: string;
  /** الكتبُ التي جاءت منها الرواياتُ المعروضة، بوفيات مصنِّفيها */
  corpus: { work: string; author: string | null; deathAh: number | null; records: number; clusters: number }[];
}

export interface TarikhNode {
  id: string; label: string; rawiId: number | null; deathYear: number | null; tabaka: number | null;
  students: number; teachers: number; studentsCorroborated: number; singleThreadAbove: number;
  depth: number; flags: string[]; nameNode: boolean; records: string[];
}
export interface TarikhEdge {
  from: string; to: string; chronoSuspect: boolean;
  studentDeathYear: number | null; teacherDeathYear: number | null; records: string[];
}
export interface TarikhRecord {
  /** سجلٌّ لا تبلغه عقدةٌ لأنّه بلا إسنادٍ مسنَد (بلاغٌ ونحوُه) — يُعرض على حِدة */
  chainless: boolean;
  id: string; eventTags: string[];
  source: { workAr: string | null; authorAr: string | null; deathAh: number | null; locus: string | null; uri: string | null };
  fullText: string; isnadRaw: string | null; matnOnly: string | null; jamiRef: string | null; flags: string[];
}
export interface TarikhCandidate {
  node: string; label: string; deathYear: number | null; students: number; studentsCorroborated: number;
  depth: number; singleThreadAbove: number;
  studentsDeathRange: { students: number; with_death_year: number; min: number | null; max: number | null } | null;
  flags: string[]; records: string[];
  branches: { student: string; studentLabel: string; records: string[]; works: string[]; worksCount: number; corroborated: boolean }[];
}
export interface TarikhCluster {
  id: string; mode: string; eventTags: string[]; works: string[]; chainsUsed: number | null;
  representative: string | null;
  earliestWitness: { record: string; work_ar: string; death_ah: number } | null;
  earliestFullySettledRoute: { record: string; work_ar: string; death_ah: number } | null;
  edgesChronoSuspect: number;
  terminalBranching: { node: string; students: number; terminals: string[] } | null;
  nodes: TarikhNode[]; edges: TarikhEdge[];
  chains: { record: string; chainNo: number; nodes: string[] }[];
  candidates: Record<string, { partial: boolean | null; minWorksPerBranch: number | null; minCorroboratedBranches: number | null; candidates: TarikhCandidate[] }>;
  datingSpans: {
    criterion: string; mode: string; node: string; label: string; deathYear: number | null;
    studentsDeathRange: { students: number; with_death_year: number; min: number | null; max: number | null } | null;
    earliestWitness: { record: string; work_ar: string; death_ah: number } | null;
    earliestFullySettled: { record: string; work_ar: string; death_ah: number } | null;
    flags: string[];
  }[];
  records: TarikhRecord[];
}

export interface TarikhTimeline {
  axis: { ceFrom: number; ceTo: number };
  points: { key: string; witness: string; witnessTitle: string; phrase: string; ah: number | null; ce: [number | null, number | null] }[];
  bands: { witness: string; witnessTitle: string; phrase: string; band: string; from: string }[];
}

const base = () => import.meta.env.BASE_URL;
const v = () => __DATA_VERSION__;

function once<T>(cache: { p: Promise<T> | null }, file: string): Promise<T> {
  cache.p ??= fetch(`${base()}${file}?v=${v()}`).then((r) => {
    if (!r.ok) throw new Error(`${file}: ${r.status}`);
    return r.json() as Promise<T>;
  });
  return cache.p;
}

const claimsCache: { p: Promise<TarikhClaims> | null } = { p: null };
export const loadTarikhClaims = () => once(claimsCache, "tarikh-claims.json");

const timelineCache: { p: Promise<TarikhTimeline> | null } = { p: null };
export const loadTarikhTimeline = () => once(timelineCache, "tarikh-timeline.json");

const hukmCache: { p: Promise<{ doc: string; rev: string; sha256: string; markdown: string }> | null } = { p: null };
export const loadTarikhHukm = () => once(hukmCache, "tarikh-hukm.json");

/** العنقودُ لا يُجلب إلا عند طلبه بعينه — وهذا هو التحميلُ الكسول المشترط */
const clusterCache = new Map<string, Promise<TarikhCluster>>();
export function loadTarikhCluster(id: string): Promise<TarikhCluster> {
  let p = clusterCache.get(id);
  if (!p) {
    p = fetch(`${base()}tarikh-cluster-${id}.json?v=${v()}`).then((r) => {
      if (!r.ok) throw new Error(`tarikh-cluster-${id}: ${r.status}`);
      return r.json() as Promise<TarikhCluster>;
    });
    clusterCache.set(id, p);
  }
  return p;
}

/**
 * «الجامع» — موسوعةُ الحديث الشقيقة: كلُّ سجلٍّ جاء منها يحمل معرّفَه فيها
 * (`jamiRef`)، فيُعرض في لوحة العقدة. وأمّا **عنوانُ الجامع على الشبكة** فلم
 * يُنشر بعد، ولا نخترع رابطًا لا يفتح: متى أُقرَّ عنوانُه وُضع هنا فصار المعرّفُ
 * رابطًا حيًّا بلا تغييرٍ آخر (سؤالٌ للإدارة في تقرير خ٧).
 */
export const JAMI_BASE: string | null = null;
export const jamiHref = (ref: string): string | null =>
  JAMI_BASE ? `${JAMI_BASE}${encodeURIComponent(ref)}` : null;

/** أرقامٌ عربيّةٌ لصفحاتِ الباب العربيّةِ الوجه */
export const arNum = (n: number | string) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

/**
 * تمييزُ العدد على وجهه: الواحدُ والاثنان بلفظهما، والثلاثةُ إلى العشرة بجمعٍ
 * مجرور، وما فوقها بمفردٍ منصوب — «سجلٌّ واحد · سجلّان · خمسةُ سجلات · ١٥ سجلًّا».
 */
export function count(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 0) return `لا ${forms.one}`;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n <= 10) return `${arNum(n)} ${forms.few}`;
  return `${arNum(n)} ${forms.many}`;
}
export const COUNTS = {
  record: { one: "سجلٌّ واحد", two: "سجلّان", few: "سجلات", many: "سجلًّا" },
  work: { one: "مصنَّفٌ واحد", two: "مصنَّفان", few: "مصنَّفات", many: "مصنَّفًا" },
  node: { one: "عقدةٌ واحدة", two: "عقدتان", few: "عقد", many: "عقدةً" },
  edge: { one: "حافّةٌ واحدة", two: "حافّتان", few: "حوافّ", many: "حافّةً" },
  student: { one: "تلميذٌ واحد", two: "تلميذان", few: "تلاميذ", many: "تلميذًا" },
  branch: { one: "فرعٌ معتضِدٌ واحد", two: "فرعان معتضدان", few: "فروعٍ معتضدة", many: "فرعًا معتضدًا" },
  cluster: { one: "عنقودٌ واحد", two: "عنقودان", few: "عناقيد", many: "عنقودًا" },
} as const;

/** شرحُ أعلام الجودة على العقد — أسماءٌ فنّيّةٌ تُفكّ للقارئ */
export const FLAG_GLOSS: Record<string, string> = {
  "rawi-unmatched": "لم تُطابَق هذه الحلقةُ براوٍ في قاعدة الرواة",
  "rawi-ambiguous": "الاسمُ يحتمل أكثر من راوٍ فلم تُحسم هويّتُه",
  "rawi-inferred": "الهويّةُ مستنبَطةٌ من السياق لا مصرَّحٌ بها",
  "rawi-relational": "الحلقةُ مذكورةٌ بنسبةٍ إلى غيرها (ابنه، عمّه…)",
  "alias-db-override": "سُوّيت الهويّةُ بقاعدة الأسماء البديلة",
  "prophet-terminus": "منتهى الطريق: النبيّ ﷺ",
};

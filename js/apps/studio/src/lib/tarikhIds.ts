/**
 * تأنيسُ المعرّفات الفنّية في النصّ المعروض.
 *
 * الوثيقةُ وثيقةُ بحث، فتجري فيها لغةُ الأداة: `clx-jamc-0998-af0cf1` لعنقود
 * الطرق، و`r7272` للراوي، و`cl-on-name-node` لعَلَم الجودة، و`yamama` للوسم.
 * وهي لغةٌ لا تنفع قارئًا (أمر المالك ٣ آب ٢٠٢٦: «أظهِر أسماءَ الكتب والمراجع
 * وما يفيد الباحث، وامسح ما لا داعيَ لنشره»).
 *
 * فالبياناتُ تبقى كما هي حرفًا — تفحصها البوّابةُ بمصدرها — و**العرضُ وحده**
 * يُؤنَّس هنا، بثلاث قواعدَ لا رابعَ لها:
 *   ١. معرّفُ العنقود ← رقمُه بالعربيّة («٠٩٩٨») — والاسمُ الكاملُ في تبويب الطرق.
 *   ٢. الوسمُ وعَلَمُ الجودة ← اسمُه بالعربيّة، أو يُطوى إن كان تكرارًا لما حوله.
 *   ٣. معرّفُ الراوي ومعرّفُ السجلّ ← يُطويان، والاسمُ والكتابُ باقيان.
 * لا يُضاف معنًى ولا يُحذف: ما يُبدَّل معرّفٌ باسمه، وما يُطوى معرّفٌ لا خبر.
 */

/** فهرسُ ألقاب العناقيد: المعرّف ← اسمُ أقدمِ كتابٍ فيه (للتبويب لا للمتن) */
export type ClusterLabels = Map<string, string>;

export function clusterLabels(index: { id: string; label: string }[]): ClusterLabels {
  const m: ClusterLabels = new Map();
  for (const c of index) {
    m.set(c.id, c.label);
    const short = c.id.replace(/-[0-9a-f]{6}$/, "");
    if (short !== c.id) m.set(short, c.label);
  }
  return m;
}

const CLUSTER_RE = /clx-jamc-(\d{4})(?:-[0-9a-f]{6})?/g;
const RAWI_RE = /\br\d{3,6}\b\s*[،,؛;]?\s*/g;
const RECORD_RE = /\bjamc-\d{4}\b\s*[،,؛;]?\s*/g;
const arNum = (n: string | number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);

/** رقمُ العنقود بالعربيّة — «٠٩٩٨» */
export const clusterNumber = (id: string) => arNum(id.replace(/^clx-jamc-/, "").replace(/-[0-9a-f]{6}$/, ""));

/**
 * أسماءُ الوسوم وأعلامِ الجودة بالعربيّة. وما قيمتُه `null` يُطوى لأنّ نصَّ
 * الوثيقة حولَه يقوله بالعربيّة أصلًا، فذكرُه تكرارٌ لا إفادة.
 */
const TAG_AR: Record<string, string | null> = {
  "cl-on-name-node": null,          // «عقدة اسمٍ غير مسوّاة» مذكورةٌ قبله في النصّ
  "cluster-suspect": "مشكوكٌ في ضمّه",
  "list-form": "التعداد",
  "kitabat-cahd-nabawi": "كتابة الوحي في العهد النبوي",
  "yamama": "اليمامة",
  "jamc-abibakr": "جمع أبي بكر",
  "suhuf-hafsa": "صحف حفصة",
  "masahif-sahaba": "مصاحف الصحابة",
  "tartib": "ترتيب الآيات والسور",
};
/** رمزٌ فنّيٌّ عامّ: لاتينيٌّ صغيرٌ بشرطات بلا مسافة — يُطوى إن لم يُعرف اسمُه */
const TAG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

/** ما يُفعل بمقطعٍ داخل ` `: اسمُه العربيّ، أو "" ليُطوى، أو null فيبقى كما هو */
export function tagRender(code: string): string | null {
  const k = code.trim();
  if (k in TAG_AR) return TAG_AR[k] ?? "";
  if (/^clx-jamc-/.test(k)) return null;      // العناقيدُ لها قاعدتُها
  if (TAG_RE.test(k)) return "";              // رمزٌ فنّيٌّ مجهولُ الاسم: يُطوى
  return null;                                 // غيرُ ذلك يبقى (أسماءُ مخطوطاتٍ ونحوُها)
}

/** أقواسٌ فرغت بعد الطيّ، ومسافاتٌ مضاعفة، وفواصلُ معلَّقة — تُنظَّف */
export function tidy(s: string): string {
  return s
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/«\s*»/g, "")
    .replace(/\s+([،.؛:])/g, "$1")
    .replace(/\(\s*[،؛,;]\s*/g, "(")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * يُبدَّل معرّفُ العنقود برقمه، ويُطوى معرّفا الراوي والسجلّ.
 * والمقطعُ قد يكون جزءًا من سطرٍ بين توكيدين، فتُحفظ مسافتاه الطرفيّتان.
 */
export function humanize(text: string, _labels?: ClusterLabels): string {
  const lead = /^\s*/.exec(text)![0];
  const tail = /\s*$/.exec(text)![0];
  const core = tidy(
    text
      .replace(CLUSTER_RE, (_m, n: string) => arNum(n))
      .replace(RAWI_RE, "")
      .replace(RECORD_RE, ""),
  );
  return core ? `${lead}${core}${tail}` : "";
}

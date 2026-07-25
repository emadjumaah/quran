/**
 * وسمُ الآية — مصدرٌ واحدٌ للتطبيق كلِّه (توحيدٌ بأمر المالك 2026-07-26:
 * «يجب أن يكون لدينا طريقةٌ واحدةٌ لوسم الآيات»).
 *
 * ثلاثُ درجاتٍ لا رابعَ لها، وكلٌّ بسندِه المعلن:
 *   • **آيةٌ جامعة**  — من «الآيات الجامعة»: اختيارٌ مراجَعٌ بأدلّةٍ محسوبة.
 *   • **قاعدةٌ كبرى** — من الشبكة المفحوصة: مفصِّلاتٌ ≥٨ واتساعُ محاورَ ≥٥.
 *   • **قاعدة**       — من الشبكة المفحوصة: مفصِّلاتٌ ≥٤ وسورٌ ≥٣ وعلاقتان.
 * وما سوى ذلك لا يُوسَم — فأكثرُ المصحف تفصيلٌ، وتكرارُ الوسم تحت كلِّ آيةٍ
 * لا يفيد القارئ (قرار المالك نفسه).
 */
import { classOf } from "./kulliyat";

export type MarkKind = "جامعة" | "كبرى" | "قاعدة" | null;
export interface Mark {
  kind: Exclude<MarkKind, null>;
  /** الاسمُ المعروض */
  label: string;
  /** صنفُ اللون: g جامعة · k كبرى · j قاعدة */
  cls: "g" | "k" | "j";
  /** سندُ الوسم كما يُعرض في التلميح */
  why: string;
}

let curated: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

/** يحمّل مواضعَ «الآيات الجامعة» مرّةً واحدة (٥٠ موضعًا — خفيف) */
export function loadMarks(): Promise<Set<string>> {
  if (curated) return Promise.resolve(curated);
  loading ??= fetch(`${import.meta.env.BASE_URL}kulliyat-curated.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : { kulliyat: [] }))
    .then((j: { kulliyat: { loc: string }[] }) => (curated = new Set(j.kulliyat.map((k) => k.loc))))
    .catch(() => (curated = new Set<string>()));
  return loading;
}

/** وسمُ الموضع — أو null إن لم يتميّز بشيء. يتطلّب تحميلَ الطبقتين. */
export function markOf(loc: string): Mark | null {
  if (curated?.has(loc)) {
    return { kind: "جامعة", label: "آيةٌ جامعة", cls: "g", why: "من «الآيات الجامعة» — اختيارٌ مراجَعٌ بأدلّةٍ محسوبة" };
  }
  const t = classOf(loc)?.tier;
  if (t === "كلّية") return { kind: "كبرى", label: "قاعدةٌ كبرى", cls: "k", why: "من الشبكة المفحوصة: مفصِّلاتٌ ≥٨ واتساعُ محاورَ ≥٥" };
  if (t === "جامعة") return { kind: "قاعدة", label: "قاعدة", cls: "j", why: "من الشبكة المفحوصة: مفصِّلاتٌ ≥٤ وانتشارٌ في ≥٣ سورًا وعلاقتان" };
  return null;
}

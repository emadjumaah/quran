/**
 * **مدخلُ الحزمة المشتركة — الخفيفُ الصافي وحدَه.**
 *
 * ما ثقُل (المسبارُ والمحرّكاتُ وعُدّتُها) يُستورد بمساره صريحًا
 * (`@mishkat/quran-core/lib/sawt/…`) **قصدًا**: لئلّا يجرّ مستوردٌ لكلمةٍ واحدةٍ
 * رزمةَ التعرّف كلَّها إلى حزمة التطبيق.
 */
export * from "./lib/arabicSearch";
export * from "./lib/sawt/mushafIndex";
export type * from "./types";

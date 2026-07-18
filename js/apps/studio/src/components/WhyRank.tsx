/**
 * «لماذا هذه المرتبة؟» — أدلة v3 المعلنة وراء وسم الآية: بواباتُ صيغة القاعدة،
 * وعددُ المفصِّلات الموجهة بعلاقاتها الأربع، واتساعُ المحاور، وشركاءُ التوكيد
 * المتبادل. كل رقمٍ محسوبٌ من الشبكة الموحدة المفحوصة بالسياق — «نحسب ونعرض».
 * نسخة أولى قبل موجات التعميق؛ تقارير المعايرة والامتحان منشورة في المستودع.
 */
import { classOf } from "../kulliyat";
import { surahNameAr } from "../db";
import { getUILang, num } from "../i18n";

const arName = (loc: string) => `${surahNameAr(Number(loc.split(":")[0]))} ${num(loc.split(":")[1])}`;

const RELS: { key: string; ar: string; en: string }[] = [
  { key: "بيان", ar: "بيان", en: "exposition" },
  { key: "مثال", ar: "مثال", en: "instance" },
  { key: "جزاء", ar: "جزاء", en: "recompense" },
  { key: "توكيد", ar: "توكيد", en: "affirmation" },
];

export default function WhyRank({ location }: { location: string }) {
  const cls = classOf(location);
  if (!cls) return null;
  const ar = getUILang() === "ar";
  const rels = cls.rels ?? {};
  const mutual = cls.mutual ?? [];

  return (
    <div className="why">
      <div className="why-head">
        <span>{ar ? "لماذا هذه المرتبة؟" : "Why this tier?"}</span>
        <span className="why-score">{cls.tier}</span>
      </div>
      <p className="why-note">
        {ar
          ? "الوسمُ من الشبكةِ الموحّدة: كلُّ صلةٍ أدناهُ فحصَها قارئٌ مستقلٌّ رأى الزوجَ بمقطعَي سياقِه (اختبارُ الاستغناءِ والافتقار). نسخةٌ أولى قبلَ موجاتِ التعميق — تُحدَّثُ بعدَها، وتقاريرُها منشورة."
          : "The tier comes from the unified network: every link below was examined independently with both passages' context in view. First edition, before the deepening waves — it will be updated, and its reports are published."}
      </p>
      <div className="why-rows">
        {(cls.gates ?? []).length > 0 && (
          <div className="why-row">
            <span className="why-name">{ar ? "صيغةُ قاعدة" : "rule form"}</span>
            <span className="why-val" style={{ flex: 1, textAlign: "start" }}>{(cls.gates ?? []).map((g) => g.split(":")[1] ?? g).join(" · ")}</span>
          </div>
        )}
        {RELS.filter(({ key }) => (rels[key] ?? []).length > 0).map(({ key, ar: la, en }) => (
          <div className="why-row" key={key}>
            <span className="why-name">{ar ? la : en}</span>
            <span className="why-val" style={{ flex: 1, textAlign: "start" }}>
              {num((rels[key] ?? []).length)} — {(rels[key] ?? []).slice(0, 6).map((l) => arName(l)).join("، ")}
              {(rels[key] ?? []).length > 6 ? "…" : ""}
            </span>
          </div>
        ))}
        {mutual.length > 0 && (
          <div className="why-row">
            <span className="why-name">{ar ? "توكيدٌ متبادل" : "mutual affirmation"}</span>
            <span className="why-val" style={{ flex: 1, textAlign: "start" }}>{mutual.slice(0, 6).map((l) => arName(l)).join("، ")}{mutual.length > 6 ? "…" : ""}</span>
          </div>
        )}
        <div className="why-row">
          <span className="why-name">{ar ? "الأدلةُ عددًا" : "totals"}</span>
          <span className="why-val" style={{ flex: 1, textAlign: "start" }}>
            {ar
              ? `${num(cls.m ?? 0)} مفصِّلة · ${num(cls.T ?? 0)} محاور · ${num(cls.mu ?? 0)} مثانٍ`
              : `${num(cls.m ?? 0)} elaborators · ${num(cls.T ?? 0)} axes · ${num(cls.mu ?? 0)} mutual`}
          </span>
        </div>
      </div>
      <div className="why-foot">
        {ar
          ? "كلّية: قاعدةٌ تلتقي عندَها المحاور (مفصِّلاتٌ ≥٨ واتساعٌ ≥٥) · جامعة: مفصِّلاتٌ ≥٣ أو مثانٍ · تفصيل: ما سوى ذلك. العتباتُ عُويرت على نصفِ الضبطِ المجمَّد وحدَه، وامتحانُ العيّنةِ المصونةِ منشورٌ بنتيجتِه قبل التعميق."
          : "kulliyya: axes meet at it (m≥8, spread≥5) · jāmiʿa: m≥3 or mutual · tafṣīl: otherwise. Thresholds tuned on the frozen tune half only; the held-out exam is published with its pre-deepening result."}
      </div>
    </div>
  );
}

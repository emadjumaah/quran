/**
 * لوحةُ الآية — كلُّ ما يخصُّ الآيةَ المعلَّمةَ في بطاقةٍ واحدةٍ منظّمة
 * (أمر المالك 2026-07-29: «ترتيبٌ مميّزٌ واضحٌ وأنيقٌ يعبّر عن هوية مشكاة» —
 * لا أزرارَ متنافرةً ولا قائمةَ نقاطٍ ثلاثًا تُخفي الأدوات).
 *
 * ثلاثُ مناطقَ بيّنة:
 *   الرأس    — موضعُ الآية ووسمُها، ومعه الأفعالُ السريعة: مشاركةٌ وعلامةٌ وإغلاق.
 *   في مشكاة — ما يخصُّ هذه الآيةَ من طبقاتنا المحسوبة (ذهبيٌّ — هويّةُ المشروع):
 *              شبيهُها المحاذى · صلاتُها المفحوصة · لفظُها ذو الوجوه · مثلُها · تدبّر.
 *   الأدوات  — المعهودُ في كل مصحف (هادئ): تفسير · إعراب · أسباب · ترجمة ·
 *              استماع · مجموعة · بطاقة الآية.
 *
 * لوحةٌ واحدةٌ تُفتح في كل وقت (active) — فلا تتراكب اللوحات. تعمل في وضعَي
 * الآيات والصفحات كليهما، فالهويةُ واحدة.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AyahDoc, WordDoc } from "../types";
import { surahNameAr } from "../db";
import { getUILang, num, t } from "../i18n";
import { toggleBookmark, useBookmarks } from "../bookmarks";
import { shareAyah } from "./ShareButton";
import { LinksPanel, TwinPanel, WujuhPanel, useAyahKnowledge } from "./AyahKnows";
import AudioButton, { ayahIdOf } from "./AudioButton";
import CollectButton from "./CollectButton";
import MuhkamaLine from "./MuhkamaLine";
import { SimilarAyahsPanel } from "./SimilarAyahs";
import { EraabPanel } from "./EraabChip";
import RefsPanel from "./RefsPanel";
import { TafsirPanel } from "./TafsirChip";
import { AsbabPanel } from "./AsbabChip";
import { TadabburPanel } from "./TadabburChip";
import Translations from "./Translations";
import { similarOf } from "../similar";

type Active = "twin" | "links" | "wujuh" | "similar" | "tadabbur" | "tafsir" | "eraab" | "refs" | "asbab" | "translate" | null;

export default function AyahPanel({
  ayah,
  words,
  onClose,
  onOpenAyat,
  initialOpen,
}: {
  ayah: AyahDoc;
  words: WordDoc[];
  /** إزالةُ التعليم */
  onClose: () => void;
  /** في وضع الصفحات: زرُّ «الآيات» ينقل للعرض الكامل */
  onOpenAyat?: () => void;
  initialOpen?: Active;
}) {
  const ar = getUILang() === "ar";
  const loc = ayah.location;
  const gid = ayahIdOf(ayah);
  const bookmarks = useBookmarks();
  const bookmarked = bookmarks.includes(loc);
  const { twins, links, wujuh } = useAyahKnowledge(loc);
  const [active, setActive] = useState<Active>(initialOpen ?? null);
  const [shared, setShared] = useState(false);
  const [simCount, setSimCount] = useState(0);
  const prevLoc = useRef(loc);

  useEffect(() => {
    if (prevLoc.current !== loc) { setActive(null); prevLoc.current = loc; }
  }, [loc]);
  useEffect(() => {
    let live = true;
    similarOf(gid).then((ns) => live && setSimCount(ns.length)).catch(() => {});
    return () => { live = false; };
  }, [gid]);

  const toggle = (k: Active) => setActive(active === k ? null : k);
  const share = async () => {
    const r = await shareAyah({
      text: words.map((w) => w.textUthmani).join(" "),
      surahName: surahNameAr(ayah.surahNo),
      ayahNo: num(ayah.ayahNo),
      loc,
    });
    if (r === "copied") { setShared(true); window.setTimeout(() => setShared(false), 1600); }
  };

  const know: { k: Active; label: string; n?: number; title: string }[] = [];
  if (twins?.length) know.push({ k: "twin", label: ar ? "شبيهُها" : "Twin", n: twins.length, title: ar ? "آيةٌ تشبهها — محاذاةً كلمةً بكلمة والفرقُ مميَّز" : "aligned near-identical verse" });
  if (links?.length) know.push({ k: "links", label: ar ? "صلاتُها" : "Links", n: links.length, title: ar ? "صلاتٌ فحصها قارئٌ مستقلٌّ بمقطعَي سياقها" : "examined links" });
  if (wujuh?.length) know.push({ k: "wujuh", label: ar ? "وجوهُها" : "Senses", title: ar ? `«${wujuh[0].lemma}» معناها هنا غيرُ معناها في مواضعَ أخرى` : "polysemous word here" });
  if (simCount > 0) know.push({ k: "similar", label: ar ? "مثلُها" : "Alike", n: simCount, title: ar ? "أقربُ الآيات معنًى — بالمتّجهات المحسوبة" : "closest verses in meaning" });
  // «تدبّر» صار يجيب بلغة الواجهة (2026-07-29) — فيُعرض للجميع
  know.push({ k: "tadabbur", label: ar ? "تدبّر" : "Reflect", title: ar ? "إعانةٌ على التدبّر بأدواتنا — ليست تفسيرًا" : "a reflection aid from our own material — not tafsir" });

  // الأدواتُ العربيةُ المحض (التفاسيرُ والإعرابُ والأسباب) تُطوى عند الإنجليزية،
  // والترجمةُ متنٌ دائمٌ هناك فلا يلزم زرُّها
  const tools: { k: Active; label: string }[] = ar
    ? [
        { k: "tafsir", label: "التفسير" },
        { k: "eraab", label: "الإعراب" },
        { k: "refs", label: "المراجع" },
        { k: "asbab", label: "سببُ النزول" },
        { k: "translate", label: "الترجمة" },
      ]
    : [];

  return (
    <div className="ayah-panel" onClick={(e) => e.stopPropagation()}>
      <div className="ap-head">
        <span className="ap-ref">{surahNameAr(ayah.surahNo)} {num(ayah.ayahNo)}</span>
        {ayah.sajdaType && <span className="chip gold" title={ayah.sajdaType}>۩ {t("reader.sajda")}</span>}
        <MuhkamaLine location={loc} />
        <span className="ap-meta muted">{t("reader.juz")} {num(ayah.juz)} · {t("reader.page")} {num(ayah.page)}</span>
        <span style={{ flex: 1 }} />
        {onOpenAyat && (
          <button className="ap-ic ap-ic-txt" onClick={onOpenAyat} title={ar ? "افتح في عرض الآيات" : "open in ayah view"}>{ar ? "الآيات" : "verses"}</button>
        )}
        <button className="ap-ic" onClick={share} title={ar ? "مشاركة الآية: نصُّها وموضعُها ورابطُها" : "share this āya"}>
          {shared ? "✓" : (
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="2.4" /><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="19" r="2.4" />
              <path d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4" />
            </svg>
          )}
        </button>
        <button className={`ap-ic${bookmarked ? " on" : ""}`} onClick={() => toggleBookmark(loc)} title={ar ? "علامة مرجعية — تُحفظ في قائمة العلامات أعلى الصفحة" : "bookmark — saved to the list in the header"}>
          {bookmarked ? <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3.5h12v17l-6-4.4-6 4.4z" /></svg> : <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3.5h12v17l-6-4.4-6 4.4z" /></svg>}
        </button>
        <button className="ap-ic" onClick={onClose} title={ar ? "إزالة التعليم" : "clear"}>✕</button>
      </div>

      <div className="ap-row ap-know">
        <span className="ap-cat" title={ar ? "طبقاتُ مشكاة المحسوبة — ما لا تجده في غيرها" : "Mishkat's computed layers"}>{ar ? "في مشكاة" : "In Mishkāt"}</span>
        {know.map((b) => (
          <button key={b.k} className={`ap-btn g${active === b.k ? " on" : ""}`} onClick={() => toggle(b.k)} title={b.title}>
            {b.label}{b.n != null && <b className="ap-n">{num(b.n)}</b>}
          </button>
        ))}
      </div>

      <div className="ap-row ap-tools">
        <span className="ap-cat">{ar ? "الأدوات" : "Tools"}</span>
        {tools.map((b) => (
          <button key={b.k} className={`ap-btn${active === b.k ? " on" : ""}`} onClick={() => toggle(b.k)}>{b.label}</button>
        ))}
        <span className="ap-audio"><AudioButton ayahId={gid} /></span>
        <span className="ap-collect"><CollectButton locations={[loc]} criterion={{ kind: "manual", value: loc }} label={ar ? "⊕ مجموعة" : "⊕ collect"} /></span>
        {/* **مدخلُ نبراس من الآية** (أمر المالك 2026-08-14): زال الزرُّ الطائرُ من
            فوق المصحف، ودخل من موضعه — والسؤالُ يذهب **مسبوقًا بموضعه**، فيصير
            نبراس جوابًا عن آيةٍ بعينها لا محادثةً بلا سياق. */}
        <Link
          to={`/assistant?q=${encodeURIComponent(
            ar
              ? `في ${surahNameAr(ayah.surahNo)} ${num(ayah.ayahNo)}: `
              : `On ${surahNameAr(ayah.surahNo)} ${ayah.ayahNo}: `,
          )}`}
          className="ap-btn ap-ask"
          title={ar ? "اسأل مشكاة عن هذه الآية — محادثةُ ذكاءٍ اصطناعيّ" : "Ask Mishkat about this āya — an AI chat"}
        >
          <span className="ai-spark" aria-hidden /> {ar ? "اسأل عن هذه الآية" : "Ask about this āya"}
        </Link>
        <Link to={`/aya/${ayah.surahNo}/${ayah.ayahNo}`} className="ap-btn ap-link">{ar ? "بطاقةُ الآية" : "Verse card"} ←</Link>
      </div>

      {active && (
        <div className="ap-panel-slot">
          {active === "twin" && twins?.length ? <TwinPanel loc={loc} pairs={twins} /> : null}
          {active === "links" && links?.length ? <LinksPanel loc={loc} links={links} /> : null}
          {active === "wujuh" && wujuh?.length ? <WujuhPanel hits={wujuh} /> : null}
          {active === "similar" && <SimilarAyahsPanel ayahId={gid} location={loc} />}
          <TadabburPanel ayah={ayah} ayahId={gid} open={active === "tadabbur"} />
          <TafsirPanel location={loc} open={active === "tafsir"} />
          <EraabPanel location={loc} open={active === "eraab"} />
          <RefsPanel location={loc} open={active === "refs"} />
          <AsbabPanel location={loc} open={active === "asbab"} />
          {active === "translate" && <Translations ayah={ayah} open />}
        </div>
      )}
    </div>
  );
}

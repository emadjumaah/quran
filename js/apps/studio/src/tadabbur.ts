/**
 * مساعد التدبّر (client) — gathers ONLY our own material for a verse (its text,
 * translation, إعراب from المجتبى, and the verses closest to it in meaning) and
 * asks /api/tadabbur to organise it into a grounded reflection. No outside
 * knowledge is sent; the server prompt forbids adding any. «إعانة، لا تفسير».
 */
import type { AyahDoc } from "./types";
import { getUILang } from "./i18n";
import { loadEraab, type EraabEntry } from "./eraab";
import { similarOf } from "./similar";
import { ayahByLocationMap, getAyahByGlobalNo, getRoot, surahNameAr, wordsOfAyah } from "./db";
import { loadSiyaq, unitOf } from "./siyaq";
import { classOf, loadKulliyat } from "./kulliyat";

/**
 * التدبّرُ المولَّدُ مسبقًا — يُقرأ من ملفٍّ ساكنٍ لا من نداءٍ لكلِّ قارئ.
 *
 * علّةُ ذلك (رصدها المالك 2026-07-31): مادّةُ التدبّر **محسوبةٌ كلُّها من
 * عندنا** — الآيةُ وسياقُها وإعرابُها وجذورُها — فالمخرَجُ ثابتٌ لكلِّ آية،
 * ولو نقر ألفُ قارئٍ على الآية نفسِها لتكرّر النداءُ ألفًا بلا فائدة. فوُلّد
 * مرّةً واحدةً وشُظّي بالسور. والفائدةُ الأكبرُ ليست الكلفةَ بل **أنّ النصَّ
 * يُراجَع قبل أن يقرأه أحد**.
 *
 * وما لم يُولَّد بعدُ يعود إلى الواجهة، فالتغطيةُ تنمو والنداءُ يتناقص.
 */
const cache = new Map<string, Record<string, string> | null>();
async function pregenerated(loc: string, lang: string): Promise<string | null> {
  const sura = loc.split(":")[0];
  const key = `${lang}/${sura}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      await fetch(`${import.meta.env.BASE_URL}tadabbur/${key}.json?v=${__DATA_VERSION__}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return cache.get(key)?.[loc] ?? null;
}

export async function askTadabbur(ayah: AyahDoc, ayahId: number): Promise<string> {
  const lang = getUILang() === "ar" ? "ar" : "en";
  const ready = await pregenerated(ayah.location, lang);
  if (ready) return ready;

  const [eraabMap, neighbors, words] = await Promise.all([
    loadEraab().catch(() => ({}) as Record<string, EraabEntry>),
    similarOf(ayahId).catch(() => [] as { ayahId: number; score: number }[]),
    wordsOfAyah(ayah.surahNo, ayah.ayahNo).catch(() => []),
    loadSiyaq().catch(() => null),
    loadKulliyat().catch(() => null),
  ]);

  // وحدةُ السياق الحاوية للآية — طبقتُنا المعتمدة (١٤٠٤ وحدة). كانت غائبةً عن
  // التدبّر (رصدها المالك 2026-07-21): الآيةُ تُتدبَّر في سياقها لا مبتورةً.
  const unit = unitOf(ayah.location);
  let siyaq: { name: string; span: string; text: string; place: string } | null = null;
  if (unit) {
    const texts = await ayahByLocationMap().catch(() => new Map<string, AyahDoc>());
    const parts: string[] = [];
    for (let a = unit.a1; a <= unit.a2; a++) {
      const t = texts.get(`${unit.s}:${a}`)?.textClean;
      if (t) parts.push(a === ayah.ayahNo ? `⟪${t}⟫` : t);
    }
    const full = parts.join(" ۝ ");
    siyaq = {
      name: unit.name,
      span: `${surahNameAr(unit.s)} ${unit.a1}–${unit.a2}`,
      text: full.length > 1800 ? `${full.slice(0, 1800)}…` : full,
      place: `الآيةُ ${ayah.ayahNo} من مقطعٍ يمتدُّ ${unit.a1}–${unit.a2} (المعلَّمةُ بين ⟪⟫)`,
    };
  }

  // صلاتُ الشبكة المفحوصة عند هذه الآية — بيانٌ/مثالٌ/جزاءٌ/توكيد، بمواضعها
  const cls = classOf(ayah.location);
  const links: string[] = [];
  if (cls?.rels) {
    const texts = await ayahByLocationMap().catch(() => new Map<string, AyahDoc>());
    for (const [rel, locs] of Object.entries(cls.rels)) {
      for (const l of locs.slice(0, 2)) {
        const t = texts.get(l)?.textClean;
        if (t) links.push(`[${rel}] ${surahNameAr(Number(l.split(":")[0]))} ${l.split(":")[1]}: ${t.slice(0, 190)}`);
      }
      if (links.length >= 6) break;
    }
  }

  // the 4 verses closest to it in meaning (precomputed neighbours) — short texts
  const neighborAyahs = await Promise.all(
    neighbors.slice(0, 4).map((n) => getAyahByGlobalNo(n.ayahId).catch(() => null)),
  );
  const neighborTexts = neighborAyahs.flatMap((a) =>
    a ? [`${surahNameAr(a.surahNo)} ${a.ayahNo}: ${a.textClean}`] : [],
  );

  // the core lexical sense (الراغب/مقاييس) of up to 4 distinct content roots — kept
  // short (~first sentence) so the grounding is rich but the prompt stays lean.
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const w of words) {
    if (!w.root || seen.has(w.root)) continue;
    seen.add(w.root);
    if (roots.length >= 4) break;
    const rd = await getRoot(w.root).catch(() => null);
    const m = rd?.meanings?.[0]?.text;
    if (m) roots.push(`«${w.root}»: ${m.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  }

  // GET بموضعٍ ولغة: مفتاحٌ ثابتٌ في المسار، فتخزّنه شبكةُ فيرسل **على مستوى
  // النظام لا المتصفّح** — أوّلُ قارئٍ يولّد ومن بعده يأخذ المخزَّن. والمادّةُ
  // تُقرأ في الواجهة من ملفٍّ ساكنٍ (tadabbur-material) فلا تُرسَل في الطلب.
  const res = await fetch(`/api/tadabbur?loc=${encodeURIComponent(ayah.location)}&lang=${lang}`);
  if (res.ok) return (await res.json()).text as string;

  // وإن تعذّر — طريقُ POST القديم بالمادّة كاملةً من المتصفّح
  const fallback = await fetch("/api/tadabbur", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      verse: ayah.textClean,
      ref: `${surahNameAr(ayah.surahNo)} ${ayah.ayahNo}`,
      translation: ayah.translations?.en,
      eraab: eraabMap[ayah.location]?.t?.slice(0, 700),
      roots,
      neighbors: neighborTexts,
      siyaq,
      links,
      tier: cls?.tier,
      lang,
    }),
  });
  if (!fallback.ok) {
    const e = await fallback.json().catch(() => ({}) as { error?: string });
    throw new Error(e.error || `HTTP ${fallback.status}`);
  }
  return (await fallback.json()).text as string;
}

/**
 * مساعد التدبّر (client) — gathers ONLY our own material for a verse (its text,
 * translation, إعراب from المجتبى, and the verses closest to it in meaning) and
 * asks /api/tadabbur to organise it into a grounded reflection. No outside
 * knowledge is sent; the server prompt forbids adding any. «إعانة، لا تفسير».
 */
import type { AyahDoc } from "./types";
import { loadEraab, type EraabEntry } from "./eraab";
import { similarOf } from "./similar";
import { getAyahByGlobalNo, getRoot, surahNameAr, wordsOfAyah } from "./db";

export async function askTadabbur(ayah: AyahDoc, ayahId: number): Promise<string> {
  const [eraabMap, neighbors, words] = await Promise.all([
    loadEraab().catch(() => ({}) as Record<string, EraabEntry>),
    similarOf(ayahId).catch(() => [] as { ayahId: number; score: number }[]),
    wordsOfAyah(ayah.surahNo, ayah.ayahNo).catch(() => []),
  ]);

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

  const res = await fetch("/api/tadabbur", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      verse: ayah.textClean,
      ref: `${surahNameAr(ayah.surahNo)} ${ayah.ayahNo}`,
      translation: ayah.translations?.en,
      eraab: eraabMap[ayah.location]?.t?.slice(0, 700),
      roots,
      neighbors: neighborTexts,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return (await res.json()).text as string;
}

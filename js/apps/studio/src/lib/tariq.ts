/**
 * فهرس المطروق — أين طرق العلماءُ هذا الجذر/هذا الموضع في متون مكتبة البيان التسعة.
 * ملفٌ واحد (public/bayan-tariq.json) يُجلب مرةً عند أول طلب، فيصير جسرًا من أي
 * موضعٍ في المشروع إلى مظانّه من الكتب — منهجية البيان §٦.
 */
import { useEffect, useState } from "react";

export interface TariqIndex {
  roots: Record<string, [string, number][]>;   // جذر → [كتاب, عدد المداخل]
  ayas: Record<string, [string, string][]>;    // موضع → [كتاب, معرّف المدخل]
}

export const BOOK_LABEL: Record<string, string> = {
  furuqaskari: "الفروق اللغوية", basair: "بصائر ذوي التمييز", wujuhaskari: "الوجوه والنظائر",
  nuzha: "نزهة الأعين النواظر", damghani: "قاموس القرآن", durra: "درة التنزيل",
  malak: "ملاك التأويل", burhan: "البرهان", itqan: "الإتقان",
};
/** كتب المتشابه والأنواع — المسندة إلى المواضع لا إلى المداخل */
export const VERSE_BOOKS = new Set(["durra", "malak", "burhan", "itqan"]);

let cache: TariqIndex | null = null;
let inflight: Promise<TariqIndex | null> | null = null;

export function loadTariq(): Promise<TariqIndex | null> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}bayan-tariq.json?v=${__DATA_VERSION__}`)
      .then((r) => r.json())
      .then((d: TariqIndex) => { cache = d; return d; })
      .catch(() => null);
  }
  return inflight;
}

export function useTariq(): TariqIndex | null {
  const [t, setT] = useState<TariqIndex | null>(cache);
  useEffect(() => { if (!cache) loadTariq().then(setT); }, []);
  return t;
}

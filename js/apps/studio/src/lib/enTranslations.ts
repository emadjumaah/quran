/**
 * مخزنُ الترجمات الإنجليزية — «مشكاة مرجعًا لغير العرب» (أمر المالك 2026-07-29:
 * أشهرُ الترجمات، وتقليبُها في مكان القراءة).
 *
 * ستُّ ترجماتٍ من أشهر ما يُقرأ به القرآن بالإنجليزية:
 *   صحيح إنترناشونال (مضمّنةٌ في قاعدة التطبيق) · بيكثال · يوسف علي ·
 *   هلالي وخان · آربري · المودودي — الخمسُ الأخيرة ملفّاتٌ جانبيّةٌ من مشروع
 *   تنزيل (Tanzil.net، بشرط النسبة وعدم التغيير — منسوبةٌ في «عن المشروع»)،
 *   تُجلب عند أول طلبٍ وتبقى في الذاكرة، مفهرسةً برقم الآية الكلّيّ (١..٦٢٣٦).
 */
import { useSyncExternalStore } from "react";
import type { AyahDoc } from "../types";

export interface TransMeta {
  id: string;
  /** الاسمُ كما يعرفه القارئ الإنجليزي */
  label: string;
  short: string;
  /** مضمّنةٌ في وثيقة الآية (ayah.translations.en) لا في ملف جانبي */
  builtin?: boolean;
}

export const EN_TRANSLATIONS: TransMeta[] = [
  { id: "sahih", label: "Saheeh International", short: "Saheeh", builtin: true },
  { id: "en.pickthall", label: "Pickthall", short: "Pickthall" },
  { id: "en.yusufali", label: "Yusuf Ali", short: "Yusuf Ali" },
  { id: "en.hilali", label: "Hilali & Khan", short: "Hilali-Khan" },
  { id: "en.arberry", label: "Arberry", short: "Arberry" },
  { id: "en.maududi", label: "Maududi", short: "Maududi" },
];

const KEY = "mishkat:en-translation";
let active = localStorage.getItem(KEY) ?? "sahih";
const cache = new Map<string, string[]>();
const loadingSet = new Set<string>();

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export function setActiveTranslation(id: string) {
  active = id;
  localStorage.setItem(KEY, id);
  void ensureLoaded(id);
  notify();
}

async function ensureLoaded(id: string): Promise<void> {
  const meta = EN_TRANSLATIONS.find((t) => t.id === id);
  if (!meta || meta.builtin || cache.has(id) || loadingSet.has(id)) return;
  loadingSet.add(id);
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}trans/${id}.json?v=${__DATA_VERSION__}`);
    if (r.ok) cache.set(id, (await r.json()) as string[]);
  } catch { /* تبقى صحيح إنترناشونال احتياطًا */ }
  loadingSet.delete(id);
  notify();
}

/** نصُّ الترجمة الفعّالة لآيةٍ — يسقط إلى صحيح إنترناشونال ريثما يصل الملف */
export function translationOf(ayah: AyahDoc): { text: string; meta: TransMeta } {
  const meta = EN_TRANSLATIONS.find((t) => t.id === active) ?? EN_TRANSLATIONS[0];
  if (!meta.builtin) {
    const arr = cache.get(meta.id);
    const gid = Number(ayah._id.slice(1));
    const text = arr?.[gid - 1];
    if (text) return { text, meta };
    void ensureLoaded(meta.id);
  }
  return { text: ayah.translations?.en ?? "", meta: meta.builtin ? meta : EN_TRANSLATIONS[0] };
}

/** الحالةُ التفاعلية: الفعّالةُ + عدّادُ وصول الملفات (لإعادة الرسم) */
export function useEnTranslation(): string {
  return useSyncExternalStore(subscribe, () => `${active}|${cache.size}`);
}
export const activeTranslationId = (): string => active;

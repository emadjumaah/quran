/**
 * البحث المفتوح — محرّكٌ واحدٌ للبحث النصّي في المصحف، بطبقاتٍ تتدرّج من الأدقّ
 * إلى الأوسع، كلُّها محليّةٌ حتميّةٌ بلا نداءٍ خارجي (قرار المالك 2026-07-21:
 * «البحث منضبطٌ زيادة — نريده مفتوحًا أكثر قليلًا»).
 *
 * الطبقات، ونتيجةُ كلٍّ موسومةٌ بسببها فيعرف الباحثُ لِمَ ظهرت:
 *   ١ «نصّ»    — مطابقةُ FTS التامّة (كلُّ الكلمات في الآية) — الأدقّ، تتصدّر.
 *   ٢ «تقريب»  — احتواءٌ حرفيٌّ بعد تجريد التشكيل وتوحيد الحروف: يلتقط «الصبر»
 *                لمن كتب «صبر»، و«ءامنوا» لمن كتب «آمنوا».
 *   ٣ «جذر»    — جذرُ الكلمة ومواضعُه كلُّها: «صبر» تأتي بالصابرين واصبروا وصبرًا.
 *   ٤ «بعض»    — عند تعدّد الكلمات: آياتٌ فيها بعضُ الكلمات لا كلُّها، مرتّبةً
 *                بعدد ما طابق. (يظهر فقط إن قلَّت نتائجُ ما قبله.)
 *
 * الترتيب داخل النتيجة: بحسب الطبقة ثم ترتيب المصحف — لا درجةَ مخترعة.
 */
import { allAyahs, ayahLocationsOfRoot, fuzzyRoots, searchAyahs } from "../db";
import type { AyahDoc } from "../types";
import { fuzzyNorm } from "./fuzzy";

export type MatchHow = "نص" | "تقريب" | "جذر" | "بعض";
export interface OpenHit {
  ayah: AyahDoc;
  how: MatchHow;
  /** الجذرُ الذي جاءت منه (للطبقة ٣) */
  root?: string;
  /** كم كلمةً من كلمات السؤال طابقت (للطبقة ٤) */
  matched?: number;
}

const HOW_ORDER: Record<MatchHow, number> = { نص: 0, تقريب: 1, جذر: 2, بعض: 3 };
const mushafKey = (loc: string): number => {
  const [s, a] = loc.split(":").map(Number);
  return s * 1000 + a;
};

/** فهرسٌ مطبَّعٌ لكل الآيات، يُبنى مرّةً واحدة (٦٢٣٦ سطرًا — مسحُه فوريّ) */
let normIndex: { ayah: AyahDoc; norm: string }[] | null = null;
let indexing: Promise<{ ayah: AyahDoc; norm: string }[]> | null = null;
async function index(): Promise<{ ayah: AyahDoc; norm: string }[]> {
  if (normIndex) return normIndex;
  indexing ??= allAyahs()
    .then((list) => {
      normIndex = list.map((ayah) => ({ ayah, norm: fuzzyNorm(ayah.textClean || ayah.textUthmani) }));
      return normIndex;
    })
    .catch(() => {
      indexing = null;
      return [];
    });
  return indexing;
}

/** كلماتُ السؤال بعد التطبيع، بلا حروفِ العطف/الجرّ الملتصقة وحدَها */
function tokens(query: string): string[] {
  return fuzzyNorm(query)
    .replace(/[^؀-ۿ\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** كلمةٌ ذاتُ معنًى يُرجى لها جذر (نتجاوز الأدوات الشائعة) */
const STOP = new Set(["من", "في", "على", "الى", "عن", "مع", "هذا", "هذه", "ذلك", "التي", "الذي", "ما", "لا", "ان", "او", "ثم", "قد", "كل", "بين", "عند", "بعد", "قبل", "هو", "هي", "كان", "يكون"]);

export interface OpenSearchResult {
  hits: OpenHit[];
  /** أعدادُ كلِّ طبقةٍ — تُعرض للباحث بيانًا لا زينة */
  counts: Record<MatchHow, number>;
  /** الجذورُ التي وُسِّع بها البحث (إن وُجدت) */
  roots: string[];
}

/**
 * بحثٌ نصّيٌّ مفتوح. `min` عتبةُ الاكتفاء: ما دامت النتائجُ دونها نمضي للطبقة
 * التالية — فالدقيقُ يتصدّر دائمًا، والتوسيعُ لا يُزاحمه بل يُذيَّل به.
 */
export async function openSearch(query: string, opts?: { min?: number; cap?: number }): Promise<OpenSearchResult> {
  const q = query.trim();
  const counts: Record<MatchHow, number> = { نص: 0, تقريب: 0, جذر: 0, بعض: 0 };
  if (!q) return { hits: [], counts, roots: [] };
  const min = opts?.min ?? 12;
  const cap = opts?.cap ?? 300;
  const toks = tokens(q);
  const seen = new Map<string, OpenHit>();
  const add = (ayah: AyahDoc, how: MatchHow, extra?: Partial<OpenHit>) => {
    if (seen.has(ayah.location)) return;
    seen.set(ayah.location, { ayah, how, ...extra });
    counts[how]++;
  };

  // ١ — المطابقةُ النصّية التامّة (FTS)
  try {
    for (const a of await searchAyahs(q)) add(a, "نص");
  } catch { /* صيغةٌ لا يقبلها FTS — تتكفّل بها الطبقاتُ التالية */ }

  // ٢ — الاحتواءُ الحرفيُّ المطبَّع (كلُّ الكلمات)
  if (seen.size < cap && toks.length) {
    const rows = await index();
    for (const { ayah, norm } of rows) {
      if (seen.size >= cap) break;
      if (toks.every((t) => norm.includes(t))) add(ayah, "تقريب");
    }
  }

  // ٣ — التوسيعُ بالجذر: لكلِّ كلمةٍ ذاتِ معنًى جذرُها ومواضعُه
  const roots: string[] = [];
  if (seen.size < cap) {
    const content = toks.filter((t) => t.length >= 3 && !STOP.has(t)).slice(0, 3);
    for (const t of content) {
      const rm = await fuzzyRoots(t, 1).catch(() => []);
      const rd = rm[0];
      // نقبل الجذرَ القريب جدًّا فقط — لا نفتح البابَ لجذرٍ بعيدٍ عن الكلمة
      if (!rd || rd.dist > 1) continue;
      roots.push(rd.doc.root);
      const locs = ayahLocationsOfRoot(rd.doc);
      if (!locs.length) continue;
      const rows = await index();
      const byLoc = new Map(rows.map((r) => [r.ayah.location, r.ayah]));
      for (const loc of locs) {
        if (seen.size >= cap) break;
        const a = byLoc.get(loc);
        if (a) add(a, "جذر", { root: rd.doc.root });
      }
    }
  }

  // ٤ — بعضُ الكلمات (عند تعدّدها وقلّةِ ما سبق)
  if (seen.size < min && toks.length > 1) {
    const rows = await index();
    const partial: { ayah: AyahDoc; matched: number }[] = [];
    for (const { ayah, norm } of rows) {
      if (seen.has(ayah.location)) continue;
      const matched = toks.filter((t) => norm.includes(t)).length;
      if (matched > 0) partial.push({ ayah, matched });
    }
    partial.sort((a, b) => b.matched - a.matched || mushafKey(a.ayah.location) - mushafKey(b.ayah.location));
    for (const p of partial.slice(0, Math.max(0, cap - seen.size))) add(p.ayah, "بعض", { matched: p.matched });
  }

  const hits = [...seen.values()].sort(
    (a, b) => HOW_ORDER[a.how] - HOW_ORDER[b.how] || mushafKey(a.ayah.location) - mushafKey(b.ayah.location),
  );
  return { hits, counts, roots: [...new Set(roots)] };
}

/** وسمُ سببِ الظهور كما يُعرض للقارئ */
export function howLabel(h: OpenHit, ar: boolean): string {
  if (h.how === "نص") return "";
  if (h.how === "تقريب") return ar ? "مطابقةٌ تقريبيّة" : "approximate";
  if (h.how === "جذر") return ar ? `من الجذر ${h.root}` : `root ${h.root}`;
  return ar ? "بعضُ كلمات السؤال" : "some words";
}

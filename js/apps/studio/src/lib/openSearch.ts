/**
 * البحثُ النصّيُّ في المصحف — محرِّكٌ واحدٌ لكلِّ صناديق البحث (2026-07-21).
 *
 * بُني على MiniSearch (فهرسٌ مقلوبٌ في المتصفّح، ترتيبٌ بـBM25) فوق محلِّلنا
 * العربيّ (lib/arabicSearch): تطبيعُ الهمزات والتاء والألف المقصورة، ونزعُ
 * السوابق واللواحق المتّصلة، ومفتاحُ هيكلٍ بلا ألفات. فيجد الباحثُ الآيةَ سواءٌ
 * كتب «أكثرهم» أو «فأكثرهم» أو «وأكثرهم»، و«قارئ» أو «قارء»، و«الرحمن» أو «الرحمان».
 *
 * الترتيبُ معلَنٌ ومرتّبٌ بالدقّة، وكلُّ نتيجةٍ موسومةٌ بسببِ ظهورها:
 *   «عبارة» — العبارةُ بحروفها متّصلةً في الآية (أدقُّ ما يكون، تتصدّر).
 *   «نص»    — كلُّ كلمات السؤال في الآية (بأيِّ صورةٍ من صور الكلمة).
 *   «تقريب» — مطابقةٌ بالتقريب (بادئةٌ أو خطأٌ حرفيٌّ يسير) بترتيب BM25.
 *   «جذر»   — مواضعُ جذرِ الكلمة كلُّها (توسيعٌ صرفيٌّ من قاعدتنا).
 *   «بعض»   — بعضُ كلمات السؤال لا كلُّها (لا يظهر إلا عند قلّة ما سبق).
 */
import MiniSearch from "minisearch";
import { allAyahs, ayahLocationsOfRoot, fuzzyRoots, searchAyahs } from "../db";
import type { AyahDoc } from "../types";
import { dePrefixAr, normalizeAr, stemAr, variantsAr } from "@mishkat/quran-core/lib/arabicSearch";

export type MatchHow = "عبارة" | "نص" | "تقريب" | "جذر" | "بعض";
export interface OpenHit {
  ayah: AyahDoc;
  how: MatchHow;
  /** الجذرُ الذي جاءت منه (للطبقة «جذر») */
  root?: string;
  /** ترتيبُ الصلة من الفهرس (كلّما كبر قوي) */
  rank?: number;
}

const HOW_ORDER: Record<MatchHow, number> = { عبارة: 0, نص: 1, تقريب: 2, جذر: 3, بعض: 4 };
const mushafKey = (loc: string): number => {
  const [s, a] = loc.split(":").map(Number);
  return s * 1000 + a;
};

interface Row {
  ayah: AyahDoc;
  norm: string;
  /** لبابُ كلماتها (بلا السوابق الموسومة في QAC) موازيًا لكلمات norm — إن اختلف */
  cores?: string[];
  coreText?: string;
}
let rows: Row[] | null = null;
let rowByLoc: Map<string, Row> | null = null;
let mini: MiniSearch<{ id: string; text: string }> | null = null;
let building: Promise<void> | null = null;

/** فهرسُ البحث — يُبنى مرّةً واحدةً في الجلسة (٦٢٣٦ آيةً، أجزاءُ ثانية).
 *  منهجُ السوابق (2026-07-29): جهةُ النصِّ يقينيّةٌ من الوسم الصرفيّ — لبابُ
 *  كلِّ كلمةٍ بعد نزع سوابقها الموسومة (search-cores.json) يُطابَق ويُفهرَس
 *  بجانب صورتها الكاملة؛ وجهةُ السؤال ظنّيّةٌ محروسة (dePrefixAr). */
async function ensureIndex(): Promise<void> {
  if (mini && rows) return;
  building ??= (async () => {
    const [list, coresDoc] = await Promise.all([
      allAyahs(),
      fetch(`${import.meta.env.BASE_URL}search-cores.json?v=${__DATA_VERSION__}`)
        .then((r) => (r.ok ? r.json() : { ayahs: {} }))
        .catch(() => ({ ayahs: {} })) as Promise<{ ayahs: Record<string, string> }>,
    ]);
    rows = list.map((ayah) => {
      const norm = normalizeAr(ayah.textClean || ayah.textUthmani);
      const row: Row = { ayah, norm };
      const c = coresDoc.ayahs[ayah.location];
      if (c) {
        const cores = c.split(" ");
        // ضمانةُ المحاذاة: عددُ اللباب يساوي عددَ كلمات النص وإلا أُهمل
        if (cores.length === norm.split(" ").length) {
          row.cores = cores;
          row.coreText = c;
        }
      }
      return row;
    });
    rowByLoc = new Map(rows.map((r) => [r.ayah.location, r]));
    const ms = new MiniSearch<{ id: string; text: string }>({
      fields: ["text"],
      storeFields: [],
      // كلُّ كلمةٍ تُفهرَس بصورها: المطبَّعةُ وجذعُها وهيكلُها — ولبابُها كذلك
      tokenize: (text) => text.split(" ").filter(Boolean).flatMap((t) => variantsAr(t)),
      processTerm: (term) => term || null,
      searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "AND" },
    });
    ms.addAll(rows.map((r) => ({ id: r.ayah.location, text: r.coreText ? `${r.norm} ${r.coreText}` : r.norm })));
    mini = ms;
  })().catch((e) => {
    building = null;
    throw e;
  });
  return building;
}

const STOP = new Set(["من", "في", "علي", "الي", "عن", "مع", "هذا", "هذه", "ذلك", "التي", "الذي", "ما", "لا", "ان", "او", "ثم", "قد", "كل", "بين", "عند", "بعد", "قبل", "هو", "هي", "كان", "يكون"]);

export interface OpenSearchResult {
  hits: OpenHit[];
  counts: Record<MatchHow, number>;
  /** الجذورُ التي وُسِّع بها البحث (إن وُجدت) */
  roots: string[];
  /** بلغت النتائجُ السقفَ فتوقّف الجمع */
  truncated: boolean;
}

export async function openSearch(query: string, opts?: { min?: number; cap?: number }): Promise<OpenSearchResult> {
  const q = query.trim();
  const counts: Record<MatchHow, number> = { عبارة: 0, نص: 0, تقريب: 0, جذر: 0, بعض: 0 };
  if (!q) return { hits: [], counts, roots: [], truncated: false };
  const min = opts?.min ?? 8;
  const cap = opts?.cap ?? 300;

  await ensureIndex().catch(() => {});
  const all = rows ?? [];
  const byLoc = new Map(all.map((r) => [r.ayah.location, r]));
  const nq = normalizeAr(q);
  const toks = nq.split(" ").filter((t) => t.length >= 2);
  const stems = toks.map((t) => stemAr(t));

  const seen = new Map<string, OpenHit>();
  const add = (ayah: AyahDoc, how: MatchHow, extra?: Partial<OpenHit>) => {
    if (seen.has(ayah.location)) return;
    seen.set(ayah.location, { ayah, how, ...extra });
    counts[how]++;
  };

  // ٠ — العبارةُ متّصلةً بحروفها: في النصِّ أو في لبابه بلا سوابق —
  //     «خلق منها زوجها» تُدرك ﴿وَخَلَقَ مِنْهَا زَوْجَهَا﴾ عبارةً تامّة.
  //     الترتيب: نصُّ ما كتبه الباحثُ بعينه أولًا، ثم المطابقُ بعد عزل السوابق
  //     (أمر المالك 2026-07-29: الأقربُ صورةً يتصدّر)
  if (nq.includes(" ")) for (const r of all) {
    if (r.norm.includes(nq)) add(r.ayah, "عبارة", { rank: 2 });
    else if (r.coreText?.includes(nq)) add(r.ayah, "عبارة", { rank: 1 });
  }

  // ١ — كلُّ كلمات السؤال حاضرةٌ في الآية: مطابقةٌ على حدود الكلمات (الكلمةُ
  //     نفسُها أو كلمةٌ تبدأ بها أو بجذعها) — لا احتواءٌ في وسط الكلمة، فذاك
  //     يجلب الأجنبيَّ («وال» داخل «والذين»).
  if (toks.length) {
    /** قربُ الكلمة من كلمةِ السؤال: بادئةٌ مشتركةٌ على أطولِ الطرفين (٠..١) */
    const closeness = (t: string, w: string): number => {
      let i = 0;
      while (i < t.length && i < w.length && t[i] === w[i]) i++;
      return i / Math.max(t.length, w.length);
    };
    for (const r of all) {
      if (seen.size >= cap) break;
      const words = r.norm.split(" ");
      let score = 0;
      const ok = toks.every((t, i) => {
        const st = stems[i];
        let best = 0;
        for (let wi = 0; wi < words.length; wi++) {
          const w = words[wi];
          const core = r.cores?.[wi];
          if (wordMatches(w, t, st) || (core != null && core !== w && wordMatches(core, t, st))) {
            // القربُ على أقرب صور الكلمة — وصورةُ النصِّ بعينها تعلو قليلًا على
            // المعزولة السوابق، فيتصدّر الأقربُ لما كُتب حرفيًّا ثم أخواتُه
            const c = Math.max(
              closeness(t, w),
              0.95 * (core != null ? closeness(t, core) : 0),
              0.95 * Math.max(0, ...dePrefixAr(w).map((x) => closeness(t, x))),
            );
            if (c > best) best = c;
          }
        }
        score += best;
        return best > 0;
      });
      // الأقربُ لفظًا أولًا: «الرحمان الرحيم» تتصدّرها البسملة لا كلُّ آيةٍ فيها «رحيم»
      if (ok) add(r.ayah, "نص", { rank: score });
    }
  }

  // ٢ — الفهرسُ المقلوب: بادئةٌ وخطأٌ حرفيٌّ يسير، مرتَّبًا بالصلة (BM25).
  //     تُقصَّ الذيولُ الضعيفة بنسبةٍ من أقوى نتيجة — كي لا يغرق الدقيقُ في تقريبٍ
  //     بعيد (رصدُ المالك: «تأتي ٦٠ آيةً معظمها لا دخل لها بالبحث»).
  if (mini && seen.size < cap) {
    const strict = mini.search(nq, { prefix: true, fuzzy: 0.15, combineWith: "AND" });
    const res = strict.length ? strict : mini.search(nq, { prefix: true, fuzzy: 0.2, combineWith: "OR" });
    const top = res[0]?.score ?? 0;
    const kept = res.filter((h) => h.score >= top * (strict.length ? 0.35 : 0.6)).slice(0, strict.length ? 60 : 20);
    for (const hit of kept) {
      if (seen.size >= cap) break;
      const r = byLoc.get(String(hit.id));
      if (r) add(r.ayah, "تقريب", { rank: hit.score });
    }
  }

  // ٣ — التوسيعُ بالجذر: للكلمة المفردة وحدَها (في المركَّب يُغرق النتيجةَ)
  const usedRoots: string[] = [];
  if (seen.size < cap && toks.length === 1) {
    const content = toks.filter((t) => t.length >= 3 && !STOP.has(t)).slice(0, 1);
    for (const t of content) {
      const rm = await fuzzyRoots(t, 1).catch(() => []);
      const rd = rm[0];
      if (!rd || rd.dist > 1) continue;
      usedRoots.push(rd.doc.root);
      for (const loc of ayahLocationsOfRoot(rd.doc)) {
        if (seen.size >= cap) break;
        const r = byLoc.get(loc);
        if (r) add(r.ayah, "جذر", { root: rd.doc.root });
      }
    }
  }

  // ٤ — بعضُ الكلمات (عند تعدّدها وقلّةِ ما سبق)
  if (seen.size < min && toks.length > 1) {
    const partial: { ayah: AyahDoc; n: number }[] = [];
    for (const r of all) {
      if (seen.has(r.ayah.location)) continue;
      const n = toks.filter((t, i) => r.norm.includes(t) || r.norm.includes(stems[i])).length;
      if (n > 0) partial.push({ ayah: r.ayah, n });
    }
    partial.sort((a, b) => b.n - a.n || mushafKey(a.ayah.location) - mushafKey(b.ayah.location));
    for (const p of partial.slice(0, 20)) add(p.ayah, "بعض");
  }

  // داخل الطبقة الواحدة: الأقوى صلةً أولًا (إن وُجدت درجة)، ثم ترتيبُ المصحف
  const hits = [...seen.values()].sort(
    (a, b) =>
      HOW_ORDER[a.how] - HOW_ORDER[b.how] ||
      (b.rank ?? 0) - (a.rank ?? 0) ||
      mushafKey(a.ayah.location) - mushafKey(b.ayah.location),
  );
  return { hits, counts, roots: [...new Set(usedRoots)], truncated: seen.size >= cap };
}

export interface SnippetSeg { text: string; hit: boolean }

/** هل تُطابق كلمةُ الآية (مطبَّعةً) كلمةَ السؤال؟ — على الكلمة وعلى صورها
 *  المجرّدة من السوابق معًا، فيلتقي «خلق» بـ«وخلق» كما يلتقي «فأكثرهم»
 *  بـ«أكثرهم» (الاتجاهان — رصد المالك 2026-07-29). */
function wordMatches(w: string, t: string, st: string): boolean {
  const one = (x: string) => x === t || x.startsWith(t) || (st.length >= 3 && (x === st || x.startsWith(st)));
  if (one(w)) return true;
  for (const alt of dePrefixAr(w)) if (one(alt)) return true;
  return false;
}

/**
 * مقتطفُ النتيجة: نافذةُ كلماتٍ حولَ أوّل موضعِ مطابقةٍ، والكلماتُ المطابِقةُ
 * موسومةٌ لتُميَّز. كان المقتطفُ أوّلَ الآية مبتورًا فلا يرى الباحثُ كلمتَه
 * (رصدُ المالك)؛ الآن يراها وسطَ سياقها أينما وقعت.
 */
export function snippetOf(ayah: AyahDoc, query: string, span = 10): SnippetSeg[] {
  const display = (ayah.textClean || ayah.textUthmani).split(" ").filter(Boolean);
  const norm = display.map((w) => normalizeAr(w));
  const cores = rowByLoc?.get(ayah.location)?.cores;
  const toks = normalizeAr(query).split(" ").filter((t) => t.length >= 2);
  const stems = toks.map((t) => stemAr(t));
  const hitAt = norm.map((w, wi) => toks.some((t, i) =>
    wordMatches(w, t, stems[i]) || (cores?.[wi] != null && cores[wi] !== w && wordMatches(cores[wi], t, stems[i]))));

  let first = hitAt.indexOf(true);
  if (first < 0) first = 0; // تقريبٌ لم يُصِب كلمةً بعينها — نبدأ من الصدر
  // النافذةُ تتوسّط المطابقةَ الأولى وتضمُّ ما وسعت من أخواتها
  let from = Math.max(0, first - Math.floor(span / 3));
  let to = Math.min(display.length, from + span);
  from = Math.max(0, to - span);

  const segs: SnippetSeg[] = [];
  if (from > 0) segs.push({ text: "…", hit: false });
  for (let i = from; i < to; i++) segs.push({ text: display[i], hit: hitAt[i] });
  if (to < display.length) segs.push({ text: "…", hit: false });
  return segs;
}

/** وسمُ سببِ الظهور كما يُعرض للقارئ */
export function howLabel(h: OpenHit, ar: boolean): string {
  if (h.how === "عبارة" || h.how === "نص") return "";
  if (h.how === "تقريب") return ar ? "مطابقةٌ تقريبيّة" : "approximate";
  if (h.how === "جذر") return ar ? `من الجذر ${h.root}` : `root ${h.root}`;
  return ar ? "بعضُ كلمات السؤال" : "some words";
}

/** بحثٌ سريعٌ للأومني: النصُّ وحدَه (عبارةً أو كلماتٍ أو تقريبًا) — والتوسيعُ
 *  بالجذر خيارٌ مستقلٌّ يُعرض بنفسه، لا يُخلط بنتائج النصّ (قرار المالك). */
export async function quickSearch(query: string, k = 6): Promise<{ hits: OpenHit[]; total: number; roots: { root: string; count: number }[] }> {
  const { hits, roots } = await openSearch(query, { cap: 400, min: 0 });
  const precise = hits.filter((h) => h.how === "عبارة" || h.how === "نص" || h.how === "تقريب");
  const byRoot = new Map<string, number>();
  for (const h of hits) if (h.how === "جذر" && h.root) byRoot.set(h.root, (byRoot.get(h.root) ?? 0) + 1);
  for (const r of roots) if (!byRoot.has(r)) byRoot.set(r, 0);
  return {
    hits: precise.slice(0, k),
    total: precise.length,
    roots: [...byRoot].map(([root, count]) => ({ root, count })),
  };
}

// searchAyahs يبقى مستعمَلًا في مواضعَ أخرى؛ نُبقيه مستوردًا للتوافق
void searchAyahs;

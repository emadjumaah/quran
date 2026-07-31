/**
 * جالبُ المراجع في المتصفّح — يُنزّل **الشظيّةَ وحدَها** لا الكتاب.
 *
 * «الدرُّ المصون» ١١٫٥ ميغابايت، و«لسانُ العرب» ١١. فتُقطَّع في البناء شظايا
 * بحدّ ٢٢٠ك بمفتاحها الطبيعيّ (السورةُ للمرسى بالآية، وحرفُ المادّة للمرسى
 * بالجذر)، ويُكتب معها دليلٌ صغير. وهذا الملفُّ يقرأ الدليلَ ثمّ يجلب الشظيّةَ
 * التي فيها الموضعُ المطلوب — فلا يُنزَّل مجلَّدٌ لقراءة سطر.
 *
 * والدليلُ والشظايا تُحفظ في الذاكرة بعد أوّل جلب، فتصفّحُ سورةٍ كاملةٍ لا
 * يُكلّف إلا جلبةً واحدةً لكلِّ كتاب.
 */

export interface RefBook {
  id: string; label: string; author: string; died: number | null;
  rank: number; group: string; kind: "ayah" | "root" | "section";
  anchor?: string | null; role?: string | null; note?: string;
  coverage: number; coverageOf: number | null; shards: number; bytes: number;
}
interface Manifest { date: string; ranks: Record<string, string>; books: RefBook[] }

/** دليلُ كتابٍ مرسًى بالآية: سورة → [أوّلُ آية، آخرُها، اسمُ الشظيّة] */
type AyahMap = Record<string, [number, number, string][]>;
/** دليلُ معجمٍ مرسًى بالجذر: جذرٌ → اسمُ الشظيّة */
type RootMap = Record<string, string>;

const base = () => `${import.meta.env.BASE_URL}refs/`;
const V = () => `?v=${__DATA_VERSION__}`;

let manifestP: Promise<Manifest | null> | null = null;
export function refsManifest(): Promise<Manifest | null> {
  manifestP ??= fetch(`${base()}manifest.json${V()}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return manifestP;
}

const mapCache = new Map<string, Promise<{ meta: unknown; map: AyahMap | RootMap } | null>>();
function bookMap(id: string) {
  let p = mapCache.get(id);
  if (!p) {
    p = fetch(`${base()}${id}/map.json${V()}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    mapCache.set(id, p);
  }
  return p;
}

const shardCache = new Map<string, Promise<Record<string, string[] | string> | null>>();
function shard(id: string, name: string) {
  const key = `${id}/${name}`;
  let p = shardCache.get(key);
  if (!p) {
    p = fetch(`${base()}${key}.json${V()}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    shardCache.set(key, p);
  }
  return p;
}

export interface RefHit { book: RefBook; texts: string[] }

/**
 * كلُّ ما عند المراجع المرساةِ بالآية في موضعٍ بعينه، مرتَّبًا بالرتبة ثمّ
 * بالأقدميّة — فالقارئُ يرى الأقدمَ أوّلًا في كلِّ رتبة.
 */
export async function refsForAyah(loc: string, opts?: { ranks?: number[]; ids?: string[] }): Promise<RefHit[]> {
  const man = await refsManifest();
  if (!man) return [];
  const [s] = loc.split(":");
  const books = man.books.filter(
    (b) => b.kind === "ayah" && (!opts?.ranks || opts.ranks.includes(b.rank)) && (!opts?.ids || opts.ids.includes(b.id)),
  );
  const out = await Promise.all(
    books.map(async (b): Promise<RefHit | null> => {
      const m = (await bookMap(b.id)) as { map: AyahMap } | null;
      const ranges = m?.map?.[s];
      if (!ranges) return null;
      const a = Number(loc.split(":")[1]);
      const hit = ranges.find(([from, to]) => a >= from && a <= to);
      if (!hit) return null;
      const data = await shard(b.id, hit[2]);
      const v = data?.[loc];
      if (!v) return null;
      return { book: b, texts: Array.isArray(v) ? v : [v] };
    }),
  );
  return out
    .filter((x): x is RefHit => !!x)
    .sort((x, y) => x.book.rank - y.book.rank || (x.book.died ?? 0) - (y.book.died ?? 0));
}

/** مداخلُ المعاجم لمادّةٍ بعينها (الرتبة ٢) */
export async function refsForRoot(root: string): Promise<RefHit[]> {
  const man = await refsManifest();
  if (!man) return [];
  const books = man.books.filter((b) => b.kind === "root");
  const out = await Promise.all(
    books.map(async (b): Promise<RefHit | null> => {
      const m = (await bookMap(b.id)) as { map: RootMap } | null;
      const name = m?.map?.[root];
      if (!name) return null;
      const data = await shard(b.id, name);
      const v = data?.[root];
      if (!v) return null;
      return { book: b, texts: Array.isArray(v) ? v : [v] };
    }),
  );
  return out.filter((x): x is RefHit => !!x).sort((x, y) => (x.book.died ?? 0) - (y.book.died ?? 0));
}

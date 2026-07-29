/**
 * وحدات السياق المحسوبة — طبقة مشكاة المعتمدة (١٤٠٤ وحدات؛ اجتازت المحجوب المجمّد:
 * استعادة ٨٩.٥٪ ورفض ١٠٠٪ — findings/siyaq-swarm/HOLDOUT-EXAM.md). البيانات
 * siyaq-units.json والمتجهات siyaq-embeddings.bin (نفس صيغة متجهات الآيات).
 *
 * unitOf(loc) — وحدة السياق الحاوية لأي آية؛ searchUnits(query) — بحث بالمعنى
 * يعيد وحداتٍ كاملة. (طبقة التفصيل الموضوعي المنقولة تبقى في tafsil.ts للعرض المسند.)
 */
import { embedQuery } from "./semantic";

export interface SiyaqUnit { i: number; s: number; a1: number; a2: number; name: string }

interface SiyaqData { units: SiyaqUnit[] }
let data: SiyaqData | null = null;
let loading: Promise<SiyaqData | null> | null = null;

export function loadSiyaq(): Promise<SiyaqData | null> {
  if (data) return Promise.resolve(data);
  loading ??= fetch(`${import.meta.env.BASE_URL}siyaq-units.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j) return null;
      data = { units: (j.units as [number, number, number, string][]).map((u, i) => ({ i, s: u[0], a1: u[1], a2: u[2], name: u[3] })) };
      return data;
    })
    .catch(() => null);
  return loading;
}

/** وحدة السياق الحاوية للموضع "س:آ" — null إن لم تُحمّل البيانات بعد */
export function unitOf(loc: string): SiyaqUnit | null {
  if (!data) return null;
  const [s, a] = loc.split(":").map(Number);
  let lo = 0, hi = data.units.length - 1, found: SiyaqUnit | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const u = data.units[mid];
    if (u.s < s || (u.s === s && u.a2 < a)) lo = mid + 1;
    else if (u.s > s || (u.s === s && u.a1 > a)) hi = mid - 1;
    else { found = u; break; }
  }
  return found;
}

// —— المتجهات (نفس صيغة quran-embeddings.bin) ————————————————
let vec: { dim: number; count: number; scales: Float32Array; data: Int8Array } | null = null;
let vecLoading: Promise<void> | null = null;

export function loadSiyaqVectors(): Promise<void> {
  if (vec) return Promise.resolve();
  vecLoading ??= (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}siyaq-embeddings.bin?v=${__DATA_VERSION__}`);
    if (!res.ok) throw new Error(`siyaq embeddings: HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const headerLen = new DataView(buf).getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headerLen)));
    const { dim, count } = header;
    const scalesOff = 4 + headerLen;
    vec = {
      dim,
      count,
      scales: new Float32Array(buf.slice(scalesOff, scalesOff + count * 4)),
      data: new Int8Array(buf, scalesOff + count * 4, count * dim),
    };
  })();
  return vecLoading;
}

export interface SiyaqHit { unit: SiyaqUnit; score: number }

/** أقربُ المقاطع معنًى إلى مقطعِ هذه الآية — بلا نداءٍ خارجيّ: متّجهُ المقطع
 *  نفسِه يُستعمل استعلامًا ضدّ متّجهات المقاطع كلِّها (2026-07-21). */
export async function nearestUnits(loc: string, k = 4): Promise<SiyaqHit[]> {
  await Promise.all([loadSiyaq(), loadSiyaqVectors()]);
  if (!data || !vec) return [];
  const self = unitOf(loc);
  if (!self) return [];
  const { dim, count, scales, data: d } = vec;
  const row = self.i;
  if (row < 0 || row >= count) return [];
  // إزالةُ التكميم: صفُّ المقطع متّجهًا عائمًا موحَّدَ الطول تقريبًا
  const q = new Float32Array(dim);
  const qoff = row * dim;
  for (let i = 0; i < dim; i++) q[i] = d[qoff + i] * scales[row];
  const hits: SiyaqHit[] = [];
  for (let r = 0; r < count; r++) {
    if (r === row) continue;
    let dot = 0;
    const off = r * dim;
    for (let i = 0; i < dim; i++) dot += q[i] * d[off + i];
    const score = dot * scales[r];
    if (hits.length < k) {
      hits.push({ unit: data.units[r], score });
      hits.sort((a, b) => a.score - b.score);
    } else if (score > hits[0].score) {
      hits[0] = { unit: data.units[r], score };
      hits.sort((a, b) => a.score - b.score);
    }
  }
  return hits.reverse();
}

/** بحثٌ بالمعنى في وحدات السياق — يعيد أفضل k وحداتٍ كاملة */
export async function searchSiyaq(query: string, k = 6): Promise<SiyaqHit[]> {
  await Promise.all([loadSiyaq(), loadSiyaqVectors()]);
  if (!data || !vec) return [];
  const q = await embedQuery(query);
  const { dim, count, scales, data: d } = vec;
  const hits: SiyaqHit[] = [];
  for (let r = 0; r < count; r++) {
    let dot = 0;
    const off = r * dim;
    for (let i = 0; i < dim; i++) dot += q[i] * d[off + i];
    const score = dot * scales[r];
    if (hits.length < k) {
      hits.push({ unit: data.units[r], score });
      hits.sort((a, b) => a.score - b.score);
    } else if (score > hits[0].score) {
      hits[0] = { unit: data.units[r], score };
      hits.sort((a, b) => a.score - b.score);
    }
  }
  return hits.reverse();
}

// ─── أسماءُ الوحدات بالإنجليزية (مولَّدةٌ بمراجعةِ عددٍ وترتيبٍ آليّة) ─────────
let enNames: Record<string, string> | null = null;
let enLoading: Promise<void> | null = null;
export function loadSiyaqEn(): Promise<void> {
  if (enNames) return Promise.resolve();
  enLoading ??= fetch(`${import.meta.env.BASE_URL}siyaq-units-en.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? r.json() : { names: {} }))
    .then((d: { names: Record<string, string> }) => { enNames = d.names ?? {}; })
    .catch(() => { enNames = {}; });
  return enLoading;
}
/** الاسمُ الإنجليزيُّ للوحدة — أو null فيُخفى الفاصل بدل عرض العربيّ لغير قارئه */
export function siyaqNameEn(u: SiyaqUnit): string | null {
  return enNames?.[`${u.s}:${u.a1}:${u.a2}`] ?? null;
}

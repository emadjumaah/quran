/**
 * **التلاوةُ المنزَّلة** — تنزيلُ تلاوةِ الحصريّ بالتجزئة، وحفظُها في خزانة
 * المتصفّح، والحكمُ على جاهزيّتها **بما في الخزانة لا بما في السجلّ**.
 *
 * ## ثلاثةُ أصولٍ يقوم عليها هذا الملفّ
 *
 * **١) الجاهزيّةُ تُقرأ من الخزّان، ولا تُصدَّق من دفترٍ عندنا.** لو حفظنا
 * «نزّلتُ الجزء ٣٠» في سجلٍّ ثمّ محا النظامُ الملفّاتِ عند ضيق المساحة (وهو
 * واقعٌ على أجهزة آبل) **لقالت اللوحةُ جاهزٌ وهي كاذبة** — فتنقطع على قارئٍ
 * صلاتُه أو مراجعتُه. فههنا: تُقرأ مفاتيحُ الخزانة، **والوحدةُ لا تكون جاهزةً
 * حتّى تحضر كلُّ آيةٍ من آياتها**. ومن محا ملفًّا واحدًا سقطت الوحدةُ فورًا.
 *
 * **٢) ولا يُقبل ملفٌّ حتّى تُطابَق تجزئتُه.** لكلّ ملفٍّ `sha256` في المانيفست،
 * **وتُحسب على البايتات النازلة** ثمّ تُقابَل — وما خالف يُرفض ولا يُخزَّن.
 * (وترويسةُ الخادم تحمل تجزئةً كذلك، **ولا يُكتفى بها**: عرفُ خادمٍ لا عقد.)
 *
 * **٣) ولا تنزيلَ صامتٌ ولا تلقائيّ.** لا شيءَ في هذا الملفّ يبدأ من نفسه؛
 * كلُّ تنزيلٍ من ضغطةٍ معلومةِ الحجم سلفًا.
 *
 * ## ولماذا يجوز أن يُقدَّم المنزَّلُ على الشبكة
 *
 * **قِيس ولم يُفترَض**: تسجيلُ الحصريّ المرتَّل في مصدر التشغيل الحيّ وفي
 * مرآتنا **واحدٌ بعينه** — جسمُ المسموع متطابقٌ بايتًا بايت في ستّ عيّناتٍ
 * مفرّقة، والفارقُ ٤١٣ بايتَ وسمٍ في الترويسة لا صوتًا. فمن نزّل جزءًا سمعه
 * من جهازه، **وهو الصوتُ نفسُه لا بديلًا عنه**.
 */

import { AYAH_COUNTS, globalIdOf, pad3 } from "./mushafIndex";

/** خزانةٌ مستقلّةٌ باسمها — لا تُخلط بخزائن الواجهة ولا بخزانة المحرّك */
const CACHE = "mishkat-tilawa-v1";
/** سجلُّ ما طلب القارئُ تنزيلَه — **دليلٌ لا حُجّة**؛ الحُجّةُ الخزانة */
const WANTED_KEY = "sawt.tilawa.wanted.v1";

export interface UnitTotals {
  n: number;
  ayat: number;
  files: number;
  bytes: number;
  from?: string;
  to?: string;
  ar?: string;
  en?: string;
}

export interface ReciterEntry {
  ar: string;
  en: string;
  use_ar?: string;
  use_en?: string;
  kbps?: number;
  files: number;
  bytes: number;
  records: string;
  juz: UnitTotals[];
  surah: UnitTotals[];
  page: UnitTotals[];
}

export interface Manifest {
  tag: string;
  generated: string;
  host: { kind: string; repo: string; base: string };
  path: string;
  attribution: Record<string, string>;
  ayat: number;
  reciters: Record<string, ReciterEntry>;
}

export type UnitKind = "juz" | "surah" | "page";
export interface Unit {
  reciter: string;
  kind: UnitKind;
  n: number;
}

export const unitId = (u: Unit) => `${u.reciter}|${u.kind}|${u.n}`;
const parseUnit = (id: string): Unit | null => {
  const [reciter, kind, n] = id.split("|");
  return reciter && (kind === "juz" || kind === "surah" || kind === "page")
    ? { reciter, kind, n: Number(n) }
    : null;
};

/**
 * **قارئُ التطبيق ⇄ مجلّدُ المرآة.** ولا يُوصل قارئٌ بمرآةٍ حتّى يثبت أنّهما
 * تسجيلٌ واحد — فإبدالُ صوتٍ بصوتٍ أشنعُ من ألّا يعمل الأوفلاين.
 */
export const MIRRORS: Record<string, string> = {
  husary: "Husary_64kbps",
  husary_muallim: "Husary_Muallim_128kbps",
};
export const mirrorOf = (reciterKey: string): string | null => MIRRORS[reciterKey] ?? null;
/** القارئُ في التطبيق الذي يُشغّل هذه المرآة */
export const appKeyOfMirror = (mirror: string): string | null =>
  Object.entries(MIRRORS).find(([, m]) => m === mirror)?.[0] ?? null;

export const fileOf = (s: number, a: number) => `${pad3(s)}${pad3(a)}.mp3`;

/* ── المانيفست ─────────────────────────────────────────────────────────── */

let manifest: Promise<Manifest | null> | null = null;

/**
 * يُخدَم ساكنًا من أصلنا، **فيُقرأ بلا إنترنت** — واللوحةُ تعمل والقارئُ منقطع.
 * **ومن جذر التطبيق لا نسبةً إلى المسار الجاري**: الصفحةُ قد تكون على
 * `/goto/juz/5`، فالنسبيُّ يطلبه من حيث ليس.
 */
export function loadManifest(): Promise<Manifest | null> {
  manifest ??= fetch(`${import.meta.env.BASE_URL}audio-manifest.json?v=${__DATA_VERSION__}`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifest;
}

export const urlOf = (m: Manifest, mirror: string, s: number, a: number) =>
  `${m.host.base}${mirror}/${fileOf(s, a)}`;

/* ── آياتُ الوحدة ──────────────────────────────────────────────────────── */

const keyOf = (s: number, a: number) => `${s}:${a}`;

/** كلُّ مفاتيح المصحف مرتَّبةً — تُبنى مرّةً */
let allKeys: [number, number][] | null = null;
function keys(): [number, number][] {
  if (!allKeys) {
    allKeys = [];
    for (let s = 1; s <= 114; s++) for (let a = 1; a <= AYAH_COUNTS[s - 1]; a++) allKeys.push([s, a]);
  }
  return allKeys;
}

/**
 * آياتُ الوحدة — من مدى المانيفست (`from`/`to`) لا من جدولٍ عندنا.
 * والسورةُ مداها نفسُها.
 */
export function ayatOfUnit(m: Manifest, u: Unit): [number, number][] {
  const rec = m.reciters[u.reciter];
  if (!rec) return [];
  const row = rec[u.kind].find((x) => x.n === u.n);
  if (!row) return [];
  if (u.kind === "surah") return keys().filter(([s]) => s === u.n);
  if (!row.from || !row.to) return [];
  const [fs, fa] = row.from.split(":").map(Number);
  const [ts, ta] = row.to.split(":").map(Number);
  const lo = globalIdOf(fs, fa);
  const hi = globalIdOf(ts, ta);
  return keys().filter((_, i) => i + 1 >= lo && i + 1 <= hi);
}

/* ── الخزانة ───────────────────────────────────────────────────────────── */

const cache = () => caches.open(CACHE);

/** مفاتيحُ ما في الخزانة فعلًا، لكلّ مرآةٍ مجموعتُها — **الحُجّةُ في الجاهزيّة** */
export async function cachedFiles(): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (!("caches" in globalThis)) return out;
  try {
    const c = await cache();
    for (const req of await c.keys()) {
      const m = /\/([A-Za-z0-9_]+)\/(\d{6})\.mp3$/.exec(new URL(req.url).pathname);
      if (!m) continue;
      const set = out.get(m[1]) ?? new Set<string>();
      set.add(m[2]);
      out.set(m[1], set);
    }
  } catch {
    /* الجهازُ قد يمنع الخزائن — تُقرأ فارغةً ولا يُدّعى شيء */
  }
  return out;
}

export interface UnitState {
  unit: Unit;
  row: UnitTotals;
  /** كم آيةً حاضرةٌ في الخزانة */
  have: number;
  /** كلُّ آياتها حاضرة */
  ready: boolean;
  /** طلبه القارئُ ولم يتمّ — أو تمّ ثمّ نقص */
  wanted: boolean;
}

export function wantedUnits(): string[] {
  try {
    const raw = localStorage.getItem(WANTED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function setWanted(ids: string[]): void {
  try {
    localStorage.setItem(WANTED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* لا شيء — والخزانةُ تبقى الحُجّة */
  }
}

/**
 * **حالُ كلِّ وحدةٍ طلبها القارئ** — محسوبةً من الخزانة.
 * **ولا تُصدَّق وحدةٌ حتّى تحضر آياتُها كلُّها**: من محا ملفًّا واحدًا خرجت
 * وحدتُه من الجاهز فورًا (وهو الضبطُ السالبُ بعينه).
 */
export async function unitStates(m: Manifest): Promise<UnitState[]> {
  const present = await cachedFiles();
  const out: UnitState[] = [];
  for (const id of wantedUnits()) {
    const u = parseUnit(id);
    if (!u) continue;
    const rec = m.reciters[u.reciter];
    const row = rec?.[u.kind].find((x) => x.n === u.n);
    if (!row) continue;
    const set = present.get(u.reciter) ?? new Set<string>();
    const ayat = ayatOfUnit(m, u);
    let have = 0;
    for (const [s, a] of ayat) if (set.has(fileOf(s, a).slice(0, 6))) have++;
    out.push({ unit: u, row, have, ready: have === ayat.length && ayat.length > 0, wanted: true });
  }
  return out;
}

/* ── التجزئات ─────────────────────────────────────────────────────────── */

const hashes = new Map<string, Promise<Map<string, string> | null>>();

/**
 * تجزئاتُ قارئٍ — تُجلب مرّةً من مستودع البيانات وتُخزَّن. **٤٧٤ ك.ب مقابلَ
 * جيجاباتٍ تحرسها**، ولا تلزم إلّا وقتَ التنزيل (وهو وقتُ اتّصالٍ أصلًا).
 */
function loadHashes(m: Manifest, reciter: string): Promise<Map<string, string> | null> {
  let p = hashes.get(reciter);
  if (!p) {
    const url = `${m.host.base}${m.reciters[reciter].records}`;
    p = (async () => {
      try {
        const c = await cache();
        const hit = await c.match(url);
        const res = hit ?? (await fetch(url));
        if (!res.ok) return null;
        if (!hit) await c.put(url, res.clone());
        const map = new Map<string, string>();
        for (const ln of (await res.text()).split("\n").slice(1)) {
          const [k, , sha] = ln.split("\t");
          if (k && sha) map.set(k, sha.trim());
        }
        return map;
      } catch {
        return null;
      }
    })();
    hashes.set(reciter, p);
  }
  return p;
}

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* ── التنزيل ──────────────────────────────────────────────────────────── */

export interface Progress {
  done: number;
  total: number;
  bytes: number;
  /** رُفض لأنّ تجزئتَه خالفت المانيفست */
  rejected: number;
  failed: number;
}

const running = new Map<string, AbortController>();
export const isRunning = (u: Unit) => running.has(unitId(u));

export function stopUnit(u: Unit): void {
  running.get(unitId(u))?.abort();
  running.delete(unitId(u));
}

/**
 * تنزيلُ وحدةٍ — **بأربعة خيوطٍ لا أكثر**، ويُستأنف: ما في الخزانة يُتخطّى.
 * وكلُّ ملفٍّ تُحسب تجزئتُه وتُقابَل قبل أن يُخزَّن؛ **وما خالف يُرفض ويُعاد**
 * (محاولةً واحدةً)، ولا يُحسب حاضرًا.
 */
export async function downloadUnit(
  m: Manifest,
  u: Unit,
  onProgress: (p: Progress) => void,
): Promise<Progress> {
  const id = unitId(u);
  stopUnit(u);
  const ctrl = new AbortController();
  running.set(id, ctrl);
  setWanted([...wantedUnits(), id]);

  const mirror = u.reciter;
  const ayat = ayatOfUnit(m, u);
  const c = await cache();
  const sums = await loadHashes(m, mirror);
  const p: Progress = { done: 0, total: ayat.length, bytes: 0, rejected: 0, failed: 0 };
  let next = 0;

  const one = async ([s, a]: [number, number], retry = false): Promise<void> => {
    const url = urlOf(m, mirror, s, a);
    if (!retry && (await c.match(url))) {
      p.done++;
      return;
    }
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    const buf = await res.arrayBuffer();
    const want = sums?.get(keyOf(s, a));
    if (want) {
      const got = hex(await crypto.subtle.digest("SHA-256", buf));
      if (got !== want) {
        // **يُرفض ولا يُخزَّن** — ومحاولةٌ واحدةٌ ثمّ يُقيَّد إخفاقُه
        if (!retry) return one([s, a], true);
        p.rejected++;
        return;
      }
    }
    await c.put(url, new Response(buf, { headers: { "content-type": "audio/mpeg" } }));
    p.done++;
    p.bytes += buf.byteLength;
  };

  const worker = async (): Promise<void> => {
    while (next < ayat.length && !ctrl.signal.aborted) {
      const item = ayat[next++];
      try {
        await one(item);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        p.failed++;
      }
      onProgress({ ...p });
    }
  };

  await Promise.all([worker(), worker(), worker(), worker()]);
  running.delete(id);
  onProgress({ ...p });
  return p;
}

/**
 * حذفُ وحدةٍ — **ولا يُحذف ما تشترك فيه وحدةٌ أخرى باقية**: من نزّل الجزءَ ٣٠
 * وسورةَ النبأ ثمّ حذف الجزءَ بقيت سورتُه كاملة.
 */
export async function deleteUnit(m: Manifest, u: Unit): Promise<number> {
  stopUnit(u);
  const id = unitId(u);
  const rest = wantedUnits().filter((x) => x !== id);
  setWanted(rest);

  const keep = new Set<string>();
  for (const other of rest) {
    const o = parseUnit(other);
    if (!o || o.reciter !== u.reciter) continue;
    for (const [s, a] of ayatOfUnit(m, o)) keep.add(fileOf(s, a));
  }
  const c = await cache();
  let n = 0;
  for (const [s, a] of ayatOfUnit(m, u)) {
    if (keep.has(fileOf(s, a))) continue;
    if (await c.delete(urlOf(m, u.reciter, s, a))) n++;
  }
  return n;
}

/* ── المساحة وثباتُ التخزين ───────────────────────────────────────────── */

export interface Space {
  usage: number | null;
  quota: number | null;
  /** جوابُ النظام في ثبات التخزين — `null` إن لم يُسأل بعد أو لم يُتَح */
  persisted: boolean | null;
}

export async function space(): Promise<Space> {
  const st = navigator.storage;
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted: boolean | null = null;
  try {
    if (st?.estimate) {
      const e = await st.estimate();
      usage = e.usage ?? null;
      quota = e.quota ?? null;
    }
    if (st?.persisted) persisted = await st.persisted();
  } catch {
    /* يُعرض المجهولُ مجهولًا */
  }
  return { usage, quota, persisted };
}

/** **يُطلب بضغطةٍ من القارئ، ويُعرض جوابُه بصدق** — ولا يُوعَد بما لا نملك */
export async function askPersist(): Promise<boolean | null> {
  try {
    return navigator.storage?.persist ? await navigator.storage.persist() : null;
  } catch {
    return null;
  }
}

/* ── المحرّكُ الحرّ: أمنزَّلٌ هو؟ ───────────────────────────────────────── */

/**
 * يُسأل خزّانُ المحرّك عن أثر النموذج. **ولا يُدّعى تنزيلٌ لم يُشهَد** — فإن
 * منع الجهازُ الخزائنَ رُدّ `false` ولم يُقَل «جاهز».
 */
export async function engineDownloaded(modelId: string): Promise<boolean> {
  try {
    if (!("caches" in globalThis) || !(await caches.has("transformers-cache"))) return false;
    const c = await caches.open("transformers-cache");
    for (const req of await c.keys()) if (req.url.includes(modelId)) return true;
  } catch {
    /* لا شيء */
  }
  return false;
}

/* ── تقديمُ المنزَّل على الشبكة ───────────────────────────────────────── */

/**
 * **يُقدَّم المنزَّلُ حين يوجد** — ولا يُبدَّل مصدرُ التشغيل الحيّ. تُرجع رابطَ
 * كائنٍ من الخزانة إن كانت الآيةُ منزَّلةً لهذا القارئ، وإلّا `null` فيمضي
 * التشغيلُ من الشبكة كما كان.
 */
export async function offlineObjectUrl(
  reciterKey: string,
  s: number,
  a: number,
): Promise<string | null> {
  const mirror = mirrorOf(reciterKey);
  if (!mirror || !("caches" in globalThis)) return null;
  try {
    const m = await loadManifest();
    if (!m?.reciters[mirror]) return null;
    const hit = await (await cache()).match(urlOf(m, mirror, s, a));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch {
    return null;
  }
}

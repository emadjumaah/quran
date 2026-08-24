/**
 * **الاستماع** — تلاوةٌ تُشغَّل من مرآتنا، وآيةٌ تتلو آية.
 *
 * ## من أين يُسمع
 * من `audio-manifest.json` وحدَه: فيه مضيفُ التلاوات وقارئوها وأحجامُها
 * وتجزئاتُها. **ولا رابطَ مكتوبٌ في الشيفرة** — عنوانُ الملفّ يُركَّب من المضيف
 * ونسقِ المسار كما أعلنهما المانيفستُ نفسُه، فمن بدّل المضيفَ بدّل ملفًّا واحدًا.
 *
 * ## وثلاثةُ حدودٍ في هذا الملفّ
 * **١) لا تنزيلَ ولا أوفلاين ههنا** — تلك عُدّةُ `lib/sawt/tilawa.ts` بتجزئاتها
 *    وخزانتها، ولها موضعُها في ف٣. وما ههنا **مشغِّلٌ بسيط**: يُشغّل من الشبكة
 *    ويسكت. **ولا يُدَّعى للقارئ أنّه يملك ما لا يملك.**
 * **٢) ولا تتبّعَ صوتيًّا** — لا مسبارَ ولا محاذاةَ كلمات؛ الوحدةُ آيةٌ كاملةٌ
 *    تُشغَّل وتنتهي فتتلوها التي بعدها.
 * **٣) والتشغيلُ في نَفَس اللمسة** — سياسةُ آبل ترفض `play()` بعد `await`؛
 *    فالمانيفستُ يُحمَّل مع إقلاع التطبيق، ولحظةَ الضغط لا يبقى إلّا إسنادُ
 *    عنوانٍ وتشغيل.
 */
import { LAST_AYAH, locationOf, pad3 } from "@mishkat/quran-core";

interface RawReciter {
  ar: string;
  files: number;
}
interface RawManifest {
  host: { base: string };
  path: string;
  attribution: Record<string, string>;
  reciters: Record<string, RawReciter>;
}

export interface Reciter {
  key: string;
  ar: string;
}

/**
 * **القارئُ الافتراضيُّ هو المرتَّل** — والمعلِّمُ خيارٌ بعده.
 *
 * فمصحفُ المعلّم تلاوةٌ تُلقِّن: إيقاعٌ بطيءٌ وسكتاتُ ترديدٍ محفوظة، وبابُه
 * التلقينُ لا القراءة؛ ومن فتح مصحفًا ليقرأ معه أراد المرتَّل. **ويُسمّى ههنا
 * بمفتاحه صريحًا** فلا يتعلّق الافتراضُ بترتيب المفاتيح في المانيفست (وهو
 * ترتيبُ مجلّداتٍ لا ترتيبُ أولويّة)؛ **فإن غاب أُخذ أوّلُ الموجود**.
 */
const PREFERRED = "Husary_64kbps";

let manifest: RawManifest | null = null;
let reciters: Reciter[] = [];

export const getReciters = (): Reciter[] => reciters;
/** إسنادُ التلاوة كما أعلنه المانيفست — يُقال حيث يُسمع الصوت، لا في صفحةٍ بعيدة */
export const getAttribution = (): string => manifest?.attribution?.recitation ?? "";

/** يُحمَّل مع الإقلاع — فيبقى التشغيلُ عند الضغط متزامنًا (الحدُّ ٣) */
export async function loadAudio(): Promise<void> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}audio-manifest.json`);
    if (!r.ok) return;
    manifest = (await r.json()) as RawManifest;
    reciters = Object.entries(manifest.reciters).map(([key, v]) => ({ key, ar: v.ar }));
  } catch {
    /* لا شبكةَ ⇒ لا استماع، ولا تنكسر القراءة */
  }
}

/** عنوانُ آيةٍ بعينها — من نسق المانيفست لا من نصٍّ مكتوبٍ ههنا */
function urlOf(reciter: string, id: number): string | null {
  if (!manifest) return null;
  const [s, a] = locationOf(id);
  const rel = manifest.path
    .replace("{reciter}", reciter)
    .replace("{sura:03}", pad3(s))
    .replace("{ayah:03}", pad3(a));
  return manifest.host.base + rel;
}

const RECITER_KEY = "tilawa.reciter.v1";
const firstReciter = () =>
  (reciters.some((r) => r.key === PREFERRED) ? PREFERRED : reciters[0]?.key) ?? "";
let chosen = (() => {
  try {
    return localStorage.getItem(RECITER_KEY) ?? "";
  } catch {
    return "";
  }
})();

export const getReciter = (): string => (reciters.some((r) => r.key === chosen) ? chosen : firstReciter());
export function setReciter(key: string): void {
  chosen = key;
  try {
    localStorage.setItem(RECITER_KEY, key);
  } catch {
    /* لا يُبطل الاستماع */
  }
  if (state.id !== null) play(state.id); // القارئُ يتبدّل والموضعُ يبقى
  else emit();
}

/** ما يراه العرضُ من حال المشغِّل */
export interface PlayState {
  /** الرقمُ العامُّ للآية المسموعة — أو `null` إن كان ساكتًا */
  id: number | null;
  playing: boolean;
  /** آخرُ ما لم يُسمع: يُعلَن ولا يُكتم */
  error: string | null;
}

let state: PlayState = { id: null, playing: false, error: null };
const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  for (const fn of listeners) fn();
};

export const getPlayState = (): PlayState => state;
export const subscribePlay = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

let el: HTMLAudioElement | null = null;
/** الآيةُ التالية تُهيَّأ سلفًا فلا تنقطع التلاوةُ بين آيتين */
let ahead: HTMLAudioElement | null = null;

function element(): HTMLAudioElement {
  if (el) return el;
  el = new Audio();
  el.preload = "auto";
  el.addEventListener("ended", () => {
    const next = (state.id ?? 0) + 1;
    if (next > LAST_AYAH) {
      state = { id: null, playing: false, error: null };
      emit();
      return;
    }
    play(next);
  });
  el.addEventListener("error", () => {
    state = { ...state, playing: false, error: "لم يصل الصوت — تحقّق من الاتّصال" };
    emit();
  });
  return el;
}

/** يُشغّل آيةً بعينها، وما بعدها يتلوها */
export function play(id: number): void {
  const url = urlOf(getReciter(), id);
  if (!url) {
    state = { ...state, error: "سجلُّ التلاوات لم يُحمَّل بعد" };
    emit();
    return;
  }
  const a = element();
  a.src = url;
  state = { id, playing: true, error: null };
  void a.play().catch(() => {
    state = { ...state, playing: false, error: "لم يبدأ التشغيل" };
    emit();
  });
  emit();
  // تهيئةُ التالية — طلبٌ واحدٌ سابقٌ لأوانه لا أكثر
  if (id < LAST_AYAH) {
    const nurl = urlOf(getReciter(), id + 1);
    if (nurl) {
      ahead ??= new Audio();
      ahead.preload = "auto";
      ahead.src = nurl;
    }
  }
}

export function pause(): void {
  el?.pause();
  state = { ...state, playing: false };
  emit();
}

export function resume(): void {
  if (state.id === null) return;
  void el?.play();
  state = { ...state, playing: true, error: null };
  emit();
}

export function stop(): void {
  if (el) {
    el.pause();
    el.removeAttribute("src");
  }
  state = { id: null, playing: false, error: null };
  emit();
}

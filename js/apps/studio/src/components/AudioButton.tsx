import { useEffect, useState, useSyncExternalStore } from "react";
import { getUILang, num, t, useUILang } from "../i18n";
import { getSettings } from "../settings";
import { useReading } from "../reading";
import { LAST_AYAH, locationOf, pad3 } from "../lib/sawt/mushafIndex";
import { mirrorOf, offlineObjectUrl } from "../lib/sawt/tilawa";
import RecitationCredit, { type CreditSource } from "./RecitationCredit";
import "../styles/sawt-tilawa.css";

/**
 * Recitation playback — Shaykh Mahmoud Khalil al-Husary (murattal), 64 kbps,
 * streamed from the Islamic Network CDN (cached offline by the service worker).
 *
 * One shared player. Two modes:
 *   single      — the per-ayah ▶ button (stops at the ayah's end)
 *   continuous  — «استمع للسورة»: chains ayah after ayah through the mushaf,
 *                 with Media Session lock-screen controls.
 * The global NowPlayingBar always offers stop/next wherever the user goes.
 */
const CDN_ROOT = "https://cdn.islamic.network/quran/audio";

/** Reciters. Two verse-by-verse sources, both streamed straight from origin —
 *  the browser handles HTTP Range; audio is not routed through the SW:
 *   - islamic.network CDN — {ed, br}, indexed by global ayah 1..6236; each
 *     bitrate is verified to return 200 (they differ per edition).
 *   - everyayah.com — {everyayah}, files named سسسآآآ.mp3 (sura+ayah), for
 *     reciters the CDN lacks (e.g. al-Ghāmidī). */
export const RECITERS: Record<string, { ed?: string; br?: number; everyayah?: string; ar: string; en: string }> = {
  husary: { ed: "ar.husary", br: 64, ar: "محمود خليل الحصري", en: "al-Ḥuṣarī" },
  husary_mujawwad: { ed: "ar.husarymujawwad", br: 128, ar: "الحصري (المجوّد)", en: "al-Ḥuṣarī (mujawwad)" },
  minshawi: { ed: "ar.minshawi", br: 128, ar: "محمد صديق المنشاوي", en: "al-Minshāwī" },
  abdulbasit: { ed: "ar.abdulbasitmurattal", br: 64, ar: "عبد الباسط عبد الصمد", en: "ʿAbd al-Bāsiṭ" },
  alafasy: { ed: "ar.alafasy", br: 128, ar: "مشاري العفاسي", en: "Mishary Alafasy" },
  ghamdi: { everyayah: "Ghamadi_40kbps", ar: "سعد الغامدي", en: "al-Ghāmidī" },
  sudais: { ed: "ar.abdurrahmaansudais", br: 192, ar: "عبد الرحمن السديس", en: "as-Sudais" },
  shuraim: { ed: "ar.saoodshuraym", br: 64, ar: "سعود الشريم", en: "ash-Shuraym" },
  muaiqly: { ed: "ar.mahermuaiqly", br: 128, ar: "ماهر المعيقلي", en: "al-Muʿayqilī" },
  ajmi: { ed: "ar.ahmedajamy", br: 128, ar: "أحمد العجمي", en: "al-ʿAjmī" },
  shatri: { ed: "ar.shaatree", br: 128, ar: "أبو بكر الشاطري", en: "ash-Shāṭirī" },
  hudhaify: { ed: "ar.hudhaify", br: 128, ar: "علي الحذيفي", en: "al-Ḥudhayfī" },
  hanirifai: { ed: "ar.hanirifai", br: 192, ar: "هاني الرفاعي", en: "Hāni ar-Rifāʿī" },
  jibreel: { ed: "ar.muhammadjibreel", br: 128, ar: "محمد جبريل", en: "Muḥammad Jibrīl" },
  basfar: { ed: "ar.abdullahbasfar", br: 64, ar: "عبد الله بصفر", en: "Abdullāh Baṣfar" },
  ayyoub: { ed: "ar.muhammadayyoub", br: 128, ar: "محمد أيوب", en: "Muḥammad Ayyūb" },
  /**
   * **مصحفُ المعلّم** — تلاوةٌ تُلقِّن: إيقاعٌ بطيءٌ بيّنٌ وسكتاتُ الترديد
   * محفوظة. زِيدت لأنّها **التلاوةُ التي بُني لها بابُ التلقين**، ولم تكن
   * معروضةً من قبلُ في شيءٍ من المصادر الحيّة. ولم يُبدَّل بها قارئٌ قائم.
   */
  husary_muallim: {
    everyayah: "Husary_Muallim_128kbps",
    ar: "الحصري — مصحف المعلّم",
    en: "al-Ḥuṣarī — Muʿallim (teaching)",
  },
};

const reciterOf = () => RECITERS[getSettings().reciter] ?? RECITERS.husary;
/** mp3 URL for a global ayah id (1..6236), per the current reciter's source. */
function audioUrl(id: number): string {
  const r = reciterOf();
  if (r.everyayah) {
    const [s, a] = locationOf(id);
    return `https://everyayah.com/data/${r.everyayah}/${pad3(s)}${pad3(a)}.mp3`;
  }
  return `${CDN_ROOT}/${r.br}/${r.ed}/${id}.mp3`;
}

/**
 * **التلاوةُ المنزَّلةُ تُقدَّم على الشبكة — ولا يُبدَّل مصدرٌ حيّ.**
 *
 * ولا يقع هذا إلّا لقارئٍ **ثبت بالقياس** أنّ مرآتَنا تسجيلُه بعينه (انظر
 * `lib/sawt/tilawa.ts`)؛ ومن نزّل جزءًا سمعه من جهازه بلا إنترنت، ومن لم
 * يُنزّل شيئًا لم يتغيّر عليه شيء.
 *
 * **والتسخينُ قبل الضغط لا بعده**: زرُّ الآية يُهيّئ رابطَها عند ظهوره، فيبقى
 * التشغيلُ عند الضغط **متزامنًا في نَفَس اللمسة** — فلا تُكسر سياسةُ التشغيل
 * على آبل (`play()` بعد `await` تُرفض هناك).
 */
const offlineUrls = new Map<number, string>();
const warming = new Set<number>();
async function warmOffline(id: number): Promise<void> {
  if (id < 1 || id > LAST_AYAH || offlineUrls.has(id) || warming.has(id)) return;
  if (!mirrorOf(getSettings().reciter)) return;
  warming.add(id);
  const [s, a] = locationOf(id);
  const url = await offlineObjectUrl(getSettings().reciter, s, a);
  if (url) {
    if (offlineUrls.size > 40) clearOffline(id);
    offlineUrls.set(id, url);
  }
  warming.delete(id);
}
/** لا يُبقى إلّا جوارُ الموضع — وروابطُ الكائنات تُردّ للجامع صراحةً */
function clearOffline(around = 0): void {
  for (const [k, u] of offlineUrls) {
    if (!around || Math.abs(k - around) > 20) {
      URL.revokeObjectURL(u);
      offlineUrls.delete(k);
    }
  }
}
/** ما يُشغَّل فعلًا لهذه الآية: المنزَّلُ ثمّ المجلوبُ مسبقًا ثمّ الشبكة */
const srcFor = (id: number) => offlineUrls.get(id) ?? prefetched.get(id) ?? audioUrl(id);

/** الجلبُ المسبق للآية التالية (2026-07-29، رصد المالك: التلاوةُ تتوقف بعد
 *  آيةٍ أو اثنتين والشاشةُ مطفأة): iOS يعلّق شبكةَ الصفحة عند إطفاء الشاشة،
 *  وفجوةُ تحميل الآية التالية تقطع جلسةَ الصوت. نجلب التاليةَ blob مسبقًا
 *  فيصير تبديلُ المصدر فوريًّا بلا شبكة — والجلسةُ لا تنقطع. إن منع CORS
 *  الجلبَ سقطنا للرابط المباشر كما كان. */
const prefetched = new Map<number, string>();
let prefetching = new Set<number>();
async function prefetchAyah(id: number): Promise<void> {
  if (id < 1 || id > LAST_AYAH || prefetched.has(id) || prefetching.has(id)) return;
  // المنزَّلُ يُغني عن الجلب — ولا يُطلب من الشبكة ما هو في الجهاز
  await warmOffline(id);
  if (offlineUrls.has(id)) return;
  prefetching.add(id);
  try {
    const res = await fetch(audioUrl(id), { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      prefetched.set(id, URL.createObjectURL(blob));
      // نظافة: لا نُبقي إلا جوارَ الموضع الحاليّ
      for (const [k, u] of prefetched) {
        if (Math.abs(k - id) > 3) { URL.revokeObjectURL(u); prefetched.delete(k); }
      }
    }
  } catch { /* يسقط للرابط المباشر */ }
  prefetching.delete(id);
}
function clearPrefetch() {
  for (const u of prefetched.values()) URL.revokeObjectURL(u);
  prefetched.clear();
  prefetching = new Set();
}

/** مشغّلان متناوبان (2026-07-29، المرحلة الثانية من علاج الخلفية — المالك:
 *  «يشغّل ٣ أو ٤ آيات ثم يتوقف»): fetch تُعلَّق والشاشةُ مطفأة فينفد مخزونُ
 *  الجلب المسبق، أمّا تحميلُ عنصرِ الوسائط فمسموحٌ ما دامت جلسةُ الصوت حيّة —
 *  فبينما يُتلى بالمشغّل الفعّال يحمّل الاحتياطيُّ الآيةَ التالية، ويتسلّم
 *  عند «ended» فورًا بمخزونه، ثم يتبادلان الدور. */
let playersPair: [HTMLAudioElement, HTMLAudioElement] | null = null;
let curIdx = 0;
let player: HTMLAudioElement | null = null; // = playersPair[curIdx] — الفعّال
let currentId = 0;
let continuous = false;
let currentLocation: string | null = null;
let repeatTotal = 0; // 0 = no repeat; N = repeat current ayah N times
let repeatLeft = 0;
let stopAtId = 0; // 0 = no bound; else stop after this global ayah (range end)
let preview = false; // true = a «مثلها» sample; the reader must NOT follow it

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Global ayah number currently playing (0 = nothing). */
export const usePlayingId = () => useSyncExternalStore(subscribe, () => currentId);
export const playingLocation = () => currentLocation;

export function stopAudio() {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
  continuous = false;
  repeatTotal = 0;
  repeatLeft = 0;
  stopAtId = 0;
  preview = false;
  for (const pl of playersPair ?? []) if (!pl.paused) pl.pause();
  currentId = 0;
  currentLocation = null;
  notify();
}

/** Global playback id (0 when stopped) — for the reader to reflect state. */
export const currentPlayingId = () => currentId;

/** True while the current playback is a «مثلها» preview sample. The reader's
 *  follow-along / page-sync effects check this so a sample never moves the
 *  reader off the ayah/page they are on. */
export const isPreviewPlaying = () => preview;

/** Apply a new playback rate to the live player (settings change mid-recitation). */
export function setLivePlaybackRate(rate: number) {
  for (const pl of playersPair ?? []) {
    pl.defaultPlaybackRate = rate;
    pl.playbackRate = rate;
  }
}

/** Reciter changed in settings — restart the current ayah in the new voice so
 *  the change is heard at once (keeps continuous/repeat/range state). */
export function reloadForReciter() {
  clearPrefetch(); // مخزونُ الجلب بصوت القارئ السابق
  clearOffline(); // ومنزَّلُ القارئ السابق كذلك — ولا يُسمع صوتٌ بغير اسمه
  if (playersPair) playersPair[1 - curIdx].removeAttribute("src"); // احتياطيٌّ بصوتٍ قديم
  if (currentId && player && !player.paused) start(currentId);
}

async function updateMediaSession(id: number) {
  currentLocation = null;
  try {
    const { getAyahByGlobalNo, surahNameAr } = await import("../db");
    const ayah = await getAyahByGlobalNo(id);
    if (ayah && currentId === id) {
      currentLocation = ayah.location;
      notify();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${surahNameAr(ayah.surahNo)} — ${ayah.ayahNo}`,
          artist: reciterOf().ar,
          album: "مشكاة",
        });
      }
    }
  } catch {
    /* metadata is decorative */
  }
}

/** يهيّئ زوجَ المشغّلين مرةً ويعيد الفعّالَ الحاليّ */
function ensurePair(): HTMLAudioElement {
  if (!playersPair) {
    playersPair = [new Audio(), new Audio()];
    for (const pl of playersPair) pl.preload = "auto";
  }
  player = playersPair[curIdx];
  return player;
}

/** حضِّر الاحتياطيَّ بالآية التالية — تحميلُ وسائطَ يعمل والشاشةُ مطفأة */
function primeStandby(nextId: number) {
  if (!playersPair || nextId < 1 || nextId > LAST_AYAH) return;
  const standby = playersPair[1 - curIdx];
  const target = srcFor(nextId);
  if (standby.src !== target) {
    standby.src = target;
    standby.load();
  }
}

function start(id: number) {
  if (id < 1 || id > LAST_AYAH) {
    stopAudio();
    return;
  }
  const firstInit = !playersPair;
  const pl = ensurePair();
  if (firstInit) {
    if ("mediaSession" in navigator) {
      // «إيقاف مؤقت» من شاشة القفل يوقف دون قتل الجلسة — و«تشغيل» يستأنف
      navigator.mediaSession.setActionHandler("pause", () => {
        player?.pause();
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
      });
      navigator.mediaSession.setActionHandler("play", () => {
        void player?.play();
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      });
      navigator.mediaSession.setActionHandler("stop", stopAudio);
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        preview = false; // transport controls leave preview mode
        if (currentId > 1) start(currentId - 1);
      });
    }
  }
  pl.onended = () => {
    if (currentId !== id) return;
    if (repeatLeft > 0) {
      repeatLeft -= 1;
      // إعادةُ الآية نفسِها بلا إعادةِ تحميل — أثبتُ في الخلفية
      pl.currentTime = 0;
      void pl.play().catch(() => { if (currentId === id) stopAudio(); });
      return;
    }
    if (stopAtId && id >= stopAtId) {
      stopAudio();
      return;
    }
    if (continuous && id < LAST_AYAH) {
      if (repeatTotal > 0) repeatLeft = repeatTotal; // repeat each ayah in a continuous range
      curIdx = 1 - curIdx; // الاحتياطيُّ المحمَّلُ سلفًا يتسلّم الدور
      start(id + 1);
    } else stopAudio();
  };
  let retried = false;
  pl.onerror = () => {
    if (currentId !== id) return;
    // هفوةُ شبكةٍ (كثيرًا ما تقع والشاشةُ مطفأة) — محاولةٌ ثانيةٌ قبل الإيقاف
    if (!retried) {
      retried = true;
      window.setTimeout(() => {
        if (currentId !== id) return;
        pl.src = srcFor(id);
        void pl.play().catch(() => { if (currentId === id) stopAudio(); });
      }, 1200);
      return;
    }
    stopAudio();
  };
  // إن كان هذا المشغّلُ حُضِّر بهذه الآية سلفًا (تناوبُ الاحتياطي) — بأيِّ
  // صورةٍ من صورتيها blob أو رابطًا — فلا نعيد التعيين كي يبقى مخزونُه المحمَّل
  const direct = audioUrl(id);
  const ready = offlineUrls.get(id) ?? prefetched.get(id);
  if (pl.src !== direct && !(ready && pl.src === ready)) pl.src = ready ?? direct;
  pl.preload = "auto";
  // loading a new src resets the rate to defaultPlaybackRate — set both
  pl.defaultPlaybackRate = getSettings().speed;
  pl.playbackRate = getSettings().speed;
  currentId = id;
  void pl.play().catch(() => {
    // a rapid second play() aborts this one — only clear if still current
    if (currentId === id) stopAudio();
  });
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  // اجلب التاليتين الآن — وقتَ ما تزال الشبكةُ حيّة — وحضِّر الاحتياطيَّ
  // بالتالية عبر قناة الوسائط (تعمل والشاشةُ مطفأة)
  if (continuous) {
    void prefetchAyah(id + 1).then(() => { if (currentId === id) primeStandby(id + 1); });
    void prefetchAyah(id + 2);
    primeStandby(id + 1);
  } else {
    void warmOffline(id + 1); // آيةٌ واحدةٌ تكفي التنقّلَ بالزرّ
  }
  notify();
  void updateMediaSession(id);
}

/** Play one ayah (stops at its end). */
function toggle(globalAyahNo: number) {
  if (currentId === globalAyahNo && player && !player.paused) {
    stopAudio();
    return;
  }
  preview = false;
  continuous = false;
  start(globalAyahNo);
}

/** Sample one ayah's recitation WITHOUT moving the reader — used by the «مثلها»
 *  neighbour rows. Reader effects ignore playback while isPreviewPlaying(). */
export function playPreview(globalAyahNo: number) {
  if (currentId === globalAyahNo && player && !player.paused && preview) {
    stopAudio();
    return;
  }
  continuous = false;
  repeatTotal = 0;
  repeatLeft = 0;
  stopAtId = 0;
  preview = true;
  start(globalAyahNo);
}

/** «استمع للسورة» — continuous recitation from this ayah onward. */
export function playContinuous(fromGlobalAyahNo: number) {
  preview = false;
  continuous = true;
  repeatTotal = 0;
  repeatLeft = 0;
  stopAtId = 0;
  start(fromGlobalAyahNo);
}

/**
 * Reading controller — play from an ayah with options.
 *   repeat: repeat EACH ayah this many extra times (0 = once)
 *   continueAfter: keep going to following ayahs (else stop at `from`, honouring repeat)
 *   until: optional global ayah id to stop after (range end)
 */
export function playFrom(
  fromGlobalAyahNo: number,
  opts: { repeat?: number; continueAfter?: boolean; until?: number } = {},
) {
  preview = false;
  repeatTotal = Math.max(0, opts.repeat ?? 0);
  repeatLeft = repeatTotal;
  continuous = opts.continueAfter ?? false;
  stopAtId = opts.until ?? 0;
  start(fromGlobalAyahNo);
}

export function next() {
  preview = false; // advancing via the transport control leaves preview mode
  if (currentId > 0 && currentId < LAST_AYAH) start(currentId + 1);
}

/** `ayahId` is the global ayah number 1..6236 (from AyahDoc._id "a<n>").
 *  `preview` routes clicks through playPreview so sampling a «مثلها» neighbour
 *  never drags the reader to that ayah's surah/page. */
export default function AudioButton({ ayahId, preview: isPreview = false }: { ayahId: number; preview?: boolean }) {
  useUILang();
  const playing = usePlayingId() === ayahId;
  // يُهيَّأ المنزَّلُ عند ظهور الزرّ لا عند ضغطه — فتبقى اللمسةُ متّصلةً بالتشغيل
  useEffect(() => {
    void warmOffline(ayahId);
  }, [ayahId]);
  return (
    <button
      className="chip"
      onClick={() => (isPreview ? playPreview(ayahId) : toggle(ayahId))}
      style={{ border: "none", cursor: "pointer" }}
      title={getUILang() === "ar" ? "تلاوة الشيخ محمود خليل الحصري" : "Recitation: Shaykh al-Ḥuṣarī"}
    >
      {playing ? `◼ ${t("stop")}` : `▶ ${t("listen")}`}
    </button>
  );
}

/** من أين تُسمع الآيةُ الجارية — يُقال بصدقٍ في سطر الإسناد */
function sourceOfNow(): CreditSource {
  if (currentId && offlineUrls.has(currentId)) return "downloaded";
  return reciterOf().everyayah ? "everyayah" : "cdn";
}

/** Fixed mini player shown whenever recitation is playing. */
export function NowPlayingBar() {
  useUILang();
  const id = usePlayingId();
  const { selected } = useReading();
  const [showCredit, setShowCredit] = useState(false);
  // when an ayah is selected the reading dock is shown and carries its own
  // transport — don't stack a second fixed bar over it (they used to collide).
  if (id === 0 || selected) return null;
  const loc = currentLocation;
  const ar = getUILang() === "ar";
  return (
    <div className="card npb npb-credited">
      <div className="npb-row">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--accent)",
            animation: "pulse 1.2s ease-in-out infinite",
          }}
        />
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>
          {ar ? "تلاوة" : "Reciting"}
          {loc ? ` · ${num(loc.split(":")[1])}` : ""}
        </span>
        {/* الإسنادُ في موضع السماع — شرطُ الرخصة، ويُفتح بلمسةٍ ولا يُخفى */}
        <button
          className="chip npb-src"
          style={{ border: "none", cursor: "pointer" }}
          onClick={() => setShowCredit((v) => !v)}
          aria-expanded={showCredit}
          title={ar ? "مصدر التلاوة وإسنادها" : "Recitation source & attribution"}
        >
          {ar ? "المصدر" : "Source"}
        </button>
        <button className="chip" style={{ border: "none", cursor: "pointer" }} onClick={() => next()} title="⏭">
          ⏭
        </button>
        <button className="chip" style={{ border: "none", cursor: "pointer" }} onClick={stopAudio} title={t("stop")}>
          ◼ {t("stop")}
        </button>
      </div>
      {showCredit && <RecitationCredit source={sourceOfNow()} className="npb-cr" />}
    </div>
  );
}

export const ayahIdOf = (doc: { _id: string }): number => Number(doc._id.slice(1));

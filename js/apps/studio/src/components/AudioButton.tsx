import { useSyncExternalStore } from "react";
import { getUILang, t, useUILang } from "../i18n";

/**
 * Per-ayah recitation playback — Shaykh Mahmoud Khalil al-Husary (murattal),
 * 64 kbps, streamed from the Islamic Network CDN (no hosting, no key).
 * One shared player: starting an ayah stops the previous one. A global
 * NowPlayingBar (rendered in the app shell) guarantees a visible stop
 * control even after navigating away from the playing ayah.
 */
const CDN = "https://cdn.islamic.network/quran/audio/64/ar.husary";

let player: HTMLAudioElement | null = null;
let currentId = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const usePlayingId = () => useSyncExternalStore(subscribe, () => currentId);

export function stopAudio() {
  if (player && !player.paused) player.pause();
  currentId = 0;
  notify();
}

function toggle(globalAyahNo: number) {
  if (currentId === globalAyahNo && player && !player.paused) {
    stopAudio();
    return;
  }
  if (!player) player = new Audio();
  const id = globalAyahNo;
  // ended/error handlers are bound per-start and guard against staleness
  player.onended = player.onerror = () => {
    if (currentId === id) {
      currentId = 0;
      notify();
    }
  };
  player.src = `${CDN}/${id}.mp3`;
  currentId = id;
  void player.play().catch(() => {
    // a rapid second play() aborts this one — only clear if still current
    if (currentId === id) {
      currentId = 0;
      notify();
    }
  });
  notify();
}

/** `ayahId` is the global ayah number 1..6236 (from AyahDoc._id "a<n>"). */
export default function AudioButton({ ayahId }: { ayahId: number }) {
  useUILang();
  const playing = usePlayingId() === ayahId;
  return (
    <button
      className="chip"
      onClick={() => toggle(ayahId)}
      style={{ border: "none", cursor: "pointer" }}
      title={getUILang() === "ar" ? "تلاوة الشيخ محمود خليل الحصري" : "Recitation: Shaykh al-Ḥuṣarī"}
    >
      {playing ? `◼ ${t("stop")}` : `▶ ${t("listen")}`}
    </button>
  );
}

/** Fixed mini bar shown whenever recitation is playing — always stoppable. */
export function NowPlayingBar() {
  useUILang();
  const id = usePlayingId();
  if (id === 0) return null;
  return (
    <button
      onClick={stopAudio}
      className="card"
      style={{
        position: "fixed",
        bottom: 46,
        insetInlineStart: 16,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        cursor: "pointer",
        color: "var(--accent)",
        fontWeight: 600,
      }}
      title={t("stop")}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--accent)",
          animation: "pulse 1.2s ease-in-out infinite",
        }}
      />
      {getUILang() === "ar" ? "تلاوة جارية" : "Reciting"} · ◼ {t("stop")}
    </button>
  );
}

export const ayahIdOf = (doc: { _id: string }): number => Number(doc._id.slice(1));

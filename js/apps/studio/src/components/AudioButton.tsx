import { useEffect, useState } from "react";
import { getUILang, t, useUILang } from "../i18n";

/**
 * Per-ayah recitation playback — Shaykh Mahmoud Khalil al-Husary (murattal),
 * 64 kbps, streamed from the Islamic Network CDN (no hosting, no key).
 * One shared player: starting an ayah stops the previous one.
 */
const CDN = "https://cdn.islamic.network/quran/audio/64/ar.husary";

let player: HTMLAudioElement | null = null;
let currentId = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function toggle(globalAyahNo: number) {
  if (currentId === globalAyahNo && player && !player.paused) {
    player.pause();
    currentId = 0;
    notify();
    return;
  }
  if (!player) {
    player = new Audio();
    player.onended = player.onerror = () => {
      currentId = 0;
      notify();
    };
  }
  player.src = `${CDN}/${globalAyahNo}.mp3`;
  currentId = globalAyahNo;
  void player.play().catch(() => {
    currentId = 0;
    notify();
  });
  notify();
}

/** `ayahId` is the global ayah number 1..6236 (from AyahDoc._id "a<n>"). */
export default function AudioButton({ ayahId }: { ayahId: number }) {
  useUILang();
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  const playing = currentId === ayahId;
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

export const ayahIdOf = (doc: { _id: string }): number => Number(doc._id.slice(1));

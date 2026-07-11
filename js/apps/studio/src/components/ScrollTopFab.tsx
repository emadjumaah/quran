/**
 * ScrollTopFab — a small floating «back to top» arrow (mobile). Watches a
 * scroll container and appears once you've scrolled down; tap to glide back to
 * the top. Rendered by the Reader over its scrolling <main>.
 */
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { getUILang } from "../i18n";

export default function ScrollTopFab({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > 500);
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollerRef]);

  if (!show) return null;
  const ar = getUILang() === "ar";
  return (
    <button
      className="scrolltop-fab"
      onClick={() => scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      title={ar ? "إلى الأعلى" : "back to top"}
      aria-label={ar ? "إلى الأعلى" : "back to top"}
    >
      ↑
    </button>
  );
}

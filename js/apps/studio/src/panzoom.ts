/**
 * usePanZoom — drag-pan + pinch/wheel zoom over a 0..100 SVG viewBox. Extracted
 * from the المحكمات «النسيج الواحد» so the roots «توارد» fabric shares exactly the
 * same feel. The consumer owns the SVG ref and spreads `svgHandlers` onto it,
 * reads `view` for the <g transform>, and calls `reset()` when the hub changes.
 */
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from "react";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface PanZoom {
  view: { x: number; y: number; k: number };
  reset: () => void;
  zoomAt: (px: number, py: number, factor: number) => void;
  svgHandlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
    onWheel: (e: ReactWheelEvent) => void;
  };
}

export function usePanZoom(svgRef: RefObject<SVGSVGElement | null>): PanZoom {
  // pan/zoom transform over a 0..100 viewBox
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const reset = () => setView({ x: 0, y: 0, k: 1 });

  // pointer bookkeeping for drag-pan + pinch-zoom
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number } | null>(null);

  const toSvg = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 50, y: 50 };
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };
  const zoomAt = (px: number, py: number, factor: number) =>
    setView((v) => {
      const k = clamp(v.k * factor, 0.5, 6);
      const f = k / v.k;
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f };
    });

  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    if (pts.length === 1) {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      const dx = ((e.clientX - prev.x) / r.width) * 100;
      const dy = ((e.clientY - prev.y) / r.height) * 100;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current) {
        const mid = toSvg((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        zoomAt(mid.x, mid.y, dist / pinch.current.dist);
      }
      pinch.current = { dist };
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
  };
  const onWheel = (e: ReactWheelEvent) => {
    const p = toSvg(e.clientX, e.clientY);
    zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  return {
    view,
    reset,
    zoomAt,
    svgHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  };
}

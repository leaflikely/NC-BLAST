import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@ncblast/shared";

/**
 * 3-handle resize controller for the overlay widget — corner/right/bottom.
 * Mirrors the source `startResize`/mousemove/mouseup logic exactly:
 *   - corner: uniform scale via dx/500
 *   - right:  width-only; scale = w / BASE_W
 *   - bottom: height-only; scale = h / cardH
 * Persists scale + explicit w/h to localStorage.
 */

export type ResizeMode = "corner" | "right" | "bottom";

export interface UseResizableArgs {
  cornerRef: React.RefObject<HTMLElement>;
  rightRef: React.RefObject<HTMLElement>;
  bottomRef: React.RefObject<HTMLElement>;
  baseW: number;
  baseH: number;
  getCardHeight: () => number;
  scaleRef: React.MutableRefObject<number>;
  wRef: React.MutableRefObject<number>;
  hRef: React.MutableRefObject<number>;
  onChange: (s: { scale: number; w: number; h: number }) => void;
}

export function useResizable(args: UseResizableArgs): void {
  const {
    cornerRef, rightRef, bottomRef,
    baseW, baseH, getCardHeight,
    scaleRef, wRef, hRef, onChange,
  } = args;

  const modeRef = useRef<ResizeMode | null>(null);
  const startRef = useRef({ x: 0, y: 0, scale: 1, w: 0, h: 0 });

  useEffect(() => {
    function start(mode: ResizeMode, e: MouseEvent) {
      modeRef.current = mode;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        scale: scaleRef.current,
        w: wRef.current || baseW * scaleRef.current,
        h: hRef.current || (getCardHeight() * scaleRef.current),
      };
      e.preventDefault();
      e.stopPropagation();
    }
    const sc = (e: MouseEvent) => start("corner", e);
    const sr = (e: MouseEvent) => start("right", e);
    const sb = (e: MouseEvent) => start("bottom", e);

    cornerRef.current?.addEventListener("mousedown", sc);
    rightRef.current?.addEventListener("mousedown", sr);
    bottomRef.current?.addEventListener("mousedown", sb);

    function onMove(e: MouseEvent) {
      const mode = modeRef.current;
      if (!mode) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;

      if (mode === "corner") {
        // Uniform scale from corner drag
        scaleRef.current = Math.max(0.3, Math.min(3.0, startRef.current.scale + dx / 500));
        wRef.current = 0; hRef.current = 0; // let scale drive size
      } else if (mode === "right") {
        // Width-only drag
        wRef.current = Math.max(200, startRef.current.w + dx);
        hRef.current = 0;
        scaleRef.current = wRef.current / baseW;
      } else if (mode === "bottom") {
        // Height-only drag — scales to fit
        hRef.current = Math.max(60, startRef.current.h + dy);
        const cardH = getCardHeight() || baseH;
        scaleRef.current = hRef.current / cardH;
        wRef.current = baseW * scaleRef.current;
      }
      onChange({ scale: scaleRef.current, w: wRef.current, h: hRef.current });
    }

    function onUp() {
      if (!modeRef.current) return;
      modeRef.current = null;
      localStorage.setItem(STORAGE_KEYS.overlayScale, String(scaleRef.current));
      localStorage.setItem(STORAGE_KEYS.overlayW, String(wRef.current));
      localStorage.setItem(STORAGE_KEYS.overlayH, String(hRef.current));
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);

    return () => {
      cornerRef.current?.removeEventListener("mousedown", sc);
      rightRef.current?.removeEventListener("mousedown", sr);
      bottomRef.current?.removeEventListener("mousedown", sb);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [cornerRef, rightRef, bottomRef, baseW, baseH, getCardHeight, onChange, scaleRef, wRef, hRef]);
}

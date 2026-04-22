import { useEffect, useRef } from "react";
import { STORAGE_KEYS } from "@ncblast/shared";

/**
 * Attaches mouse+touch drag handling to a drag handle element.
 * Persists position to localStorage under `ncblast-pos` so refresh restores it.
 * Exposes a ref-based position so the consumer can render left/top.
 */
export interface DragPos { x: number; y: number; }

export function useDraggable(
  handleRef: React.RefObject<HTMLElement>,
  initial: DragPos,
  onChange: (p: DragPos) => void
) {
  const posRef = useRef<DragPos>(initial);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    posRef.current = initial;
  }, [initial.x, initial.y]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    function startDrag(e: MouseEvent | TouchEvent) {
      const touch = "touches" in e ? e.touches[0] : e;
      draggingRef.current = true;
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        ox: posRef.current.x,
        oy: posRef.current.y,
      };
      e.preventDefault();
    }

    function onDrag(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      const touch = "touches" in e ? e.touches[0] : e;
      let x = startRef.current.ox + (touch.clientX - startRef.current.x);
      let y = startRef.current.oy + (touch.clientY - startRef.current.y);
      // Clamp to screen
      x = Math.max(0, Math.min(1920 - 100, x));
      y = Math.max(0, Math.min(1080 - 40, y));
      posRef.current = { x, y };
      onChange({ x, y });
    }

    function endDrag() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      localStorage.setItem(STORAGE_KEYS.overlayPos, JSON.stringify(posRef.current));
    }

    handle.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
    handle.addEventListener("touchstart", startDrag, { passive: false });
    document.addEventListener("touchmove", onDrag, { passive: false });
    document.addEventListener("touchend", endDrag);

    return () => {
      handle.removeEventListener("mousedown", startDrag);
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", endDrag);
      handle.removeEventListener("touchstart", startDrag);
      document.removeEventListener("touchmove", onDrag);
      document.removeEventListener("touchend", endDrag);
    };
  }, [handleRef, onChange]);

  return posRef;
}

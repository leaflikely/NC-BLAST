import { useEffect, useRef, useCallback } from "react";
import type { OverlayState } from "@ncblast/shared";
import { pollOverlay } from "@ncblast/shared";

/**
 * Infinite long-polling loop for the overlay Worker.
 * Mirrors the source `poll()` loop: long-poll with etag, 30s timeout,
 * fall back to renderState(null) on error, 200ms pause between polls.
 */
export function usePolling(
  slot: number,
  onState: (state: OverlayState | null, prev: OverlayState | null) => void
): { reset: () => void } {
  const lastEtagRef = useRef<string | null>(null);
  const lastStateRef = useRef<OverlayState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          const data = await pollOverlay(slot, lastEtagRef.current);
          if (data.etag && data.etag !== lastEtagRef.current) {
            const prev = lastStateRef.current;
            lastStateRef.current = data.state;
            lastEtagRef.current = data.etag;
            onState(data.state, prev);
          } else if (!lastEtagRef.current) {
            // First load with no data yet
            onState(null, null);
          }
        } catch (_e) {
          // Network error — show offline, retry in 3s
          onState(null, null);
          await new Promise((r) => setTimeout(r, 3000));
        }
        // Short pause between polls (long-poll already waited up to 25s server-side)
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [slot, onState]);

  const reset = useCallback(() => {
    lastEtagRef.current = null;
    lastStateRef.current = null;
  }, []);

  return { reset };
}

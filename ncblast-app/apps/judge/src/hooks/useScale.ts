import { useEffect, useState } from "react";

/**
 * VIEWPORT SCALE — Use layout width/height only — never the visual viewport
 * (which shrinks when keyboard opens). This means we only ever scale based on
 * the true screen dimensions, not the keyboard-adjusted view.
 * Returns a scale factor and updates :root font-size accordingly.
 */
export function useScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function update() {
      const w = window.screen.width;
      const h = window.screen.height;
      // Use the smaller screen dimension as width (handles landscape correctly)
      const sw = Math.min(w, h);
      const sh = Math.max(w, h);
      const wScale = Math.min(sw / 480, 2.2);
      const hScale = Math.min(sh / 700, 2.0);
      const s = Math.min(wScale, hScale);
      const clamped = Math.max(0.7, Math.min(2.0, s));
      setScale(clamped);
      document.documentElement.style.fontSize = (16 * clamped) + "px";
    }
    update();
    // Only re-scale on orientation change — resize fires on keyboard open and causes input blur
    window.addEventListener("orientationchange", update);
    return () => window.removeEventListener("orientationchange", update);
  }, []);
  return scale;
}

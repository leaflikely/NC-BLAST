import { useEffect, useState, useCallback } from "react";
import { STORAGE_KEYS } from "@ncblast/shared";

/**
 * Dark mode toggle bound to `ncblast-dark` localStorage key.
 * Applies/removes the `dark` class on <body> as a side effect.
 */
export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.dark) === "1";
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem(STORAGE_KEYS.dark, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  // Apply dark class to body
  useEffect(() => {
    document.body.classList.toggle("dark", dark);
  }, [dark]);
  return [dark, toggle];
}

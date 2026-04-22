import { useEffect } from "react";

/**
 * Block accidental page refresh/close when match is in progress.
 * `beforeunload` — works on desktop and Android Chrome.
 * Pull-to-refresh on iOS Safari is blocked via CSS overscroll-behavior:none
 * on html and body — JS cannot reliably intercept it.
 */
export function useRefreshGuard(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have a match in progress. Are you sure you want to leave?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [isActive]);
}

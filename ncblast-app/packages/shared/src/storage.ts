/**
 * Typed localStorage helpers — JSON get/set with a fallback value.
 * Identical behavior to the source `sGet`/`sSave`.
 */

export function sGet<T>(key: string, fb: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
}

export function sSave<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore quota errors */
  }
}

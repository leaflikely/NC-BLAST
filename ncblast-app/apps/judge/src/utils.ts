import type { Combo, Finish } from "@ncblast/shared";
export { FINISH, PENALTY } from "@ncblast/shared";

export const emptyCombo = (): Combo => ({
  blade: null,
  ratchet: null,
  bit: null,
});

export const comboStr = (c: Combo | null | undefined): string =>
  c?.blade && c?.ratchet && c?.bit ? `${c.blade} ${c.ratchet} ${c.bit}` : "—";

export const comboReady = (c: Combo | null | undefined): boolean =>
  Boolean(c?.blade && c?.ratchet && c?.bit);

/** Truncate display names longer than 15 chars to 12 + ellipsis */
export const tn = (name: string | null | undefined): string =>
  name && name.length > 15 ? name.slice(0, 12) + "…" : name || "";

/**
 * Split a part name into display lines for buttons.
 * Splits on space or dash (removing dash), returns array of words.
 * keepDash=true: only split on spaces (ratchets keep their dashes e.g. "1-60")
 * keepDash=false (default): also split on dashes (bits e.g. "Low-Rush" → ["Low","Rush"])
 */
export function splitPartName(name: string, keepDash?: boolean): string[] {
  if (keepDash) return name.split(" ").filter(Boolean);
  return name.replace(/-/g, " ").split(" ").filter(Boolean);
}

export type { Combo, Finish };

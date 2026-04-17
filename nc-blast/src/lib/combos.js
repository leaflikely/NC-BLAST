export const emptyCombo = () => ({blade:null,ratchet:null,bit:null});
export const comboStr = (c) => c?.blade&&c?.ratchet&&c?.bit ? `${c.blade} ${c.ratchet} ${c.bit}` : "—";
export const comboReady = (c) => c?.blade&&c?.ratchet&&c?.bit;
// Truncate display names longer than 15 chars to 12 + ellipsis
export const tn = (name) => name && name.length > 15 ? name.slice(0,12) + "…" : (name||"");
export function splitPartName(name, keepDash) {
  // keepDash=true: only split on spaces (ratchets keep their dashes e.g. "1-60")
  // keepDash=false (default): also split on dashes (bits e.g. "Low-Rush" → ["Low","Rush"])
  if(keepDash) return name.split(" ").filter(Boolean);
  return name.replace(/-/g, " ").split(" ").filter(Boolean);
}
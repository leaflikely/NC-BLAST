import { DEFAULT_PARTS } from '../data/parts'

export const KEYS = { parts: "bx-library-v9", players: "bx-roster-v2", combos: "bx-combos-v1", matchLog: "bx-matchlog-v1", challongeMap: "bx-challonge-map-v1", overlaySlot: "bx-overlay-slot-v1" };
export function sGet(key, fb) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
export function sSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
export function mergeWithDefaults(saved) {
  // Merge: defaults keep their order (pinned first), user extras appended alphabetically
  function mergeList(defaults, saved) {
    const extras = (saved||[]).filter(x => !defaults.includes(x)).sort();
    return [...new Set([...defaults, ...extras])];
  }
  return {
    blades: mergeList(DEFAULT_PARTS.blades, saved.blades),
    ratchets: mergeList(DEFAULT_PARTS.ratchets, saved.ratchets),
    bits: mergeList(DEFAULT_PARTS.bits, saved.bits),
  };
}
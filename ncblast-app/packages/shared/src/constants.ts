/**
 * Shared constants used by both judge (scoring) and overlay (rendering).
 * Finish codes, point values, worker URL, and all localStorage keys live here
 * so the two apps never drift.
 */
import type { Finish } from "./types";

/** Cloudflare Worker base URL (Challonge proxy + overlay bus). */
export const WORKER_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_WORKER_URL) ||
  "https://challonge-proxy.danny61734.workers.dev";

/** Alias kept for parity with source (`OVERLAY_WORKER`). */
export const OVERLAY_WORKER = WORKER_BASE_URL;

/** Combo cache TTL — 1 hour in ms, used for both localStorage and Worker KV. */
export const COMBO_CACHE_TTL = 60 * 60 * 1000;

/** Core scoring finishes (index.html:269). */
export const FINISH: Finish[] = [
  { id: "SPF", p: 1, name: "Spin Finish" },
  { id: "OVR", p: 2, name: "Over Finish" },
  { id: "BST", p: 2, name: "Burst Finish" },
  { id: "XTR", p: 3, name: "Xtreme Finish" },
];

// Penalty finishes: listed under the LOSER, points go to OPPONENT
export const PENALTY: Finish[] = [
  { id: "OF2", p: 2, name: "Own Finish", penalty: true },
  { id: "OF3", p: 3, name: "Own Finish", penalty: true },
  { id: "LER", p: 1, name: "Launch Error", penalty: true },
];

/** Display labels for finish banner (overlay.html). */
export const FINISH_LABELS: Record<string, string> = {
  XTR: "XTREME",
  OVR: "OVER",
  BST: "BURST",
  OF: "OUT OF BOUNDS",
  OF2: "OUT — P2 PENALTY",
  OF3: "OUT — P1 PENALTY",
  "LER-STRIKE": "LER STRIKE",
};

/** All localStorage keys used by the judge app — do not change names (data compat). */
export const STORAGE_KEYS = {
  parts: "bx-library-v9",
  players: "bx-roster-v2",
  combos: "bx-combos-v1",
  matchLog: "bx-matchlog-v1",
  challongeMap: "bx-challonge-map-v1",
  overlaySlot: "bx-overlay-slot-v1",
  submitQueue: "bx-submit-queue-v1",
  dark: "ncblast-dark",
  challongeCache: "bx-challonge-cache-v1",
  // overlay-only keys
  overlayScale: "ncblast-scale",
  overlayPos: "ncblast-pos",
  overlayW: "ncblast-w",
  overlayH: "ncblast-h",
} as const;

/** Alias kept for parity with the source's `KEYS` object. */
export const KEYS = STORAGE_KEYS;

/** Google Apps Script endpoint for Sheets submission. */
export const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbzvb5LkqMDXaMVJNFNQSf7dsUJK_0vbTfQ4gRRISGsRWg4mINvawLROxn0SaPqJ5o9E/exec";

// Challonge API key intentionally NOT shipped client-side — the Cloudflare
// Worker holds it as an encrypted env var and proxies all Challonge calls.

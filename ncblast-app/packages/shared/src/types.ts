/**
 * Shared TypeScript types used by both judge and overlay apps.
 * These describe the overlay state payload, combos, finish codes, and
 * localStorage/Worker shapes.
 */

export interface Combo {
  blade: string | null;
  ratchet: string | null;
  bit: string | null;
  /** Millisecond timestamp — used for combo cache expiry. */
  updatedAt?: number;
}

export interface Finish {
  id: string;
  p: number;
  name: string;
  penalty?: boolean;
}

export type Side = "" | "B" | "X";

/** The state shape written by the judge and read by the overlay via Cloudflare Worker KV. */
export interface OverlayState {
  p1: string | null;
  p2: string | null;
  p1Side: Side;
  p2Side: Side;
  pts: [number, number];
  sets: [number, number];
  curSet: number;
  setsNeeded: number;
  pointLimit: number;
  tournamentName: string;
  judge: string;
  p1ActiveCombo: { blade: string | null; ratchet: string | null; bit: string | null } | null;
  p2ActiveCombo: { blade: string | null; ratchet: string | null; bit: string | null } | null;
  lastFinish?: { type: string; scorerIdx: 0 | 1 };
}

export interface MatchConfig {
  pts: number;
  bo: number;
  tm: boolean;
  tournamentName?: string;
}

export interface Parts {
  blades: string[];
  ratchets: string[];
  bits: string[];
}

/** Entry in the persistent match log. Many fields are snapshots for undo/redo. */
export interface LogEntry {
  set: number;
  shuffle: number;
  round: number;
  scorer: string;
  scorerIdx: 0 | 1;
  judge: string;
  penalty: boolean;
  type: string;
  typeName: string;
  points: number;
  p1Score: number;
  p2Score: number;
  p1Name: string;
  p2Name: string;
  p1Combo: Combo;
  p2Combo: Combo;
  p1ComboIdx: number | null;
  p2ComboIdx: number | null;
  p1Side: Side;
  p2Side: Side;
  winnerCombo: string;
  time: string;
  // snapshots for undo
  _pp: [number, number];
  _ps: [number, number];
  _cs: number;
  _u1: number[];
  _u2: number[];
  _sh: number;
  _ls?: [number, number];
}

export interface CachedTournament {
  slug: string;
  participantCount: number;
  ageSeconds: number;
}

export interface ChallongeMatch {
  id: number;
  player1_id: number | null;
  player2_id: number | null;
  player1_name?: string;
  player2_name?: string;
  round: number;
  suggested_play_order?: number;
}

export interface ChallongeParticipantMap {
  [displayName: string]: number;
}

export interface SubmissionQueueItem {
  /** Stable id assigned on enqueue (legacy items without id get one on first load). */
  id?: string;
  /** Endpoint kind — determines how the flusher retries the item. */
  kind?: "sheets" | "challonge";
  type: string;
  payload: unknown;
  queuedAt: number;
}

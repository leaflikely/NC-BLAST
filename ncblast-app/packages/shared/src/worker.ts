/**
 * Cloudflare Worker / Challonge / Sheets client used by both apps.
 * All `fetch` response bodies are treated as `unknown` and narrowed.
 */
import { WORKER_BASE_URL, COMBO_CACHE_TTL, SHEETS_URL } from "./constants";
import type {
  Combo,
  OverlayState,
  CachedTournament,
  ChallongeMatch,
} from "./types";

function hasKey<K extends string>(o: unknown, k: K): o is Record<K, unknown> {
  return typeof o === "object" && o !== null && k in o;
}

/** POST overlay state to Worker KV so the overlay page can long-poll it. */
export async function pushOverlay(
  slot: number,
  state: OverlayState,
): Promise<void> {
  await fetch(`${WORKER_BASE_URL}/overlay/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, state }),
  });
}

export interface PollResult {
  etag: string | null;
  state: OverlayState | null;
}

/** Long-poll the Worker for a state change; returns when etag differs. */
export async function pollOverlay(
  slot: number,
  etag: string | null,
): Promise<PollResult> {
  const url = etag
    ? `${WORKER_BASE_URL}/overlay/poll?slot=${slot}&etag=${etag}`
    : `${WORKER_BASE_URL}/overlay/state?slot=${slot}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown = await res.json();
  const out: PollResult = { etag: null, state: null };
  if (hasKey(data, "etag") && typeof data.etag === "string")
    out.etag = data.etag;
  if (hasKey(data, "state"))
    out.state = (data.state as OverlayState | null) ?? null;
  return out;
}

/** GET current overlay state (used on first load before long-poll). */
export async function getOverlayState(slot: number): Promise<PollResult> {
  return pollOverlay(slot, null);
}

/** GET the cached-tournaments list for the import dropdown. */
export async function listCachedTournaments(): Promise<CachedTournament[]> {
  const res = await fetch(`${WORKER_BASE_URL}/list`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Failed");
  const data: unknown = await res.json();
  if (hasKey(data, "tournaments") && Array.isArray(data.tournaments)) {
    return data.tournaments as CachedTournament[];
  }
  return [];
}

/** DELETE a slug from the Worker cache. */
export async function deleteCachedTournament(slug: string): Promise<void> {
  await fetch(`${WORKER_BASE_URL}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
    signal: AbortSignal.timeout(8000),
  });
}

/** List open Challonge matches for a given slug. */
export async function listMatches(slug: string): Promise<ChallongeMatch[]> {
  const res = await fetch(`${WORKER_BASE_URL}/matches?slug=${slug}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (
    hasKey(data, "errors") &&
    Array.isArray(data.errors) &&
    data.errors.length
  ) {
    throw new Error(String(data.errors[0]));
  }
  if (hasKey(data, "matches") && Array.isArray(data.matches)) {
    return data.matches as ChallongeMatch[];
  }
  return [];
}

export interface SubmitMatchPayload {
  slug: string;
  matchId: number;
  scores_csv: string;
  winner_id: number | null;
}

/** POST a match result to Challonge via the Worker. */
export async function submitMatch(payload: SubmitMatchPayload): Promise<void> {
  const res = await fetch(`${WORKER_BASE_URL}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const msg =
      hasKey(data, "errors") && Array.isArray(data.errors) && data.errors.length
        ? String(data.errors[0])
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (
    hasKey(data, "errors") &&
    Array.isArray(data.errors) &&
    data.errors.length
  ) {
    throw new Error(String(data.errors[0]));
  }
}

// Push a player's combos to the Worker KV so other devices can load them
export async function pushCombos(
  playerName: string,
  combos: Combo[],
): Promise<void> {
  if (!playerName || !combos?.length) return;
  try {
    await fetch(`${WORKER_BASE_URL}/combos/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player: playerName,
        combos,
        updatedAt: Date.now(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* swallow */
  }
}

// Fetch a player's combos from the Worker KV (returns [] on miss/error)
export async function getCombos(playerName: string): Promise<Combo[]> {
  if (!playerName) return [];
  try {
    const res = await fetch(
      `${WORKER_BASE_URL}/combos/get?player=${encodeURIComponent(playerName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!hasKey(data, "combos") || !Array.isArray(data.combos)) return [];
    // Respect TTL client-side too
    if (
      hasKey(data, "updatedAt") &&
      typeof data.updatedAt === "number" &&
      Date.now() - data.updatedAt > COMBO_CACHE_TTL
    ) {
      return [];
    }
    return (data.combos as Combo[]).filter(
      (c) => c?.blade && c?.ratchet && c?.bit,
    );
  } catch {
    return [];
  }
}

/** Google Sheets submission payload — matches the Apps Script handler. */
export interface SheetsPayload {
  rows: unknown[][];
  battleRows: unknown[][];
  flagged?: boolean;
  comment?: string;
}

export async function submitSheets(
  payload: SheetsPayload,
): Promise<"ok" | "error"> {
  const resp = await fetch(SHEETS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const result: unknown = await resp.json();
  if (hasKey(result, "status") && result.status === "ok") return "ok";
  return "error";
}

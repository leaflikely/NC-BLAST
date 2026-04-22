import { STORAGE_KEYS } from "@ncblast/shared";
import type { SubmissionQueueItem } from "@ncblast/shared";

/**
 * Offline submission queue — write-ahead outbox for at-least-once delivery.
 * Callers enqueue BEFORE attempting submission; remove only on confirmed success.
 */

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRaw(): SubmissionQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.submitQueue) || "[]";
    const parsed = JSON.parse(raw) as SubmissionQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(items: SubmissionQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.submitQueue, JSON.stringify(items));
  } catch { /* ignore */ }
}

/** Backfill ids on any legacy items (written by the old catch-only queue). */
function normalize(items: SubmissionQueueItem[]): { items: SubmissionQueueItem[]; changed: boolean } {
  let changed = false;
  const out = items.map(it => {
    if (!it.id) { changed = true; return { ...it, id: genId() }; }
    return it;
  });
  return { items: out, changed };
}

/** Adds an item to the queue and returns its id. */
export function enqueue(item: Omit<SubmissionQueueItem, "id" | "queuedAt"> & { queuedAt?: number }): string {
  const id = genId();
  const full: SubmissionQueueItem = {
    id,
    kind: item.kind,
    type: item.type,
    payload: item.payload,
    queuedAt: item.queuedAt ?? Date.now(),
  };
  const { items } = normalize(readRaw());
  items.push(full);
  writeRaw(items);
  return id;
}

/** Removes a single item by id (no-op if already gone). */
export function remove(id: string): void {
  const { items } = normalize(readRaw());
  const filtered = items.filter(it => it.id !== id);
  writeRaw(filtered);
}

/** Read-only snapshot. Backfills ids for legacy items on first read. */
export function list(): SubmissionQueueItem[] {
  const { items, changed } = normalize(readRaw());
  if (changed) writeRaw(items);
  return items;
}

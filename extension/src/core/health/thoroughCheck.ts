import type { Bookmark, HealthMap } from "../types.js";
import { checkLinks, type CheckOptions } from "./checkLinks.js";

export interface ThoroughProgress {
  pass: 1 | 2;
  done: number;
  total: number;
}

export interface ThoroughResult {
  health: HealthMap;
  /** Links the quick pass flagged (dead/error) and the deep pass re-verified. */
  suspects: number;
}

/**
 * Two automatic passes so the first scan is as accurate as a manual "Recheck":
 * 1) quick HEAD→GET check, 8 parallel, short timeout;
 * 2) every dead/error result is re-verified with a full GET, longer timeout, fewer parallel.
 */
export async function checkLinksThorough(
  bookmarks: Bookmark[],
  existing: HealthMap,
  opts: Pick<CheckOptions, "fetchImpl" | "now"> & {
    onProgress?: (p: ThoroughProgress) => void;
    onQuickDone?: (health: HealthMap) => Promise<void> | void;
  } = {},
): Promise<ThoroughResult> {
  const { fetchImpl, now, onProgress, onQuickDone } = opts;
  let health = await checkLinks(bookmarks, existing, {
    fetchImpl,
    now,
    concurrency: 8,
    timeoutMs: 4000,
    force: true,
    onProgress: (done, total) => onProgress?.({ pass: 1, done, total }),
  });
  await onQuickDone?.(health);

  const suspects = bookmarks.filter((b) => ["error", "dead"].includes(health[b.id]?.status ?? ""));
  if (suspects.length) {
    health = await checkLinks(suspects, health, {
      fetchImpl,
      now,
      concurrency: 4,
      timeoutMs: 15_000,
      preferGet: true,
      force: true,
      onProgress: (done, total) => onProgress?.({ pass: 2, done, total }),
    });
  }
  return { health, suspects: suspects.length };
}

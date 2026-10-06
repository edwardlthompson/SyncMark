const TTL_MS = 15_000;
const touched = new Map<string, number>();

/** Remember a bookmark node SyncMark itself just created, moved, renamed or removed. */
export function markSelf(id: string | undefined): void {
  if (!id) return;
  const now = Date.now();
  touched.set(id, now);
  if (touched.size > 5000) for (const [k, t] of touched) if (now - t > TTL_MS) touched.delete(k);
}

/** True when a bookmark event was caused by SyncMark's own write, not by the user. */
export function isSelf(id: string): boolean {
  const t = touched.get(id);
  return t !== undefined && Date.now() - t < TTL_MS;
}

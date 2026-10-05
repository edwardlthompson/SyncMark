import type { Bookmark } from "../types.js";

/** Normalise URL for dedupe: strip hash, trailing slash, lowercase host. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function dedupeBookmarks(items: Bookmark[]): Bookmark[] {
  const byUrl = new Map<string, Bookmark>();
  for (const item of items) {
    const key = normalizeUrl(item.url);
    const prev = byUrl.get(key);
    if (!prev) {
      byUrl.set(key, item);
      continue;
    }
    const prefer =
      item.updatedAt > prev.updatedAt ||
      (item.title.length > prev.title.length && item.updatedAt === prev.updatedAt)
        ? item
        : prev;
    const tags = [...new Set([...prev.tags, ...item.tags])];
    byUrl.set(key, { ...prefer, tags, url: normalizeUrl(prefer.url) });
  }
  return [...byUrl.values()];
}

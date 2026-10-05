import type { Bookmark } from "./types.js";

export function searchBookmarks(bookmarks: Bookmark[], query: string): Bookmark[] {
  const q = query.trim().toLowerCase();
  if (!q) return bookmarks;
  return bookmarks.filter((b) => {
    const hay = [b.title, b.url, b.category, ...b.tags].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

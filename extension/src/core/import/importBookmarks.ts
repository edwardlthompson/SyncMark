import { dedupeBookmarks, normalizeUrl } from "./dedupe.js";
import type { Bookmark } from "../types.js";

export interface BrowserBookmarkNode {
  id?: string;
  title?: string;
  url?: string;
  dateAdded?: number;
  children?: BrowserBookmarkNode[];
}

function walk(nodes: BrowserBookmarkNode[], category: string, out: Bookmark[]): void {
  for (const node of nodes) {
    if (node.children?.length) {
      const next = node.title?.trim() || category;
      walk(node.children, next, out);
      continue;
    }
    if (!node.url || node.url.startsWith("javascript:") || node.url.startsWith("place:")) continue;
    const created = node.dateAdded
      ? new Date(node.dateAdded).toISOString()
      : new Date().toISOString();
    out.push({
      id: crypto.randomUUID(),
      url: normalizeUrl(node.url),
      title: node.title?.trim() || node.url,
      category: category || "Imported",
      tags: [],
      createdAt: created,
      updatedAt: created,
      source: "browser-import",
    });
  }
}

export function importFromBrowserTree(roots: BrowserBookmarkNode[]): Bookmark[] {
  const collected: Bookmark[] = [];
  walk(roots, "Imported", collected);
  return dedupeBookmarks(collected);
}

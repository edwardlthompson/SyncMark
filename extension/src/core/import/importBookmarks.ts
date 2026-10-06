import {
  classifyBookmarkRoot,
  isSkipPathSegment,
  rootPathLabel,
  stripImportWrappers,
} from "../bookmarkRoots.js";
import type { Bookmark } from "../types.js";
import { dedupeBookmarks, normalizeUrl } from "./dedupe.js";

export interface BrowserBookmarkNode {
  id?: string;
  title?: string;
  url?: string;
  dateAdded?: number;
  children?: BrowserBookmarkNode[];
}

function walk(nodes: BrowserBookmarkNode[], path: string[], out: Bookmark[]): void {
  for (const node of nodes) {
    if (node.children) {
      const title = node.title?.trim() ?? "";
      // Only the tree's top-level folders are roots; a nested folder titled "Bookmarks bar" is just a folder.
      const kind = node.id && path.length === 0 ? classifyBookmarkRoot(node.id, title) : null;
      let next = path;
      if (kind) {
        next = [rootPathLabel(kind)];
      } else if (!isSkipPathSegment(node.id, title)) {
        next = [...path, title];
      }
      walk(node.children, next, out);
      continue;
    }
    if (!node.url || node.url.startsWith("javascript:") || node.url.startsWith("place:")) continue;
    const created = node.dateAdded
      ? new Date(node.dateAdded).toISOString()
      : new Date().toISOString();
    const folderPath = path.length ? stripImportWrappers(path) : ["Other Bookmarks"];
    out.push({
      id: crypto.randomUUID(),
      url: normalizeUrl(node.url),
      title: node.title?.trim() || node.url,
      category: folderPath[folderPath.length - 1] || "Other Bookmarks",
      folderPath,
      tags: [],
      createdAt: created,
      updatedAt: created,
      source: "browser-import",
    });
  }
}

/** Import the full browser tree, including Bookmarks Toolbar / bar drops. */
export function importFromBrowserTree(roots: BrowserBookmarkNode[]): Bookmark[] {
  const collected: Bookmark[] = [];
  walk(roots, [], collected);
  return dedupeBookmarks(collected);
}

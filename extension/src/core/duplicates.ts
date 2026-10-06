import {
  classifyBookmarkRoot,
  folderKey,
  isSkipPathSegment,
  normalizeFolderPath,
  rootPathLabel,
  stripImportWrappers,
} from "./bookmarkRoots.js";
import { normalizeUrl } from "./import/dedupe.js";
import type { BrowserBookmarkNode } from "./import/importBookmarks.js";

export interface DuplicateCopy {
  id: string;
  title: string;
  /** Where the copy really sits in the browser (root label + folder titles). */
  path: string[];
  /** True for the one copy that stays. */
  keep: boolean;
}

export interface DuplicateGroup {
  url: string;
  title: string;
  copies: DuplicateCopy[];
}

function collect(
  nodes: BrowserBookmarkNode[],
  path: string[],
  out: Map<string, Array<{ id: string; title: string; url: string; path: string[] }>>,
): void {
  for (const node of nodes) {
    if (node.children) {
      const title = node.title?.trim() ?? "";
      const kind = node.id && path.length === 0 ? classifyBookmarkRoot(node.id, title) : null;
      const next = kind ? [rootPathLabel(kind)] : isSkipPathSegment(node.id, title) ? path : [...path, title];
      collect(node.children, next, out);
      continue;
    }
    if (!node.id || !node.url || node.url.startsWith("javascript:") || node.url.startsWith("place:")) continue;
    const key = normalizeUrl(node.url);
    const list = out.get(key) ?? [];
    list.push({ id: node.id, title: node.title?.trim() || node.url, url: node.url, path: path.length ? path : ["Other Bookmarks"] });
    out.set(key, list);
  }
}

/** Lower is better: right folder, then outside an import wrapper, then deeper (more specific) folder. */
function rank(path: string[], preferred: string[] | undefined): number {
  const clean = normalizeFolderPath(stripImportWrappers(path));
  const wrapped = clean.length !== normalizeFolderPath(path).length || folderKey(clean) !== folderKey(normalizeFolderPath(path));
  const inPlace = preferred && folderKey(clean) === folderKey(normalizeFolderPath(preferred)) ? 0 : 1;
  return inPlace * 1000 + (wrapped ? 500 : 0) - Math.min(path.length, 99);
}

/**
 * Links saved more than once in the browser tree. `preferred` maps normalized URL → the folder path
 * SyncMark wants for it; the copy sitting there (or else the most specific one) is kept.
 */
export function findDuplicateGroups(
  tree: BrowserBookmarkNode[],
  preferred?: Map<string, string[]>,
): DuplicateGroup[] {
  const byUrl = new Map<string, Array<{ id: string; title: string; url: string; path: string[] }>>();
  collect(tree, [], byUrl);
  const groups: DuplicateGroup[] = [];
  for (const [key, list] of byUrl) {
    if (list.length < 2) continue;
    const pref = preferred?.get(key);
    const best = list.reduce((a, b) => (rank(b.path, pref) < rank(a.path, pref) ? b : a));
    groups.push({
      url: list[0].url,
      title: best.title,
      copies: list.map((c) => ({ id: c.id, title: c.title, path: c.path, keep: c === best })),
    });
  }
  return groups.sort((a, b) => b.copies.length - a.copies.length || a.title.localeCompare(b.title));
}

/** Ids of every copy that is not the kept one. */
export function extraCopyIds(groups: DuplicateGroup[]): string[] {
  return groups.flatMap((g) => g.copies.filter((c) => !c.keep).map((c) => c.id));
}

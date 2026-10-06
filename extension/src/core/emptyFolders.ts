import { classifyBookmarkRoot } from "./bookmarkRoots.js";

/** Minimal bookmark-tree node (chrome.bookmarks.BookmarkTreeNode subset). */
export interface TreeNode {
  id: string;
  title?: string;
  url?: string;
  type?: string;
  children?: TreeNode[];
}

export interface EmptyFolder {
  id: string;
  path: string[];
  /** Empty sub-folders removed along with it. */
  nested: number;
}

function hasContent(node: TreeNode): boolean {
  if (node.url || node.type === "separator") return true;
  return (node.children ?? []).some(hasContent);
}

function countFolders(node: TreeNode): number {
  return (node.children ?? []).reduce((n, c) => (c.url ? n : n + 1 + countFolders(c)), 0);
}

/**
 * Topmost folders whose whole subtree holds no bookmarks (or separators).
 * Browser root folders are never returned.
 */
export function findEmptyFolders(roots: TreeNode[]): EmptyFolder[] {
  const out: EmptyFolder[] = [];
  // depth 0 = tree root, depth 1 = browser root folders (toolbar/other/menu/mobile): never removed.
  const walk = (node: TreeNode, path: string[], depth: number): void => {
    if (node.url) return;
    const title = (node.title ?? "").trim();
    const isRoot = depth <= 1 || classifyBookmarkRoot(node.id, title) !== null;
    if (!isRoot && !hasContent(node)) {
      out.push({ id: node.id, path: [...path, title], nested: countFolders(node) });
      return;
    }
    const next = depth === 0 ? path : [...path, title];
    for (const child of node.children ?? []) walk(child, next, depth + 1);
  };
  for (const top of roots) walk(top, [], 0);
  return out;
}

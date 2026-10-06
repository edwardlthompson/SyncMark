import { classifyBookmarkRoot } from "../core/bookmarkRoots.js";
import { markSelf } from "./selfWrites.js";
import { DEFAULT_SORT_PREFS, planMoves, type SortNode, type SortPrefs } from "../core/sortBookmarks.js";

const SORT_KEY = "syncmark.sortPrefs";

export async function loadSortPrefs(): Promise<SortPrefs> {
  const raw = (await chrome.storage.local.get(SORT_KEY))[SORT_KEY] as Partial<SortPrefs> | undefined;
  return { ...DEFAULT_SORT_PREFS, folders: raw?.folders === true, links: raw?.links === true };
}

export async function saveSortPrefs(prefs: SortPrefs): Promise<void> {
  await chrome.storage.local.set({ [SORT_KEY]: prefs });
}

async function sortFolderNode(node: SortNode, prefs: SortPrefs): Promise<number> {
  const children = node.children ?? [];
  let moved = 0;
  for (const m of planMoves(children, prefs)) {
    markSelf(m.id);
    await chrome.bookmarks.move(m.id, { parentId: node.id, index: m.index });
    moved += 1;
  }
  for (const child of children) {
    if (!child.url && child.type !== "separator") moved += await sortFolderNode(child, prefs);
  }
  return moved;
}

/** Sort the Bookmarks bar/toolbar tree (all nested folders). Returns the number of moves made. */
export async function sortBookmarksBar(prefs: SortPrefs): Promise<number> {
  if (!prefs.folders && !prefs.links) return 0;
  const [top] = await chrome.bookmarks.getTree();
  const bar = (top?.children ?? []).find((n) => !n.url && classifyBookmarkRoot(n.id, n.title ?? "") === "toolbar");
  return bar ? sortFolderNode(bar as SortNode, prefs) : 0;
}

/** Apply the saved auto-sort toggles (no-op when both are off). */
export async function applySavedSort(): Promise<number> {
  return sortBookmarksBar(await loadSortPrefs());
}

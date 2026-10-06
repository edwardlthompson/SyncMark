/** Detect Chromium vs Firefox bookmark root folders. */

export type BookmarkRootKind = "toolbar" | "other" | "menu";

export interface ClassifiedRoot {
  id: string;
  kind: BookmarkRootKind;
  title: string;
}

const FIREFOX_TOOLBAR = "toolbar_____";
const FIREFOX_UNFILED = "unfiled_____";
const FIREFOX_MENU = "menu________";

export function classifyBookmarkRoot(id: string, title = ""): BookmarkRootKind | null {
  const t = title.trim().toLowerCase();
  if (
    id === "1" ||
    id === FIREFOX_TOOLBAR ||
    t === "bookmarks toolbar" ||
    t === "bookmarks bar" ||
    t === "bookmark toolbar" ||
    t.includes("toolbar")
  ) {
    return "toolbar";
  }
  if (
    id === "2" ||
    id === FIREFOX_UNFILED ||
    t === "other bookmarks" ||
    t === "unsorted bookmarks" ||
    t.includes("other bookmarks")
  ) {
    return "other";
  }
  if (id === FIREFOX_MENU || t === "bookmarks menu") {
    return "menu";
  }
  return null;
}

export function isSkipPathSegment(id: string | undefined, title: string): boolean {
  if (!title || title === "Root") return true;
  if (id === "0" || id === "root________") return true;
  return false;
}

/** Canonical path label for a root kind (stable across browsers). */
export function rootPathLabel(kind: BookmarkRootKind): string {
  if (kind === "toolbar") return "Bookmarks Toolbar";
  if (kind === "menu") return "Bookmarks Menu";
  return "Other Bookmarks";
}

const ROOT_NAMES: Record<string, BookmarkRootKind> = {
  "bookmarks toolbar": "toolbar",
  "bookmarks bar": "toolbar",
  "bookmark toolbar": "toolbar",
  "other bookmarks": "other",
  "unsorted bookmarks": "other",
  "bookmarks menu": "menu",
};

/**
 * Browsers that import another browser's bookmarks nest them as
 * `Bookmarks bar / Imported from Google Chrome / Bookmarks bar / ...`.
 * Collapse that wrapper so the content maps onto the real root it came from.
 */
export function stripImportWrappers(path: string[]): string[] {
  if (path.length < 3 || !/^imported from .+/i.test(path[1])) return path;
  const kind = ROOT_NAMES[path[2].trim().toLowerCase()];
  return kind ? stripImportWrappers([rootPathLabel(kind), ...path.slice(3)]) : path;
}

/** Always start a path with a canonical root; unrooted paths default to the bookmarks bar. */
export function normalizeFolderPath(path: string[]): string[] {
  const clean = path.map((p) => p.trim()).filter(Boolean);
  if (!clean.length) return [rootPathLabel("other")];
  const kind = ROOT_NAMES[clean[0].toLowerCase()];
  return kind ? [rootPathLabel(kind), ...clean.slice(1)] : [rootPathLabel("toolbar"), ...clean];
}

/** Case-insensitive lookup key so “Cooking” and “cooking” never become two folders. */
export function folderKey(parts: string[]): string {
  return parts.map((p) => p.trim().toLowerCase()).join("\0");
}

export function resolveParentForPath(
  folderPath: string[],
  roots: { toolbar?: string; other?: string; menu?: string },
): string {
  const first = (folderPath[0] ?? "").toLowerCase();
  if (
    first.includes("toolbar") ||
    first.includes("bookmarks bar") ||
    first === "bookmarks toolbar"
  ) {
    return roots.toolbar ?? roots.other ?? roots.menu ?? "";
  }
  if (first.includes("menu")) {
    return roots.menu ?? roots.other ?? roots.toolbar ?? "";
  }
  return roots.other ?? roots.toolbar ?? roots.menu ?? "";
}

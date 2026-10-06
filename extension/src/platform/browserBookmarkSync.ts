import {
  classifyBookmarkRoot,
  folderKey,
  normalizeFolderPath,
  resolveParentForPath,
  rootPathLabel,
} from "../core/bookmarkRoots.js";
import { applySavedSort } from "./bookmarkSort.js";
import { markSelf } from "./selfWrites.js";
import { fingerprintFromBookmarks, mergeBrowserWithSpace } from "../core/browserMerge.js";
import { normalizeUrl } from "../core/import/dedupe.js";
import { importFromBrowserTree } from "../core/import/importBookmarks.js";
import { pathsEqual } from "../core/syncMerge.js";
import type { SyncMarkStore } from "../core/store.js";
import type { Bookmark, SyncFingerprintEntry, SyncReport } from "../core/types.js";

const FP_KEY = "syncmark.browserFingerprint";
const LOCAL_ISSUES_KEY = "syncmark.localSyncIssues";

export async function loadFingerprint(): Promise<SyncFingerprintEntry[] | null> {
  const result = await chrome.storage.local.get(FP_KEY);
  const fp = result[FP_KEY] as SyncFingerprintEntry[] | undefined;
  return fp ?? null;
}

export async function saveFingerprint(entries: SyncFingerprintEntry[]): Promise<void> {
  await chrome.storage.local.set({ [FP_KEY]: entries });
}

async function mirrorIssueLocal(issue: {
  at: string;
  deviceId: string;
  phase: string;
  level: string;
  message: string;
  detail?: string;
}): Promise<void> {
  const prev = ((await chrome.storage.local.get(LOCAL_ISSUES_KEY))[LOCAL_ISSUES_KEY] as unknown[]) ?? [];
  const next = [issue, ...prev].slice(0, 50);
  await chrome.storage.local.set({ [LOCAL_ISSUES_KEY]: next });
}

export async function loadLocalSyncIssues(): Promise<unknown[]> {
  return ((await chrome.storage.local.get(LOCAL_ISSUES_KEY))[LOCAL_ISSUES_KEY] as unknown[]) ?? [];
}

interface NodeRef {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
}

async function indexTree(): Promise<{
  byUrl: Map<string, NodeRef[]>;
  folders: Map<string, string>;
  roots: { toolbar?: string; other?: string; menu?: string };
}> {
  const tree = await chrome.bookmarks.getTree();
  const byUrl = new Map<string, NodeRef[]>();
  const folders = new Map<string, string>();
  const roots: { toolbar?: string; other?: string; menu?: string } = {};

  function walk(nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[], parentId?: string): void {
    for (const node of nodes) {
      if (node.url) {
        const key = normalizeUrl(node.url);
        const copies = byUrl.get(key) ?? [];
        copies.push({ id: node.id, title: node.title, url: node.url, parentId });
        byUrl.set(key, copies);
        continue;
      }
      const title = node.title?.trim() ?? "";
      // Only top-level folders are roots; a nested folder titled "Bookmarks bar" is just a folder.
      const kind = path.length === 0 ? classifyBookmarkRoot(node.id, title) : null;
      if (kind) {
        roots[kind] = node.id;
        const label = rootPathLabel(kind);
        folders.set(folderKey([label]), node.id);
        const next = [label];
        if (node.children) walk(node.children, next, node.id);
        continue;
      }
      const next =
        !title || node.id === "0" || node.id === "root________" || title === "Root"
          ? path
          : [...path, title];
      if (next.length && !folders.has(folderKey(next))) folders.set(folderKey(next), node.id);
      if (node.children) walk(node.children, next, node.id);
    }
  }

  walk(tree, []);
  return { byUrl, folders, roots };
}

async function ensureFolderPath(
  folderPath: string[],
  folders: Map<string, string>,
  roots: { toolbar?: string; other?: string; menu?: string },
): Promise<string> {
  // Rooted + case-insensitive so existing folders are always found (no duplicate empty folders).
  const path = normalizeFolderPath(folderPath);
  let parentId = folders.get(folderKey([path[0]])) ?? resolveParentForPath(path, roots);
  if (!parentId) {
    throw new Error(
      "Could not find a bookmarks root (toolbar/other). Firefox needs the Bookmarks permission; try reloading the add-on.",
    );
  }

  const built: string[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    built.push(path[i]);
    const key = folderKey(built);
    const hit = folders.get(key);
    if (hit) {
      parentId = hit;
      continue;
    }
    const created: chrome.bookmarks.BookmarkTreeNode = await chrome.bookmarks.create({
      parentId,
      title: path[i],
    });
    markSelf(created.id);
    folders.set(key, created.id);
    parentId = created.id;
  }
  return parentId;
}

export async function reconcileBrowserTree(
  bookmarks: Bookmark[],
  tombstoneUrls: string[],
): Promise<{ written: number; failed: number; errors: string[]; arrived: Array<{ title: string; url: string }> }> {
  const { byUrl, folders, roots } = await indexTree();
  let written = 0;
  let failed = 0;
  const errors: string[] = [];
  const arrived: Array<{ title: string; url: string }> = [];

  for (const url of tombstoneUrls) {
    const hits = byUrl.get(normalizeUrl(url));
    if (!hits) continue;
    for (const hit of hits) {
      try {
        markSelf(hit.id);
        await chrome.bookmarks.remove(hit.id);
        written += 1;
      } catch (err) {
        failed += 1;
        errors.push(`remove ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    byUrl.delete(normalizeUrl(url));
  }

  for (const b of bookmarks) {
    try {
      const parentId = await ensureFolderPath(b.folderPath, folders, roots);
      const copies = byUrl.get(normalizeUrl(b.url));
      if (copies?.length) {
        // A copy already in the right folder wins; otherwise move the first copy there.
        const existing = copies.find((c) => c.parentId === parentId) ?? copies[0];
        if (existing.title !== b.title) {
          markSelf(existing.id);
          await chrome.bookmarks.update(existing.id, { title: b.title });
          written += 1;
        }
        if (existing.parentId && existing.parentId !== parentId) {
          markSelf(existing.id);
          await chrome.bookmarks.move(existing.id, { parentId });
          written += 1;
        }
        continue;
      }
      markSelf((await chrome.bookmarks.create({ parentId, title: b.title, url: b.url })).id);
      arrived.push({ title: b.title, url: b.url });
      written += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${b.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { written, failed, errors, arrived };
}

export function browserLabel(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Edg")) return "edge";
  if (ua.includes("Chrome")) return "chrome";
  return "unknown";
}

/** Two-way sync, serialized across the options page, popup and background. */
export async function syncTwoWay(store: SyncMarkStore): Promise<SyncReport> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return syncTwoWayUnlocked(store);
  return (await locks.request("syncmark-sync", async () => await syncTwoWayUnlocked(store))) as SyncReport;
}

/** Two-way sync: browser tree ↔ SyncMark space (shared folder DB). */
async function syncTwoWayUnlocked(store: SyncMarkStore): Promise<SyncReport> {
  const logIssue = async (
    phase: string,
    level: "error" | "warn" | "info",
    message: string,
    detail?: string,
  ) => {
    const issue = {
      at: new Date().toISOString(),
      deviceId: store.localDeviceId,
      phase,
      level,
      message,
      detail,
      browser: browserLabel(),
    };
    await mirrorIssueLocal(issue);
    try {
      await store.appendSyncIssue(issue);
    } catch {
      /* session-only folder may still work via storage mirror */
    }
  };

  try {
    await store.migrateLegacyLog();
    const tree = await chrome.bookmarks.getTree();
    const fromBrowser = importFromBrowserTree(tree as never);
    await logIssue(
      "pull",
      "info",
      `Pulled ${fromBrowser.length} bookmarks from browser tree (incl. toolbar/bar).`,
    );

    const space = await store.readBookmarks();
    const tombstones = await store.readTombstones();
    const fingerprint = await loadFingerprint();

    const { ops, report } = mergeBrowserWithSpace({
      space,
      browser: fromBrowser,
      tombstones,
      fingerprint,
      deviceId: store.localDeviceId,
    });

    if (ops.length) await store.appendChanges(ops);

    const bookmarks = await store.readBookmarks();
    const stones = await store.readTombstones();
    const { written, failed, errors, arrived } = await reconcileBrowserTree(
      bookmarks,
      Object.keys(stones),
    );

    if (failed) {
      await logIssue(
        "push",
        "error",
        `Reconcile failed for ${failed} item(s).`,
        errors.slice(0, 20).join(" | "),
      );
    }

    await saveFingerprint(fingerprintFromBookmarks(bookmarks));
    await store.touchDevice();

    for (const b of bookmarks) {
      const inBrowser = fromBrowser.some((x) => normalizeUrl(x.url) === normalizeUrl(b.url));
      if (!inBrowser && !stones[normalizeUrl(b.url)] && fingerprint) {
        const prev = fingerprint.find((f) => normalizeUrl(f.url) === normalizeUrl(b.url));
        if (prev && !pathsEqual(prev.folderPath, b.folderPath)) {
          report.moved.push({ title: b.title, url: b.url, at: b.updatedAt });
        }
      }
    }

    await applySavedSort().catch(() => 0);

    report.folderCount = bookmarks.length;
    report.browserWritten = written;
    report.arrived = arrived;
    report.failed = failed;
    await logIssue(
      "sync",
      failed ? "warn" : "info",
      `Sync finished: ${bookmarks.length} in space, ${written} browser writes, ${report.added.length} added, ${report.removed.length} removed.`,
    );
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logIssue("sync", "error", `Sync failed: ${message}`, err instanceof Error ? err.stack : undefined);
    throw err;
  }
}

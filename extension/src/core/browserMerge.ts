import { normalizeUrl } from "./import/dedupe.js";
import { mergeBookmarkPair, pathsEqual } from "./syncMerge.js";
import { isTombstoned, putTombstone, tombstoneKey } from "./tombstones.js";
import type { Bookmark, ChangeOp, ChangeOpDraft, SyncFingerprintEntry, SyncReport, TombstoneMap } from "./types.js";

export interface BrowserSpaceMergeInput {
  space: Bookmark[];
  browser: Bookmark[];
  tombstones: TombstoneMap;
  fingerprint: SyncFingerprintEntry[] | null;
  deviceId: string;
  now?: string;
}

export interface BrowserSpaceMergeResult {
  ops: ChangeOpDraft[];
  report: SyncReport;
}

/** Diff browser tree vs space using fingerprint for explicit deletes. */
export function mergeBrowserWithSpace(input: BrowserSpaceMergeInput): BrowserSpaceMergeResult {
  const now = input.now ?? new Date().toISOString();
  const ops: BrowserSpaceMergeResult["ops"] = [];
  const report: SyncReport = {
    added: [],
    updated: [],
    moved: [],
    removed: [],
    folderCount: 0,
    browserWritten: 0,
    failed: 0,
  };

  const spaceByUrl = new Map(input.space.map((b) => [normalizeUrl(b.url), b]));
  const browserByUrl = new Map(input.browser.map((b) => [normalizeUrl(b.url), b]));
  let tombstones = { ...input.tombstones };
  const fp = input.fingerprint
    ? new Map(input.fingerprint.map((e) => [normalizeUrl(e.url), e]))
    : null;

  // Explicit deletes: in fingerprint, gone from browser, still in space
  if (fp) {
    for (const [url, entry] of fp) {
      if (browserByUrl.has(url)) continue;
      const inSpace = spaceByUrl.get(url);
      if (!inSpace) continue;
      ops.push({
        op: "remove",
        id: inSpace.id,
        url,
        title: entry.title || inSpace.title,
        folderPath: entry.folderPath || inSpace.folderPath,
        at: now,
      });
      report.removed.push({ title: inSpace.title, url, at: now });
      spaceByUrl.delete(url);
      tombstones = putTombstone(tombstones, {
        url,
        id: inSpace.id,
        title: inSpace.title,
        folderPath: inSpace.folderPath,
        deletedAt: now,
        deviceId: input.deviceId,
        source: "browser",
      });
    }
  }

  for (const [url, browserBm] of browserByUrl) {
    if (isTombstoned(tombstones, url, browserBm.updatedAt)) continue;
    const spaceBm = spaceByUrl.get(url);
    if (!spaceBm) {
      ops.push({
        op: "upsert",
        bookmark: { ...browserBm, originDeviceId: input.deviceId },
        at: now,
      });
      report.added.push({ title: browserBm.title, url, at: now });
      continue;
    }
    const merged = mergeBookmarkPair(spaceBm, { ...browserBm, updatedAt: browserBm.updatedAt });
    const pathChanged = !pathsEqual(spaceBm.folderPath, merged.folderPath);
    const titleChanged = spaceBm.title !== merged.title;
    if (pathChanged || titleChanged || spaceBm.updatedAt !== merged.updatedAt) {
      if (
        browserBm.updatedAt > spaceBm.updatedAt ||
        (pathChanged && browserBm.updatedAt >= spaceBm.updatedAt)
      ) {
        ops.push({
          op: "upsert",
          bookmark: { ...merged, updatedAt: now, originDeviceId: input.deviceId },
          at: now,
        });
        if (pathChanged) report.moved.push({ title: merged.title, url, at: now });
        else report.updated.push({ title: merged.title, url, at: now });
      }
    }
  }

  // Space-only bookmarks that are not tombstoned stay; push will create them in browser
  report.folderCount = spaceByUrl.size + report.added.length - report.removed.length;
  return { ops, report };
}

export function fingerprintFromBookmarks(bookmarks: Bookmark[]): SyncFingerprintEntry[] {
  return bookmarks.map((b) => ({
    url: tombstoneKey(b.url),
    folderPath: b.folderPath,
    title: b.title,
    updatedAt: b.updatedAt,
  }));
}

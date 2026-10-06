import { normalizeUrl } from "./import/dedupe.js";
import { sortOps } from "./deviceLog.js";
import { clearTombstone, isTombstoned, putTombstone, tombstoneKey } from "./tombstones.js";
import type { Bookmark, ChangeOp, TombstoneMap } from "./types.js";

export function ensurePathSafe(b: Bookmark): Bookmark {
  const folderPath =
    b.folderPath?.length ? b.folderPath : b.category ? [b.category] : ["Other Bookmarks"];
  const category = b.category || folderPath[folderPath.length - 1] || "Other Bookmarks";
  return {
    ...b,
    url: normalizeUrl(b.url),
    folderPath,
    category,
    tags: b.tags ?? [],
  };
}

/** Keep earliest createdAt; LWW title/path/category; union tags. */
export function mergeBookmarkPair(a: Bookmark, b: Bookmark): Bookmark {
  const left = ensurePathSafe(a);
  const right = ensurePathSafe(b);
  const newer =
    right.updatedAt > left.updatedAt ||
    (right.updatedAt === left.updatedAt &&
      (right.originDeviceId ?? "") > (left.originDeviceId ?? ""))
      ? right
      : left;
  const older = newer === right ? left : right;
  return {
    ...newer,
    id: older.createdAt <= newer.createdAt ? older.id : newer.id,
    createdAt: older.createdAt <= newer.createdAt ? older.createdAt : newer.createdAt,
    tags: [...new Set([...left.tags, ...right.tags])],
    originDeviceId: newer.originDeviceId ?? older.originDeviceId,
  };
}

export interface ReplayState {
  bookmarks: Map<string, Bookmark>;
  tombstones: TombstoneMap;
}

export function emptyReplay(): ReplayState {
  return { bookmarks: new Map(), tombstones: {} };
}

export function applyOp(state: ReplayState, op: ChangeOp): ReplayState {
  const bookmarks = new Map(state.bookmarks);
  let tombstones = { ...state.tombstones };

  if (op.op === "upsert") {
    const b = ensurePathSafe({ ...op.bookmark, originDeviceId: op.bookmark.originDeviceId ?? op.deviceId });
    const key = normalizeUrl(b.url);
    if (isTombstoned(tombstones, key, b.updatedAt)) {
      return { bookmarks, tombstones };
    }
    tombstones = clearTombstone(tombstones, key);
    const prev = bookmarks.get(key);
    bookmarks.set(key, prev ? mergeBookmarkPair(prev, b) : b);
    return { bookmarks, tombstones };
  }

  if (op.op === "remove") {
    const key = op.url ? normalizeUrl(op.url) : [...bookmarks.values()].find((x) => x.id === op.id)?.url;
    if (!key) return { bookmarks, tombstones };
    const prev = bookmarks.get(key);
    bookmarks.delete(key);
    tombstones = putTombstone(tombstones, {
      url: key,
      id: op.id || prev?.id,
      title: op.title ?? prev?.title,
      folderPath: op.folderPath ?? prev?.folderPath,
      deletedAt: op.at,
      deviceId: op.deviceId,
      source: "space",
    });
    return { bookmarks, tombstones };
  }

  if (op.op === "setCategory") {
    for (const [key, b] of bookmarks) {
      if (b.id !== op.id) continue;
      const folderPath = op.folderPath?.length
        ? op.folderPath
        : [...b.folderPath.slice(0, -1), op.category];
      bookmarks.set(key, {
        ...b,
        category: op.category,
        folderPath,
        updatedAt: op.at,
        categoryLocked: op.locked !== false,
      });
      break;
    }
  }
  return { bookmarks, tombstones };
}

export function replayOps(ops: ChangeOp[]): ReplayState {
  let state = emptyReplay();
  for (const op of sortOps(ops)) state = applyOp(state, op);
  return state;
}

export function bookmarksFromReplay(state: ReplayState): Bookmark[] {
  return [...state.bookmarks.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function pathsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p === b[i]);
}

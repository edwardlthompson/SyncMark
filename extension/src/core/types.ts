/** Shared SyncMark domain types (locked contracts). */

export const SPACE_VERSION = 1 as const;

export type BookmarkId = string;

export interface Bookmark {
  id: BookmarkId;
  url: string;
  title: string;
  category: string;
  tags: string[];
  /** Nested folder titles from browser roots, e.g. ["Bookmarks Bar","Work"]. */
  folderPath: string[];
  createdAt: string;
  updatedAt: string;
  source?: string;
  originDeviceId?: string;
  /** User confirmed category — skip in auto suggest scans. */
  categoryLocked?: boolean;
}

export interface SpaceDevice {
  deviceId: string;
  label: string;
  firstSeenAt: string;
  lastSyncAt: string;
}

export interface SpaceMeta {
  version: typeof SPACE_VERSION;
  id: string;
  name: string;
  secretHash: string;
  createdAt: string;
  devices?: SpaceDevice[];
}

export type ChangeOp =
  | {
      op: "upsert";
      bookmark: Bookmark;
      at: string;
      seq: number;
      deviceId: string;
    }
  | {
      op: "remove";
      id: BookmarkId;
      url: string;
      title?: string;
      folderPath?: string[];
      at: string;
      seq: number;
      deviceId: string;
    }
  | {
      op: "setCategory";
      id: BookmarkId;
      category: string;
      folderPath?: string[];
      /** When true (default for UI Accept), bookmark is excluded from future scans. */
      locked?: boolean;
      at: string;
      seq: number;
      deviceId: string;
    };

export interface Tombstone {
  url: string;
  id?: BookmarkId;
  title?: string;
  folderPath?: string[];
  deletedAt: string;
  deviceId: string;
  source: "browser" | "space" | "user";
}

export type TombstoneMap = Record<string, Tombstone>;

export type HealthStatus = "unknown" | "ok" | "redirect" | "dead" | "error";

export interface HealthRecord {
  status: HealthStatus;
  checkedAt: string;
  httpStatus?: number;
  detail?: string;
}

export type HealthMap = Record<BookmarkId, HealthRecord>;

export interface Suggestion {
  category: string;
  tags: string[];
  reason: string;
  /** True when suggestion would create a folder that does not yet exist. */
  createFolder?: boolean;
  folderPath?: string[];
}

export interface SyncMarkBundle {
  space: SpaceMeta;
  /** Plain secret only present when freshly created / pairing export — never required on disk. */
  pairingSecret?: string;
  bookmarks: Bookmark[];
  changelog: ChangeOp[];
  health: HealthMap;
  tombstones?: TombstoneMap;
}

export interface FolderPort {
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
  list?(prefix: string): Promise<string[]>;
}

export interface SyncFingerprintEntry {
  url: string;
  folderPath: string[];
  title: string;
  updatedAt: string;
}

export type ChangeOpDraft =
  | (Omit<Extract<ChangeOp, { op: "upsert" }>, "seq" | "deviceId"> & {
      seq?: number;
      deviceId?: string;
    })
  | (Omit<Extract<ChangeOp, { op: "remove" }>, "seq" | "deviceId"> & {
      seq?: number;
      deviceId?: string;
    })
  | (Omit<Extract<ChangeOp, { op: "setCategory" }>, "seq" | "deviceId"> & {
      seq?: number;
      deviceId?: string;
    });

export interface SyncReport {
  added: Array<{ title: string; url: string; at: string }>;
  updated: Array<{ title: string; url: string; at: string }>;
  moved: Array<{ title: string; url: string; at: string }>;
  removed: Array<{ title: string; url: string; at: string }>;
  folderCount: number;
  browserWritten: number;
  failed: number;
  /** Links this sync newly created in the browser (they came from another browser). */
  arrived?: Array<{ title: string; url: string }>;
}

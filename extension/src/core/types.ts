/** Shared SyncMark domain types (locked contracts). */

export const SPACE_VERSION = 1 as const;

export type BookmarkId = string;

export interface Bookmark {
  id: BookmarkId;
  url: string;
  title: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source?: string;
}

export interface SpaceMeta {
  version: typeof SPACE_VERSION;
  id: string;
  name: string;
  secretHash: string;
  createdAt: string;
}

export type ChangeOp =
  | { op: "upsert"; bookmark: Bookmark; at: string }
  | { op: "remove"; id: BookmarkId; at: string }
  | { op: "setCategory"; id: BookmarkId; category: string; at: string };

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
}

export interface SyncMarkBundle {
  space: SpaceMeta;
  /** Plain secret only present when freshly created / pairing export — never required on disk. */
  pairingSecret?: string;
  bookmarks: Bookmark[];
  changelog: ChangeOp[];
  health: HealthMap;
}

export interface FolderPort {
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
  list?(prefix: string): Promise<string[]>;
}

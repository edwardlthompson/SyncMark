import { ackPath, parseAck, type Ack } from "./ack.js";
import { normalizeFolderPath } from "./bookmarkRoots.js";
import { dedupeOps, nextSeq, parseChangeLog, serializeOps, sortOps } from "./deviceLog.js";
import { isValidSpace } from "./space.js";
import { bookmarksFromReplay, ensurePathSafe, replayOps } from "./syncMerge.js";
import {
  appendSyncIssueFile,
  readRecentSyncIssues,
  type SyncIssue,
} from "./syncIssues.js";
import { parseTombstones, serializeTombstones } from "./tombstones.js";
import type {
  Bookmark,
  ChangeOp,
  ChangeOpDraft,
  FolderPort,
  HealthMap,
  SpaceMeta,
  SyncMarkBundle,
  TombstoneMap,
} from "./types.js";

const SPACE_PATH = "space.json";
const LEGACY_LOG = "changelog.jsonl";
const SNAPSHOT_PATH = "snapshots/bookmarks.json";
const HEALTH_PATH = "health.json";
const TOMBSTONES_PATH = "tombstones.json";
const LOG_DIR = "changelog/";

function logPath(deviceId: string): string {
  return `${LOG_DIR}${deviceId}.jsonl`;
}

export class SyncMarkStore {
  constructor(
    private folder: FolderPort,
    private deviceId: string = "local",
  ) {}

  get localDeviceId(): string {
    return this.deviceId;
  }

  async initSpace(space: SpaceMeta): Promise<void> {
    const withDevice: SpaceMeta = {
      ...space,
      devices: space.devices?.length
        ? space.devices
        : [
            {
              deviceId: this.deviceId,
              label: this.deviceId,
              firstSeenAt: space.createdAt,
              lastSyncAt: space.createdAt,
            },
          ],
    };
    await this.folder.writeText(SPACE_PATH, JSON.stringify(withDevice, null, 2));
    await this.folder.writeText(logPath(this.deviceId), "");
    await this.folder.writeText(SNAPSHOT_PATH, "[]");
    await this.folder.writeText(HEALTH_PATH, "{}");
    await this.folder.writeText(TOMBSTONES_PATH, "{}");
  }

  async readSpace(): Promise<SpaceMeta | null> {
    const raw = await this.folder.readText(SPACE_PATH);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isValidSpace(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async touchDevice(label?: string): Promise<void> {
    const space = await this.readSpace();
    if (!space) return;
    const now = new Date().toISOString();
    const devices = [...(space.devices ?? [])];
    const idx = devices.findIndex((d) => d.deviceId === this.deviceId);
    if (idx >= 0) {
      devices[idx] = { ...devices[idx], lastSyncAt: now, label: label ?? devices[idx].label };
    } else {
      devices.push({
        deviceId: this.deviceId,
        label: label ?? this.deviceId,
        firstSeenAt: now,
        lastSyncAt: now,
      });
    }
    await this.folder.writeText(SPACE_PATH, JSON.stringify({ ...space, devices }, null, 2));
  }

  async readAllOps(): Promise<ChangeOp[]> {
    const ops: ChangeOp[] = [];
    const legacy = await this.folder.readText(LEGACY_LOG);
    if (legacy) ops.push(...parseChangeLog(legacy));
    if (this.folder.list) {
      const files = await this.folder.list(LOG_DIR);
      for (const path of files) {
        if (!path.endsWith(".jsonl")) continue;
        const raw = await this.folder.readText(path);
        if (raw) ops.push(...parseChangeLog(raw));
      }
    } else {
      const raw = await this.folder.readText(logPath(this.deviceId));
      if (raw) ops.push(...parseChangeLog(raw));
    }
    return sortOps(dedupeOps(ops));
  }

  async rebuildFromLogs(): Promise<{ bookmarks: Bookmark[]; tombstones: TombstoneMap }> {
    const ops = await this.readAllOps();
    if (!ops.length) {
      const bookmarks = await this.readBookmarksRaw();
      const tombstones = await this.readTombstones();
      return { bookmarks, tombstones };
    }
    const state = replayOps(ops);
    const bookmarks = bookmarksFromReplay(state);
    await this.folder.writeText(SNAPSHOT_PATH, JSON.stringify(bookmarks, null, 2));
    await this.folder.writeText(TOMBSTONES_PATH, serializeTombstones(state.tombstones));
    return { bookmarks, tombstones: state.tombstones };
  }

  private async readBookmarksRaw(): Promise<Bookmark[]> {
    const raw = await this.folder.readText(SNAPSHOT_PATH);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return (parsed as Bookmark[]).map((b) => ensurePathSafe(b));
    } catch {
      return [];
    }
  }

  async readBookmarks(): Promise<Bookmark[]> {
    return this.readBookmarksRaw();
  }

  async readTombstones(): Promise<TombstoneMap> {
    return parseTombstones(await this.folder.readText(TOMBSTONES_PATH));
  }

  async readHealth(): Promise<HealthMap> {
    const raw = await this.folder.readText(HEALTH_PATH);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as HealthMap;
    } catch {
      return {};
    }
  }

  async writeHealth(health: HealthMap): Promise<void> {
    await this.folder.writeText(HEALTH_PATH, JSON.stringify(health, null, 2));
  }

  private async appendLocalOps(ops: ChangeOp[]): Promise<void> {
    if (!ops.length) return;
    const path = logPath(this.deviceId);
    const prev = (await this.folder.readText(path)) ?? "";
    await this.folder.writeText(path, prev + serializeOps(ops));
  }

  private async nextLocalSeq(): Promise<number> {
    const raw = (await this.folder.readText(logPath(this.deviceId))) ?? "";
    return nextSeq(parseChangeLog(raw));
  }

  async appendChange(op: ChangeOpDraft): Promise<void> {
    const seq = op.seq ?? (await this.nextLocalSeq());
    const full = { ...op, seq, deviceId: op.deviceId ?? this.deviceId } as ChangeOp;
    await this.appendLocalOps([full]);
    await this.rebuildFromLogs();
  }

  async appendChanges(ops: ChangeOpDraft[]): Promise<void> {
    let seq = await this.nextLocalSeq();
    const full: ChangeOp[] = ops.map((op) => {
      const row = { ...op, seq: op.seq ?? seq, deviceId: op.deviceId ?? this.deviceId } as ChangeOp;
      if (op.seq == null) seq += 1;
      return row;
    });
    await this.appendLocalOps(full);
    await this.rebuildFromLogs();
  }

  async replaceBookmarks(bookmarks: Bookmark[], sourceOps?: ChangeOp[]): Promise<void> {
    const at = new Date().toISOString();
    if (sourceOps?.length) {
      await this.appendLocalOps(sourceOps.map((o, i) => ({ ...o, seq: o.seq || i + 1, deviceId: o.deviceId || this.deviceId })));
    } else {
      let seq = await this.nextLocalSeq();
      const ops: ChangeOp[] = bookmarks.map((bookmark) => {
        const op: ChangeOp = {
          op: "upsert",
          bookmark: ensurePathSafe(bookmark),
          at,
          seq,
          deviceId: this.deviceId,
        };
        seq += 1;
        return op;
      });
      await this.appendLocalOps(ops);
    }
    await this.rebuildFromLogs();
  }

  async upsertBookmark(bookmark: Bookmark): Promise<Bookmark[]> {
    const at = new Date().toISOString();
    await this.appendChange({
      op: "upsert",
      bookmark: ensurePathSafe({ ...bookmark, updatedAt: at }),
      at,
    });
    return this.readBookmarks();
  }

  async removeBookmark(bookmark: Bookmark, source: "browser" | "space" | "user" = "user"): Promise<void> {
    const at = new Date().toISOString();
    void source;
    await this.appendChange({
      op: "remove",
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      folderPath: bookmark.folderPath,
      at,
    });
  }

  async setCategory(
    id: string,
    category: string,
    folderPath?: string[],
    locked = true,
  ): Promise<Bookmark[]> {
    const at = new Date().toISOString();
    const path = folderPath && normalizeFolderPath(folderPath);
    await this.appendChange({ op: "setCategory", id, category, folderPath: path, locked, at });
    return this.readBookmarks();
  }

  /** Batch lock+move many bookmarks with a single log append and rebuild. */
  async setCategories(
    items: Array<{ id: string; category: string; folderPath?: string[] }>,
    locked = true,
  ): Promise<void> {
    const at = new Date().toISOString();
    await this.appendChanges(
      items.map((i) => ({
        op: "setCategory" as const,
        ...i,
        folderPath: i.folderPath ? normalizeFolderPath(i.folderPath) : undefined,
        locked,
        at,
      })),
    );
  }

  async exportBundle(pairingSecret?: string): Promise<SyncMarkBundle> {
    const space = await this.readSpace();
    if (!space) throw new Error("No SyncMark space in this folder.");
    const { bookmarks, tombstones } = await this.rebuildFromLogs();
    return {
      space,
      pairingSecret,
      bookmarks,
      changelog: await this.readAllOps(),
      health: await this.readHealth(),
      tombstones,
    };
  }

  async importBundle(bundle: SyncMarkBundle): Promise<void> {
    if (!isValidSpace(bundle.space)) throw new Error("Invalid SyncMark bundle.");
    await this.initSpace(bundle.space);
    if (bundle.changelog?.length) {
      await this.folder.writeText(logPath(this.deviceId), serializeOps(bundle.changelog));
    } else {
      await this.replaceBookmarks(bundle.bookmarks);
    }
    await this.writeHealth(bundle.health ?? {});
    if (bundle.tombstones) {
      await this.folder.writeText(TOMBSTONES_PATH, serializeTombstones(bundle.tombstones));
    }
    await this.rebuildFromLogs();
  }

  /** Migrate legacy root changelog.jsonl into this device's log once. */
  async migrateLegacyLog(): Promise<void> {
    const legacy = await this.folder.readText(LEGACY_LOG);
    if (!legacy?.trim()) return;
    const path = logPath(this.deviceId);
    const existing = (await this.folder.readText(path)) ?? "";
    if (!existing.trim()) {
      await this.folder.writeText(path, legacy.endsWith("\n") ? legacy : `${legacy}\n`);
    }
    await this.folder.writeText(LEGACY_LOG, "");
    await this.rebuildFromLogs();
  }

  /** Record that this device has applied everything up to `seen` (lets other browsers verify delivery). */
  async writeAck(browser: string, seen: Record<string, number>): Promise<void> {
    const ack: Ack = { deviceId: this.deviceId, browser, at: new Date().toISOString(), seen };
    await this.folder.writeText(ackPath(this.deviceId), JSON.stringify(ack));
  }

  async readAcks(): Promise<Ack[]> {
    if (!this.folder.list) return [];
    const acks: Ack[] = [];
    for (const path of await this.folder.list("acks/")) {
      const ack = parseAck(await this.folder.readText(path));
      if (ack) acks.push(ack);
    }
    return acks;
  }

  async appendSyncIssue(issue: SyncIssue): Promise<void> {
    await appendSyncIssueFile(this.folder, this.deviceId, issue);
  }

  async readSyncIssues(limit = 40): Promise<SyncIssue[]> {
    return readRecentSyncIssues(this.folder, this.deviceId, limit);
  }
}

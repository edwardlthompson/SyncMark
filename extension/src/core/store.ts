import { isValidSpace } from "./space.js";
import type {
  Bookmark,
  ChangeOp,
  FolderPort,
  HealthMap,
  SpaceMeta,
  SyncMarkBundle,
} from "./types.js";

const SPACE_PATH = "space.json";
const CHANGELOG_PATH = "changelog.jsonl";
const SNAPSHOT_PATH = "snapshots/bookmarks.json";
const HEALTH_PATH = "health.json";

export class SyncMarkStore {
  constructor(private folder: FolderPort) {}

  async initSpace(space: SpaceMeta): Promise<void> {
    await this.folder.writeText(SPACE_PATH, JSON.stringify(space, null, 2));
    await this.folder.writeText(CHANGELOG_PATH, "");
    await this.folder.writeText(SNAPSHOT_PATH, "[]");
    await this.folder.writeText(HEALTH_PATH, "{}");
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

  async readBookmarks(): Promise<Bookmark[]> {
    const raw = await this.folder.readText(SNAPSHOT_PATH);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Bookmark[]) : [];
    } catch {
      return [];
    }
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

  async appendChange(op: ChangeOp): Promise<void> {
    const prev = (await this.folder.readText(CHANGELOG_PATH)) ?? "";
    const line = `${JSON.stringify(op)}\n`;
    await this.folder.writeText(CHANGELOG_PATH, prev + line);
  }

  async replaceBookmarks(bookmarks: Bookmark[], sourceOps?: ChangeOp[]): Promise<void> {
    const at = new Date().toISOString();
    const ops =
      sourceOps ??
      bookmarks.map(
        (bookmark): ChangeOp => ({
          op: "upsert",
          bookmark,
          at,
        }),
      );
    const existing = (await this.folder.readText(CHANGELOG_PATH)) ?? "";
    const added = ops.map((o) => JSON.stringify(o)).join("\n");
    await this.folder.writeText(
      CHANGELOG_PATH,
      existing + (existing && !existing.endsWith("\n") && added ? "\n" : "") + (added ? `${added}\n` : ""),
    );
    await this.folder.writeText(SNAPSHOT_PATH, JSON.stringify(bookmarks, null, 2));
  }

  async upsertBookmark(bookmark: Bookmark): Promise<Bookmark[]> {
    const list = await this.readBookmarks();
    const idx = list.findIndex((b) => b.id === bookmark.id || b.url === bookmark.url);
    if (idx >= 0) list[idx] = { ...list[idx], ...bookmark, updatedAt: new Date().toISOString() };
    else list.push(bookmark);
    await this.appendChange({ op: "upsert", bookmark: list[idx >= 0 ? idx : list.length - 1], at: new Date().toISOString() });
    await this.folder.writeText(SNAPSHOT_PATH, JSON.stringify(list, null, 2));
    return list;
  }

  async setCategory(id: string, category: string): Promise<Bookmark[]> {
    const list = await this.readBookmarks();
    const item = list.find((b) => b.id === id);
    if (!item) return list;
    item.category = category;
    item.updatedAt = new Date().toISOString();
    await this.appendChange({ op: "setCategory", id, category, at: item.updatedAt });
    await this.folder.writeText(SNAPSHOT_PATH, JSON.stringify(list, null, 2));
    return list;
  }

  async exportBundle(pairingSecret?: string): Promise<SyncMarkBundle> {
    const space = await this.readSpace();
    if (!space) throw new Error("No SyncMark space in this folder.");
    const changelogRaw = (await this.folder.readText(CHANGELOG_PATH)) ?? "";
    const changelog = changelogRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ChangeOp);
    return {
      space,
      pairingSecret,
      bookmarks: await this.readBookmarks(),
      changelog,
      health: await this.readHealth(),
    };
  }

  async importBundle(bundle: SyncMarkBundle): Promise<void> {
    if (!isValidSpace(bundle.space)) throw new Error("Invalid SyncMark bundle.");
    await this.initSpace(bundle.space);
    await this.replaceBookmarks(bundle.bookmarks, bundle.changelog);
    await this.writeHealth(bundle.health ?? {});
  }
}

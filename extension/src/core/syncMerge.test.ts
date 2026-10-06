import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./import/dedupe.js";
import { applyOp, emptyReplay, mergeBookmarkPair, replayOps } from "./syncMerge.js";
import type { Bookmark, ChangeOp } from "./types.js";

const bm = (partial: Partial<Bookmark> & Pick<Bookmark, "url" | "title">): Bookmark => ({
  id: partial.id ?? "id",
  category: partial.category ?? "General",
  folderPath: partial.folderPath ?? ["General"],
  tags: partial.tags ?? [],
  createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  ...partial,
});

describe("syncMerge", () => {
  it("keeps earliest createdAt and unions tags", () => {
    const merged = mergeBookmarkPair(
      bm({
        url: "https://a.com",
        title: "Old",
        tags: ["a"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      bm({
        url: "https://a.com",
        title: "New",
        tags: ["b"],
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      }),
    );
    expect(merged.title).toBe("New");
    expect(merged.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(merged.tags.sort()).toEqual(["a", "b"]);
  });

  it("tombstone wins unless later upsert revives", () => {
    const ops: ChangeOp[] = [
      {
        op: "upsert",
        bookmark: bm({ url: "https://x.com", title: "X", updatedAt: "2026-01-01T00:00:00.000Z" }),
        at: "2026-01-01T00:00:00.000Z",
        seq: 1,
        deviceId: "a",
      },
      {
        op: "remove",
        id: "id",
        url: "https://x.com",
        at: "2026-02-01T00:00:00.000Z",
        seq: 1,
        deviceId: "b",
      },
    ];
    let state = replayOps(ops);
    expect(state.bookmarks.size).toBe(0);
    expect(state.tombstones[normalizeUrl("https://x.com")] ?? Object.values(state.tombstones)[0]).toBeDefined();

    state = applyOp(state, {
      op: "upsert",
      bookmark: bm({
        url: "https://x.com",
        title: "Back",
        updatedAt: "2026-03-01T00:00:00.000Z",
      }),
      at: "2026-03-01T00:00:00.000Z",
      seq: 2,
      deviceId: "a",
    });
    expect(state.bookmarks.size).toBe(1);
  });

  it("replay is idempotent", () => {
    const ops: ChangeOp[] = [
      {
        op: "upsert",
        bookmark: bm({ url: "https://y.com", title: "Y" }),
        at: "2026-01-01T00:00:00.000Z",
        seq: 1,
        deviceId: "a",
      },
    ];
    const a = replayOps(ops);
    const b = replayOps([...ops, ...ops]);
    expect([...a.bookmarks.keys()]).toEqual([...b.bookmarks.keys()]);
    expect(emptyReplay().bookmarks.size).toBe(0);
  });
});

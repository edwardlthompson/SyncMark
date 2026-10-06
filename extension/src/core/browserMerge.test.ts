import { describe, expect, it } from "vitest";
import { mergeBrowserWithSpace } from "./browserMerge.js";
import type { Bookmark } from "./types.js";

const bm = (partial: Partial<Bookmark> & Pick<Bookmark, "url" | "title">): Bookmark => ({
  id: partial.id ?? crypto.randomUUID(),
  category: partial.category ?? "General",
  folderPath: partial.folderPath ?? ["General"],
  tags: partial.tags ?? [],
  createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
  ...partial,
});

describe("mergeBrowserWithSpace", () => {
  it("adds browser-only bookmarks and tombstones fingerprint deletes", () => {
    const space = [
      bm({ id: "1", url: "https://keep.com", title: "Keep" }),
      bm({ id: "2", url: "https://gone.com", title: "Gone" }),
    ];
    const browser = [bm({ id: "1", url: "https://keep.com", title: "Keep" }), bm({ url: "https://new.com", title: "New" })];
    const { ops, report } = mergeBrowserWithSpace({
      space,
      browser,
      tombstones: {},
      fingerprint: [
        { url: "https://keep.com", folderPath: ["General"], title: "Keep", updatedAt: "t" },
        { url: "https://gone.com", folderPath: ["General"], title: "Gone", updatedAt: "t" },
      ],
      deviceId: "dev",
      now: "2026-04-01T00:00:00.000Z",
    });
    expect(report.removed.some((r) => r.url.includes("gone.com"))).toBe(true);
    expect(report.added.some((r) => r.url.includes("new.com"))).toBe(true);
    expect(ops.some((o) => o.op === "remove")).toBe(true);
    expect(ops.some((o) => o.op === "upsert")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { dedupeBookmarks, normalizeUrl } from "./dedupe.js";
import type { Bookmark } from "../types.js";

function bm(partial: Partial<Bookmark> & Pick<Bookmark, "url" | "title">): Bookmark {
  return {
    id: partial.id ?? crypto.randomUUID(),
    category: partial.category ?? "General",
    tags: partial.tags ?? [],
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("dedupe", () => {
  it("normalises trailing slash and hash", () => {
    expect(normalizeUrl("https://Example.com/path/#x")).toBe("https://example.com/path");
  });

  it("merges duplicates by normalised URL", () => {
    const out = dedupeBookmarks([
      bm({ url: "https://a.com/x/", title: "A", tags: ["one"], updatedAt: "2026-01-01T00:00:00.000Z" }),
      bm({
        url: "https://a.com/x",
        title: "A longer",
        tags: ["two"],
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("A longer");
    expect(out[0].tags.sort()).toEqual(["one", "two"]);
  });
});

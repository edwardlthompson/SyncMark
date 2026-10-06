import { describe, expect, it } from "vitest";
import { searchBookmarks } from "./search.js";
import type { Bookmark } from "./types.js";

describe("searchBookmarks", () => {
  const items: Bookmark[] = [
    {
      id: "1",
      url: "https://a.com",
      title: "Alpha",
      category: "Dev",
      folderPath: ["Dev"],
      tags: ["rust"],
      createdAt: "t",
      updatedAt: "t",
    },
    {
      id: "2",
      url: "https://b.com",
      title: "Beta",
      category: "News",
      folderPath: ["News"],
      tags: [],
      createdAt: "t",
      updatedAt: "t",
    },
  ];

  it("filters by title tag or category", () => {
    expect(searchBookmarks(items, "rust")).toHaveLength(1);
    expect(searchBookmarks(items, "news")).toHaveLength(1);
    expect(searchBookmarks(items, "")).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import { exportHtml, exportJson, exportMarkdown } from "./exportBookmarks.js";
import type { Bookmark } from "../types.js";

const bookmarks: Bookmark[] = [
  {
    id: "1",
    url: "https://a.com",
    title: "A",
    category: "Dev",
    folderPath: ["Dev"],
    tags: ["x"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("export", () => {
  it("exports JSON, Markdown, and HTML", () => {
    expect(JSON.parse(exportJson(bookmarks))).toHaveLength(1);
    expect(exportMarkdown(bookmarks)).toContain("[A](https://a.com)");
    expect(exportHtml(bookmarks)).toContain("HREF=\"https://a.com\"");
  });
});

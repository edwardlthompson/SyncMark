import { describe, expect, it } from "vitest";
import { importFromBrowserTree } from "./importBookmarks.js";

describe("importFromBrowserTree", () => {
  it("walks folders and skips javascript bookmarks", () => {
    const out = importFromBrowserTree([
      {
        title: "Bar",
        children: [
          { title: "Docs", url: "https://example.com/docs" },
          { title: "Skip", url: "javascript:void(0)" },
          {
            title: "Dev",
            children: [{ title: "GH", url: "https://github.com/x" }],
          },
        ],
      },
    ]);
    expect(out.map((b) => b.url).sort()).toEqual([
      "https://example.com/docs",
      "https://github.com/x",
    ]);
    expect(out.find((b) => b.url.includes("github"))?.category).toBe("Dev");
  });
});

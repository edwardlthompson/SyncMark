import { describe, expect, it } from "vitest";
import { classifyBookmarkRoot, resolveParentForPath, rootPathLabel } from "./bookmarkRoots.js";

describe("bookmarkRoots", () => {
  it("classifies Chromium and Firefox root ids", () => {
    expect(classifyBookmarkRoot("1")).toBe("toolbar");
    expect(classifyBookmarkRoot("2")).toBe("other");
    expect(classifyBookmarkRoot("toolbar_____")).toBe("toolbar");
    expect(classifyBookmarkRoot("unfiled_____")).toBe("other");
    expect(classifyBookmarkRoot("menu________")).toBe("menu");
  });

  it("resolves parent from folder path labels", () => {
    const roots = { toolbar: "tb", other: "ot", menu: "mn" };
    expect(resolveParentForPath(["Bookmarks Toolbar", "Work"], roots)).toBe("tb");
    expect(resolveParentForPath(["Other Bookmarks"], roots)).toBe("ot");
    expect(rootPathLabel("toolbar")).toBe("Bookmarks Toolbar");
  });
});

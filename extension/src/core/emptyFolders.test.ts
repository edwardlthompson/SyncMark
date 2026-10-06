import { describe, expect, it } from "vitest";
import { findEmptyFolders, type TreeNode } from "./emptyFolders.js";
import { folderKey, normalizeFolderPath } from "./bookmarkRoots.js";

const folder = (id: string, title: string, children: TreeNode[] = []): TreeNode => ({ id, title, children });
const link = (id: string): TreeNode => ({ id, title: id, url: `https://${id}.example/` });

describe("findEmptyFolders", () => {
  it("returns topmost empty folders only and never roots", () => {
    const tree = [
      folder("0", "", [
        folder("1", "Bookmarks bar", [
          folder("a", "Cooking", [folder("a1", "Baking"), folder("a2", "Grilling", [link("l1")])]),
          folder("b", "Empty", [folder("b1", "Deeper")]),
          folder("c", "Empty"),
          link("l2"),
        ]),
        folder("2", "Other bookmarks"),
        folder("3", "Mobile bookmarks"),
      ]),
    ];
    const found = findEmptyFolders(tree);
    expect(found.map((f) => f.id).sort()).toEqual(["a1", "b", "c"]);
    expect(found.find((f) => f.id === "b")?.nested).toBe(1);
    expect(found.find((f) => f.id === "a1")?.path).toEqual(["Bookmarks bar", "Cooking", "Baking"]);
  });

  it("keeps folders that contain separators", () => {
    const tree = [folder("0", "", [folder("1", "Toolbar", [folder("s", "Sep", [{ id: "x", type: "separator" }])])])];
    expect(findEmptyFolders(tree)).toHaveLength(0);
  });
});

describe("normalizeFolderPath", () => {
  it("defaults unrooted paths to the bookmarks bar and canonicalizes roots", () => {
    expect(normalizeFolderPath(["Cooking", "Baking"])).toEqual(["Bookmarks Toolbar", "Cooking", "Baking"]);
    expect(normalizeFolderPath(["Bookmarks bar", "Dev"])).toEqual(["Bookmarks Toolbar", "Dev"]);
    expect(normalizeFolderPath(["Other Bookmarks", "Dev"])).toEqual(["Other Bookmarks", "Dev"]);
    expect(normalizeFolderPath(["Toolbar tools"])).toEqual(["Bookmarks Toolbar", "Toolbar tools"]);
  });

  it("builds case-insensitive keys", () => {
    expect(folderKey(["A", "Cooking"])).toBe(folderKey(["a", " cooking "]));
  });
});

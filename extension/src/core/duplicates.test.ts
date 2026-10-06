import { describe, expect, it } from "vitest";
import { extraCopyIds, findDuplicateGroups } from "./duplicates.js";

const url = (id: string, u: string) => ({ id, title: `t${id}`, url: u });
const folder = (id: string, title: string, children: unknown[]) => ({ id, title, children });

const tree = [
  {
    id: "0",
    title: "",
    children: [
      folder("1", "Bookmarks bar", [
        folder("10", "Imported from Google Chrome", [
          folder("11", "Bookmarks bar", [folder("12", "Gaming", [url("13", "https://g.example/")])]),
        ]),
        folder("20", "Gaming", [url("21", "https://g.example"), url("22", "https://solo.example/")]),
        url("30", "https://g.example/#top"),
      ]),
      folder("2", "Other bookmarks", []),
    ],
  },
];

describe("findDuplicateGroups", () => {
  it("groups the same link across folders and keeps the one in the right place", () => {
    const groups = findDuplicateGroups(tree as never, new Map([["https://g.example/", ["Bookmarks Toolbar", "Gaming"]]]));
    expect(groups).toHaveLength(1);
    const keep = groups[0].copies.filter((c) => c.keep);
    expect(keep).toHaveLength(1);
    expect(keep[0].id).toBe("21");
    expect(extraCopyIds(groups).sort()).toEqual(["13", "30"]);
  });

  it("without a preferred folder, prefers a copy outside an import wrapper and ignores single links", () => {
    const groups = findDuplicateGroups(tree as never);
    expect(groups[0].copies.find((c) => c.keep)?.id).not.toBe("13");
    expect(groups.flatMap((g) => g.copies.map((c) => c.id))).not.toContain("22");
  });
});

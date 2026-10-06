import { describe, expect, it } from "vitest";
import { desiredOrder, planMoves, type SortNode } from "./sortBookmarks.js";

const f = (id: string, title: string): SortNode => ({ id, title, children: [] });
const l = (id: string, title: string): SortNode => ({ id, title, url: `https://${id}.example/` });
const ids = (n: SortNode[]) => n.map((x) => x.id);

describe("sortBookmarks", () => {
  const mixed = [l("l2", "zeta"), f("f2", "Beta"), l("l1", "Alpha"), f("f1", "alpha"), f("f10", "Folder 10"), f("f9", "Folder 9")];

  it("sorts folders first (A–Z, natural numbers) and keeps manual link order", () => {
    expect(ids(desiredOrder(mixed, { folders: true, links: false }))).toEqual(["f1", "f2", "f9", "f10", "l2", "l1"]);
  });

  it("sorts links too when asked", () => {
    expect(ids(desiredOrder(mixed, { folders: true, links: true }))).toEqual(["f1", "f2", "f9", "f10", "l1", "l2"]);
  });

  it("links-only sorting keeps folder slots in place", () => {
    expect(ids(desiredOrder(mixed, { folders: false, links: true }))).toEqual(["l1", "f2", "l2", "f1", "f10", "f9"]);
  });

  it("does nothing when both are off or a separator is present", () => {
    expect(desiredOrder(mixed, { folders: false, links: false })).toBe(mixed);
    const sep = [l("b", "b"), { id: "s", type: "separator" }, l("a", "a")];
    expect(ids(desiredOrder(sep, { folders: false, links: true }))).toEqual(["b", "s", "a"]);
  });

  it("plans moves that reproduce the desired order and are empty when sorted", () => {
    const prefs = { folders: true, links: true };
    const cur = [...mixed];
    for (const m of planMoves(mixed, prefs)) {
      const from = cur.findIndex((n) => n.id === m.id);
      expect(m.index).toBeLessThan(from);
      cur.splice(m.index, 0, cur.splice(from, 1)[0]);
    }
    expect(ids(cur)).toEqual(ids(desiredOrder(mixed, prefs)));
    expect(planMoves(cur, prefs)).toHaveLength(0);
  });
});

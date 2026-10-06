import { afterEach, describe, expect, it } from "vitest";
import { stripImportWrappers } from "../core/bookmarkRoots.js";
import { dedupeOps } from "../core/deviceLog.js";
import { importFromBrowserTree } from "../core/import/importBookmarks.js";
import type { ChangeOp, Bookmark } from "../core/types.js";
import { reconcileBrowserTree } from "./browserBookmarkSync.js";

type Node = { id: string; title: string; url?: string; children?: Node[] };

/** Chromium tree after "import from Chrome": real bar holds a wrapper containing a nested "Bookmarks bar". */
function importedTree(): Node {
  return {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "Bookmarks bar",
        children: [
          {
            id: "10",
            title: "Imported from Google Chrome",
            children: [
              {
                id: "11",
                title: "Bookmarks bar",
                children: [
                  { id: "12", title: "Gaming", children: [{ id: "13", title: "Game", url: "https://game.example/" }] },
                ],
              },
            ],
          },
        ],
      },
      { id: "2", title: "Other bookmarks", children: [] },
    ],
  };
}

function mockChrome(root: Node) {
  const nodes = new Map<string, Node>();
  const parents = new Map<string, Node>();
  const reg = (n: Node, p?: Node) => {
    nodes.set(n.id, n);
    if (p) parents.set(n.id, p);
    n.children?.forEach((c) => reg(c, n));
  };
  reg(root);
  let next = 100;
  const calls = { create: 0, move: 0 };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    bookmarks: {
      getTree: async () => [root],
      create: async (a: { parentId: string; title: string; url?: string }) => {
        const n: Node = { id: String(next++), title: a.title, url: a.url, children: a.url ? undefined : [] };
        nodes.get(a.parentId)?.children?.push(n);
        nodes.set(n.id, n);
        parents.set(n.id, nodes.get(a.parentId) as Node);
        calls.create++;
        return n;
      },
      move: async (id: string, d: { parentId: string }) => {
        const n = nodes.get(id) as Node;
        const p = parents.get(id) as Node;
        p.children = p.children?.filter((c) => c !== n);
        nodes.get(d.parentId)?.children?.push(n);
        parents.set(id, nodes.get(d.parentId) as Node);
        calls.move++;
      },
      update: async () => undefined,
      remove: async () => undefined,
    },
  };
  return calls;
}

const bookmark = (folderPath: string[]): Bookmark => ({
  id: "b1",
  url: "https://game.example/",
  title: "Game",
  category: folderPath[folderPath.length - 1],
  tags: [],
  folderPath,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

afterEach(() => {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
});

describe("imported-from-browser wrappers", () => {
  it("collapses the import wrapper onto the real root", () => {
    expect(stripImportWrappers(["Bookmarks Toolbar", "Imported from Google Chrome", "Bookmarks bar", "Gaming"])).toEqual([
      "Bookmarks Toolbar",
      "Gaming",
    ]);
    expect(stripImportWrappers(["Bookmarks Toolbar", "Imported", "Gaming"])).toEqual(["Bookmarks Toolbar", "Imported", "Gaming"]);
  });

  it("imports the nested bar as Bookmarks Toolbar / Gaming", () => {
    const [b] = importFromBrowserTree([importedTree()] as never);
    expect(b.folderPath).toEqual(["Bookmarks Toolbar", "Gaming"]);
  });

  it("moves the bookmark into a real top-level folder on the real bar", async () => {
    const tree = importedTree();
    const calls = mockChrome(tree);
    await reconcileBrowserTree([bookmark(["Bookmarks Toolbar", "Gaming"])], []);
    expect(calls).toEqual({ create: 1, move: 1 });
    const bar = tree.children?.[0] as Node;
    expect(bar.children?.some((c) => c.title === "Gaming" && c.children?.[0]?.url)).toBe(true);
  });
});

describe("dedupeOps", () => {
  const op = (seq: number, at: string): ChangeOp => ({ op: "setCategory", id: "x", category: "C", at, seq, deviceId: "d" });
  it("drops exact copies but keeps different ops that reused a seq", () => {
    expect(dedupeOps([op(1, "a"), op(1, "a"), op(1, "b")])).toHaveLength(2);
  });
});

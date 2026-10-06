import { describe, expect, it } from "vitest";
import { MemoryFolder } from "./memoryFolder.js";
import { createSpace } from "./space.js";
import { SyncMarkStore } from "./store.js";

describe("SyncMarkStore", () => {
  it("initialises folder layout and round-trips bookmarks", async () => {
    const folder = new MemoryFolder();
    const store = new SyncMarkStore(folder, "testdev");
    const created = await createSpace("Desk");
    await store.initSpace(created.space);
    expect(await store.readSpace()).toMatchObject({ name: "Desk", id: created.space.id });
    await store.replaceBookmarks([
      {
        id: "1",
        url: "https://example.com",
        title: "Example",
        category: "General",
        folderPath: ["General"],
        tags: [],
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
    expect(await store.readBookmarks()).toHaveLength(1);
    expect(folder.dump()["space.json"]).toContain("Desk");
    expect(folder.dump()["changelog/testdev.jsonl"]).toContain("upsert");
    expect(folder.dump()["tombstones.json"]).toBeDefined();
  });

  it("records remove tombstones with url", async () => {
    const folder = new MemoryFolder();
    const store = new SyncMarkStore(folder, "testdev");
    await store.initSpace((await createSpace("T")).space);
    await store.upsertBookmark({
      id: "1",
      url: "https://gone.example",
      title: "Gone",
      category: "Work",
      folderPath: ["Work"],
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.removeBookmark({
      id: "1",
      url: "https://gone.example/",
      title: "Gone",
      category: "Work",
      folderPath: ["Work"],
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(await store.readBookmarks()).toHaveLength(0);
    const stones = await store.readTombstones();
    expect(Object.keys(stones).length).toBe(1);
  });

  it("batch setCategories moves and locks many bookmarks", async () => {
    const store = new SyncMarkStore(new MemoryFolder(), "testdev");
    await store.initSpace((await createSpace("B")).space);
    const mk = (id: string) => ({
      id,
      url: `https://e.example/${id}`,
      title: id,
      category: "Misc",
      folderPath: ["Misc"],
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await store.replaceBookmarks([mk("a"), mk("b"), mk("c")]);
    await store.setCategories([
      { id: "a", category: "Rust", folderPath: ["Dev", "Rust"] },
      { id: "b", category: "Baking", folderPath: ["Cooking", "Baking"] },
    ]);
    const all = await store.readBookmarks();
    const by = Object.fromEntries(all.map((b) => [b.id, b]));
    expect(by.a.folderPath).toEqual(["Bookmarks Toolbar", "Dev", "Rust"]);
    expect(by.a.categoryLocked).toBe(true);
    expect(by.b.category).toBe("Baking");
    expect(by.c.categoryLocked).toBeFalsy();
  });
});

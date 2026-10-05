import { describe, expect, it } from "vitest";
import { MemoryFolder } from "./memoryFolder.js";
import { createSpace } from "./space.js";
import { SyncMarkStore } from "./store.js";

describe("SyncMarkStore", () => {
  it("initialises folder layout and round-trips bookmarks", async () => {
    const folder = new MemoryFolder();
    const store = new SyncMarkStore(folder);
    const created = await createSpace("Desk");
    await store.initSpace(created.space);
    expect(await store.readSpace()).toEqual(created.space);
    await store.replaceBookmarks([
      {
        id: "1",
        url: "https://example.com",
        title: "Example",
        category: "General",
        tags: [],
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
    expect(await store.readBookmarks()).toHaveLength(1);
    expect(folder.dump()["space.json"]).toContain("Desk");
    expect(folder.dump()["changelog.jsonl"]).toContain("upsert");
  });
});

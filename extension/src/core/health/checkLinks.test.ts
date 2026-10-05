import { describe, expect, it } from "vitest";
import { checkLinks } from "./checkLinks.js";
import type { Bookmark } from "../types.js";

const sample: Bookmark = {
  id: "b1",
  url: "https://example.com",
  title: "Ex",
  category: "General",
  tags: [],
  createdAt: "t",
  updatedAt: "t",
};

describe("checkLinks", () => {
  it("records advisory status and never mutates bookmark list", async () => {
    const bookmarks = [sample];
    const health = await checkLinks(bookmarks, {}, {
      gapMs: 0,
      fetchImpl: async () => ({ status: 404, ok: false, url: sample.url }),
      now: () => "2026-10-05T00:00:00.000Z",
    });
    expect(health.b1.status).toBe("dead");
    expect(bookmarks).toHaveLength(1);
  });

  it("treats 401 as ok (login wall)", async () => {
    const health = await checkLinks([sample], {}, {
      gapMs: 0,
      fetchImpl: async () => ({ status: 401, ok: false, url: sample.url }),
    });
    expect(health.b1.status).toBe("ok");
  });
});

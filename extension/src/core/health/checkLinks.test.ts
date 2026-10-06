import { describe, expect, it, vi } from "vitest";
import { checkLinks } from "./checkLinks.js";
import type { Bookmark } from "../types.js";

const sample: Bookmark = {
  id: "b1",
  url: "https://example.com",
  title: "Ex",
  category: "General",
  folderPath: ["General"],
  tags: [],
  createdAt: "t",
  updatedAt: "t",
};

describe("checkLinks", () => {
  it("records advisory status and never mutates bookmark list", async () => {
    const bookmarks = [sample];
    const health = await checkLinks(bookmarks, {}, {
      gapMs: 0,
      force: true,
      fetchImpl: async () => ({ status: 404, ok: false, url: sample.url }),
      now: () => "2026-10-05T00:00:00.000Z",
    });
    expect(health.b1.status).toBe("dead");
    expect(bookmarks).toHaveLength(1);
  });

  it("treats 401 as ok (login wall)", async () => {
    const health = await checkLinks([sample], {}, {
      gapMs: 0,
      force: true,
      fetchImpl: async () => ({ status: 401, ok: false, url: sample.url }),
    });
    expect(health.b1.status).toBe("ok");
  });

  it("checks bookmarks concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items: Bookmark[] = Array.from({ length: 12 }, (_, i) => ({
      ...sample,
      id: `b${i}`,
      url: `https://example.com/${i}`,
    }));
    await checkLinks(items, {}, {
      concurrency: 4,
      force: true,
      fetchImpl: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight -= 1;
        return { status: 200, ok: true, url: "https://example.com" };
      },
    });
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("skips fresh health records unless force", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, ok: true, url: sample.url }));
    const existing = {
      b1: { status: "ok" as const, checkedAt: "2026-10-05T12:00:00.000Z", httpStatus: 200 },
    };
    await checkLinks([sample], existing, {
      force: false,
      staleAfterMs: 24 * 60 * 60 * 1000,
      now: () => "2026-10-05T13:00:00.000Z",
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

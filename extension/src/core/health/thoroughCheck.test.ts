import { describe, expect, it } from "vitest";
import { checkLinksThorough } from "./thoroughCheck.js";
import type { Bookmark } from "../types.js";

const bm = (id: string, url: string): Bookmark => ({
  id,
  url,
  title: id,
  category: "x",
  tags: [],
  folderPath: ["x"],
  createdAt: "t",
  updatedAt: "t",
});

describe("checkLinksThorough", () => {
  it("re-verifies quick-pass failures with GET so false dead/error results are cleared", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string, init?: { method?: string }) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url}`);
      // hostile-to-HEAD site: HEAD says 404, GET says 200
      if (url.includes("headhostile")) return { status: method === "HEAD" ? 404 : 200, ok: method !== "HEAD", url };
      if (url.includes("truly-gone")) return { status: 404, ok: false, url };
      if (url.includes("flaky")) {
        // fails the quick pass (HEAD) with a server error, succeeds on GET
        return { status: method === "HEAD" ? 503 : 200, ok: method !== "HEAD", url };
      }
      return { status: 200, ok: true, url };
    };
    const list = [
      bm("a", "https://fine.example/"),
      bm("b", "https://headhostile.example/"),
      bm("c", "https://truly-gone.example/"),
      bm("d", "https://flaky.example/"),
    ];
    const passes: number[] = [];
    const { health, suspects } = await checkLinksThorough(list, {}, {
      fetchImpl,
      onProgress: (p) => passes.push(p.pass),
    });
    expect(suspects).toBe(3);
    expect(health.a.status).toBe("ok");
    expect(health.b.status).toBe("ok");
    expect(health.c.status).toBe("dead");
    expect(health.d.status).toBe("ok");
    expect(passes).toContain(2);
    expect(calls.filter((c) => c.startsWith("GET") && c.includes("fine.example"))).toHaveLength(0); // no wasted deep check
  });

  it("skips pass 2 when nothing is suspect and reports quick results first", async () => {
    let quick = 0;
    const r = await checkLinksThorough([bm("a", "https://ok.example/")], {}, {
      fetchImpl: async (url) => ({ status: 200, ok: true, url }),
      onQuickDone: () => {
        quick += 1;
      },
    });
    expect(r.suspects).toBe(0);
    expect(quick).toBe(1);
    expect(r.health.a.status).toBe("ok");
  });
});

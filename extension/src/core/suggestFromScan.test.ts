import { describe, expect, it } from "vitest";
import { suggestFromScan } from "./suggestFromScan.js";

describe("suggestFromScan", () => {
  it("uses scanned title for heuristics", () => {
    const s = suggestFromScan(
      { url: "https://example.com/x", title: "x" },
      { ok: true, title: "Chocolate cake recipe", finalUrl: "https://example.com/x" },
      [],
    );
    expect(s.category).toBe("Food");
    expect(s.reason).toMatch(/page title/i);
  });
});

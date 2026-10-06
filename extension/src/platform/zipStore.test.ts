import { describe, expect, it } from "vitest";
import { zipStoreFiles } from "./zipStore.js";

describe("zipStoreFiles", () => {
  it("builds a zip blob with local file headers", async () => {
    const blob = zipStoreFiles({ "space.json": "{}", "health.json": "{}" });
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(blob.size).toBeGreaterThan(40);
  });
});

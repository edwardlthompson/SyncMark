import { describe, expect, it } from "vitest";
import { joinWithPairingCode } from "./pairing.js";
import { createSpace } from "./space.js";

describe("joinWithPairingCode", () => {
  it("accepts a matching code", async () => {
    const created = await createSpace("Home");
    const result = await joinWithPairingCode(created.space, created.pairingCode);
    expect(result).toEqual({ ok: true, spaceId: created.space.id, secret: created.secret });
  });

  it("rejects wrong folder id", async () => {
    const a = await createSpace("A");
    const b = await createSpace("B");
    const result = await joinWithPairingCode(b.space, a.pairingCode);
    expect(result.ok).toBe(false);
  });
});

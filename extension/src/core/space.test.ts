import { describe, expect, it } from "vitest";
import { createSpace, formatPairingCode, parsePairingCode, verifySpaceSecret } from "./space.js";

describe("space + pairing code", () => {
  it("creates a space with verifiable secret and parseable code", async () => {
    let n = 0;
    const created = await createSpace("Test", (len) => {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (n++ * 17 + 3) & 0xff;
      return bytes;
    });
    expect(created.space.name).toBe("Test");
    expect(created.pairingCode).toBe(formatPairingCode(created.space.id, created.secret));
    expect(parsePairingCode(created.pairingCode)).toEqual({
      spaceId: created.space.id,
      secret: created.secret,
    });
    expect(await verifySpaceSecret(created.space, created.secret)).toBe(true);
    expect(await verifySpaceSecret(created.space, "WRONGWRONGWRONG1")).toBe(false);
  });

  it("parses compact codes without dashes", async () => {
    const created = await createSpace("X");
    const compact = `SM${created.space.id}${created.secret}`;
    expect(parsePairingCode(compact)).toEqual({
      spaceId: created.space.id,
      secret: created.secret,
    });
  });
});

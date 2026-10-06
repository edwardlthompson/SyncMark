import { describe, expect, it } from "vitest";
import { browserNames, ownMaxSeq, seenFromOps, verifyLink, type Ack, type PendingLink } from "./ack.js";
import { MemoryFolder } from "./memoryFolder.js";
import { SyncMarkStore } from "./store.js";
import type { ChangeOp } from "./types.js";

const op = (deviceId: string, seq: number): ChangeOp => ({ op: "setCategory", id: "x", category: "C", at: "t", seq, deviceId });
const ack = (deviceId: string, browser: string, seen: Record<string, number>): Ack => ({ deviceId, browser, at: "t", seen });
const link = (needSeq?: number, ackedBy: string[] = []): PendingLink => ({ url: "u", title: "T", needSeq, addedAt: 0, ackedBy });

describe("ack", () => {
  it("computes the highest seq per device", () => {
    const seen = seenFromOps([op("a", 1), op("a", 5), op("b", 2)]);
    expect(seen).toEqual({ a: 5, b: 2 });
    expect(ownMaxSeq([op("a", 3)], "a")).toBe(3);
    expect(ownMaxSeq([], "a")).toBe(0);
  });

  it("confirms only once the other browser has seen our seq", () => {
    expect(verifyLink(link(10), [ack("b", "firefox", { a: 9 })], "a")).toEqual({ newlyAcked: [], complete: false });
    const done = verifyLink(link(10), [ack("b", "firefox", { a: 10 })], "a");
    expect(done.complete).toBe(true);
    expect(done.newlyAcked.map((x) => x.browser)).toEqual(["firefox"]);
  });

  it("is incomplete with no other browser, or before the link is published, and reports each browser once", () => {
    expect(verifyLink(link(1), [ack("a", "chrome", { a: 1 })], "a").complete).toBe(false);
    expect(verifyLink(link(undefined), [ack("b", "firefox", { a: 99 })], "a").complete).toBe(false);
    expect(verifyLink(link(1, ["b"]), [ack("b", "firefox", { a: 1 })], "a").newlyAcked).toEqual([]);
  });

  it("names browsers for messages", () => {
    expect(browserNames([ack("b", "firefox", {})])).toBe("Firefox");
    expect(browserNames([ack("b", "firefox", {}), ack("c", "edge", {})])).toBe("Firefox and Edge");
    expect(browserNames([])).toBe("the other browser");
  });

  it("round-trips acks through the shared folder so the sender can verify delivery", async () => {
    const folder = new MemoryFolder();
    const firefox = new SyncMarkStore(folder, "ff");
    await firefox.writeAck("firefox", { chrome: 7 });
    const acks = await new SyncMarkStore(folder, "chrome").readAcks();
    expect(acks.map((a) => a.browser)).toEqual(["firefox"]);
    expect(verifyLink(link(7), acks, "chrome").complete).toBe(true);
    expect(verifyLink(link(8), acks, "chrome").complete).toBe(false);
  });
});

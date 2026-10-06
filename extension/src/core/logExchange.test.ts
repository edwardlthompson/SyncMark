import { describe, expect, it } from "vitest";
import { parseChangeLog, serializeOps } from "./deviceLog.js";
import { deviceIdFromLogPath, mergeOpsIntoFolder, ownLogText, pullDeviceLogs } from "./logExchange.js";
import { MemoryFolder } from "./memoryFolder.js";
import type { ChangeOp } from "./types.js";

const op = (deviceId: string, seq: number): ChangeOp => ({
  op: "setCategory",
  id: `b${seq}`,
  category: "Dev",
  at: `2026-01-01T00:00:0${seq}.000Z`,
  seq,
  deviceId,
});

describe("logExchange", () => {
  it("parses device ids from nested log paths", () => {
    expect(deviceIdFromLogPath("changelog/dev_a.jsonl")).toBe("dev_a");
    expect(deviceIdFromLogPath("SyncMark/changelog/dev_b.jsonl")).toBe("dev_b");
    expect(deviceIdFromLogPath("snapshots/bookmarks.json")).toBeNull();
  });

  it("publishes only own ops", () => {
    const text = ownLogText([op("ff", 1), op("ch", 1), op("ff", 2)], "ff");
    expect(parseChangeLog(text).map((o) => o.deviceId)).toEqual(["ff", "ff"]);
  });

  it("merges ops per device without duplicating", async () => {
    const folder = new MemoryFolder();
    await folder.writeText("changelog/ch.jsonl", serializeOps([op("ch", 1)]));
    const n = await mergeOpsIntoFolder(folder, [op("ch", 1), op("ch", 2), op("ff", 1)]);
    expect(n).toBe(2);
    expect(parseChangeLog((await folder.readText("changelog/ch.jsonl")) ?? "")).toHaveLength(2);
    expect(await mergeOpsIntoFolder(folder, [op("ch", 2)])).toBe(0);
  });

  it("pulls other devices' logs but never overwrites own", async () => {
    const inbox = new MemoryFolder();
    await inbox.writeText("SyncMark/changelog/ff.jsonl", serializeOps([op("ff", 1), op("ff", 2)]));
    await inbox.writeText("SyncMark/changelog/ch.jsonl", serializeOps([op("ch", 9)]));
    const shared = new MemoryFolder();
    const updated = await pullDeviceLogs(inbox, shared, "ch");
    expect(updated).toEqual(["ff"]);
    expect(await shared.readText("changelog/ch.jsonl")).toBeNull();
    expect(parseChangeLog((await shared.readText("changelog/ff.jsonl")) ?? "")).toHaveLength(2);
    expect(await pullDeviceLogs(inbox, shared, "ch")).toEqual([]);
  });
});

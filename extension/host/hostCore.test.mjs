import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHUNK_BYTES, createDecoder, encodeMessage, handleRequest, resolveSafe } from "./hostCore.mjs";

describe("native host core", () => {
  it("rejects paths that escape the root", () => {
    const root = join(tmpdir(), "sm-root");
    expect(() => resolveSafe(root, "../evil.txt")).toThrow();
    expect(() => resolveSafe(root, "a/../../evil")).toThrow();
    expect(resolveSafe(root, "changelog/x.jsonl")).toContain("changelog");
  });

  it("writes atomically, lists, and reads in chunks", async () => {
    const root = await mkdtemp(join(tmpdir(), "sm-host-"));
    const big = "é".repeat(CHUNK_BYTES); // multi-byte, > one chunk
    expect((await handleRequest(root, { cmd: "write", path: "changelog/a.jsonl", content: big })).ok).toBe(true);
    const files = (await handleRequest(root, { cmd: "list", prefix: "changelog/" })).files;
    expect(files).toEqual(["changelog/a.jsonl"]);
    const parts = [];
    let offset = 0;
    for (;;) {
      const r = await handleRequest(root, { cmd: "read", path: "changelog/a.jsonl", offset });
      const bytes = Buffer.from(r.data, "base64");
      parts.push(bytes);
      offset += bytes.length;
      if (r.eof) break;
    }
    expect(Buffer.concat(parts).toString("utf8")).toBe(big);
    expect(await readFile(join(root, "changelog", "a.jsonl"), "utf8")).toBe(big);
  });

  it("reports missing files and unknown commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "sm-host-"));
    await writeFile(join(root, "x"), "1");
    expect((await handleRequest(root, { cmd: "read", path: "nope" })).exists).toBe(false);
    expect((await handleRequest(root, { cmd: "bogus" })).ok).toBe(false);
  });

  it("decodes framed messages across arbitrary chunking", () => {
    const got = [];
    const dec = createDecoder((m) => got.push(m));
    const frame = Buffer.concat([encodeMessage({ a: 1 }), encodeMessage({ b: "é" })]);
    dec(frame.subarray(0, 3));
    dec(frame.subarray(3, 9));
    dec(frame.subarray(9));
    expect(got).toEqual([{ a: 1 }, { b: "é" }]);
  });
});

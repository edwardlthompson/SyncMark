import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSHARP_HOST } from "../src/platform/helperHostSource.ts";
import { buildWindowsInstaller } from "../src/platform/helperInstaller.ts";

function frame(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length, 0);
  return Buffer.concat([head, body]);
}

describe("windows installer", () => {
  it("fills placeholders and keeps a single PowerShell marker", () => {
    const text = buildWindowsInstaller("abcdefghijklmnopabcdefghijklmnop", "x@y");
    expect(text).not.toMatch(/__[A-Z_]+__/);
    expect(text).toContain("abcdefghijklmnopabcdefghijklmnop");
    expect(text.split("#PS" + "START")).toHaveLength(2);
    expect(text.startsWith("@echo off\r\n")).toBe(true);
    expect(text).toContain("class SyncMarkHost");
  });

  const csc = join(process.env.WINDIR ?? "", "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
  it.runIf(process.platform === "win32" && existsSync(csc))(
    "compiled helper serves the native-messaging protocol",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "sm-cs-"));
      const root = join(dir, "data");
      mkdirSync(join(root, "changelog"), { recursive: true });
      writeFileSync(join(dir, "SyncMarkHost.cs"), CSHARP_HOST);
      const build = spawnSync(
        csc,
        ["/nologo", "/target:exe", `/out:${join(dir, "SyncMarkHost.exe")}`, "/r:System.Web.Extensions.dll", join(dir, "SyncMarkHost.cs")],
        { encoding: "utf8" },
      );
      expect(build.status, build.stdout + build.stderr).toBe(0);
      writeFileSync(join(dir, "root.txt"), root);

      const p = spawn(join(dir, "SyncMarkHost.exe"));
      const msgs = [];
      let buf = Buffer.alloc(0);
      p.stdout.on("data", (c) => {
        buf = Buffer.concat([buf, c]);
        while (buf.length >= 4 && buf.length >= 4 + buf.readUInt32LE(0)) {
          const n = buf.readUInt32LE(0);
          msgs.push(JSON.parse(buf.subarray(4, 4 + n).toString("utf8")));
          buf = buf.subarray(4 + n);
        }
      });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const big = "\u00e9".repeat(200_000); // > one 256 KB chunk once UTF-8 encoded
      p.stdin.write(frame({ id: 1, cmd: "ping" }));
      p.stdin.write(frame({ id: 2, cmd: "watch" }));
      p.stdin.write(frame({ id: 3, cmd: "write", path: "changelog/dev_a.jsonl", content: big }));
      await wait(1200);
      writeFileSync(join(root, "changelog", "dev_b.jsonl"), "x\n");
      p.stdin.write(frame({ id: 4, cmd: "list", prefix: "changelog/" }));
      p.stdin.write(frame({ id: 5, cmd: "read", path: "changelog/dev_a.jsonl", offset: 0 }));
      p.stdin.write(frame({ id: 6, cmd: "read", path: "../escape" }));
      await wait(1200);
      p.kill();

      const byId = (id) => msgs.find((m) => m.id === id);
      expect(byId(1)?.ok).toBe(true);
      expect(byId(3)?.ok).toBe(true);
      expect((byId(4)?.files ?? []).sort()).toEqual(["changelog/dev_a.jsonl", "changelog/dev_b.jsonl"]);
      expect(byId(5)).toMatchObject({ exists: true, eof: false });
      expect(byId(6)?.ok).toBe(false);
      expect(msgs.some((m) => m.event === "changed" && m.path === "changelog/dev_b.jsonl")).toBe(true);
    },
    30_000,
  );
});

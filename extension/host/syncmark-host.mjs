#!/usr/bin/env node
// SyncMark native messaging host: lets the extension read/write the shared folder and watch it.
import { existsSync, readFileSync, watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDecoder, encodeMessage, handleRequest } from "./hostCore.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = join(here, "config.json");
const root =
  process.env.SYNCMARK_ROOT || (existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")).root : "");

function send(obj) {
  process.stdout.write(encodeMessage(obj));
}

let watcher;
function startWatch() {
  if (watcher || !root) return;
  try {
    watcher = watch(root, { recursive: true }, (_ev, name) => {
      const path = String(name ?? "").replace(/\\/g, "/");
      if (!path || path.endsWith(".tmp") || path.split("/").some((p) => p.startsWith("."))) return;
      send({ event: "changed", path });
    });
    watcher.on("error", () => {});
  } catch {
    /* watching is best-effort */
  }
}

const decode = createDecoder(async (req) => {
  const id = req.id;
  if (!root) return send({ id, ok: false, error: "no folder configured; run install-host.mjs" });
  try {
    if (req.cmd === "watch") {
      startWatch();
      return send({ id, ok: true });
    }
    send({ id, ...(await handleRequest(root, req)) });
  } catch (err) {
    send({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

process.stdin.on("data", decode);
process.stdin.on("end", () => process.exit(0));

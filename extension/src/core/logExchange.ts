import { parseChangeLog, serializeOps, unionOps } from "./deviceLog.js";
import type { ChangeOp, FolderPort } from "./types.js";

const LOG_FILE_RE = /(?:^|\/)changelog\/([^/]+)\.jsonl$/;

/** Device id from a `changelog/<id>.jsonl` path (any parent prefix), else null. */
export function deviceIdFromLogPath(path: string): string | null {
  return LOG_FILE_RE.exec(path)?.[1] ?? null;
}

/** Serialized changelog containing only ops authored by `deviceId` (what a browser may publish). */
export function ownLogText(ops: ChangeOp[], deviceId: string): string {
  return serializeOps(ops.filter((o) => o.deviceId === deviceId));
}

/** Union `ops` into per-device log files of `folder`. Returns count of files rewritten. */
export async function mergeOpsIntoFolder(folder: FolderPort, ops: ChangeOp[]): Promise<number> {
  const byDevice = new Map<string, ChangeOp[]>();
  for (const o of ops) {
    if (!o.deviceId || o.deviceId === "legacy") continue;
    const list = byDevice.get(o.deviceId) ?? [];
    list.push(o);
    byDevice.set(o.deviceId, list);
  }
  let written = 0;
  for (const [id, incoming] of byDevice) {
    const path = `changelog/${id}.jsonl`;
    const existing = parseChangeLog((await folder.readText(path)) ?? "");
    const merged = unionOps(existing, incoming);
    if (merged.length === existing.length) continue;
    await folder.writeText(path, serializeOps(merged));
    written += 1;
  }
  return written;
}

/**
 * Copy other devices' logs from `from` (e.g. a Firefox publish folder) into `to`.
 * Never touches `ownDeviceId`. Returns the device ids whose log grew.
 */
export async function pullDeviceLogs(
  from: FolderPort,
  to: FolderPort,
  ownDeviceId: string,
): Promise<string[]> {
  if (!from.list) return [];
  const updated: string[] = [];
  for (const path of await from.list("")) {
    const id = deviceIdFromLogPath(path);
    if (!id || id === ownDeviceId) continue;
    const incoming = parseChangeLog((await from.readText(path)) ?? "");
    if (!incoming.length) continue;
    if ((await mergeOpsIntoFolder(to, incoming)) > 0) updated.push(id);
  }
  return updated;
}

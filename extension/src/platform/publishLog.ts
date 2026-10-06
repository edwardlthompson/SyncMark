import { ownLogText } from "../core/logExchange.js";
import type { SyncMarkStore } from "../core/store.js";

const AUTO_KEY = "syncmark.autoPublish";
const COUNT_KEY = "syncmark.publishedCount";

/** Firefox cannot write to a user folder; it publishes through the downloads API instead. */
export function canPublishViaDownloads(): boolean {
  return typeof chrome !== "undefined" && typeof chrome.downloads?.download === "function";
}

export function publishRelativePath(deviceId: string): string {
  return `SyncMark/changelog/${deviceId}.jsonl`;
}

export async function loadAutoPublish(): Promise<boolean> {
  const got = await chrome.storage.local.get(AUTO_KEY);
  return got[AUTO_KEY] !== false;
}

export async function saveAutoPublish(on: boolean): Promise<void> {
  await chrome.storage.local.set({ [AUTO_KEY]: on });
}

/**
 * Write this browser's own changelog to Downloads/SyncMark/changelog/<device>.jsonl.
 * Skips when nothing is new unless `force`. Returns the relative path, or null when skipped.
 */
export async function publishOwnLog(store: SyncMarkStore, force = false): Promise<string | null> {
  if (!canPublishViaDownloads()) return null;
  const deviceId = store.localDeviceId;
  const ops = (await store.readAllOps()).filter((o) => o.deviceId === deviceId);
  const last = ((await chrome.storage.local.get(COUNT_KEY))[COUNT_KEY] as number | undefined) ?? -1;
  if (!force && ops.length === last) return null;
  const url = URL.createObjectURL(new Blob([ownLogText(ops, deviceId)], { type: "text/plain" }));
  const filename = publishRelativePath(deviceId);
  try {
    await chrome.downloads.download({ url, filename, conflictAction: "overwrite", saveAs: false });
    await chrome.storage.local.set({ [COUNT_KEY]: ops.length });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return filename;
}

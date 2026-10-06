import { pullDeviceLogs } from "../core/logExchange.js";
import type { FolderPort } from "../core/types.js";
import { INBOX_KEY, loadDirectoryHandle, saveDirectoryHandle } from "./directoryHandleStore.js";
import { FsAccessFolder } from "./fsAccessFolder.js";

/** Remember the folder Firefox publishes into (e.g. Downloads\SyncMark). */
export async function chooseInboxFolder(): Promise<string> {
  const handle = await globalThis.showDirectoryPicker({ id: "syncmark-inbox", mode: "read", startIn: "downloads" });
  await saveDirectoryHandle(handle, INBOX_KEY);
  return handle.name;
}

export async function inboxFolderName(): Promise<string | null> {
  return (await loadDirectoryHandle(INBOX_KEY))?.name ?? null;
}

/**
 * Copy other browsers' changelogs from the inbox folder into the shared folder.
 * Silent no-op when no inbox is set or read permission is not granted (e.g. service worker).
 */
export async function pullInbox(target: FolderPort, ownDeviceId: string): Promise<string[]> {
  try {
    const handle = await loadDirectoryHandle(INBOX_KEY);
    if (!handle) return [];
    const opts = { mode: "read" as const };
    if ((await handle.queryPermission(opts)) !== "granted") {
      if (typeof document === "undefined" || (await handle.requestPermission(opts)) !== "granted") return [];
    }
    return await pullDeviceLogs(new FsAccessFolder(handle), target, ownDeviceId);
  } catch {
    return [];
  }
}

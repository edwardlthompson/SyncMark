import { mergeOpsIntoFolder } from "../core/logExchange.js";
import { MemoryFolder } from "../core/memoryFolder.js";
import { SyncMarkStore } from "../core/store.js";
import type { FolderPort, SyncMarkBundle } from "../core/types.js";
import { getOrCreateDeviceId } from "./deviceId.js";
import { loadDirectoryHandle } from "./directoryHandleStore.js";
import { ensureReadWrite, FsAccessFolder } from "./fsAccessFolder.js";
import { pullInbox } from "./inboxPull.js";
import { openNativeFolder } from "./nativeFolder.js";
import { loadSessionBundle, saveSessionBundle } from "./session.js";

export async function openStore(folder: FolderPort): Promise<SyncMarkStore> {
  const deviceId = await getOrCreateDeviceId();
  return new SyncMarkStore(folder, deviceId);
}

export async function storeFromSession(): Promise<{ store: SyncMarkStore; bundle: SyncMarkBundle } | null> {
  const live = await tryOpenDiskStore();
  if (live) return live;
  const bundle = await loadSessionBundle();
  if (!bundle) return null;
  const folder = new MemoryFolder();
  const store = await openStore(folder);
  await store.importBundle(bundle);
  return { store, bundle };
}

export async function tryOpenDiskStore(): Promise<{
  store: SyncMarkStore;
  bundle: SyncMarkBundle;
  folderName: string;
} | null> {
  const native = await openNativeFolder();
  if (native) return openSharedStore(native, native.rootName, false);
  const handle = await loadDirectoryHandle();
  if (!handle) return null;
  if (!(await ensureReadWrite(handle))) return null;
  return openSharedStore(new FsAccessFolder(handle), handle.name, true);
}

async function openSharedStore(
  folder: FolderPort,
  folderName: string,
  pullFirefoxInbox: boolean,
): Promise<{ store: SyncMarkStore; bundle: SyncMarkBundle; folderName: string } | null> {
  const store = await openStore(folder);
  await store.migrateLegacyLog();
  const space = await store.readSpace();
  if (!space) return null;
  if (pullFirefoxInbox) await pullInbox(folder, store.localDeviceId);
  const prev = await loadSessionBundle();
  await adoptSessionHistory(folder, space.id, folderName, prev);
  const secret = prev?.pairingSecret;
  const bundle = await store.exportBundle(secret);
  await saveSessionBundle(bundle);
  return { store, bundle, folderName };
}

const ADOPTED_KEY = "syncmark.sessionAdopted";

/**
 * The first time a browser attaches to a shared folder, copy the changes it made while it only had a
 * private session (e.g. Firefox before the helper) into that folder, so other browsers receive them.
 */
async function adoptSessionHistory(
  folder: FolderPort,
  spaceId: string,
  folderName: string,
  prev: SyncMarkBundle | null,
): Promise<void> {
  const tag = `${spaceId}:${folderName}`;
  const done = (await chrome.storage.local.get(ADOPTED_KEY))[ADOPTED_KEY] as string | undefined;
  if (done === tag) return;
  if (prev?.space.id === spaceId && prev.changelog?.length) await mergeOpsIntoFolder(folder, prev.changelog);
  await chrome.storage.local.set({ [ADOPTED_KEY]: tag });
}

export async function persistStore(
  store: SyncMarkStore,
  pairingSecret?: string,
): Promise<SyncMarkBundle> {
  const bundle = await store.exportBundle(pairingSecret);
  await saveSessionBundle(bundle);
  return bundle;
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

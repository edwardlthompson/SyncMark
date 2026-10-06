import { mergeOpsIntoFolder } from "../core/logExchange.js";
import type { MemoryFolder } from "../core/memoryFolder.js";
import { isValidSpace } from "../core/space.js";
import type { SyncMarkStore } from "../core/store.js";
import type { SyncMarkBundle } from "../core/types.js";
import { chooseInboxFolder, inboxFolderName } from "../platform/inboxPull.js";
import { nativeEnabled } from "../platform/nativeFolder.js";
import {
  canPublishViaDownloads,
  loadAutoPublish,
  publishOwnLog,
  saveAutoPublish,
} from "../platform/publishLog.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/**
 * Firefox re-reads the shared folder from a file picker. Keep this browser's own earlier work:
 * union the session changelog into the picked folder so nothing done in Firefox is lost.
 */
export async function mergeSessionIntoFolder(
  folder: MemoryFolder,
  prev: SyncMarkBundle | null,
): Promise<number> {
  if (!prev?.changelog?.length) return 0;
  try {
    const space: unknown = JSON.parse((await folder.readText("space.json")) ?? "null");
    if (!isValidSpace(space) || space.id !== prev.space.id) return 0;
  } catch {
    return 0;
  }
  return mergeOpsIntoFolder(folder, prev.changelog);
}

/** Firefox: publish own changelog after a sync. Returns a short message ("" when nothing happened). */
export async function publishAfterSync(store: SyncMarkStore, force = false): Promise<string> {
  if (!canPublishViaDownloads() || (await nativeEnabled())) return "";
  if (!force && !(await loadAutoPublish())) return "";
  try {
    const path = await publishOwnLog(store, force);
    return path ? ` Published to Downloads/${path}.` : "";
  } catch (err) {
    return ` Could not publish: ${err instanceof Error ? err.message : "download failed"}.`;
  }
}

async function refreshInboxLabel(): Promise<void> {
  const name = await inboxFolderName();
  $("inboxName").textContent = name
    ? `Pulling Firefox changes from “${name}” on every sync.`
    : "Not set. Pick the SyncMark folder inside Downloads (where Firefox publishes).";
}

export async function initExchangeUi(
  getStore: () => Promise<SyncMarkStore | null>,
  native: boolean,
): Promise<void> {
  const intro = $("exchangeIntro");
  const say = (m: string) => ($("exchangeMsg").textContent = m);
  if (native) {
    $("exchangeCh").classList.remove("hidden");
    intro.textContent =
      "Firefox cannot write into your data folder, so it publishes its changes to Downloads\\SyncMark. Point SyncMark at that folder once; every sync then copies Firefox’s changes into your data folder and applies them here.";
    $("btnInbox").addEventListener("click", () => {
      chooseInboxFolder()
        .then(() => refreshInboxLabel())
        .then(() => say("Saved. Click Sync now to pull Firefox’s changes."))
        .catch((e) => {
          if (!(e instanceof DOMException && e.name === "AbortError")) say(String(e?.message ?? e));
        });
    });
    await refreshInboxLabel();
    return;
  }
  if (!canPublishViaDownloads()) {
    $("exchangeCard").classList.add("hidden");
    return;
  }
  $("exchangeFf").classList.remove("hidden");
  intro.textContent =
    "Firefox cannot write into your data folder. It publishes its changes to Downloads\\SyncMark\\changelog and reads the shared folder when you open it. In Chrome, choose Downloads\\SyncMark as the Firefox publish folder.";
  const box = $("autoPublish") as HTMLInputElement;
  box.checked = await loadAutoPublish();
  box.addEventListener("change", () => void saveAutoPublish(box.checked));
  void getStore().then(async (s) => {
    const msg = s ? await publishAfterSync(s) : "";
    if (msg) say(msg.trim());
  });
  $("btnPublish").addEventListener("click", async () => {
    const store = await getStore();
    if (!store) return say("Open or create a SyncMark space first.");
    const msg = await publishAfterSync(store, true);
    say(msg.trim() || "Nothing to publish yet.");
  });
}

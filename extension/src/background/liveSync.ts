/// <reference types="chrome" />
import { seenFromOps } from "../core/ack.js";
import { deviceIdFromLogPath } from "../core/logExchange.js";
import { syncTwoWay } from "../platform/browserBookmarkSync.js";
import { openStore, persistStore, tryOpenDiskStore } from "../platform/bundleIo.js";
import { getOrCreateDeviceId } from "../platform/deviceId.js";
import { getNativeClient, nativeEnabled, openNativeFolder } from "../platform/nativeFolder.js";
import { isSelf } from "../platform/selfWrites.js";
import { afterSync, noteAdded, verifyPending } from "./linkWatch.js";

const LOCAL_DELAY_MS = 3000;
const REMOTE_DELAY_MS = 800;
const EVENT_SETTLE_MS = 400;
const SAFETY_MS = 120_000;
const ACK_RE = /^acks\/([^/]+)\.json$/;

let timer: ReturnType<typeof setTimeout> | undefined;
let ackTimer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;
let watching = false;

function request(delay: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => void run(), delay);
}

async function run(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  if (!(await nativeEnabled())) return;
  running = true;
  const startedAt = Date.now();
  try {
    const live = await tryOpenDiskStore();
    if (live) {
      const seenBefore = seenFromOps(await live.store.readAllOps());
      const report = await syncTwoWay(live.store);
      await persistStore(live.store, live.bundle.pairingSecret);
      await afterSync(live.store, seenBefore, report, startedAt);
    }
  } catch {
    /* syncTwoWay records its own sync issues */
  } finally {
    running = false;
    if (again) {
      again = false;
      request(REMOTE_DELAY_MS);
    }
  }
}

/** A bookmark event. SyncMark's own writes are ignored; a link the user added is announced. */
function onBookmarkEvent(id: string, node?: chrome.bookmarks.BookmarkTreeNode): void {
  // Our own create/move calls mark the id only once they return, so let the event settle first.
  setTimeout(async () => {
    if (isSelf(id) || !(await nativeEnabled())) return;
    if (node?.url) noteAdded(node.url, node.title);
    if (running) again = true;
    else request(LOCAL_DELAY_MS);
  }, EVENT_SETTLE_MS);
}

async function checkAcks(): Promise<void> {
  const folder = await openNativeFolder();
  if (folder) await verifyPending(await openStore(folder)).catch(() => undefined);
}

async function startWatching(): Promise<void> {
  if (watching || !(await nativeEnabled())) return;
  const client = await getNativeClient();
  if (!client) {
    setTimeout(() => void startWatching(), 15_000);
    return;
  }
  const own = await getOrCreateDeviceId();
  watching = true;
  client.onChange((path) => {
    const id = deviceIdFromLogPath(path);
    if (id && id !== own) return request(REMOTE_DELAY_MS);
    const ack = ACK_RE.exec(path)?.[1];
    if (ack && ack !== own) {
      clearTimeout(ackTimer);
      ackTimer = setTimeout(() => void checkAcks(), EVENT_SETTLE_MS);
    }
  });
  const prior = client.onClosed;
  client.onClosed = () => {
    prior?.();
    watching = false;
    setTimeout(() => void startWatching(), 5_000);
  };
  await client.request("watch");
  request(1500);
}

/** Instant two-way sync, new-link notices and delivery confirmation while the native helper is enabled. */
export function startLiveSync(): void {
  chrome.bookmarks?.onCreated?.addListener((id, node) => onBookmarkEvent(id, node));
  for (const ev of ["onRemoved", "onChanged", "onMoved"] as const) {
    chrome.bookmarks?.[ev]?.addListener((id: string) => onBookmarkEvent(id));
  }
  chrome.bookmarks?.onImportEnded?.addListener(() => request(LOCAL_DELAY_MS));
  chrome.storage.onChanged.addListener((changes) => {
    if (changes["syncmark.native"]) void startWatching();
  });
  setInterval(() => void (watching && request(0)), SAFETY_MS);
  void startWatching();
}

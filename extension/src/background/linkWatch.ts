/// <reference types="chrome" />
import { browserNames, ownMaxSeq, verifyLink, type Ack, type PendingLink } from "../core/ack.js";
import type { SyncMarkStore } from "../core/store.js";
import type { SyncReport } from "../core/types.js";
import { browserLabel } from "../platform/browserBookmarkSync.js";
import { toast } from "../platform/toast.js";

const KEY = "syncmark.pendingLinks";
const BATCH_MS = 1500;
const WARN_AFTER_MS = 60_000;
const DROP_AFTER_MS = 7 * 24 * 3600_000;
const MAX_TRACKED = 50;

let batch: Array<{ url: string; title: string; at: number }> = [];
let batchTimer: ReturnType<typeof setTimeout> | undefined;

async function load(): Promise<PendingLink[]> {
  return ((await chrome.storage.local.get(KEY))[KEY] as PendingLink[] | undefined) ?? [];
}

async function save(list: PendingLink[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: list });
}

async function flush(): Promise<void> {
  const added = batch;
  batch = [];
  if (!added.length) return;
  const pending = await load();
  if (added.length <= MAX_TRACKED) {
    for (const a of added) pending.push({ url: a.url, title: a.title, addedAt: a.at, ackedBy: [] });
  } else {
    pending.push({ url: "", title: `${added.length} links`, addedAt: added[0].at, ackedBy: [] });
  }
  await save(pending);
  await toast(
    added.length === 1 ? "Link added to SyncMark" : `${added.length} links added to SyncMark`,
    added.length === 1 ? `“${added[0].title}”. Sending it to your other browser…` : "Sending them to your other browser…",
  );
}

/** A link the user just added in this browser (not one SyncMark wrote itself). */
export function noteAdded(url: string, title: string): void {
  batch.push({ url, title: title || url, at: Date.now() });
  clearTimeout(batchTimer);
  batchTimer = setTimeout(() => void flush(), BATCH_MS);
}

async function verify(store: SyncMarkStore, acks: Ack[]): Promise<void> {
  const own = store.localDeviceId;
  const now = Date.now();
  const keep: PendingLink[] = [];
  for (const link of await load()) {
    if (now - link.addedAt > DROP_AFTER_MS) continue;
    const res = verifyLink(link, acks, own);
    if (res.newlyAcked.length) {
      link.ackedBy.push(...res.newlyAcked.map((a) => a.deviceId));
      await toast(`Confirmed in ${browserNames(res.newlyAcked)}`, `“${link.title}” is now in ${browserNames(res.newlyAcked)}.`);
    }
    if (res.complete) continue;
    const waiting = acks.filter((a) => a.deviceId !== own && !link.ackedBy.includes(a.deviceId));
    if (!link.warned && link.needSeq != null && waiting.length && now - link.addedAt > WARN_AFTER_MS) {
      link.warned = true;
      await toast(
        `${browserNames(waiting)} has not picked up “${link.title}” yet`,
        "It may be closed. SyncMark will confirm as soon as it receives the link.",
      );
    }
    keep.push(link);
  }
  await save(keep);
}

/** Cheap check when another browser reports progress (its ack file changed). */
export async function verifyPending(store: SyncMarkStore): Promise<void> {
  if (!(await load()).length) return;
  await verify(store, await store.readAcks());
}

/**
 * After a successful sync: publish this browser's ack, tell the user about links that arrived from the
 * other browser, and start/continue tracking the links the user added here.
 */
export async function afterSync(
  store: SyncMarkStore,
  seenBefore: Record<string, number>,
  report: SyncReport,
  startedAt: number,
): Promise<void> {
  const arrived = report.arrived ?? [];
  if (arrived.length) {
    await toast(
      arrived.length === 1 ? "New link from your other browser" : `${arrived.length} new links from your other browser`,
      arrived.length === 1 ? `“${arrived[0].title}” was added to this browser.` : `Latest: “${arrived[arrived.length - 1].title}”.`,
    );
  }
  const pending = await load();
  // Only a sync that started after the link was added is guaranteed to have published it.
  const fresh = pending.filter((p) => p.needSeq == null && p.addedAt <= startedAt);
  if (fresh.length) {
    const need = ownMaxSeq(await store.readAllOps(), store.localDeviceId);
    for (const p of fresh) p.needSeq = need;
    await save(pending);
  }
  await store.writeAck(browserLabel(), seenBefore);
  await verifyPending(store);
}

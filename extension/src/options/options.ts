import { checkLinks } from "../core/health/checkLinks.js";
import { importFromBrowserTree } from "../core/import/importBookmarks.js";
import { exportHtml, exportJson, exportMarkdown } from "../core/export/exportBookmarks.js";
import { MemoryFolder } from "../core/memoryFolder.js";
import { joinWithPairingCode } from "../core/pairing.js";
import { createSpace } from "../core/space.js";
import { SyncMarkStore } from "../core/store.js";
import type { SyncMarkBundle } from "../core/types.js";
import { downloadText, persistStore, storeFromSession } from "../platform/bundleIo.js";
import { loadSessionBundle } from "../platform/session.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function refreshStatus(): Promise<void> {
  const bundle = await loadSessionBundle();
  const status = $("spaceStatus");
  const box = $("pairingBox");
  if (!bundle) {
    status.textContent = "No space yet. Create one or open a saved SyncMark file.";
    box.classList.add("hidden");
    return;
  }
  status.textContent = `Active: ${bundle.space.name} (${bundle.bookmarks.length} bookmarks)`;
  if (bundle.pairingSecret) {
    box.classList.remove("hidden");
    $("pairingCode").textContent = `SM-${bundle.space.id}-${bundle.pairingSecret}`;
  } else {
    box.classList.add("hidden");
  }
}

async function createSpaceFlow(): Promise<void> {
  const name = ($("spaceName") as HTMLInputElement).value;
  const created = await createSpace(name);
  const folder = new MemoryFolder();
  const store = new SyncMarkStore(folder);
  await store.initSpace(created.space);
  await persistStore(store, created.secret);
  await refreshStatus();
}

async function readBundleFile(file: File): Promise<SyncMarkBundle> {
  const text = await file.text();
  return JSON.parse(text) as SyncMarkBundle;
}

async function openBundle(file: File): Promise<void> {
  const bundle = await readBundleFile(file);
  const folder = new MemoryFolder();
  const store = new SyncMarkStore(folder);
  await store.importBundle(bundle);
  await persistStore(store, bundle.pairingSecret);
  await refreshStatus();
  $("importMsg").textContent = `Opened “${bundle.space.name}”.`;
}

async function joinBundle(file: File): Promise<void> {
  const code = ($("joinCode") as HTMLInputElement).value;
  const bundle = await readBundleFile(file);
  const result = await joinWithPairingCode(bundle.space, code);
  const msg = $("joinMsg");
  if (!result.ok) {
    msg.textContent = result.reason;
    return;
  }
  const folder = new MemoryFolder();
  const store = new SyncMarkStore(folder);
  await store.importBundle({ ...bundle, pairingSecret: result.secret });
  await persistStore(store, result.secret);
  msg.textContent = "Joined. This browser is paired to the space.";
  await refreshStatus();
}

async function importBrowser(): Promise<void> {
  const session = await storeFromSession();
  if (!session) {
    $("importMsg").textContent = "Create or open a SyncMark space first.";
    return;
  }
  const tree = await chrome.bookmarks.getTree();
  const imported = importFromBrowserTree(tree as never);
  const merged = [...session.bundle.bookmarks, ...imported];
  const { dedupeBookmarks } = await import("../core/import/dedupe.js");
  const unique = dedupeBookmarks(merged);
  await session.store.replaceBookmarks(unique);
  await persistStore(session.store, session.bundle.pairingSecret);
  $("importMsg").textContent = `Imported. ${unique.length} bookmarks in your space.`;
  await refreshStatus();
}

async function runLinkCheck(): Promise<void> {
  const session = await storeFromSession();
  if (!session) {
    $("importMsg").textContent = "Create or open a SyncMark space first.";
    return;
  }
  $("importMsg").textContent = "Checking links (advisory only — nothing will be deleted)…";
  const health = await checkLinks(session.bundle.bookmarks, session.bundle.health, { gapMs: 150 });
  await session.store.writeHealth(health);
  await persistStore(session.store, session.bundle.pairingSecret);
  const dead = Object.values(health).filter((h) => h.status === "dead").length;
  $("importMsg").textContent = `Checked ${session.bundle.bookmarks.length} links. ${dead} look dead (not deleted).`;
}

async function exportFormat(kind: "html" | "json" | "md"): Promise<void> {
  const bundle = await loadSessionBundle();
  if (!bundle) return;
  if (kind === "html") downloadText("syncmark-bookmarks.html", exportHtml(bundle.bookmarks), "text/html");
  if (kind === "json") downloadText("syncmark-bookmarks.json", exportJson(bundle.bookmarks), "application/json");
  if (kind === "md") downloadText("syncmark-bookmarks.md", exportMarkdown(bundle.bookmarks), "text/markdown");
}

function wire(): void {
  $("btnCreate").addEventListener("click", () => void createSpaceFlow());
  $("fileOpen").addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void openBundle(file);
  });
  $("fileJoin").addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void joinBundle(file);
  });
  $("btnImport").addEventListener("click", () => void importBrowser());
  $("btnCheckLinks").addEventListener("click", () => void runLinkCheck());
  $("btnExportHtml").addEventListener("click", () => void exportFormat("html"));
  $("btnExportJson").addEventListener("click", () => void exportFormat("json"));
  $("btnExportMd").addEventListener("click", () => void exportFormat("md"));
  $("btnCopyPair").addEventListener("click", async () => {
    const code = $("pairingCode").textContent ?? "";
    await navigator.clipboard.writeText(code);
  });
  $("btnExportBundle").addEventListener("click", async () => {
    const bundle = await loadSessionBundle();
    if (!bundle) return;
    downloadText(
      "syncmark-space.syncmark.json",
      JSON.stringify(bundle, null, 2),
      "application/json",
    );
  });
}

wire();
void refreshStatus();

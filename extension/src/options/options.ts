import { checkBookmarkLink, checkLinks } from "../core/health/checkLinks.js";
import { checkLinksThorough } from "../core/health/thoroughCheck.js";
import { dedupeBookmarks } from "../core/import/dedupe.js";
import { importFromBrowserTree } from "../core/import/importBookmarks.js";
import { exportHtml, exportJson, exportMarkdown } from "../core/export/exportBookmarks.js";
import { MemoryFolder } from "../core/memoryFolder.js";
import { joinWithPairingCode } from "../core/pairing.js";
import { createSpace } from "../core/space.js";
import { findEmptyFolders } from "../core/emptyFolders.js";
import { parseCategorizedMarkdown } from "../core/llmCategorize.js";
import { exportMarkdownForLlm, LLM_EXPORT_DEFAULT_BATCH } from "../core/llmExport.js";
import { reviewSuggestions } from "../core/suggest.js";
import { suggestTightening } from "../core/tightenFolders.js";
import { enrichCategorySignals, suggestFromScan } from "../core/suggestFromScan.js";
import type { Bookmark, HealthMap, HealthStatus, Suggestion, SyncMarkBundle, SyncReport } from "../core/types.js";
import { loadLocalSyncIssues, syncTwoWay } from "../platform/browserBookmarkSync.js";
import { loadSortPrefs, saveSortPrefs, sortBookmarksBar } from "../platform/bookmarkSort.js";
import { downloadText, openStore, persistStore, tryOpenDiskStore } from "../platform/bundleIo.js";
import { notifyDone } from "../platform/notify.js";
import { saveDirectoryHandle } from "../platform/directoryHandleStore.js";
import { memoryFolderFromFileList } from "../platform/folderFromFiles.js";
import { downloadSyncMarkFolderPack } from "../platform/folderPack.js";
import {
  canPickDirectory,
  ensureReadWrite,
  FsAccessFolder,
  pickSyncMarkDirectory,
} from "../platform/fsAccessFolder.js";
import { loadSessionBundle } from "../platform/session.js";
import { confirmInPage } from "./confirmInPage.js";
import { initExchangeUi, mergeSessionIntoFolder, publishAfterSync } from "./exchange.js";
import { initDuplicatesUi } from "./duplicatesUi.js";
import { initHelperUi } from "./helperUi.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const useNativeFolder = canPickDirectory();
let folderLabel = "";

function showFirefoxFolderUi(): void {
  if (useNativeFolder) return;
  $("ffFolderRow").classList.remove("hidden");
  $("ffJoinLabel").classList.remove("hidden");
  $("btnOpenFolder").classList.add("hidden");
  $("browserHint").textContent =
    "Firefox: Sync Now updates your existing bookmark folders in place (no zip). Firefox cannot write into the shared folder, so it publishes its changes to Downloads\\SyncMark and you re-open the shared folder here to pull Chrome’s changes (see Sync & links).";
}

function formatSyncReport(r: SyncReport): string {
  const parts = [
    `${r.folderCount} in space`,
    `${r.browserWritten} browser updates`,
    `+${r.added.length} added`,
    `~${r.updated.length} updated`,
    `↔${r.moved.length} moved`,
    `−${r.removed.length} removed`,
  ];
  if (r.failed) parts.push(`${r.failed} failed`);
  let msg = `Synced. ${parts.join(" · ")}.`;
  if (r.added.length) {
    msg += ` Added: ${r.added
      .slice(0, 3)
      .map((x) => `“${x.title}”`)
      .join(", ")}${r.added.length > 3 ? "…" : ""}.`;
  }
  if (r.removed.length) {
    const names = r.removed
      .slice(0, 5)
      .map((x) => `“${x.title}”`)
      .join(", ");
    msg += ` Removed (explicit): ${names}${r.removed.length > 5 ? "…" : ""}.`;
  }
  return msg;
}

type HealthFilter = "dead" | "error";

const PAGE_SIZE = 10;
let lastHealth: HealthMap = {};
let lastBookmarks: Bookmark[] = [];
let healthFilter: HealthFilter = "dead";
let healthPage = 0;
let catPage = 0;
const selectedIds = new Set<string>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bookmarksWithStatus(status: HealthStatus): Bookmark[] {
  return lastBookmarks.filter((b) => lastHealth[b.id]?.status === status);
}

function updateSelectionMsg(): void {
  const el = $("selectionMsg");
  if (el) el.textContent = `${selectedIds.size} selected (across pages)`;
}

function filteredHealthRows(): Bookmark[] {
  return healthFilter === "dead" ? bookmarksWithStatus("dead") : bookmarksWithStatus("error");
}

function pageSlice<T>(items: T[], page: number): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safe = Math.min(Math.max(0, page), pages - 1);
  const start = safe * PAGE_SIZE;
  return { rows: items.slice(start, start + PAGE_SIZE), page: safe, pages };
}

function renderHealthList(): void {
  const report = $("healthReport");
  const list = $("healthList");
  const summary = $("healthSummary");
  const dead = bookmarksWithStatus("dead");
  const errors = bookmarksWithStatus("error");
  const ok = bookmarksWithStatus("ok").length + bookmarksWithStatus("redirect").length;
  report.classList.remove("hidden");
  const all = filteredHealthRows();
  const { rows, page, pages } = pageSlice(all, healthPage);
  healthPage = page;
  summary.textContent = `Last scan: ${dead.length} dead · ${errors.length} errors · ${ok} ok/redirect · ${lastBookmarks.length} total. Showing ${healthFilter}: page ${page + 1}/${pages} (${rows.length} of ${all.length}).`;
  $("healthPageLabel").textContent = `Page ${page + 1} / ${pages}`;
  ($("btnHealthPrev") as HTMLButtonElement).disabled = page <= 0;
  ($("btnHealthNext") as HTMLButtonElement).disabled = page >= pages - 1;
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = `<p class="muted">No ${healthFilter} links in this scan.</p>`;
    updateSelectionMsg();
    return;
  }
  for (const b of rows) {
    const h = lastHealth[b.id];
    const div = document.createElement("div");
    div.className = "review-item health-row";
    div.setAttribute("role", "listitem");
    const path = (b.folderPath ?? [b.category]).join(" / ");
    const detail = h?.detail || (h?.httpStatus != null ? `HTTP ${h.httpStatus}` : "");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = selectedIds.has(b.id);
    check.setAttribute("aria-label", `Select ${b.title}`);
    check.addEventListener("change", () => {
      if (check.checked) selectedIds.add(b.id);
      else selectedIds.delete(b.id);
      updateSelectionMsg();
    });
    const body = document.createElement("div");
    body.innerHTML = `<span class="health-badge ${healthFilter}">${healthFilter}</span>
      <strong>${escapeHtml(b.title)}</strong>
      <div class="muted">${escapeHtml(path)}</div>
      <div class="health-url"><a href="${escapeHtml(b.url)}" target="_blank" rel="noreferrer">${escapeHtml(b.url)}</a></div>
      <div class="muted">${escapeHtml(detail)}</div>`;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary";
    open.textContent = "Open";
    open.addEventListener("click", () => {
      void chrome.tabs.create({ url: b.url });
    });
    const recheck = document.createElement("button");
    recheck.type = "button";
    recheck.className = "secondary";
    recheck.textContent = "Recheck";
    recheck.addEventListener("click", () => void recheckOne(b, recheck));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove…";
    remove.addEventListener("click", () => void removeOne(b));
    const rowBtns = document.createElement("div");
    rowBtns.className = "row";
    rowBtns.append(open, recheck, remove);
    body.append(rowBtns);
    div.append(check, body);
    list.append(div);
  }
  updateSelectionMsg();
}

function selectAllVisible(): void {
  for (const b of pageSlice(filteredHealthRows(), healthPage).rows) selectedIds.add(b.id);
  renderHealthList();
}

function clearSelection(): void {
  selectedIds.clear();
  renderHealthList();
}

function renderCatPage(): void {
  const box = $("catReview");
  const msg = $("catMsg");
  box.innerHTML = "";
  if (!catRows.length) {
    $("catPageLabel").textContent = "Page 0 / 0";
    ($("btnCatPrev") as HTMLButtonElement).disabled = true;
    ($("btnCatNext") as HTMLButtonElement).disabled = true;
    return;
  }
  const { rows, page, pages } = pageSlice(catRows, catPage);
  catPage = page;
  $("catPageLabel").textContent = `Page ${page + 1} / ${pages}`;
  ($("btnCatPrev") as HTMLButtonElement).disabled = page <= 0;
  ($("btnCatNext") as HTMLButtonElement).disabled = page >= pages - 1;
  msg.textContent = `${catRows.length} unlocked suggestion(s). Page ${page + 1}/${pages} (10 per page). Locked bookmarks are skipped.`;

  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "review-item";
    const cur = (row.bookmark.folderPath ?? [row.bookmark.category]).join(" / ");
    const create = row.suggestion.createFolder ? " (new folder)" : "";
    div.innerHTML = `<strong>${escapeHtml(row.bookmark.title)}</strong>
      <div class="muted">Now: ${escapeHtml(cur)} → ${escapeHtml(row.suggestion.category)}${create}</div>
      <div class="muted">${escapeHtml(row.suggestion.reason)}</div>`;
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "primary";
    accept.textContent = "Accept & lock";
    accept.addEventListener("click", async () => {
      const session = await activeStore();
      if (!session) return;
      await applyCategory(session.store, session.pairingSecret, row.bookmark, row.suggestion);
      catRows = catRows.filter((r) => r.bookmark.id !== row.bookmark.id);
      renderCatPage();
      $("catMsg").textContent = `Locked “${row.suggestion.category}” for “${row.bookmark.title}” (skipped in future scans) and auto-synced.`;
    });
    const keep = document.createElement("button");
    keep.type = "button";
    keep.className = "secondary";
    keep.textContent = "Skip";
    keep.addEventListener("click", () => {
      catRows = catRows.filter((r) => r.bookmark.id !== row.bookmark.id);
      renderCatPage();
    });
    const rowBtns = document.createElement("div");
    rowBtns.className = "row";
    rowBtns.append(accept, keep);
    div.append(rowBtns);
    box.append(div);
  }
}

async function autoSync(reason: string, chime = true): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  $("importMsg").textContent = `Auto-sync after ${reason}: reading browser folders…`;
  try {
    const result = await syncTwoWay(session.store);
    await persistStore(session.store, session.pairingSecret);
    const msg = `Auto-sync (${reason}): ${formatSyncReport(result)}${await publishAfterSync(session.store)}`;
    $("importMsg").textContent = msg;
    if (chime) await notifyDone("SyncMark — auto-sync complete", msg);
  } catch (err) {
    const fail =
      err instanceof Error
        ? `Auto-sync failed after ${reason}: ${err.message}`
        : `Auto-sync failed after ${reason}.`;
    $("importMsg").textContent = fail;
    if (chime) await notifyDone("SyncMark — auto-sync failed", fail);
  }
  await refreshStatus();
  await refreshSyncIssues();
}

async function recheckOne(bookmark: Bookmark, btn: HTMLButtonElement): Promise<void> {
  btn.disabled = true;
  btn.textContent = "Deep check…";
  $("importMsg").textContent = `Deep recheck “${bookmark.title}” (GET, up to 15s)…`;
  const started = Date.now();
  const record = await checkBookmarkLink(bookmark, {
    timeoutMs: 15_000,
    preferGet: true,
  });
  lastHealth = { ...lastHealth, [bookmark.id]: record };
  const session = await activeStore();
  if (session) {
    await session.store.writeHealth(lastHealth);
    await persistStore(session.store, session.pairingSecret);
  }
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  $("importMsg").textContent = `Deep recheck “${bookmark.title}” in ${sec}s: ${record.status}${record.httpStatus != null ? ` (HTTP ${record.httpStatus})` : ""}${record.detail ? ` — ${record.detail}` : ""}.`;
  btn.disabled = false;
  btn.textContent = "Recheck";
  renderHealthList();
}

async function recheckSelected(): Promise<void> {
  const targets = lastBookmarks.filter((b) => selectedIds.has(b.id));
  if (!targets.length) {
    $("importMsg").textContent = "Select one or more links to recheck.";
    return;
  }
  const session = await activeStore();
  if (!session) return;
  $("importMsg").textContent = `Deep recheck ${targets.length} selected (GET, 15s each, 4 at a time)…`;
  const started = Date.now();
  const health = await checkLinks(targets, lastHealth, {
    concurrency: 4,
    timeoutMs: 15_000,
    preferGet: true,
    force: true,
    onProgress: (done, total) => {
      const sec = Math.round((Date.now() - started) / 1000);
      $("importMsg").textContent = `Deep recheck selected (${done}/${total}) · ${sec}s…`;
    },
  });
  lastHealth = health;
  await session.store.writeHealth(health);
  await persistStore(session.store, session.pairingSecret);
  const msg = `Deep-rechecked ${targets.length} selected in ${Math.round((Date.now() - started) / 1000)}s.`;
  $("importMsg").textContent = msg;
  renderHealthList();
  await notifyDone("SyncMark — recheck finished", msg);
}

async function recheckAllErrors(): Promise<void> {
  const errors = bookmarksWithStatus("error");
  if (!errors.length) {
    $("importMsg").textContent = "No error links to recheck.";
    return;
  }
  const session = await activeStore();
  if (!session) return;
  $("importMsg").textContent = `Deep recheck ${errors.length} errors (GET, 15s, 4 at a time)…`;
  const started = Date.now();
  const health = await checkLinks(errors, lastHealth, {
    concurrency: 4,
    timeoutMs: 15_000,
    preferGet: true,
    force: true,
    onProgress: (done, total) => {
      const sec = Math.round((Date.now() - started) / 1000);
      $("importMsg").textContent = `Deep recheck errors (${done}/${total}) · ${sec}s…`;
    },
  });
  lastHealth = health;
  await session.store.writeHealth(health);
  await persistStore(session.store, session.pairingSecret);
  const still = bookmarksWithStatus("error").length;
  const nowDead = bookmarksWithStatus("dead").length;
  const recovered = errors.length - still;
  const msg = `Deep-rechecked ${errors.length} errors in ${Math.round((Date.now() - started) / 1000)}s. ${recovered} changed · ${still} still error · ${nowDead} dead.`;
  $("importMsg").textContent = msg;
  renderHealthList();
  await notifyDone("SyncMark — recheck finished", msg);
}

async function removeBookmarks(targets: Bookmark[], label: string): Promise<void> {
  if (!targets.length) {
    $("importMsg").textContent = "Nothing selected to remove.";
    return;
  }
  const ok = await confirmInPage({
    title: `Remove ${targets.length} bookmark(s)?`,
    body: `${label}\n\nThis writes explicit tombstones, then auto-syncs so the browser folders update. (In-page confirm — not a browser popup.)`,
    confirmLabel: `Remove ${targets.length}`,
    cancelLabel: "Cancel",
  });
  if (!ok) {
    $("importMsg").textContent = "Remove cancelled.";
    return;
  }
  const session = await activeStore();
  if (!session) return;
  $("importMsg").textContent = `Removing ${targets.length} bookmark(s)…`;
  for (let i = 0; i < targets.length; i++) {
    await session.store.removeBookmark(targets[i], "user");
    selectedIds.delete(targets[i].id);
    $("importMsg").textContent = `Removing (${i + 1}/${targets.length})…`;
  }
  await persistStore(session.store, session.pairingSecret);
  lastBookmarks = await session.store.readBookmarks();
  lastHealth = await session.store.readHealth();
  renderHealthList();
  await autoSync(`remove ${targets.length}`);
}

async function removeOne(bookmark: Bookmark): Promise<void> {
  await removeBookmarks([bookmark], `“${bookmark.title}”\n${bookmark.url}`);
}

async function removeSelected(): Promise<void> {
  const targets = lastBookmarks.filter((b) => selectedIds.has(b.id));
  await removeBookmarks(
    targets,
    targets
      .map((b) => `• ${b.title}`)
      .slice(0, 12)
      .join("\n") + (targets.length > 12 ? "\n…" : ""),
  );
}

async function removeAllDead(): Promise<void> {
  await removeBookmarks(
    bookmarksWithStatus("dead"),
    `${bookmarksWithStatus("dead").length} dead links from the last scan.`,
  );
}

async function syncNow(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  $("importMsg").textContent = "Manual sync (setup/pull): reading browser folders…";
  try {
    const result = await syncTwoWay(session.store);
    await persistStore(session.store, session.pairingSecret);
    const msg = formatSyncReport(result) + (await publishAfterSync(session.store));
    $("importMsg").textContent = msg;
    await notifyDone("SyncMark — sync complete", msg);
  } catch (err) {
    const fail = err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed. Try again.";
    $("importMsg").textContent = fail;
    await notifyDone("SyncMark — sync failed", fail);
  }
  await refreshStatus();
  await refreshSyncIssues();
}

async function runLinkCheck(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  const bookmarks = await session.store.readBookmarks();
  if (!bookmarks.length) {
    $("importMsg").textContent = "No bookmarks to check.";
    return;
  }
  selectedIds.clear();
  healthPage = 0;
  const started = Date.now();
  const elapsed = () => Math.round((Date.now() - started) / 1000);
  $("importMsg").textContent = `Pass 1 of 2: quick check of ${bookmarks.length} links (8 at a time)…`;
  lastBookmarks = bookmarks;
  // Same accuracy as a manual "Recheck": dead/error results are re-verified automatically in pass 2.
  const { health, suspects } = await checkLinksThorough(bookmarks, await session.store.readHealth(), {
    onProgress: ({ pass, done, total }) => {
      $("importMsg").textContent =
        pass === 1
          ? `Pass 1 of 2: quick check (${done}/${total}) · ${elapsed()}s…`
          : `Pass 2 of 2: verifying ${total} suspect links with a full check (${done}/${total}) · ${elapsed()}s…`;
    },
    onQuickDone: async (quick) => {
      await session.store.writeHealth(quick); // keep pass-1 results even if the page closes mid-way
      lastHealth = quick;
    },
  });
  await session.store.writeHealth(health);
  await persistStore(session.store, session.pairingSecret);
  lastHealth = health;
  healthFilter = "dead";
  const dead = bookmarksWithStatus("dead").length;
  const errored = bookmarksWithStatus("error").length;
  const ok = bookmarks.length - dead - errored;
  const msg = `Link check finished in ${elapsed()}s: ${dead} dead · ${errored} still unreachable · ${ok} ok/other${suspects ? ` (${suspects} suspects re-verified automatically)` : ""}.`;
  $("importMsg").textContent = msg;
  renderHealthList();
  await notifyDone("SyncMark — link check finished", msg);
}

async function refreshStatus(): Promise<void> {
  const disk = await tryOpenDiskStore();
  const status = $("spaceStatus");
  const box = $("pairingBox");
  if (disk) {
    folderLabel = disk.folderName;
    status.textContent = `Linked folder “${disk.folderName}” · ${disk.bundle.space.name} · ${disk.bundle.bookmarks.length} bookmarks`;
    showPairing(disk.bundle);
    return;
  }
  const bundle = await loadSessionBundle();
  if (!bundle) {
    status.textContent = useNativeFolder
      ? "No folder linked yet. Create a new space or open an existing SyncMark folder."
      : "No space loaded. Open the SyncMark data folder (or .json) shared with Chrome.";
    box.classList.add("hidden");
    return;
  }
  folderLabel = folderLabel || bundle.space.name;
  status.textContent = `Loaded “${bundle.space.name}” · ${bundle.bookmarks.length} bookmarks · Sync Now uses your browser folders`;
  showPairing(bundle);
}

function showPairing(bundle: SyncMarkBundle): void {
  const box = $("pairingBox");
  if (bundle.pairingSecret) {
    box.classList.remove("hidden");
    $("pairingCode").textContent = `SM-${bundle.space.id}-${bundle.pairingSecret}`;
  } else {
    box.classList.add("hidden");
  }
}

async function activateMemorySpace(
  folder: MemoryFolder,
  pairingSecret: string | undefined,
  label: string,
): Promise<void> {
  const store = await openStore(folder);
  folderLabel = label;
  await persistStore(store, pairingSecret);
  await refreshStatus();
}

async function createSpaceFlow(): Promise<void> {
  const name = ($("spaceName") as HTMLInputElement).value;
  try {
    if (useNativeFolder) {
      const handle = await pickSyncMarkDirectory();
      if (!(await ensureReadWrite(handle))) {
        $("importMsg").textContent = "Permission to write that folder was denied.";
        return;
      }
      const folder = new FsAccessFolder(handle);
      const existing = await folder.readText("space.json");
      if (existing) {
        const ok = await confirmInPage({
          title: "Overwrite SyncMark folder?",
          body: `“${handle.name}” already looks like a SyncMark folder. OK to overwrite, or Cancel and use Open instead.`,
          confirmLabel: "Overwrite",
          cancelLabel: "Cancel",
        });
        if (!ok) return;
      }
      const created = await createSpace(name);
      const store = await openStore(folder);
      await store.initSpace(created.space);
      await saveDirectoryHandle(handle);
      await persistStore(store, created.secret);
      folderLabel = handle.name;
      $("importMsg").textContent = `Created SyncMark space in folder “${handle.name}”.`;
      await refreshStatus();
      return;
    }

    const created = await createSpace(name);
    const folder = new MemoryFolder();
    const store = await openStore(folder);
    await store.initSpace(created.space);
    await persistStore(store, created.secret);
    await downloadSyncMarkFolderPack(
      store,
      `${created.space.name.replace(/\s+/g, "-")}-SyncMark.zip`,
    );
    $("importMsg").textContent =
      "Created. Optional backup zip downloaded — extract into your shared SyncMark data folder if you sync the folder across PCs. Sync Now does not need the zip.";
    await refreshStatus();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    $("importMsg").textContent = err instanceof Error ? err.message : "Could not create space.";
  }
}

async function openFolderNative(): Promise<void> {
  const handle = await pickSyncMarkDirectory();
  if (!(await ensureReadWrite(handle))) {
    $("importMsg").textContent = "Permission to read that folder was denied.";
    return;
  }
  const folder = new FsAccessFolder(handle);
  const store = await openStore(folder);
  await store.migrateLegacyLog();
  const space = await store.readSpace();
  if (!space) {
    $("importMsg").textContent = "That folder has no space.json. Pick the SyncMark folder itself.";
    return;
  }
  await saveDirectoryHandle(handle);
  const prev = await loadSessionBundle();
  await persistStore(store, prev?.pairingSecret);
  $("importMsg").textContent = `Opened SyncMark folder “${handle.name}”.`;
  await refreshStatus();
}

async function openFromDirectoryInput(files: FileList): Promise<void> {
  const { folder, rootLabel } = await memoryFolderFromFileList(files);
  const prev = await loadSessionBundle();
  await mergeSessionIntoFolder(folder, prev);
  const store = await openStore(folder);
  await store.migrateLegacyLog();
  const space = await store.readSpace();
  if (!space) throw new Error("Invalid SyncMark folder.");
  await activateMemorySpace(folder, prev?.pairingSecret, rootLabel);
  $("importMsg").textContent = `Opened SyncMark folder “${rootLabel}”. Merging with this browser…`;
  await autoSync("opening the shared folder");
}

async function openFromJsonFile(file: File): Promise<void> {
  const bundle = JSON.parse(await file.text()) as SyncMarkBundle;
  const folder = new MemoryFolder();
  const store = await openStore(folder);
  await store.importBundle(bundle);
  await activateMemorySpace(folder, bundle.pairingSecret, bundle.space.name);
  $("importMsg").textContent = `Opened SyncMark file “${file.name}”.`;
}

async function openFolderFlow(): Promise<void> {
  try {
    if (useNativeFolder) await openFolderNative();
    else $("dirOpen").click();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    $("importMsg").textContent = err instanceof Error ? err.message : "Could not open folder.";
  }
}

async function joinFolderFlow(): Promise<void> {
  if (!useNativeFolder) {
    $("dirJoin").click();
    return;
  }
  const code = ($("joinCode") as HTMLInputElement).value;
  const msg = $("joinMsg");
  try {
    const handle = await pickSyncMarkDirectory();
    if (!(await ensureReadWrite(handle))) {
      msg.textContent = "Permission to that folder was denied.";
      return;
    }
    const folder = new FsAccessFolder(handle);
    const store = await openStore(folder);
    const space = await store.readSpace();
    if (!space) {
      msg.textContent = "That folder is not a SyncMark space (missing space.json).";
      return;
    }
    const result = await joinWithPairingCode(space, code);
    if (!result.ok) {
      msg.textContent = result.reason;
      return;
    }
    await saveDirectoryHandle(handle);
    await persistStore(store, result.secret);
    msg.textContent = `Joined space in folder “${handle.name}”.`;
    await refreshStatus();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    msg.textContent = err instanceof Error ? err.message : "Could not join.";
  }
}

async function joinFromDirectoryInput(files: FileList): Promise<void> {
  const code = ($("joinCode") as HTMLInputElement).value;
  const msg = $("joinMsg");
  try {
    const { folder, rootLabel } = await memoryFolderFromFileList(files);
    const store = await openStore(folder);
    const space = await store.readSpace();
    if (!space) {
      msg.textContent = "That folder is not a SyncMark space.";
      return;
    }
    const result = await joinWithPairingCode(space, code);
    if (!result.ok) {
      msg.textContent = result.reason;
      return;
    }
    await activateMemorySpace(folder, result.secret, rootLabel);
    msg.textContent = `Joined “${rootLabel}”.`;
  } catch (err) {
    msg.textContent = err instanceof Error ? err.message : "Could not join.";
  }
}

async function activeStore(): Promise<{
  store: Awaited<ReturnType<typeof openStore>>;
  pairingSecret?: string;
} | null> {
  const disk = await tryOpenDiskStore();
  if (disk) return { store: disk.store, pairingSecret: disk.bundle.pairingSecret };
  const bundle = await loadSessionBundle();
  if (!bundle) {
    $("importMsg").textContent = "Open or create a SyncMark space first.";
    return null;
  }
  const folder = new MemoryFolder();
  const store = await openStore(folder);
  await store.importBundle(bundle);
  return { store, pairingSecret: bundle.pairingSecret };
}

async function importBrowserOnly(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  $("importMsg").textContent = "Importing from this browser’s folders…";
  const tree = await chrome.bookmarks.getTree();
  const imported = importFromBrowserTree(tree as never);
  const current = await session.store.readBookmarks();
  const unique = dedupeBookmarks([...current, ...imported]);
  await session.store.replaceBookmarks(unique);
  await persistStore(session.store, session.pairingSecret);
  $("importMsg").textContent = `Imported ${unique.length} bookmarks. Auto-syncing…`;
  await autoSync("import");
}

async function refreshSyncIssues(): Promise<void> {
  const box = $("syncIssues");
  try {
    const session = await activeStore();
    const fromDisk = session ? await session.store.readSyncIssues(30) : [];
    const local = (await loadLocalSyncIssues()) as Array<{
      at?: string;
      level?: string;
      phase?: string;
      message?: string;
      detail?: string;
      browser?: string;
    }>;
    const merged = [
      ...fromDisk.map((i) => ({ ...i, source: "folder" as const })),
      ...local.map((i) => ({
        at: i.at ?? "",
        level: (i.level as "error" | "warn" | "info") ?? "info",
        phase: i.phase ?? "local",
        message: i.message ?? "",
        detail: i.detail,
        browser: i.browser,
        deviceId: "local",
        source: "local" as const,
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 25);
    if (!merged.length) {
      box.textContent = "No sync issues yet. Run Sync Now to generate diagnostics.";
      return;
    }
    box.textContent = merged
      .map((i) => {
        const head = `[${i.at}] ${i.level.toUpperCase()} ${i.phase}: ${i.message}`;
        return i.detail ? `${head}\n  → ${i.detail}` : head;
      })
      .join("\n");
  } catch (err) {
    box.textContent = err instanceof Error ? err.message : "Could not load issues.";
  }
}

type CatRow = { bookmark: Bookmark; suggestion: Suggestion };

let catRows: CatRow[] = [];

async function applyCategory(
  store: Awaited<ReturnType<typeof openStore>>,
  pairingSecret: string | undefined,
  bookmark: Bookmark,
  suggestion: Suggestion,
  sync = true,
): Promise<void> {
  const path = suggestion.folderPath?.length
    ? suggestion.folderPath
    : [...(bookmark.folderPath?.slice(0, -1) ?? []), suggestion.category];
  await store.setCategory(bookmark.id, suggestion.category, path);
  await persistStore(store, pairingSecret);
  if (sync) await autoSync(`categorize “${bookmark.title}”`, false);
}

async function scanAndCategorize(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  const msg = $("catMsg");
  $("catReview").innerHTML = "";
  const bookmarks = await session.store.readBookmarks();
  const unlocked = bookmarks.filter((b) => !b.categoryLocked);
  const lockedCount = bookmarks.length - unlocked.length;
  const candidates = reviewSuggestions(bookmarks).filter((r) => r.differs).slice(0, 100);
  if (!candidates.length) {
    msg.textContent = `Nothing to scan: ${lockedCount} already locked by you · ${unlocked.length} unlocked with no catalog/page mismatch.`;
    await notifyDone("SyncMark — categorize finished", "No unlocked suggestions.");
    catRows = [];
    renderCatPage();
    return;
  }
  msg.textContent = `Precision scan: ${candidates.length} unlocked candidates (${lockedCount} locked/skipped). Catalog → page → Wikidata (4 at a time)…`;
  const started = Date.now();
  const scanned: CatRow[] = [];
  let done = 0;
  let cursor = 0;
  const concurrency = 4;

  async function worker(): Promise<void> {
    while (cursor < candidates.length) {
      const i = cursor;
      cursor += 1;
      const row = candidates[i];
      const signals = await enrichCategorySignals(row.bookmark.url);
      const suggestion = suggestFromScan(row.bookmark, signals, bookmarks);
      done += 1;
      const sec = Math.round((Date.now() - started) / 1000);
      let host = row.bookmark.url;
      try {
        host = new URL(row.bookmark.url).hostname;
      } catch {
        /* keep */
      }
      msg.textContent = `Precision scan (${done}/${candidates.length}) · ${sec}s · ${host} → ${suggestion.category}${signals.wikidataReason ? " · Wikidata" : ""}${signals.ok ? "" : " · page fetch failed"}`;
      if (suggestion.category !== row.bookmark.category && !/^general$/i.test(suggestion.category)) {
        scanned.push({ bookmark: row.bookmark, suggestion });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()));
  catRows = scanned;
  catPage = 0;
  const sec = Math.round((Date.now() - started) / 1000);
  if (!scanned.length) {
    msg.textContent = `Finished in ${sec}s: no precise folder changes among ${candidates.length} unlocked bookmarks.`;
    renderCatPage();
    await notifyDone("SyncMark — categorize finished", "No folder changes.");
    return;
  }
  renderCatPage();
  msg.textContent = `Finished in ${sec}s: ${scanned.length} precise suggestion(s). Review 10 per page; Accept & lock skips them next scan.`;
  await notifyDone("SyncMark — categorize finished", `${scanned.length} suggestions ready.`);
}

async function runSort(prefs: { folders: boolean; links: boolean }, label: string): Promise<void> {
  const moved = await sortBookmarksBar(prefs);
  $("sortMsg").textContent = moved ? `${label}: ${moved} item(s) reordered.` : `${label}: already in order.`;
}

async function loadSortUi(): Promise<void> {
  const prefs = await loadSortPrefs();
  ($("sortFoldersAuto") as HTMLInputElement).checked = prefs.folders;
  ($("sortLinksAuto") as HTMLInputElement).checked = prefs.links;
}

async function onSortToggle(): Promise<void> {
  const prefs = {
    folders: ($("sortFoldersAuto") as HTMLInputElement).checked,
    links: ($("sortLinksAuto") as HTMLInputElement).checked,
  };
  await saveSortPrefs(prefs);
  const on = [prefs.folders && "folders A–Z", prefs.links ? "links A–Z" : "links in my own order"]
    .filter(Boolean)
    .join(", ");
  $("sortMsg").textContent = `Saved: ${on}.`;
  await runSort(prefs, "Auto-sort");
}

async function cleanEmptyFolders(): Promise<void> {
  const msg = $("cleanMsg");
  const found = findEmptyFolders(await chrome.bookmarks.getTree());
  if (!found.length) {
    msg.textContent = "No empty folders found.";
    return;
  }
  const total = found.reduce((n, f) => n + 1 + f.nested, 0);
  const sample = found.slice(0, 8).map((f) => `• ${f.path.join(" / ")}`).join("\n");
  const ok = await confirmInPage({
    title: `Remove ${total} empty folder(s)?`,
    body: `Only folders with no bookmarks anywhere inside are removed. Bookmarks and browser root folders are never touched.\n\n${sample}${found.length > 8 ? `\n…and ${found.length - 8} more` : ""}`,
    confirmLabel: `Remove ${total}`,
  });
  if (!ok) return;
  let failed = 0;
  for (const f of found) {
    try {
      await chrome.bookmarks.removeTree(f.id);
    } catch {
      failed += 1;
    }
  }
  msg.textContent = `Removed ${total - failed} empty folder(s)${failed ? `, ${failed} failed` : ""}.`;
}

async function exportForLlm(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  const scope = ($("llmScope") as HTMLSelectElement).value === "all" ? "all" : "uncategorized";
  const batchSize = Number(($("llmBatch") as HTMLInputElement).value) || LLM_EXPORT_DEFAULT_BATCH;
  const partInput = $("llmPart") as HTMLInputElement;
  const r = exportMarkdownForLlm(await session.store.readBookmarks(), {
    scope,
    batchSize,
    part: Number(partInput.value) || 1,
  });
  if (!r.total) {
    $("llmMsg").textContent = "Nothing to export: every bookmark is already categorized. Choose “All links” to re-check them.";
    return;
  }
  partInput.value = String(r.part);
  downloadText(`syncmark-${scope}-part${r.part}of${r.parts}.md`, r.markdown, "text/markdown");
  $("llmMsg").textContent = `Exported part ${r.part} of ${r.parts} (${r.count} of ${r.total} link(s)). ${r.part < r.parts ? `Set Part to ${r.part + 1} for the next file. ` : ""}Accept each part before exporting the next so folders stay consistent.`;
}

async function tightenExisting(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  catRows = suggestTightening(await session.store.readBookmarks());
  catPage = 0;
  renderCatPage();
  $("llmMsg").textContent = catRows.length
    ? `${catRows.length} link(s) can be merged into tighter folders. Review below, then Accept (all pages…).`
    : "Nothing to tighten: your accepted folders already use the standard names.";
}

async function importFromLlm(file: File): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  const r = parseCategorizedMarkdown(await file.text(), await session.store.readBookmarks());
  catRows = r.rows;
  catPage = 0;
  renderCatPage();
  $("llmMsg").textContent = r.rows.length
    ? `Imported ${r.rows.length} suggestion(s) into ${r.folders} folder(s)${r.singletons ? ` (${r.singletons} hold a single link — consider re-exporting to tighten)` : ""}. ${r.unchanged} already match their current folder, ${r.rejected} vague folders rejected, ${r.unmatched} unmatched lines. Review below, then Accept.`
    : r.unchanged > 0
      ? `Nothing to change: ${r.unchanged} link(s) in this file already have these folders${r.unmatched ? ` (${r.unmatched} lines matched no bookmark)` : ""}. If your bookmarks bar looks different, click Sync now.`
      : `No usable lines found (${r.rejected} vague rejected, ${r.unmatched} unmatched). Expected lines like “KEY | Folder / Subfolder”.`;
}

async function acceptAllCategories(everyPage = false): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  const rows = everyPage ? [...catRows] : pageSlice(catRows, catPage).rows;
  if (everyPage && rows.length) {
    const ok = await confirmInPage({
      title: `Lock ${rows.length} folder choices?`,
      body: "Every suggestion on every page is applied, locked, and auto-synced to your browser folders.",
      confirmLabel: `Accept ${rows.length}`,
    });
    if (!ok) return;
  }
  if (!rows.length) {
    $("catMsg").textContent = "Run Scan & suggest folders first (or go to a page with suggestions).";
    return;
  }
  await session.store.setCategories(
    rows.map((r) => ({
      id: r.bookmark.id,
      category: r.suggestion.category,
      folderPath: r.suggestion.folderPath?.length
        ? r.suggestion.folderPath
        : [...(r.bookmark.folderPath?.slice(0, -1) ?? []), r.suggestion.category],
    })),
  );
  await persistStore(session.store, session.pairingSecret);
  const n = rows.length;
  const ids = new Set(rows.map((r) => r.bookmark.id));
  catRows = catRows.filter((r) => !ids.has(r.bookmark.id));
  $("catMsg").textContent = `Locked ${n} on this page. Auto-syncing…`;
  await autoSync(`accept ${n} categories`);
  renderCatPage();
  $("catMsg").textContent = `Locked ${n} folder choice(s) on this page and auto-synced. They will not appear in the next scan.`;
}

async function savePack(): Promise<void> {
  const session = await activeStore();
  if (!session) return;
  await downloadSyncMarkFolderPack(session.store, "SyncMark-folder.zip");
  $("importMsg").textContent =
    "Downloaded SyncMark-folder.zip (manual backup). Sync Now does not require extracting this.";
}

async function exportFormat(kind: "html" | "json" | "md"): Promise<void> {
  const bundle = (await tryOpenDiskStore())?.bundle ?? (await loadSessionBundle());
  if (!bundle) return;
  if (kind === "html") downloadText("syncmark-bookmarks.html", exportHtml(bundle.bookmarks), "text/html");
  if (kind === "json") downloadText("syncmark-bookmarks.json", exportJson(bundle.bookmarks), "application/json");
  if (kind === "md") downloadText("syncmark-bookmarks.md", exportMarkdown(bundle.bookmarks), "text/markdown");
}

function wire(): void {
  showFirefoxFolderUi();
  $("btnCreate").addEventListener("click", () => void createSpaceFlow());
  $("btnOpenFolder").addEventListener("click", () => void openFolderFlow());
  $("btnJoinFolder").addEventListener("click", () => void joinFolderFlow());
  $("btnSync").addEventListener("click", () => void syncNow());
  $("btnImport").addEventListener("click", () => void importBrowserOnly());
  $("btnCheckLinks").addEventListener("click", () => void runLinkCheck());
  $("btnShowDead").addEventListener("click", () => {
    healthFilter = "dead";
    healthPage = 0;
    renderHealthList();
  });
  $("btnShowErrors").addEventListener("click", () => {
    healthFilter = "error";
    healthPage = 0;
    renderHealthList();
  });
  $("btnSelectAll").addEventListener("click", () => selectAllVisible());
  $("btnClearSelection").addEventListener("click", () => clearSelection());
  $("btnHealthPrev").addEventListener("click", () => {
    healthPage -= 1;
    renderHealthList();
  });
  $("btnHealthNext").addEventListener("click", () => {
    healthPage += 1;
    renderHealthList();
  });
  $("btnCatPrev").addEventListener("click", () => {
    catPage -= 1;
    renderCatPage();
  });
  $("btnCatNext").addEventListener("click", () => {
    catPage += 1;
    renderCatPage();
  });
  $("btnRecheckErrors").addEventListener("click", () => void recheckAllErrors());
  $("btnRecheckSelected").addEventListener("click", () => void recheckSelected());
  $("btnRemoveSelected").addEventListener("click", () => void removeSelected());
  $("btnRemoveDead").addEventListener("click", () => void removeAllDead());
  $("btnRefreshIssues").addEventListener("click", () => void refreshSyncIssues());
  $("btnScanCategorize").addEventListener("click", () => void scanAndCategorize());
  $("btnAcceptAllCats").addEventListener("click", () => void acceptAllCategories());
  $("btnAcceptEveryCat").addEventListener("click", () => void acceptAllCategories(true));
  $("btnCleanEmpty").addEventListener("click", () => void cleanEmptyFolders());
  $("sortFoldersAuto").addEventListener("change", () => void onSortToggle());
  $("sortLinksAuto").addEventListener("change", () => void onSortToggle());
  $("btnSortFolders").addEventListener("click", async () => {
    const p = await loadSortPrefs();
    await runSort({ folders: true, links: p.links }, "Folders A–Z");
  });
  $("btnSortLinks").addEventListener("click", async () => {
    const p = await loadSortPrefs();
    await runSort({ folders: p.folders, links: true }, "Links A–Z");
  });
  $("btnTighten").addEventListener("click", () => void tightenExisting());
  $("btnLlmExport").addEventListener("click", () => void exportForLlm());
  $("btnLlmImport").addEventListener("click", () => $("llmFile").click());
  $("llmFile").addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void importFromLlm(file).finally(() => (input.value = ""));
  });
  $("btnSavePack").addEventListener("click", () => void savePack());
  $("btnExportHtml").addEventListener("click", () => void exportFormat("html"));
  $("btnExportJson").addEventListener("click", () => void exportFormat("json"));
  $("btnExportMd").addEventListener("click", () => void exportFormat("md"));
  $("btnCopyPair").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("pairingCode").textContent ?? "");
  });
  $("dirOpen").addEventListener("change", (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files?.length)
      void openFromDirectoryInput(files).catch((err) => {
        $("importMsg").textContent = err instanceof Error ? err.message : "Open failed.";
      });
  });
  $("fileOpen").addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file)
      void openFromJsonFile(file).catch((err) => {
        $("importMsg").textContent = err instanceof Error ? err.message : "Open failed.";
      });
  });
  $("dirJoin").addEventListener("change", (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files?.length) void joinFromDirectoryInput(files);
  });
}

wire();
void refreshStatus();
void refreshSyncIssues();
void loadSortUi();
void initHelperUi(useNativeFolder);
initDuplicatesUi(async () => (await activeStore())?.store.readBookmarks() ?? []);
void initExchangeUi(async () => (await activeStore())?.store ?? null, useNativeFolder);

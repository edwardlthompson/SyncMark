import { normalizeFolderPath } from "../core/bookmarkRoots.js";
import { normalizeFolder } from "../core/llmCategorize.js";
import { reviewSuggestions, suggestCategory } from "../core/suggest.js";
import { scanLinkSignals, suggestFromScan } from "../core/suggestFromScan.js";
import { searchBookmarks } from "../core/search.js";
import { MemoryFolder } from "../core/memoryFolder.js";
import type { Bookmark, HealthMap, Suggestion, SyncMarkBundle } from "../core/types.js";
import { syncTwoWay } from "../platform/browserBookmarkSync.js";
import { openStore, persistStore } from "../platform/bundleIo.js";
import { notifyDone } from "../platform/notify.js";
import { loadSessionBundle } from "../platform/session.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let bundle: SyncMarkBundle | null = null;
let suggestion: Suggestion = suggestCategory({ url: "", title: "" });

async function ensureStore() {
  bundle = await loadSessionBundle();
  if (!bundle) return null;
  const folder = new MemoryFolder();
  const store = await openStore(folder);
  await store.importBundle(bundle);
  return { store, bundle };
}

const LIST_LIMIT = 8;

function renderList(items: Bookmark[], health: HealthMap): void {
  const ul = $("list");
  ul.innerHTML = "";
  $("listMeta").textContent = items.length
    ? `Showing ${Math.min(items.length, LIST_LIMIT)} of ${items.length}${items.length > LIST_LIMIT ? " — refine your search to narrow down" : ""}`
    : "No bookmarks match.";
  for (const b of items.slice(0, LIST_LIMIT)) {
    const li = document.createElement("li");
    const h = health[b.id];
    const healthLabel =
      h?.status === "dead"
        ? `<span class="health-dead"> · dead link</span>`
        : h?.status === "ok"
          ? " · ok"
          : "";
    const path = (b.folderPath ?? [b.category]).join(" / ");
    li.innerHTML = `<a href="${b.url}" target="_blank" rel="noreferrer">${escapeHtml(b.title)}</a>
      <div class="meta">${escapeHtml(path)}${healthLabel}</div>`;
    ul.appendChild(li);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatSuggestion(s: Suggestion): string {
  const create = s.createFolder ? ` · create folder “${s.category}”` : "";
  return `Suggested: ${s.category}${create} — ${s.reason}`;
}

async function refresh(): Promise<void> {
  const session = await ensureStore();
  const empty = $("empty");
  const main = $("main");
  if (!session) {
    empty.classList.remove("hidden");
    main.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  main.classList.remove("hidden");
  bundle = session.bundle;
  const q = ($("search") as HTMLInputElement).value;
  renderList(searchBookmarks(bundle.bookmarks, q), bundle.health);
}

async function refreshSuggestion(): Promise<void> {
  const url = ($("saveUrl") as HTMLInputElement).value;
  const title = ($("saveTitle") as HTMLInputElement).value;
  const known = bundle?.bookmarks ?? [];
  suggestion = suggestCategory({ url, title }, known);
  $("suggestion").textContent = formatSuggestion(suggestion);
  ($("saveCategory") as HTMLInputElement).value = suggestion.category;
}

async function prefillSave(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pending = await chrome.storage.session.get("pendingSave");
  const url =
    (pending.pendingSave as { url?: string } | undefined)?.url || tab?.url || "";
  const title =
    (pending.pendingSave as { title?: string } | undefined)?.title || tab?.title || "";
  ($("saveUrl") as HTMLInputElement).value = url;
  ($("saveTitle") as HTMLInputElement).value = title;
  await refreshSuggestion();
  await chrome.storage.session.remove("pendingSave");
  if (url) {
    void scanLinkSignals(url).then((signals) => {
      if (!signals.ok && !signals.title) return;
      const known = bundle?.bookmarks ?? [];
      suggestion = suggestFromScan({ url, title }, signals, known);
      $("suggestion").textContent = formatSuggestion(suggestion);
    });
  }
}

async function saveBookmark(): Promise<void> {
  const session = await ensureStore();
  if (!session) {
    $("saveMsg").textContent = "Create a SyncMark space in Settings first.";
    return;
  }
  const title = ($("saveTitle") as HTMLInputElement).value.trim();
  const url = ($("saveUrl") as HTMLInputElement).value.trim();
  const typed = ($("saveCategory") as HTMLInputElement).value.trim();
  if (!url) {
    $("saveMsg").textContent = "Enter the link address (open “Edit link address”).";
    return;
  }
  // Same short, specific vocabulary as the AI path; unrooted paths land on the Bookmarks bar.
  const parts = normalizeFolder(typed || suggestion.category);
  if (!parts) {
    $("saveMsg").textContent = "Pick a specific folder, e.g. Gaming / Elite (not General or Misc).";
    return;
  }
  const now = new Date().toISOString();
  const keepSuggestedPath = Boolean(suggestion.folderPath?.length) && typed === suggestion.category;
  const folderPath = normalizeFolderPath(keepSuggestedPath ? (suggestion.folderPath as string[]) : parts);
  const category = folderPath[folderPath.length - 1];
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    url,
    title: title || url,
    category,
    folderPath,
    tags: suggestion.tags,
    createdAt: now,
    updatedAt: now,
    source: "popup-save",
    categoryLocked: true,
  };
  await session.store.upsertBookmark(bookmark);
  await persistStore(session.store, session.bundle.pairingSecret);
  $("saveMsg").textContent = "Saved. Auto-syncing folders…";
  try {
    await syncTwoWay(session.store);
    await persistStore(session.store, session.bundle.pairingSecret);
    $("saveMsg").textContent = "Saved and synced.";
    await notifyDone("SyncMark — saved", `Saved “${bookmark.title}” and synced.`);
  } catch (err) {
    $("saveMsg").textContent =
      err instanceof Error ? `Saved, but sync failed: ${err.message}` : "Saved, but sync failed.";
  }
  await refresh();
}

async function showReview(): Promise<void> {
  const session = await ensureStore();
  if (!session) return;
  const box = $("review");
  box.classList.remove("hidden");
  box.innerHTML = "<h2>Scan &amp; categorize</h2><p class='muted'>Scanning links…</p>";
  const rows = reviewSuggestions(session.bundle.bookmarks).filter((r) => r.differs).slice(0, 40);
  const scanned = await Promise.all(
    rows.map(async (row) => {
      const signals = await scanLinkSignals(row.bookmark.url);
      const suggestion = suggestFromScan(row.bookmark, signals, session.bundle.bookmarks);
      return {
        ...row,
        suggestion,
        differs: suggestion.category !== row.bookmark.category,
      };
    }),
  );
  const actionable = scanned.filter((r) => r.differs);
  box.innerHTML = "<h2>Scan &amp; categorize</h2>";
  if (!actionable.length) {
    box.innerHTML += "<p class='muted'>Everything already matches suggestions.</p>";
    return;
  }
  for (const row of actionable) {
    const div = document.createElement("div");
    div.className = "review-item";
    const cur = (row.bookmark.folderPath ?? [row.bookmark.category]).join(" / ");
    const create = row.suggestion.createFolder ? " (new folder)" : "";
    div.innerHTML = `<strong>${escapeHtml(row.bookmark.title)}</strong>
      <div class="meta">Now: ${escapeHtml(cur)} → Suggested: ${escapeHtml(row.suggestion.category)}${create}</div>
      <div class="meta">${escapeHtml(row.suggestion.reason)}</div>`;
    const accept = document.createElement("button");
    accept.className = "primary";
    accept.textContent = "Accept";
    accept.type = "button";
    accept.addEventListener("click", async () => {
      const path = row.suggestion.folderPath ?? [row.suggestion.category];
      await session.store.setCategory(row.bookmark.id, row.suggestion.category, path, true);
      await persistStore(session.store, session.bundle.pairingSecret);
      accept.textContent = "Syncing…";
      try {
        await syncTwoWay(session.store);
        await persistStore(session.store, session.bundle.pairingSecret);
      } catch {
        /* keep going */
      }
      await showReview();
      await refresh();
    });
    const keep = document.createElement("button");
    keep.className = "secondary";
    keep.textContent = "Keep current";
    keep.type = "button";
    keep.addEventListener("click", () => div.remove());
    const rowBtns = document.createElement("div");
    rowBtns.className = "row";
    rowBtns.append(accept, keep);
    div.append(rowBtns);
    box.append(div);
  }
}

async function rescanCurrent(): Promise<void> {
  const url = ($("saveUrl") as HTMLInputElement).value;
  const title = ($("saveTitle") as HTMLInputElement).value;
  if (!url) return;
  $("suggestion").textContent = "Scanning link…";
  const signals = await scanLinkSignals(url);
  const known = bundle?.bookmarks ?? [];
  suggestion = suggestFromScan({ url, title }, signals, known);
  $("suggestion").textContent = formatSuggestion(suggestion);
  ($("saveCategory") as HTMLInputElement).value = suggestion.category;
}

function wire(): void {
  $("search").addEventListener("input", () => void refresh());
  $("btnSave").addEventListener("click", () => void saveBookmark());
  $("btnUseSuggestion").addEventListener("click", () => {
    ($("saveCategory") as HTMLInputElement).value = suggestion.category;
  });
  $("btnRescan").addEventListener("click", () => void rescanCurrent());
  $("btnReview").addEventListener("click", () => void showReview());
  $("saveUrl").addEventListener("change", () => void refreshSuggestion());
}

wire();
void prefillSave().then(() => refresh());

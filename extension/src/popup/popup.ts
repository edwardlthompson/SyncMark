import { reviewSuggestions, suggestCategory } from "../core/suggest.js";
import { searchBookmarks } from "../core/search.js";
import { MemoryFolder } from "../core/memoryFolder.js";
import { SyncMarkStore } from "../core/store.js";
import type { Bookmark, HealthMap, SyncMarkBundle } from "../core/types.js";
import { persistStore } from "../platform/bundleIo.js";
import { loadSessionBundle } from "../platform/session.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let bundle: SyncMarkBundle | null = null;
let suggestion = suggestCategory({ url: "", title: "" });

async function ensureStore(): Promise<{ store: SyncMarkStore; bundle: SyncMarkBundle } | null> {
  bundle = await loadSessionBundle();
  if (!bundle) return null;
  const folder = new MemoryFolder();
  const store = new SyncMarkStore(folder);
  await store.importBundle(bundle);
  return { store, bundle };
}

function renderList(items: Bookmark[], health: HealthMap): void {
  const ul = $("list");
  ul.innerHTML = "";
  for (const b of items.slice(0, 80)) {
    const li = document.createElement("li");
    const h = health[b.id];
    const healthLabel =
      h?.status === "dead"
        ? `<span class="health-dead"> · dead link</span>`
        : h?.status === "ok"
          ? " · ok"
          : "";
    li.innerHTML = `<a href="${b.url}" target="_blank" rel="noreferrer">${escapeHtml(b.title)}</a>
      <div class="meta">${escapeHtml(b.category)}${healthLabel}</div>`;
    ul.appendChild(li);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

async function prefillSave(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pending = await chrome.storage.session.get("pendingSave");
  const url =
    (pending.pendingSave as { url?: string } | undefined)?.url || tab?.url || "";
  const title =
    (pending.pendingSave as { title?: string } | undefined)?.title || tab?.title || "";
  ($("saveUrl") as HTMLInputElement).value = url;
  ($("saveTitle") as HTMLInputElement).value = title;
  suggestion = suggestCategory({ url, title });
  $("suggestion").textContent = `Suggested: ${suggestion.category} — ${suggestion.reason}`;
  ($("saveCategory") as HTMLInputElement).value = suggestion.category;
  await chrome.storage.session.remove("pendingSave");
}

async function saveBookmark(): Promise<void> {
  const session = await ensureStore();
  if (!session) {
    $("saveMsg").textContent = "Create a SyncMark space in Settings first.";
    return;
  }
  const title = ($("saveTitle") as HTMLInputElement).value.trim();
  const url = ($("saveUrl") as HTMLInputElement).value.trim();
  const category = ($("saveCategory") as HTMLInputElement).value.trim() || "General";
  if (!url) {
    $("saveMsg").textContent = "URL is required.";
    return;
  }
  const now = new Date().toISOString();
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    url,
    title: title || url,
    category,
    tags: suggestion.tags,
    createdAt: now,
    updatedAt: now,
    source: "popup-save",
  };
  await session.store.upsertBookmark(bookmark);
  await persistStore(session.store, session.bundle.pairingSecret);
  $("saveMsg").textContent = "Saved.";
  await refresh();
}

async function showReview(): Promise<void> {
  const session = await ensureStore();
  if (!session) return;
  const box = $("review");
  box.classList.remove("hidden");
  box.innerHTML = "<h2>Review existing</h2>";
  const rows = reviewSuggestions(session.bundle.bookmarks).filter((r) => r.differs).slice(0, 40);
  if (!rows.length) {
    box.innerHTML += "<p class='muted'>Everything already matches suggestions.</p>";
    return;
  }
  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "review-item";
    div.innerHTML = `<strong>${escapeHtml(row.bookmark.title)}</strong>
      <div class="meta">Now: ${escapeHtml(row.bookmark.category)} → Suggested: ${escapeHtml(row.suggestion.category)}</div>`;
    const accept = document.createElement("button");
    accept.className = "primary";
    accept.textContent = "Accept";
    accept.type = "button";
    accept.addEventListener("click", async () => {
      await session.store.setCategory(row.bookmark.id, row.suggestion.category);
      await persistStore(session.store, session.bundle.pairingSecret);
      await showReview();
      await refresh();
    });
    const keep = document.createElement("button");
    keep.className = "secondary";
    keep.textContent = "Keep current";
    keep.type = "button";
    keep.addEventListener("click", () => {
      div.remove();
    });
    const rowBtns = document.createElement("div");
    rowBtns.className = "row";
    rowBtns.append(accept, keep);
    div.append(rowBtns);
    box.append(div);
  }
}

function wire(): void {
  $("search").addEventListener("input", () => void refresh());
  $("btnRefresh").addEventListener("click", () => void refresh());
  $("btnSave").addEventListener("click", () => void saveBookmark());
  $("btnUseSuggestion").addEventListener("click", () => {
    ($("saveCategory") as HTMLInputElement).value = suggestion.category;
  });
  $("btnReview").addEventListener("click", () => void showReview());
  $("saveUrl").addEventListener("change", () => {
    const url = ($("saveUrl") as HTMLInputElement).value;
    const title = ($("saveTitle") as HTMLInputElement).value;
    suggestion = suggestCategory({ url, title });
    $("suggestion").textContent = `Suggested: ${suggestion.category} — ${suggestion.reason}`;
  });
}

wire();
void prefillSave().then(() => refresh());

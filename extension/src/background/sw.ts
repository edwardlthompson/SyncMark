/// <reference types="chrome" />
import { applySavedSort } from "../platform/bookmarkSort.js";
import { startLiveSync } from "./liveSync.js";

startLiveSync();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: "syncmark-save",
    title: "Save to SyncMark",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "syncmark-save") return;
  const url = info.linkUrl || info.pageUrl || tab?.url;
  const title = tab?.title || url || "Bookmark";
  if (!url) return;
  void chrome.storage.session.set({
    pendingSave: { url, title },
  });
  void chrome.action.openPopup?.();
});

// Keep the bookmarks bar ordered per the user's toggles (debounced; a sorted bar plans zero moves, so no loop).
let sortTimer: ReturnType<typeof setTimeout> | undefined;
let sorting = false;
function scheduleAutoSort(): void {
  if (sorting) return;
  clearTimeout(sortTimer);
  sortTimer = setTimeout(async () => {
    sorting = true;
    try {
      await applySavedSort();
    } catch {
      /* best-effort */
    } finally {
      setTimeout(() => (sorting = false), 500);
    }
  }, 1500);
}
for (const ev of ["onCreated", "onMoved", "onChanged"] as const) chrome.bookmarks?.[ev]?.addListener(scheduleAutoSort);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ ok: true, name: "SyncMark" });
    return true;
  }
  return false;
});

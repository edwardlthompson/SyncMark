/// <reference types="chrome" />

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ping") {
    sendResponse({ ok: true, name: "SyncMark" });
    return true;
  }
  return false;
});

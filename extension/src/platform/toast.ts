/** System notification usable from the background (no DOM, no audio). */
export async function toast(title: string, message: string, id?: string): Promise<void> {
  try {
    if (!chrome.notifications?.create) return;
    await chrome.notifications.create(id ?? `syncmark-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title,
      message: message.slice(0, 250),
      priority: 1,
    });
  } catch {
    /* notifications unavailable or blocked */
  }
}

const DEVICE_KEY = "syncmark.deviceId";

/** Stable per-install device id for per-writer changelog files. */
export async function getOrCreateDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(DEVICE_KEY);
  const existing = result[DEVICE_KEY] as string | undefined;
  if (existing) return existing;
  const id = `dev_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await chrome.storage.local.set({ [DEVICE_KEY]: id });
  return id;
}

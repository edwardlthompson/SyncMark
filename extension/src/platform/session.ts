import type { SyncMarkBundle } from "../core/types.js";

const KEY = "syncmark.activeBundle";
const SECRET_KEY = "syncmark.pairingSecret";

function area(): chrome.storage.StorageArea {
  return chrome.storage.local;
}

export async function loadSessionBundle(): Promise<SyncMarkBundle | null> {
  const result = await area().get([KEY, SECRET_KEY]);
  const bundle = result[KEY] as SyncMarkBundle | undefined;
  if (!bundle) return null;
  if (result[SECRET_KEY] && !bundle.pairingSecret) {
    bundle.pairingSecret = result[SECRET_KEY] as string;
  }
  return bundle;
}

export async function saveSessionBundle(bundle: SyncMarkBundle): Promise<void> {
  const payload: Record<string, unknown> = { [KEY]: bundle };
  if (bundle.pairingSecret) payload[SECRET_KEY] = bundle.pairingSecret;
  await area().set(payload);
}

export async function clearSession(): Promise<void> {
  await area().remove([KEY, SECRET_KEY]);
}

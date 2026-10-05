import { MemoryFolder } from "../core/memoryFolder.js";
import { SyncMarkStore } from "../core/store.js";
import type { SyncMarkBundle } from "../core/types.js";
import { loadSessionBundle, saveSessionBundle } from "./session.js";

export async function storeFromSession(): Promise<{ store: SyncMarkStore; bundle: SyncMarkBundle } | null> {
  const bundle = await loadSessionBundle();
  if (!bundle) return null;
  const folder = new MemoryFolder();
  const store = new SyncMarkStore(folder);
  await store.importBundle(bundle);
  return { store, bundle };
}

export async function persistStore(
  store: SyncMarkStore,
  pairingSecret?: string,
): Promise<SyncMarkBundle> {
  const bundle = await store.exportBundle(pairingSecret);
  await saveSessionBundle(bundle);
  return bundle;
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

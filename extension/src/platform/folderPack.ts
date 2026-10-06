import type { SyncMarkStore } from "../core/store.js";
import { downloadBlob, zipStoreFiles } from "./zipStore.js";

/** Download a zip of the SyncMark on-disk layout for Firefox / portable sync. */
export async function downloadSyncMarkFolderPack(
  store: SyncMarkStore,
  zipName = "SyncMark-folder.zip",
): Promise<void> {
  const bundle = await store.exportBundle();
  const changelog =
    bundle.changelog.map((o) => JSON.stringify(o)).join("\n") +
    (bundle.changelog.length ? "\n" : "");
  downloadBlob(
    zipName,
    zipStoreFiles({
      "space.json": JSON.stringify(bundle.space, null, 2),
      "changelog.jsonl": changelog,
      "snapshots/bookmarks.json": JSON.stringify(bundle.bookmarks, null, 2),
      "health.json": JSON.stringify(bundle.health ?? {}, null, 2),
    }),
  );
}

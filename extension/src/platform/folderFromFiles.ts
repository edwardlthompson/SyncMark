import { MemoryFolder } from "../core/memoryFolder.js";

const NEEDED = ["space.json", "snapshots/bookmarks.json"] as const;

/**
 * Build a MemoryFolder from a directory file input (webkitdirectory / Firefox).
 * Accepts either flat SyncMark root files or a single top-level folder containing them.
 */
export async function memoryFolderFromFileList(files: FileList | File[]): Promise<{
  folder: MemoryFolder;
  rootLabel: string;
}> {
  const list = Array.from(files as ArrayLike<File>);
  if (!list.length) throw new Error("No files selected.");

  const entries: Array<{ rel: string; file: File }> = list.map((file) => {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath?.replace(/\\/g, "/") ||
      file.name;
    return { rel, file };
  });

  const spaceEntry = entries.find((e) => e.rel === "space.json" || e.rel.endsWith("/space.json"));
  if (!spaceEntry) {
    throw new Error(
      "No space.json in that folder. Pick the SyncMark folder Chrome created (the one that contains space.json).",
    );
  }

  const prefix =
    spaceEntry.rel === "space.json" ? "" : spaceEntry.rel.slice(0, -"space.json".length);
  const rootLabel = prefix.replace(/\/$/, "").split("/").filter(Boolean).pop() || "SyncMark";

  const folder = new MemoryFolder();
  for (const { rel, file } of entries) {
    if (prefix && !rel.startsWith(prefix)) continue;
    const path = prefix ? rel.slice(prefix.length) : rel;
    if (!path || path.endsWith("/")) continue;
    await folder.writeText(path, await file.text());
  }

  for (const need of NEEDED) {
    if (!(await folder.readText(need))) {
      throw new Error(`Missing ${need} in the SyncMark folder.`);
    }
  }
  return { folder, rootLabel };
}

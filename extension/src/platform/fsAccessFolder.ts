import type { FolderPort } from "../core/types.js";

/** File System Access API adapter for a user-chosen SyncMark root folder. */
export class FsAccessFolder implements FolderPort {
  constructor(private root: FileSystemDirectoryHandle) {}

  get handle(): FileSystemDirectoryHandle {
    return this.root;
  }

  async readText(path: string): Promise<string | null> {
    try {
      const file = await this.getFileHandle(path, false);
      if (!file) return null;
      const blob = await file.getFile();
      return await blob.text();
    } catch {
      return null;
    }
  }

  async writeText(path: string, content: string): Promise<void> {
    const file = await this.getFileHandle(path, true);
    if (!file) throw new Error(`Cannot write ${path}`);
    const writable = await file.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async list(prefix = ""): Promise<string[]> {
    const parts = prefix.replace(/\/$/, "").split("/").filter(Boolean);
    let dir = this.root;
    try {
      for (const p of parts) {
        dir = await dir.getDirectoryHandle(p, { create: false });
      }
    } catch {
      return [];
    }
    const out: string[] = [];
    const base = parts.length ? `${parts.join("/")}/` : "";
    const dirAny = dir as FileSystemDirectoryHandle & {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    for await (const [name, handle] of dirAny.entries()) {
      if (handle.kind === "file") out.push(`${base}${name}`);
      else if (handle.kind === "directory") {
        const nested = new FsAccessFolder(handle as FileSystemDirectoryHandle);
        const kids = await nested.list("");
        for (const k of kids) out.push(`${base}${name}/${k}`);
      }
    }
    return out;
  }

  private async getFileHandle(
    path: string,
    create: boolean,
  ): Promise<FileSystemFileHandle | null> {
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) return null;
    let dir = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create });
    }
    try {
      return await dir.getFileHandle(parts[parts.length - 1], { create });
    } catch {
      return null;
    }
  }
}

export function canPickDirectory(): boolean {
  return typeof globalThis.showDirectoryPicker === "function";
}

export async function pickSyncMarkDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!canPickDirectory()) {
    throw new Error(
      "This browser cannot open a folder picker here. Use Chrome, Edge, or Brave for folder sync.",
    );
  }
  return globalThis.showDirectoryPicker({
    id: "syncmark-root",
    mode: "readwrite",
    startIn: "documents",
  });
}

export async function ensureReadWrite(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

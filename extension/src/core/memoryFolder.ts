import type { FolderPort } from "./types.js";

export class MemoryFolder implements FolderPort {
  private files = new Map<string, string>();

  async readText(path: string): Promise<string | null> {
    return this.files.has(path) ? (this.files.get(path) ?? null) : null;
  }

  async writeText(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async list(prefix = ""): Promise<string[]> {
    return [...this.files.keys()].filter((k) => k.startsWith(prefix));
  }

  dump(): Record<string, string> {
    return Object.fromEntries(this.files);
  }
}

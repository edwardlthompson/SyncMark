import type { FolderPort } from "../core/types.js";

const HOST = "com.syncmark.host";
const ENABLED_KEY = "syncmark.native";
const TIMEOUT_MS = 8000;

type Pending = { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void };

export async function nativeEnabled(): Promise<boolean> {
  return ((await chrome.storage.local.get(ENABLED_KEY))[ENABLED_KEY] as boolean | undefined) === true;
}

export async function setNativeEnabled(on: boolean): Promise<void> {
  await chrome.storage.local.set({ [ENABLED_KEY]: on });
}

/** One connection to the native helper per extension context (service worker, options, popup). */
export class NativeClient {
  private port: chrome.runtime.Port;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private listeners = new Set<(path: string) => void>();
  closed = false;
  root = "";

  constructor() {
    this.port = chrome.runtime.connectNative(HOST);
    this.port.onMessage.addListener((msg: Record<string, unknown>) => {
      if (msg.event === "changed") {
        for (const l of this.listeners) l(String(msg.path ?? ""));
        return;
      }
      const p = this.pending.get(msg.id as number);
      if (!p) return;
      this.pending.delete(msg.id as number);
      if (msg.ok === false) p.reject(new Error(String(msg.error ?? "helper error")));
      else p.resolve(msg);
    });
    this.port.onDisconnect.addListener(() => {
      this.closed = true;
      const err = new Error(chrome.runtime.lastError?.message ?? "SyncMark helper disconnected");
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      this.onClosed?.();
    });
  }

  onClosed?: () => void;

  request(cmd: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    if (this.closed) return Promise.reject(new Error("SyncMark helper is not running"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`helper timed out (${cmd})`));
      }, TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      this.port.postMessage({ id, cmd, ...args });
    });
  }

  onChange(cb: (path: string) => void): void {
    this.listeners.add(cb);
  }
}

let shared: NativeClient | null = null;

/** Connected helper client, or null when it is not installed / not reachable. */
export async function getNativeClient(): Promise<NativeClient | null> {
  if (typeof chrome === "undefined" || typeof chrome.runtime?.connectNative !== "function") return null;
  if (shared && !shared.closed) return shared;
  const client = new NativeClient();
  try {
    const pong = await client.request("ping");
    client.root = String(pong.root ?? "");
    client.onClosed = () => {
      if (shared === client) shared = null;
    };
    shared = client;
    return client;
  } catch {
    return null;
  }
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** FolderPort backed by the native helper (same files both browsers share). */
export class NativeFolder implements FolderPort {
  constructor(private client: NativeClient) {}

  get rootName(): string {
    return this.client.root.split(/[\\/]/).filter(Boolean).pop() ?? "SyncMark";
  }

  async readText(path: string): Promise<string | null> {
    const parts: Uint8Array[] = [];
    let offset = 0;
    for (;;) {
      const r = await this.client.request("read", { path, offset });
      if (!r.exists) return null;
      const bytes = fromBase64(String(r.data ?? ""));
      parts.push(bytes);
      offset += bytes.length;
      if (r.eof || !bytes.length) break;
    }
    const all = new Uint8Array(offset);
    let at = 0;
    for (const p of parts) (all.set(p, at), (at += p.length));
    return new TextDecoder().decode(all);
  }

  async writeText(path: string, content: string): Promise<void> {
    await this.client.request("write", { path, content });
  }

  async list(prefix = ""): Promise<string[]> {
    return ((await this.client.request("list", { prefix })).files as string[]) ?? [];
  }
}

export async function openNativeFolder(): Promise<NativeFolder | null> {
  if (!(await nativeEnabled())) return null;
  const client = await getNativeClient();
  return client ? new NativeFolder(client) : null;
}

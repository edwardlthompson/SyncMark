// Pure-ish helpers for the SyncMark native messaging host (no dependencies).
import { mkdir, open, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export const CHUNK_BYTES = 256 * 1024;

/** Resolve `rel` inside `root`; throws if it escapes the root. */
export function resolveSafe(root, rel) {
  const base = resolve(root);
  const full = resolve(base, String(rel).replace(/^[/\\]+/, ""));
  if (full !== base && !full.startsWith(base + sep)) throw new Error("path escapes root");
  return full;
}

/** Read up to CHUNK_BYTES at `offset`. Returns { exists, size, data(base64), eof }. */
export async function readChunk(root, rel, offset = 0) {
  const full = resolveSafe(root, rel);
  let info;
  try {
    info = await stat(full);
  } catch {
    return { exists: false, size: 0, data: "", eof: true };
  }
  if (!info.isFile()) return { exists: false, size: 0, data: "", eof: true };
  const len = Math.max(0, Math.min(CHUNK_BYTES, info.size - offset));
  const buf = Buffer.alloc(len);
  if (len) {
    const fh = await open(full, "r");
    try {
      await fh.read(buf, 0, len, offset);
    } finally {
      await fh.close();
    }
  }
  return { exists: true, size: info.size, data: buf.toString("base64"), eof: offset + len >= info.size };
}

/** Write atomically (temp file in the same dir, then rename) so the other browser never reads a partial file. */
export async function writeAtomic(root, rel, content) {
  const full = resolveSafe(root, rel);
  await mkdir(dirname(full), { recursive: true });
  const tmp = join(dirname(full), `.${Date.now()}-${process.pid}.tmp`);
  await writeFile(tmp, content, "utf8");
  for (let i = 0; ; i++) {
    try {
      await rename(tmp, full);
      return;
    } catch (err) {
      if (i >= 5) throw err;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
}

/** Recursive file list under `prefix` (relative, forward slashes). */
export async function listFiles(root, prefix = "") {
  const base = resolveSafe(root, prefix);
  const out = [];
  async function walk(dir, rel) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.endsWith(".tmp")) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(join(dir, e.name), r);
      else out.push(r);
    }
  }
  const start = prefix.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  await walk(base, start);
  return out;
}

/** Native messaging framing: 4-byte little-endian length + UTF-8 JSON. */
export function encodeMessage(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length, 0);
  return Buffer.concat([head, body]);
}

/** Incremental decoder: push chunks, get complete messages. */
export function createDecoder(onMessage) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32LE(0);
      if (buf.length < 4 + len) return;
      const body = buf.subarray(4, 4 + len).toString("utf8");
      buf = buf.subarray(4 + len);
      try {
        onMessage(JSON.parse(body));
      } catch {
        /* ignore malformed frame */
      }
    }
  };
}

/** Handle one request against `root`. Returns the response payload (without id). */
export async function handleRequest(root, req) {
  switch (req.cmd) {
    case "ping":
      return { ok: true, root, version: 1 };
    case "read":
      return { ok: true, ...(await readChunk(root, req.path, req.offset ?? 0)) };
    case "write":
      await writeAtomic(root, req.path, String(req.content ?? ""));
      return { ok: true };
    case "list":
      return { ok: true, files: await listFiles(root, req.prefix ?? "") };
    default:
      return { ok: false, error: `unknown cmd ${req.cmd}` };
  }
}

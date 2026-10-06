import type { Bookmark, HealthMap, HealthRecord, HealthStatus } from "../types.js";

export interface FetchLike {
  (url: string, init?: { method?: string; redirect?: RequestRedirect; signal?: AbortSignal }): Promise<{
    status: number;
    ok: boolean;
    url: string;
  }>;
}

export interface CheckOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Prefer GET (more reliable for recheck); default HEAD-then-GET. */
  preferGet?: boolean;
  /** Max parallel checks (default 8). */
  concurrency?: number;
  /** Skip bookmarks checked within this window unless force (default 24h). */
  staleAfterMs?: number;
  force?: boolean;
  gapMs?: number;
  now?: () => string;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}

function classify(status: number, finalUrl: string, original: string): HealthStatus {
  if (status >= 200 && status < 300) {
    try {
      const a = new URL(original);
      const b = new URL(finalUrl);
      if (a.origin !== b.origin || a.pathname !== b.pathname) return "redirect";
    } catch {
      /* ignore */
    }
    return "ok";
  }
  if (status === 401 || status === 403) return "ok";
  // Only clear gone pages count as dead — 5xx/timeouts are often temporary.
  if (status === 404 || status === 410) return "dead";
  if (status >= 500) return "error";
  if (status === 0) return "error";
  return "error";
}

async function fetchOnce(
  fetchImpl: FetchLike,
  url: string,
  method: "HEAD" | "GET",
  signal: AbortSignal,
): Promise<{ status: number; ok: boolean; url: string }> {
  return fetchImpl(url, { method, redirect: "follow", signal });
}

export async function checkBookmarkLink(
  bookmark: Bookmark,
  opts: CheckOptions = {},
): Promise<HealthRecord> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const now = opts.now ?? (() => new Date().toISOString());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: { status: number; ok: boolean; url: string };
    if (opts.preferGet) {
      res = await fetchOnce(fetchImpl, bookmark.url, "GET", controller.signal);
    } else {
      try {
        res = await fetchOnce(fetchImpl, bookmark.url, "HEAD", controller.signal);
        if (res.status === 405 || res.status === 501 || res.status === 403) {
          res = await fetchOnce(fetchImpl, bookmark.url, "GET", controller.signal);
        }
      } catch {
        res = await fetchOnce(fetchImpl, bookmark.url, "GET", controller.signal);
      }
    }
    return {
      status: classify(res.status, res.url, bookmark.url),
      checkedAt: now(),
      httpStatus: res.status,
    };
  } catch (err) {
    return {
      status: "error",
      checkedAt: now(),
      detail: err instanceof Error ? err.message : "Request failed / timed out",
    };
  } finally {
    clearTimeout(timer);
  }
}

function isFresh(record: HealthRecord | undefined, staleAfterMs: number, nowIso: string): boolean {
  if (!record?.checkedAt || staleAfterMs <= 0) return false;
  const age = Date.parse(nowIso) - Date.parse(record.checkedAt);
  return Number.isFinite(age) && age >= 0 && age < staleAfterMs;
}

/** Concurrent, advisory link checks. Never deletes bookmarks. */
export async function checkLinks(
  bookmarks: Bookmark[],
  existing: HealthMap = {},
  opts: CheckOptions = {},
): Promise<HealthMap> {
  const concurrency = Math.max(1, opts.concurrency ?? 8);
  const staleAfterMs = opts.staleAfterMs ?? 24 * 60 * 60 * 1000;
  const nowIso = (opts.now ?? (() => new Date().toISOString()))();
  const next: HealthMap = { ...existing };

  const queue = opts.force
    ? bookmarks
    : bookmarks.filter((b) => !isFresh(existing[b.id], staleAfterMs, nowIso));

  let done = 0;
  const total = queue.length;
  opts.onProgress?.(0, total);

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const i = cursor;
      cursor += 1;
      const b = queue[i];
      next[b.id] = await checkBookmarkLink(b, opts);
      done += 1;
      opts.onProgress?.(done, total);
      if (opts.gapMs && opts.gapMs > 0) {
        const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
        await sleep(opts.gapMs);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(queue.length, 1)) }, () =>
    worker(),
  );
  if (queue.length) await Promise.all(workers);
  return next;
}

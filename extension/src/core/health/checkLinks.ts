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
  gapMs?: number;
  now?: () => string;
  sleep?: (ms: number) => Promise<void>;
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
  if (status === 401 || status === 403) return "ok"; // login wall — not treated as dead
  if (status === 404 || status === 410 || status >= 500) return "dead";
  if (status === 0) return "error";
  return "error";
}

export async function checkBookmarkLink(
  bookmark: Bookmark,
  opts: CheckOptions = {},
): Promise<HealthRecord> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const now = opts.now ?? (() => new Date().toISOString());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: { status: number; ok: boolean; url: string };
    try {
      res = await fetchImpl(bookmark.url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });
    } catch {
      res = await fetchImpl(bookmark.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
    }
    if (res.status === 405 || res.status === 501) {
      res = await fetchImpl(bookmark.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
    }
    const status = classify(res.status, res.url, bookmark.url);
    return { status, checkedAt: now(), httpStatus: res.status };
  } catch (err) {
    return {
      status: "error",
      checkedAt: now(),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Rate-limited advisory checks. Never deletes bookmarks. */
export async function checkLinks(
  bookmarks: Bookmark[],
  existing: HealthMap = {},
  opts: CheckOptions = {},
): Promise<HealthMap> {
  const gapMs = opts.gapMs ?? 200;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const next: HealthMap = { ...existing };
  for (let i = 0; i < bookmarks.length; i++) {
    const b = bookmarks[i];
    next[b.id] = await checkBookmarkLink(b, opts);
    if (i < bookmarks.length - 1 && gapMs > 0) await sleep(gapMs);
  }
  return next;
}

import type { FolderPort } from "./types.js";

export interface SyncIssue {
  at: string;
  deviceId: string;
  phase: string;
  level: "error" | "warn" | "info";
  message: string;
  detail?: string;
  browser?: string;
}

const ISSUES_DIR = "diagnostics/";

export function syncIssuesPath(deviceId: string): string {
  return `${ISSUES_DIR}${deviceId}-sync-issues.jsonl`;
}

export function formatSyncIssue(issue: SyncIssue): string {
  return `${JSON.stringify(issue)}\n`;
}

export function parseSyncIssues(raw: string | null): SyncIssue[] {
  if (!raw?.trim()) return [];
  const out: SyncIssue[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as SyncIssue);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function appendSyncIssueFile(
  folder: FolderPort,
  deviceId: string,
  issue: SyncIssue,
): Promise<void> {
  const path = syncIssuesPath(deviceId);
  const prev = (await folder.readText(path)) ?? "";
  await folder.writeText(path, prev + formatSyncIssue(issue));
}

export async function readRecentSyncIssues(
  folder: FolderPort,
  deviceId: string,
  limit = 40,
): Promise<SyncIssue[]> {
  const local = parseSyncIssues(await folder.readText(syncIssuesPath(deviceId)));
  let all = local;
  if (folder.list) {
    try {
      const files = await folder.list(ISSUES_DIR);
      for (const f of files) {
        if (!f.endsWith("-sync-issues.jsonl")) continue;
        if (f.endsWith(`${deviceId}-sync-issues.jsonl`)) continue;
        all = all.concat(parseSyncIssues(await folder.readText(f)));
      }
    } catch {
      /* ignore */
    }
  }
  return all.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

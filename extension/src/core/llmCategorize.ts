import { folderKey, normalizeFolderPath } from "./bookmarkRoots.js";
import { canonicalizeParts } from "./folderTaxonomy.js";
import type { Bookmark, Suggestion } from "./types.js";

/** Import side of manual "bring your own LLM" bulk categorization. */

const isUrl = (c: string): boolean => /^https?:\/\//i.test(c);

export interface LlmSuggestionRow {
  bookmark: Bookmark;
  suggestion: Suggestion;
}

export interface LlmImportResult {
  rows: LlmSuggestionRow[];
  unmatched: number;
  rejected: number;
  unchanged: number;
  /** Distinct folders in this answer, and how many hold just one link (a sign of loose categories). */
  folders?: number;
  singletons?: number;
}

/** Split an LLM folder answer and canonicalize it (≤2 levels, canonical top-level, no generic subfolder). */
export function normalizeFolder(raw: string): string[] | null {
  const parts = raw
    .replace(/[`*_]/g, "")
    .split(/\s*(?:\/|>|›|»|\\)\s*/)
    .map((p) => p.replace(/\s+/g, " ").trim().slice(0, 48))
    .filter(Boolean);
  return canonicalizeParts(parts);
}

function keyIndex(all: Bookmark[]): Map<string, Bookmark | null> {
  const byKey = new Map<string, Bookmark | null>();
  for (const len of [8, 12, 32]) {
    for (const b of all) {
      const k = b.id.replace(/-/g, "").slice(0, len).toLowerCase();
      byKey.set(k, byKey.has(k) && byKey.get(k) !== b ? null : b);
    }
  }
  return byKey;
}

export function parseCategorizedMarkdown(text: string, all: Bookmark[]): LlmImportResult {
  const byKey = keyIndex(all);
  const byUrl = new Map(all.map((b) => [b.url, b]));
  const folderKeys = new Set(all.map((o) => folderKey(normalizeFolderPath(o.folderPath ?? []))));
  const seen = new Set<string>();
  const result: LlmImportResult = { rows: [], unmatched: 0, rejected: 0, unchanged: 0 };

  for (const line of text.split(/\r?\n/)) {
    const cells = line
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
      .split("|")
      .map((c) => c.replace(/[`*]/g, "").trim())
      .filter(Boolean);
    if (cells.length < 2 || /^[-: ]+$/.test(cells[0]) || /^key$/i.test(cells[0])) continue;
    const key = cells[0].replace(/-/g, "").toLowerCase();
    const keyed = byKey.get(key);
    const bookmark = keyed ?? byUrl.get(cells.find(isUrl) ?? "");
    const folderCell = [...cells.slice(1)].reverse().find((c) => !isUrl(c));
    if (!bookmark && !/^[0-9a-f]{6,32}$/.test(key)) continue;
    if (!bookmark || !folderCell) {
      result.unmatched += 1;
      continue;
    }
    if (seen.has(bookmark.id)) continue;
    seen.add(bookmark.id);
    const sub = normalizeFolder(folderCell);
    if (!sub) {
      result.rejected += 1;
      continue;
    }
    const folderPath = normalizeFolderPath(sub); // default root: Bookmarks Toolbar
    const joined = folderKey(folderPath);
    const same = folderKey(normalizeFolderPath(bookmark.folderPath ?? [])) === joined;
    if (same) result.unchanged += 1;
    if (same && bookmark.categoryLocked) continue; // already final: nothing to review
    result.rows.push({
      bookmark,
      suggestion: {
        category: sub[sub.length - 1],
        tags: sub.map((s) => s.toLowerCase()),
        reason: same ? "Your LLM agrees with the current folder (accept to lock it)" : "From your LLM’s bulk answer",
        createFolder: !folderKeys.has(joined),
        folderPath,
      },
    });
  }
  const perFolder = new Map<string, number>();
  for (const r of result.rows) {
    const k = folderKey(r.suggestion.folderPath ?? []);
    perFolder.set(k, (perFolder.get(k) ?? 0) + 1);
  }
  result.folders = perFolder.size;
  result.singletons = [...perFolder.values()].filter((n) => n === 1).length;
  return result;
}

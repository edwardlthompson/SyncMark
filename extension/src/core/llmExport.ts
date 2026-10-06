import { canonicalizeParts } from "./folderTaxonomy.js";
import { promptRules, taxonomyLines } from "./llmPrompt.js";
import type { Bookmark } from "./types.js";

/** Export side of manual "bring your own LLM" bulk categorization. Exports never change any data. */

export const LLM_EXPORT_DEFAULT_BATCH = 150;
export const ROOT_RE = /toolbar|bookmarks bar|bookmarks menu|other bookmarks/i;

export type LlmScope = "uncategorized" | "all";

export interface LlmExportResult {
  markdown: string;
  count: number;
  part: number;
  parts: number;
  total: number;
}

/** Short stable keys (uuid prefix; lengthened on collision) for LLM round-trips. */
export function llmKeys(bookmarks: Bookmark[]): Map<string, Bookmark> {
  for (const len of [8, 12, 32]) {
    const out = new Map<string, Bookmark>();
    for (const b of bookmarks) out.set(b.id.replace(/-/g, "").slice(0, len).toLowerCase(), b);
    if (out.size === bookmarks.length) return out;
  }
  return new Map(bookmarks.map((b) => [b.id.replace(/-/g, "").toLowerCase(), b]));
}

const subPath = (b: Bookmark): string[] => (b.folderPath ?? []).filter((p) => !ROOT_RE.test(p));

function folderUsage(bookmarks: Bookmark[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const b of bookmarks) {
    const parts = canonicalizeParts(subPath(b));
    if (!parts) continue;
    const label = parts.join(" / ");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 120);
}

export function exportMarkdownForLlm(
  all: Bookmark[],
  opts: { scope?: LlmScope; batchSize?: number; part?: number } = {},
): LlmExportResult {
  const scope = opts.scope ?? "uncategorized";
  const size = Math.max(1, Math.floor(opts.batchSize ?? LLM_EXPORT_DEFAULT_BATCH));
  const pool = scope === "all" ? all : all.filter((b) => !b.categoryLocked);
  const parts = Math.max(1, Math.ceil(pool.length / size));
  const part = Math.min(Math.max(1, Math.floor(opts.part ?? 1)), parts);
  const batch = pool.slice((part - 1) * size, part * size);
  const keys = llmKeys(batch);
  const keyOf = new Map([...keys].map(([k, b]) => [b.id, k]));
  const sample = [...keys.keys()];
  const usage = folderUsage(scope === "all" ? all : all.filter((b) => b.categoryLocked));
  const extraTop = [...new Set(usage.map(([label]) => label.split(" / ")[0]))];
  const lines = [
    "# SyncMark — categorize these bookmarks",
    "",
    `Part ${part} of ${parts} · ${batch.length} links · ${scope === "all" ? "re-checking ALL links" : "uncategorized links only"}`,
    "",
    "## Instructions for the AI assistant",
    "",
    ...promptRules({ refine: scope === "all" }),
    "",
    "Example lines:",
    "```",
    `${sample[0] ?? "a1b2c3d4"} | Gaming / Elite`,
    `${sample[1] ?? "e5f6a7b8"} | Music / Karaoke`,
    "```",
    "",
    "## Allowed top-level folders",
    "",
    ...taxonomyLines(extraTop),
    "",
    "## Existing folders (reuse these subfolders when they fit)",
    "",
    ...(usage.length ? usage.map(([f, n]) => `- ${f} (${n})`) : ["- (none yet — create specific ones)"]),
    "",
    `## Links (${batch.length})`,
    "",
    "KEY | Title | URL | Current folder",
  ];
  for (const b of batch) {
    const title = (b.title || "(untitled)").replace(/[|\r\n]+/g, " ").trim().slice(0, 120);
    const cur = subPath(b).join(" / ") || "-";
    lines.push(`${keyOf.get(b.id)} | ${title} | ${b.url.replace(/\|/g, "%7C")} | ${cur}`);
  }
  return { markdown: lines.join("\n") + "\n", count: batch.length, part, parts, total: pool.length };
}

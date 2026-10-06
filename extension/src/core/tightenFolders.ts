import { folderKey, normalizeFolderPath } from "./bookmarkRoots.js";
import { canonicalTopLevel, isGenericSub, shortName } from "./folderTaxonomy.js";
import { ROOT_RE } from "./llmExport.js";
import type { LlmSuggestionRow } from "./llmCategorize.js";
import type { Bookmark } from "./types.js";

/**
 * Local (no AI) cleanup of folders SyncMark already filed: Games → Gaming, Audio/Music → Music,
 * long names shortened (Automotive → Auto), generic subfolders (Tools, Guides, …) dropped.
 * Only touches locked bookmarks; depth is never truncated.
 */
export function suggestTightening(all: Bookmark[]): LlmSuggestionRow[] {
  const rows: LlmSuggestionRow[] = [];
  for (const bookmark of all) {
    if (!bookmark.categoryLocked) continue;
    const path = (bookmark.folderPath ?? []).filter((p) => !ROOT_RE.test(p));
    if (!path.length) continue;
    const top = canonicalTopLevel(path[0]);
    const rest = path
      .slice(1)
      .filter((p) => !isGenericSub(p) && p.toLowerCase() !== top.toLowerCase())
      .map((p) => shortName(p));
    const root = bookmark.folderPath?.[0] && ROOT_RE.test(bookmark.folderPath[0]) ? [bookmark.folderPath[0]] : [];
    const next = normalizeFolderPath([...root, top, ...rest]); // keep the link on its current root
    if (folderKey(next) === folderKey(normalizeFolderPath(bookmark.folderPath ?? []))) continue;
    rows.push({
      bookmark,
      suggestion: {
        category: next[next.length - 1],
        tags: bookmark.tags,
        reason: `Tighten “${path.join(" / ")}” → “${next.slice(1).join(" / ")}” (merge synonyms, shorter names)`,
        createFolder: false,
        folderPath: next,
      },
    });
  }
  return rows;
}

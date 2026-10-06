import { lookupDomainCategory, mapToExistingFolder } from "./domainCatalog.js";
import { canonicalTopLevel, shortName } from "./folderTaxonomy.js";
import type { Bookmark, Suggestion } from "./types.js";

function existingFolders(bookmarks: Bookmark[]): Set<string> {
  const set = new Set<string>();
  for (const b of bookmarks) {
    for (const part of b.folderPath ?? []) if (part) set.add(part);
    if (b.category) set.add(b.category);
  }
  return set;
}

function titleCaseHostBrand(url: string, siteName?: string): string {
  if (siteName?.trim()) {
    return siteName.trim().replace(/\s+/g, " ").slice(0, 48);
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    // drop TLD-ish last part when 2+ labels
    const brand = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  } catch {
    return "Unsorted";
  }
}

function heuristicCategory(
  input: Pick<Bookmark, "url" | "title"> & { siteName?: string },
): Suggestion {
  const hit = lookupDomainCategory(input.url, input.title);
  if (hit && hit.category.toLowerCase() !== "general") {
    // Same short, canonical vocabulary as the AI path (Development → Dev, Media → Video/Music, …).
    const isAudio = hit.tags.some((t) => /music|podcast|audio/i.test(t));
    return { category: isAudio ? "Music" : canonicalTopLevel(hit.category), tags: hit.tags, reason: hit.reason };
  }
  const brand = shortName(titleCaseHostBrand(input.url, input.siteName), 14);
  return {
    category: brand,
    tags: [brand.toLowerCase()],
    reason: `Specific site folder “${brand}” (no vague General bucket)`,
  };
}

/** Suggest a folder/category, preferring folders that already exist in the space. */
export function suggestCategory(
  input: Pick<Bookmark, "url" | "title"> &
    Partial<Pick<Bookmark, "folderPath" | "category">> & { siteName?: string },
  knownBookmarks: Bookmark[] = [],
): Suggestion {
  const base = heuristicCategory(input);
  const folders = existingFolders(knownBookmarks);

  const mapped = mapToExistingFolder(base.category, folders);
  if (mapped) {
    return {
      ...base,
      category: mapped,
      createFolder: false,
      folderPath: [...(input.folderPath?.slice(0, -1) ?? []), mapped],
      reason: `${base.reason} → your folder “${mapped}”`,
    };
  }

  for (const name of folders) {
    if (/^(other bookmarks|bookmarks (bar|toolbar|menu)|general)$/i.test(name)) continue;
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(input.title) || re.test(input.url)) {
      return {
        category: name,
        tags: base.tags,
        reason: `Fits your existing “${name}” folder`,
        createFolder: false,
        folderPath: [...(input.folderPath?.slice(0, -1) ?? []), name],
      };
    }
  }

  return {
    ...base,
    createFolder: !folders.has(base.category),
    reason: folders.has(base.category)
      ? base.reason
      : `${base.reason} — create folder “${base.category}”`,
    folderPath: [base.category],
  };
}

/** Only unlocked bookmarks are candidates for scan/suggest. */
export function reviewSuggestions(
  bookmarks: Bookmark[],
): Array<{ bookmark: Bookmark; suggestion: Suggestion; differs: boolean }> {
  return bookmarks
    .filter((b) => !b.categoryLocked)
    .map((bookmark) => {
      const suggestion = suggestCategory(bookmark, bookmarks);
      return {
        bookmark,
        suggestion,
        differs: suggestion.category !== bookmark.category,
      };
    });
}

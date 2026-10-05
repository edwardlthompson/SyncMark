import type { Bookmark, Suggestion } from "./types.js";

const DOMAIN_RULES: Array<{ match: RegExp; category: string; tags: string[]; reason: string }> = [
  { match: /github\.com|gitlab\.com|bitbucket\.org/i, category: "Development", tags: ["code"], reason: "Code hosting domain" },
  { match: /stackoverflow\.com|stackexchange\.com|mdn\.io|developer\.mozilla/i, category: "Development", tags: ["docs"], reason: "Developer docs" },
  { match: /youtube\.com|youtu\.be|vimeo\.com|netflix\.com/i, category: "Media", tags: ["video"], reason: "Video site" },
  { match: /nytimes\.com|bbc\.(com|co\.uk)|theguardian\.com|reuters\.com/i, category: "News", tags: ["news"], reason: "News domain" },
  { match: /amazon\.|ebay\.|etsy\.|shopify\./i, category: "Shopping", tags: ["shop"], reason: "Shopping domain" },
  { match: /mail\.google\.com|outlook\.|proton\.me/i, category: "Productivity", tags: ["email"], reason: "Mail service" },
  { match: /docs\.google\.com|notion\.so|dropbox\.com|drive\.google/i, category: "Productivity", tags: ["docs"], reason: "Docs / files" },
  { match: /twitter\.com|x\.com|linkedin\.com|facebook\.com|instagram\.com/i, category: "Social", tags: ["social"], reason: "Social network" },
  { match: /wikipedia\.org/i, category: "Reference", tags: ["wiki"], reason: "Wikipedia" },
];

const TITLE_RULES: Array<{ match: RegExp; category: string; tags: string[]; reason: string }> = [
  { match: /\brecipe\b|\bcook(ing)?\b/i, category: "Food", tags: ["recipe"], reason: "Title mentions cooking" },
  { match: /\btutorial\b|\bhow to\b|\bguide\b/i, category: "Learning", tags: ["tutorial"], reason: "Title looks like a guide" },
];

export function suggestCategory(input: Pick<Bookmark, "url" | "title">): Suggestion {
  for (const rule of DOMAIN_RULES) {
    if (rule.match.test(input.url)) {
      return { category: rule.category, tags: rule.tags, reason: rule.reason };
    }
  }
  for (const rule of TITLE_RULES) {
    if (rule.match.test(input.title)) {
      return { category: rule.category, tags: rule.tags, reason: rule.reason };
    }
  }
  try {
    const host = new URL(input.url).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] || "General";
    return {
      category: "General",
      tags: [label.toLowerCase()],
      reason: "Default suggestion from domain",
    };
  } catch {
    return { category: "General", tags: [], reason: "Default suggestion" };
  }
}

export function reviewSuggestions(
  bookmarks: Bookmark[],
): Array<{ bookmark: Bookmark; suggestion: Suggestion; differs: boolean }> {
  return bookmarks.map((bookmark) => {
    const suggestion = suggestCategory(bookmark);
    return {
      bookmark,
      suggestion,
      differs: suggestion.category !== bookmark.category,
    };
  });
}

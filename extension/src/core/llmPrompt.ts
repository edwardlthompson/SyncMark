import { MAX_SUB_LEN, TOP_LEVEL_FOLDERS } from "./folderTaxonomy.js";

/** Instructions embedded at the top of every export so each file works on its own. */

export function promptRules(opts: { refine: boolean }): string[] {
  return [
    "You are organizing browser bookmarks into a tight, consistent, SHORT-named folder structure.",
    "For EVERY link below, choose exactly one folder using its title, URL, and what you know (or can look up) about the site.",
    "",
    "Rules (all mandatory):",
    "1. Exactly two levels: `Top-level / Subfolder`. The top-level MUST be copied exactly from “Allowed top-level folders” below (they are deliberately short). Only propose a brand-new top-level if at least 10 links in this file fit nowhere else, and keep it to one short word.",
    `2. Keep names SHORT so they fit on a bookmarks bar: subfolders ≤ ${MAX_SUB_LEN} characters (aim for ≤ 12), one or two words. Abbreviate freely: \`Mustang\` not \`Ford Mustang\`, \`Cyberpunk\` not \`Cyberpunk 2077\`, \`Photo\` not \`Photography\`. No “The”, no “&”/“and” lists, no trailing words like Guides, Tools, Community, Resources.`,
    "3. The subfolder is the specific subject: a game title, product type, brand, hobby, activity or place (e.g. `Gaming / Elite`, `Hardware / Monitors`, `Auto / Mustang`). Never generic: Tools, Resources, Guides, Tips, Misc, Other, General, Links, Websites, Info, Stuff.",
    "4. Anything even remotely related to games (titles, guides, mods, stats, stores, launchers, communities, game news) goes under `Gaming`. Never use `Games`.",
    "5. Audio and music are ONE top-level folder: `Music` (songs, podcasts, karaoke, audio production, sound libraries, audio gear).",
    "6. One topic lives in exactly one place. Decide by the page’s primary purpose (e.g. Android app development → `Dev / Android`; Android phones and OS → `Mobile / Android`).",
    "7. Be consistent: identical spelling, capitalization and singular/plural for the same subfolder everywhere. Reuse an existing subfolder whenever one fits.",
    "8. Avoid one-off subfolders: if a subfolder would hold fewer than 3 links in this file and is not already listed under “Existing folders”, use the closest broader subfolder instead.",
    opts.refine
      ? "9. “Current folder” is shown for reference. Keep it only if it already follows every rule above; otherwise correct it (wrong top-level, long, generic or duplicate subfolder)."
      : "9. If unsure what a site is, look it up (web search / browsing). Do not guess from the domain name alone.",
    "10. Output EVERY link exactly once; skip none, add none.",
    "",
    "Return a **downloadable Markdown file** named `syncmark-categorized.md` (create a file, not chat text).",
    "Each line of the file must be exactly: `KEY | Top-level / Subfolder`",
    "KEY is copied unchanged from the list. No headers, tables, or commentary inside the file.",
  ];
}

export function taxonomyLines(extraTop: string[]): string[] {
  const known = new Set(TOP_LEVEL_FOLDERS.map((t) => t.name.toLowerCase()));
  return [
    ...TOP_LEVEL_FOLDERS.map((t) => `- ${t.name} — ${t.scope}`),
    ...extraTop.filter((n) => !known.has(n.toLowerCase())).map((n) => `- ${n} — (already in use in your bookmarks)`),
  ];
}

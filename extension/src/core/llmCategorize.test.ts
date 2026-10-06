import { describe, expect, it } from "vitest";
import { canonicalizeParts } from "./folderTaxonomy.js";
import { exportMarkdownForLlm, llmKeys } from "./llmExport.js";
import { normalizeFolder, parseCategorizedMarkdown } from "./llmCategorize.js";
import { suggestTightening } from "./tightenFolders.js";
import type { Bookmark } from "./types.js";

function bm(id: string, url: string, extra: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    url,
    title: `T ${id.slice(0, 4)}`,
    category: "Misc",
    tags: [],
    folderPath: ["Bookmarks Toolbar", "Misc"],
    createdAt: "t",
    updatedAt: "t",
    ...extra,
  };
}

const A = bm("aaaaaaaa-1111-4111-8111-111111111111", "https://rust-lang.org/");
const B = bm("bbbbbbbb-2222-4222-8222-222222222222", "https://bakingsite.example/x");
const L = bm("cccccccc-3333-4333-8333-333333333333", "https://locked.example/", {
  categoryLocked: true,
  folderPath: ["Bookmarks Toolbar", "Games", "Tools"],
});

describe("llm export", () => {
  it("exports only unlocked links with keys, tight rules, and the allowed taxonomy", () => {
    const r = exportMarkdownForLlm([A, B, L]);
    expect(r.count).toBe(2);
    expect(r.markdown).toContain("aaaaaaaa |");
    expect(r.markdown).not.toContain("locked.example");
    expect(r.markdown).toContain("**downloadable Markdown file**");
    expect(r.markdown).toContain("## Allowed top-level folders");
    expect(r.markdown).toContain("- Gaming — ");
    expect(r.markdown).toContain("- Music — ");
    expect(r.markdown).toContain("Never use `Games`");
    expect(r.markdown).toContain("Audio and music are ONE top-level folder");
    // existing folders are shown canonicalized (Games / Tools → Gaming)
    expect(r.markdown).toContain("- Gaming (1)");
  });

  it("can export all links again, including locked ones with their current folder", () => {
    const r = exportMarkdownForLlm([A, B, L], { scope: "all" });
    expect(r.count).toBe(3);
    expect(r.markdown).toContain("locked.example");
    expect(r.markdown).toContain("re-checking ALL links");
    expect(r.markdown).toContain("| Games / Tools");
    expect(exportMarkdownForLlm([A, B, L], { scope: "all" }).markdown).toBe(r.markdown); // repeatable
  });

  it("splits into parts that can each be exported repeatedly", () => {
    const p1 = exportMarkdownForLlm([A, B], { batchSize: 1, part: 1 });
    const p2 = exportMarkdownForLlm([A, B], { batchSize: 1, part: 2 });
    expect([p1.parts, p1.part, p1.count, p1.total]).toEqual([2, 1, 1, 2]);
    expect(p2.markdown).toContain("bbbbbbbb |");
    expect(exportMarkdownForLlm([A, B], { batchSize: 1, part: 9 }).part).toBe(2);
  });

  it("lengthens keys on prefix collision", () => {
    const x = bm("deadbeef-0000-4000-8000-000000000001", "https://x.example/");
    const y = bm("deadbeef-0000-4000-8000-000000000002", "https://y.example/");
    expect(llmKeys([x, y]).size).toBe(2);
  });
});

describe("llm import", () => {
  it("parses lines, tables, bullets; defaults to the bar; counts unmatched", () => {
    const text = [
      "```",
      "aaaaaaaa | Development / Rust",
      "```",
      "- `bbbbbbbb` | **Food** > Baking | https://bakingsite.example/x",
      "99999999 | Nope",
    ].join("\n");
    const r = parseCategorizedMarkdown(text, [A, B, L]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].suggestion.folderPath).toEqual(["Bookmarks Toolbar", "Dev", "Rust"]);
    expect(r.rows[1].suggestion.folderPath).toEqual(["Bookmarks Toolbar", "Food", "Baking"]);
    expect(r.unmatched).toBe(1);
    expect(r.folders).toBe(2);
    expect(r.singletons).toBe(2);
  });

  it("merges synonyms: Games→Gaming, Audio/Music→Music, drops generic subfolders", () => {
    expect(normalizeFolder("Games / Elite Dangerous")).toEqual(["Gaming", "Elite Dangerous"]);
    expect(normalizeFolder("Video Games / Guides")).toEqual(["Gaming"]);
    expect(normalizeFolder("Audio / Karaoke")).toEqual(["Music", "Karaoke"]);
    expect(normalizeFolder("Music / Resources")).toEqual(["Music"]);
    expect(normalizeFolder("Software / Tools")).toEqual(["Software"]);
    expect(normalizeFolder("Hardware / Benchmarks / Extra")).toEqual(["Hardware", "Benchmarks"]);
    expect(canonicalizeParts(["Gaming", "Gaming"])).toEqual(["Gaming"]);
  });

  it("rejects vague top-levels and falls back to URL match", () => {
    const r = parseCategorizedMarkdown("aaaaaaaa | General\nQ1 | Tools | https://bakingsite.example/x", [A, B]);
    expect(r.rejected).toBe(1);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].bookmark.id).toBe(B.id);
    expect(normalizeFolder("Misc")).toBeNull();
  });

  it("re-categorizes locked links when they change, and skips locked links that already match", () => {
    const changed = parseCategorizedMarkdown("cccccccc | Gaming / Starfield", [L]);
    expect(changed.rows).toHaveLength(1);
    const same = parseCategorizedMarkdown("cccccccc | Games", [bm(L.id, L.url, { categoryLocked: true, folderPath: ["Bookmarks Toolbar", "Gaming"] })]);
    expect(same.rows).toHaveLength(0);
    expect(same.unchanged).toBe(1);
  });

  it("defaults to the bookmarks bar even for links now in Other Bookmarks", () => {
    const o = bm("dddddddd-4444-4444-8444-444444444444", "https://o.example/", {
      folderPath: ["Other Bookmarks", "Old"],
    });
    const r = parseCategorizedMarkdown("dddddddd | Food / Baking", [o]);
    expect(r.rows[0].suggestion.folderPath).toEqual(["Bookmarks Toolbar", "Food", "Baking"]);
  });
});

describe("suggestTightening", () => {
  it("merges synonyms locally for locked links only, keeping their root", () => {
    const g = bm("eeeeeeee-5555-4555-8555-555555555555", "https://g.example/", {
      categoryLocked: true,
      folderPath: ["Other Bookmarks", "Games", "Borderlands"],
    });
    const a = bm("ffffffff-6666-4666-8666-666666666666", "https://a.example/", {
      categoryLocked: true,
      folderPath: ["Bookmarks Toolbar", "Audio", "Resources"],
    });
    const ok = bm("11111111-7777-4777-8777-777777777777", "https://ok.example/", {
      categoryLocked: true,
      folderPath: ["Bookmarks Toolbar", "Gaming", "Starfield"],
    });
    const rows = suggestTightening([g, a, ok, A]);
    expect(rows).toHaveLength(2);
    expect(rows[0].suggestion.folderPath).toEqual(["Other Bookmarks", "Gaming", "Borderlands"]);
    expect(rows[1].suggestion.folderPath).toEqual(["Bookmarks Toolbar", "Music"]);
  });
});

import { describe, expect, it } from "vitest";
import { reviewSuggestions, suggestCategory } from "./suggest.js";

describe("suggestCategory", () => {
  it("suggests Development for GitHub", () => {
    const s = suggestCategory({ url: "https://github.com/a/b", title: "repo" });
    expect(s.category).toBe("Dev");
  });

  it("uses the short canonical vocabulary (Spotify → Music)", () => {
    expect(suggestCategory({ url: "https://open.spotify.com/x", title: "x" }).category).toBe("Music");
  });

  it("never suggests General — uses site brand instead", () => {
    const s = suggestCategory({ url: "https://obscure-brand.example/x", title: "x" });
    expect(s.category.toLowerCase()).not.toBe("general");
    expect(s.category.length).toBeGreaterThan(0);
  });

  it("skips locked bookmarks in review", () => {
    const rows = reviewSuggestions([
      {
        id: "1",
        url: "https://youtube.com/watch?v=1",
        title: "vid",
        category: "General",
        folderPath: ["General"],
        tags: [],
        createdAt: "t",
        updatedAt: "t",
        categoryLocked: true,
      },
      {
        id: "2",
        url: "https://youtube.com/watch?v=2",
        title: "vid2",
        category: "Misc",
        folderPath: ["Misc"],
        tags: [],
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].bookmark.id).toBe("2");
    expect(rows[0].suggestion.category).toBe("Video");
  });
});

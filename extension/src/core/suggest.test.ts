import { describe, expect, it } from "vitest";
import { reviewSuggestions, suggestCategory } from "./suggest.js";

describe("suggestCategory", () => {
  it("suggests Development for GitHub", () => {
    const s = suggestCategory({ url: "https://github.com/a/b", title: "repo" });
    expect(s.category).toBe("Development");
  });

  it("marks review items that differ", () => {
    const rows = reviewSuggestions([
      {
        id: "1",
        url: "https://youtube.com/watch?v=1",
        title: "vid",
        category: "General",
        tags: [],
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
    expect(rows[0].differs).toBe(true);
    expect(rows[0].suggestion.category).toBe("Media");
  });
});

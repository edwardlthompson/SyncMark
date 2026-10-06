import { describe, expect, it } from "vitest";
import { lookupDomainCategory, mapToExistingFolder } from "./domainCatalog.js";

describe("domainCatalog", () => {
  it("looks up known hosts and parent domains", () => {
    expect(lookupDomainCategory("https://github.com/a/b")?.category).toBe("Development");
    expect(lookupDomainCategory("https://www.nytimes.com/x")?.category).toBe("News");
    expect(lookupDomainCategory("https://docs.github.com/")?.category).toBe("Development");
  });

  it("uses path heuristics", () => {
    expect(lookupDomainCategory("https://example.com/recipes/pie")?.category).toBe("Food");
  });

  it("maps categories onto existing folders", () => {
    expect(mapToExistingFolder("Development", ["Dev", "Recipes"])).toBe("Dev");
    expect(mapToExistingFolder("News", ["My News Links"])).toBe("My News Links");
  });
});

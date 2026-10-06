import { describe, expect, it } from "vitest";
import { canonicalTopLevel, MAX_SUB_LEN, MAX_TOP_LEN, shortName, TOP_LEVEL_FOLDERS } from "./folderTaxonomy.js";

describe("short folder names", () => {
  it("keeps every standard top-level folder short enough for the bookmarks bar", () => {
    for (const t of TOP_LEVEL_FOLDERS) expect(t.name.length).toBeLessThanOrEqual(MAX_TOP_LEN);
  });

  it("maps old long names to the short ones", () => {
    expect(canonicalTopLevel("Automotive")).toBe("Auto");
    expect(canonicalTopLevel("Hardware & PCs")).toBe("Hardware");
    expect(canonicalTopLevel("Music & Audio")).toBe("Music");
    expect(canonicalTopLevel("Photography")).toBe("Photo");
    expect(canonicalTopLevel("Puerto Rico")).toBe("Puerto Rico"); // unknown, short enough: untouched
  });

  it("shortens subfolders: strips generic tails, abbreviates, caps length", () => {
    expect(shortName("Trading & Tools")).toBe("Trading");
    expect(shortName("The Witcher Guides")).toBe("Witcher");
    expect(shortName("Campers & Overlanding")).toBe("Campers & Overland");
    expect(shortName("Motorcycles & E-Bikes")).toBe("Motorcycles");
    expect(shortName("Web Development")).toBe("Web Dev");
    expect(shortName("Averyveryverylongsinglewordname")).toHaveLength(MAX_SUB_LEN);
    expect(shortName("Cameras & Gear")).toBe("Cameras & Gear");
  });
});

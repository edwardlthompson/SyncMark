import { describe, expect, it } from "vitest";
import { memoryFolderFromFileList } from "./folderFromFiles.js";

describe("memoryFolderFromFileList", () => {
  it("loads a SyncMark root from webkitRelativePath files", async () => {
    const files = [
      fileWithPath("MySpace/space.json", JSON.stringify({
        version: 1,
        id: "ABCDEFGHJK",
        name: "MySpace",
        secretHash: "abc",
        createdAt: "t",
      })),
      fileWithPath("MySpace/snapshots/bookmarks.json", "[]"),
      fileWithPath("MySpace/changelog.jsonl", ""),
      fileWithPath("MySpace/health.json", "{}"),
    ];
    const { folder, rootLabel } = await memoryFolderFromFileList(files);
    expect(rootLabel).toBe("MySpace");
    expect(await folder.readText("space.json")).toContain("MySpace");
    expect(await folder.readText("snapshots/bookmarks.json")).toBe("[]");
  });
});

function fileWithPath(rel: string, text: string): File {
  const f = new File([text], rel.split("/").pop()!, { type: "application/json" });
  Object.defineProperty(f, "webkitRelativePath", { value: rel });
  return f;
}

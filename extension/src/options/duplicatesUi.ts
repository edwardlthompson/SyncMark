import { extraCopyIds, findDuplicateGroups, type DuplicateGroup } from "../core/duplicates.js";
import { normalizeUrl } from "../core/import/dedupe.js";
import type { Bookmark } from "../core/types.js";
import { confirmInPage } from "./confirmInPage.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const PAGE_SIZE = 10;

let groups: DuplicateGroup[] = [];
let page = 0;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(): void {
  const list = $("dupeList");
  list.innerHTML = "";
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  page = Math.min(Math.max(0, page), pages - 1);
  $("dupePageLabel").textContent = groups.length ? `Page ${page + 1} / ${pages}` : "Page 0 / 0";
  ($("btnDupePrev") as HTMLButtonElement).disabled = page <= 0;
  ($("btnDupeNext") as HTMLButtonElement).disabled = page >= pages - 1;
  ($("btnRemoveDupes") as HTMLButtonElement).disabled = !groups.length;
  for (const g of groups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
    const div = document.createElement("div");
    div.className = "review-item";
    const copies = g.copies
      .map((c) => `<div class="muted">${c.keep ? "Keep" : "Remove"}: ${esc(c.path.join(" / "))}</div>`)
      .join("");
    div.innerHTML = `<strong>${esc(g.title)}</strong><div class="muted">${esc(g.url)}</div>${copies}`;
    list.append(div);
  }
}

async function check(getBookmarks: () => Promise<Bookmark[]>): Promise<void> {
  const msg = $("dupeMsg");
  msg.textContent = "Checking your bookmarks…";
  const preferred = new Map<string, string[]>();
  for (const b of await getBookmarks().catch(() => [] as Bookmark[])) preferred.set(normalizeUrl(b.url), b.folderPath);
  groups = findDuplicateGroups((await chrome.bookmarks.getTree()) as never, preferred);
  page = 0;
  render();
  const extra = extraCopyIds(groups).length;
  msg.textContent = groups.length
    ? `${groups.length} link(s) saved more than once (${extra} extra copies). One copy of each is kept: the one in its SyncMark folder, otherwise the most specific folder.`
    : "No duplicate links found.";
}

async function removeExtras(): Promise<void> {
  const ids = extraCopyIds(groups);
  if (!ids.length) return;
  const ok = await confirmInPage({
    title: `Remove ${ids.length} extra cop${ids.length === 1 ? "y" : "ies"}?`,
    body: `${groups.length} link(s) stay in your bookmarks, one copy each. Only the extra copies shown as “Remove” are deleted from this browser.`,
    confirmLabel: `Remove ${ids.length}`,
  });
  if (!ok) return;
  let failed = 0;
  for (const id of ids) {
    try {
      await chrome.bookmarks.remove(id);
    } catch {
      failed += 1;
    }
  }
  groups = [];
  render();
  $("dupeMsg").textContent = `Removed ${ids.length - failed} extra cop${ids.length - failed === 1 ? "y" : "ies"}${failed ? `, ${failed} failed` : ""}. Every link is still saved once.`;
}

export function initDuplicatesUi(getBookmarks: () => Promise<Bookmark[]>): void {
  $("btnFindDupes").addEventListener("click", () => void check(getBookmarks));
  $("btnRemoveDupes").addEventListener("click", () => void removeExtras());
  $("btnDupePrev").addEventListener("click", () => ((page -= 1), render()));
  $("btnDupeNext").addEventListener("click", () => ((page += 1), render()));
}

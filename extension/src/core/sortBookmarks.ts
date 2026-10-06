/** Pure planning for alphabetical ordering of one bookmark folder's children. */

export interface SortNode {
  id: string;
  title?: string;
  url?: string;
  type?: string;
  children?: SortNode[];
}

export interface SortPrefs {
  /** Keep folders A–Z (folders listed first). */
  folders: boolean;
  /** Keep links A–Z. When false, links keep the order they were added or dragged into. */
  links: boolean;
}

export const DEFAULT_SORT_PREFS: SortPrefs = { folders: false, links: false };

const isFolder = (n: SortNode): boolean => !n.url && n.type !== "separator";

const byTitle = (a: SortNode, b: SortNode): number =>
  (a.title ?? "").localeCompare(b.title ?? "", undefined, { numeric: true, sensitivity: "base" });

export function desiredOrder(children: SortNode[], prefs: SortPrefs): SortNode[] {
  const folders = children.filter(isFolder);
  const rest = children.filter((n) => !isFolder(n));
  // Separators have positional meaning; never reorder links around them.
  const hasSeparator = rest.some((n) => !n.url);
  const links = prefs.links && !hasSeparator ? [...rest].sort(byTitle) : rest;
  if (prefs.folders) return [...[...folders].sort(byTitle), ...links];
  if (links === rest) return children;
  let i = 0;
  return children.map((n) => (isFolder(n) ? n : links[i++]));
}

/** Ordered list of moves; each target is always earlier than the current spot (no index off-by-one). */
export function planMoves(children: SortNode[], prefs: SortPrefs): Array<{ id: string; index: number }> {
  const want = desiredOrder(children, prefs);
  const cur = [...children];
  const moves: Array<{ id: string; index: number }> = [];
  for (let i = 0; i < want.length; i++) {
    if (cur[i].id === want[i].id) continue;
    const j = cur.findIndex((n) => n.id === want[i].id);
    moves.push({ id: want[i].id, index: i });
    cur.splice(i, 0, cur.splice(j, 1)[0]);
  }
  return moves;
}

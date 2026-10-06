import { normalizeUrl } from "./import/dedupe.js";
import type { Tombstone, TombstoneMap } from "./types.js";

export function tombstoneKey(url: string): string {
  return normalizeUrl(url);
}

export function parseTombstones(raw: string | null): TombstoneMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TombstoneMap;
  } catch {
    return {};
  }
}

export function serializeTombstones(map: TombstoneMap): string {
  return JSON.stringify(map, null, 2);
}

export function putTombstone(map: TombstoneMap, stone: Tombstone): TombstoneMap {
  const key = tombstoneKey(stone.url);
  const prev = map[key];
  if (prev && prev.deletedAt > stone.deletedAt) return map;
  return { ...map, [key]: { ...stone, url: key } };
}

export function clearTombstone(map: TombstoneMap, url: string): TombstoneMap {
  const key = tombstoneKey(url);
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

export function isTombstoned(map: TombstoneMap, url: string, updatedAt: string): boolean {
  const stone = map[tombstoneKey(url)];
  if (!stone) return false;
  return stone.deletedAt >= updatedAt;
}

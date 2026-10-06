# Feature: two-way-sync

> Shared-folder database + in-place browser bookmark tree sync (no SyncMark mirror dump).

## Acceptance criteria

- ✅ Sync Now merges browser folders ↔ SyncMark space without creating a duplicate `SyncMark` bookmark folder
- ✅ Nested `folderPath` preserved on import and push
- ✅ Deletes use tombstones + fingerprint (never treat partial reads as deletes)
- ✅ Sync summary lists Removed with titles/timestamps
- ✅ Per-device `changelog/<deviceId>.jsonl` append-only; snapshot derived
- ✅ Category/folder suggestions require user Accept; can recommend new folders; link scan is advisory
- ✅ Sync issues append to `diagnostics/<deviceId>-sync-issues.jsonl` (+ local mirror)
- ✅ On-demand Scan & categorize in Options and popup; Save flow suggests folders
- ✅ Bookmarks Toolbar / bar drops are imported and synced

## Smoke scenario

1. _Given_ bookmarks already exist in the browser under real folders
2. _When_ the user opens a SyncMark data folder and clicks Sync Now
3. _Then_ the space and browser folders match (add/update/move/remove) with no zip prompt

## Container map

| Layer | Path |
|-------|------|
| Logic | `extension/src/core/` (`syncMerge`, `browserMerge`, `tombstones`, `deviceLog`, `store`) |
| View | `extension/src/options/`, `extension/src/popup/` |
| Platform | `extension/src/platform/browserBookmarkSync.ts` |
| Tests | co-located `*.test.ts` |

## Tests

- Automated: yes — vitest (`npm test`)
- Coverage: merge/tombstone/path import/browser merge/suggest+scan/store

## Fallback validation

- Why tests are not feasible: N/A (automated tests exist)
- Command: `cd extension && npm test && npm run build` (or `python scripts/agent-run.py feature-gate --stack web`)

## Definition of Done

Sync builds on existing folders; shared folder is a chronological multi-writer DB; suggestions stay confirm-only.

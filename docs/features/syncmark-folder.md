# Feature: syncmark-folder

> SyncMark space create/open, on-disk layout, and folder port.

## Acceptance criteria

- ✅ User can create a new SyncMark space and see files written (`space.json`, changelog, snapshot)
- ✅ User can open an existing SyncMark folder/bundle and load bookmarks
- ✅ Named primary CTA: **Create SyncMark folder** / **Open existing**
- ✅ Empty state explains why empty and offers Create or Open
- ✅ Permission-denied / cancelled picker shows a clear retry message
- ✅ Offline: create/open/import/suggest/export need no network
- ✅ Keyboard: options form controls are focusable; buttons have labels
- ✅ i18n: English copy in options/popup for MVP (`syncmark.*` keys optional later)

## Smoke scenario

1. _Given_ the unpacked extension is loaded
2. _When_ the user creates a SyncMark folder (or saves a bundle) and imports bookmarks
3. _Then_ the popup lists bookmarks with no console errors

## Container map

| Layer | Path |
|-------|------|
| Logic | `extension/src/core/` |
| View | `extension/src/options/`, `extension/src/popup/` |
| Tests | co-located `*.test.ts` |
| Wiring | `extension/src/background/sw.ts` |

## Tests

- Automated: yes — `extension` vitest suite (`npm test`)
- Coverage: space, pairing, dedupe, suggest, health, export, search, store

## Fallback validation

- Command: `cd extension && npm test && npm run build` (or `python scripts/agent-run.py feature-gate --stack web`)

## Definition of Done

MVP path: install → folder → import → pair → suggest → health → export.

# SyncMark extension

Local-first browser extension (Chromium MV3 + Firefox). Bookmark data lives in a folder you choose on disk — no accounts, no project-operated cloud.

## Develop

```bash
cd extension
npm install
npm test
npm run build

```

Load unpacked:

- Chrome / Edge / Brave: `dist/chromium`
- Firefox: `dist/firefox` (`about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`)

## First-run path

1. Open **Settings** from the popup.
2. **Create SyncMark space…** (Chrome/Edge) or open an existing data folder (Firefox: directory picker).
3. Click **Sync now** — merges your **existing** browser bookmark folders with the shared space (no duplicate SyncMark dump folder; no zip required).
4. Use **Review** in the popup to accept folder/category suggestions (including “create folder” tips). Link scan is advisory only.
5. Copy the pairing code for other browsers that open the same data folder.

On disk: `space.json`, `changelog/<deviceId>.jsonl`, `snapshots/bookmarks.json`, `tombstones.json`, `health.json`.

## Layout

- `src/core/` — pure domain logic (tested)
- `src/options/` — folder create/open/join + sync
- `src/popup/` — search, save, review
- `src/background/` — service worker + context menu

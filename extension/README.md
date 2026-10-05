# SyncMark extension

Local-first browser extension (Chromium MV3 + Firefox). Bookmark data lives in a SyncMark space file you own — no accounts, no project-operated cloud.

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
2. **Create SyncMark space** (or open a `.syncmark.json` file).
3. Copy the pairing code and **Download SyncMark file** if you will pair another browser.
4. **Import from this browser**.
5. Use the popup to save pages (suggestions are confirm-only), **Review suggestions**, and **Check links** from Settings.

Pairing another browser: open the same SyncMark file (or a copy kept in sync via Syncthing/Dropbox/etc.), enter the pairing code under **Join an existing space**.

## Layout

- `src/core/` — pure domain logic (tested)
- `src/options/` — create/open/join/import/export/health
- `src/popup/` — search, save, review
- `src/background/` — service worker + context menu

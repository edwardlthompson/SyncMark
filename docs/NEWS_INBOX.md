# News Inbox

Auto-collected inbox of news, upstream updates, security fixes, and ideas relevant to this repo, appended daily by News Bot.
A Cursor planning agent should review these items and fold the useful ones into BUILD_PLAN; entries are append-only, newest at the bottom.


## 2026-11-13

**News and updates**

- Local-First News roundup: Jazz 2.0 alpha on SQLite, Subduction encrypted P2P CRDT sync, new sync engines. [source](https://www.localfirstnews.com/2026-11-12/)
- Chrome 157.0.8103.50 patches an in-the-wild exploited zero-day (CVE-2026-125350). [source](https://chromereleases.googleblog.com/2026/11/)

**Tasks for the planning agent**

- [x] Review new local-first sync engines for two-way sync — Directly relevant to Sprint 5 two-way sync and the shared-folder DB. Label: `[AGENT][LOCAL]` · Priority: P2 · https://www.localfirstnews.com/2026-11-12/ (synced to BUILD_PLAN)
- [ ] Retest the extension on Chrome 157 and Firefox 160 — Users will be on the patched browsers quickly. Label: `[AGENT][LOCAL]` · Priority: P3 · https://chromereleases.googleblog.com/2026/11/

## 2026-11-14

**News and updates**

- wfx-loot campaign pushed a CI secret stealer into 17,000+ public repos using stolen GitHub credentials since Nov 10; an npm postinstall hook slipped past GitHub's workflow hold. IOCs: wfx-docs branch, .ci-xxxxxx.sh files, build-audit-*.yml workflows. [source](https://blog.gitguardian.com/wfx-loot-a-ci-secret-stealer-pushed-with-stolen-github-credentials/)

**Tasks for the planning agent**

- [x] Audit the repo for wfx-loot IOCs — Checks for the wfx-docs branch/PR, .ci-*.sh files, build-audit-*.yml workflows and new npm lifecycle hooks, since the campaign steals CI secrets and Cursor credentials. Label: `[AGENT][LOCAL]` · Priority: P1 · https://blog.gitguardian.com/wfx-loot-a-ci-secret-stealer-pushed-with-stolen-github-credentials/ (synced to BUILD_PLAN)

## 2026-11-18

Catch-up for Nov 17–18 (the daily brief did not run those mornings).

**News and updates**

- Chrome 158 is on the stable channel (158.0.8127.36/.37 desktop, 158.0.8127.42 Android) with 204 security fixes. [source](https://chromereleases.googleblog.com/2026/11/stable-channel-update-for-desktop_01699533288.html)

**Tasks for the planning agent**

- [ ] Retest the extension on Chrome 158 — Users will be on 158 quickly, and the release includes 204 security fixes on top of the earlier 157 retest. Label: `[AGENT][LOCAL]` · Priority: P3 · https://chromereleases.googleblog.com/2026/11/stable-channel-update-for-desktop_01699533288.html

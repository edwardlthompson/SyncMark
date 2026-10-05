# AGENT.md — original product brief (Sacred)

Copy this file to `AGENT.md` after cloning the agent-project-bootstrap template and **before** running `scripts/init-project.sh` (or `.ps1`). Paste the human’s original prompt **verbatim**. Bootstrap stamps `AGENTS.md` only and will not overwrite this file. Later sessions: read this before any BUILD_PLAN sprint row.

<!-- agent-brief:one-liner -->
Local-first, self-hosted browser extension that unifies bookmarks across browsers, checks dead links, suggests categories, and syncs via a user-owned folder + pairing code — no accounts, no cloud required.
<!-- /agent-brief:one-liner -->

<!-- agent-brief:keywords -->
local-first, self-hosted, browser-extension, webextensions, bookmarks, dead-link-checker, category-suggestions, folder-sync, pairing-code, P2P-ish, privacy, FOSS, no-cloud, no-login
<!-- /agent-brief:keywords -->

## Rules

- Pure FOSS under MIT. No proprietary SDKs, no mandatory cloud, no user accounts, no OAuth in the core product.
- Local-first: all bookmark data lives in a user-chosen folder on disk. The extension never sends bookmark content to any remote server operated by the project.
- Pairing is done with a short human-enterable code (or QR) that lets another browser/device join the same SyncMark space by pointing at the same (or synced) folder and sharing a secret for integrity.
- Auto-categorization only **suggests**; the user always makes the final decision. Suggestions appear on every new save and in a bulk “Review existing bookmarks” flow.
- Target mainstream users who hop between browsers and devices. Prefer simple, obvious UX over power-user complexity in v1.
- Follow every rule in the parent template’s `AGENTS.md`, `docs/INITIALIZATION_PROMPT.md`, `docs/ux-ui-guidelines.md`, file-size budgets, test-first policy, Conventional Commits, and security defaults.
- After `init-project`, keep this file as the Sacred product brief. Update `docs/spec.md`, `docs/plan.md`, and `BUILD_PLAN.md` from it; do not let the product drift.

## Product Overview

**Name:** SyncMark

**Purpose:** Give anyone a single, healthy, organized bookmark collection that works across Chrome, Edge, Firefox, Brave, Opera, and (later) Safari, without forcing them into an account or a cloud service.

**Core user story:**  
“I use multiple browsers and devices. I want all my bookmarks in one place, cleaned of dead links, organized with helpful category suggestions, and kept in sync — but I refuse to create an account or upload my links to someone else’s servers.”

**Distribution:** GitHub Releases + browser extension stores (Chrome Web Store, Firefox Add-ons, etc.) when ready. Pure FOSS (MIT). Optional later self-hosted cloud folder adapters (Google Drive / Dropbox / Syncthing) with E2EE remain user-controlled.

## Goals

1. Unify bookmarks from any supported browser into one local model stored in a user-owned folder.
2. Detect and surface dead / broken links (with careful soft-404 handling).
3. Suggest categories/tags on every new bookmark and offer a guided bulk review for existing ones; never auto-move without explicit user approval.
4. Let the user pair additional browsers/devices with a short code so they all read/write the same folder (or folders already kept in sync by the user’s own tools such as Syncthing, Dropbox desktop, network share, etc.).
5. Remain fully usable offline and with zero network dependency for core functionality.
6. Stay privacy-respecting and mainstream-friendly: clear language, minimal setup steps, no jargon.

## Non-Goals (explicit scope boundaries)

- No mandatory accounts, OAuth, or project-operated cloud backend in the core product.
- No automatic permanent deletion of bookmarks; dead-link status is advisory.
- No forced AI categorization; suggestions only.
- No mobile native apps in the first major milestones (a simple local-folder web viewer may come later).
- No monetization, tracking, or telemetry by default.
- No attempt at true NAT-traversing P2P mesh in v1; rely on the user’s existing folder-sync tools + optional later LAN discovery / self-hosted relay.

## Success Metrics (early)

- A user can install the extension, point it at a folder, import existing bookmarks, and see a unified list in < 5 minutes.
- Pairing a second browser with the code works without creating an account.
- Dead-link checker produces useful status without false-positive mass deletion.
- Category suggestions are accepted or easily overridden; bulk review feels helpful rather than burdensome.
- All data remains on disk under the user’s control; export is always available.

## Recommended Stack (Sprint 0 choice)

- **Primary:** Web / browser-extension (Manifest V3 for Chromium family, WebExtensions for Firefox).
- Shared TypeScript codebase where possible.
- Local persistence: File System Access API where available + optional small native messaging host for broader folder access and background reliability.
- Data format inside the SyncMark folder: append-only change log or CRDT files (e.g. Automerge/Yjs) so concurrent browser edits merge cleanly; plain JSON fallback for inspectability.
- Optional later: native helper (Rust or Go) for richer filesystem watching and LAN discovery.
- AI suggestions: start with local heuristics (domain + title rules); optional on-device or user-provided model later. Never require a remote LLM for core functionality.
- Testing: unit tests for core logic, Playwright or equivalent for extension UI where feasible, feature-gate scripts from the bootstrap template.

Choose stack `web` (or `multi` if a small native helper is added early) during `init-project`.

## Key Features for First Milestones

### Must-have (MVP)

- Create / open a SyncMark folder.
- Import bookmarks from the current browser.
- Unified local model with deduplication.
- Pair additional browsers via short code / QR (shared secret + folder identity).
- Save new bookmark → category/tag suggestions → user decides.
- “Review existing bookmarks” flow that shows current vs suggested category.
- Dead-link checker (configurable schedule or on-demand) with health status stored in the folder.
- Search, basic tags/folders, export (HTML / JSON / Markdown).
- Everything readable and writable only from the user-controlled folder.

### High-value follow-ons

- Better conflict/merge behavior (CRDT).
- Soft-404 and login-wall heuristics.
- Local learning from accept/reject of suggestions.
- Optional LAN discovery so two devices on the same network can locate the folder more easily.
- Optional adapters that treat a Google Drive / Dropbox / Syncthing folder as the SyncMark root, with E2EE layer if desired.
- Safari support (separate packaging).
- Bookmarklet fallback for limited environments.

## Architecture Constraints (in addition to template rules)

- Local-first and offline-first by default.
- No project-operated servers for bookmark data.
- Pairing code must be short, memorable or scannable, and sufficient to join the same space without exposing the full folder path if the user prefers.
- Dead-link checks must be rate-limited, respectful, and never destructive by default.
- Category suggestions are advisory only; user confirmation is required for any change.
- File size budgets, strict typing, test-first, and Conventional Commits from the parent template apply.
- Prefer small, composable modules; keep pure logic ≤ 150 lines per file where practical.

## First Milestone (suggested Sprint 1–2 after init)

1. Scaffold the extension (Chromium + Firefox) that can request a folder and write a minimal SyncMark data structure into it.
2. Import current-browser bookmarks into that structure with basic deduplication.
3. Implement pairing-code generation and “join existing space” flow (same machine / same already-synced folder first).
4. Dead-link status field + simple on-demand checker.
5. New-bookmark save flow with rule-based category suggestions + user confirmation.
6. Basic “Review existing” list that lets the user accept or keep current categories.
7. Export and a minimal popup / options UI that feels mainstream-friendly.
8. Document the exact folder layout and pairing protocol in `docs/spec.md` and an ADR.

## Initialization Instructions for the Cursor Agent

1. Confirm this file is present as `AGENT.md` (Sacred brief).
2. Run the parent template’s init:
   ```bash
   ./scripts/init-project.sh
   # or non-interactive example:
   ./scripts/init-project.sh --non-interactive --stack web --project-name "SyncMark" --purpose "Local-first cross-browser bookmark unifier with dead-link checking and category suggestions" --license MIT
   ```
3. After init, update `docs/spec.md`, `docs/plan.md`, `branding/product.json`, and the product card inside `AGENTS.md` so they reflect SyncMark.
4. Create an initial ADR for the local-folder + pairing-code architecture.
5. Populate `BUILD_PLAN.md` with concrete sprints derived from the milestones above, using the template’s Sequential / Parallel structure, owner labels (`[AGENT]`, `[HUMAN]`, etc.), and status markers (🔲 ✅ ❌).
6. Follow `docs/INITIALIZATION_PROMPT.md`, `docs/START_HERE.md`, and `/tour` / `/coach` guidance from the parent template.
7. Never introduce accounts, cloud storage of bookmarks, or mandatory network calls for core functionality.

## Stakeholders

- **Primary users:** Mainstream people who switch browsers or devices and want their bookmarks unified and cleaned without creating yet another account.
- **Operators / maintainers:** FOSS contributors; the project itself runs no backend.
- **Non-goals reminder:** power-user advanced P2P mesh, commercial SaaS, or telemetry-driven product are out of scope for the core.

## Success Definition for the Agent

A working child repository that:

- Inherits all bootstrap guardrails, CI, security, and agent routing.
- Has a clear `docs/spec.md` and living `BUILD_PLAN.md` for SyncMark.
- Can demonstrate a minimal end-to-end path: install → choose folder → import → pair second browser via code → save with suggestion → see dead-link status — all without any project-operated cloud or login.

Begin by reading this brief, the parent `AGENTS.md`, `docs/START_HERE.md`, and `docs/INITIALIZATION_PROMPT.md`, then proceed with Sprint 0 / init as directed.

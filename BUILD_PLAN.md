# Build Plan

<!-- remaining-tally -->
**Remaining:** AGENT 0 · LOCAL 0 · CLOUD 0 · AUTO 1 · HUMAN 5 · ADB 0 · **6 open**
<!-- /remaining-tally -->

Live board for SyncMark. Finished work: [`COMPLETED_TASKS.md`](COMPLETED_TASKS.md).

**Who:** `AGENT` code · `HUMAN` person · `ADB` device · `AUTO` CI/scripts
**Venue (AGENT only):** `[LOCAL]` This Computer · `[CLOUD]` Cursor Cloud — [`docs/adr/0008-agent-venue.md`](docs/adr/0008-agent-venue.md)
**State:** 🔲 open · ✅ done · ❌ blocked — reason

Format: `🔲 [AGENT][LOCAL] Short task — scope: path/prefix`. Smoke gate: after every `[AGENT]` row run `python3 scripts/agent-run.py watch-agent-gates --once --autofix --scope auto`.

---

## Product

### Product (do not drift)

> Auto-managed from `AGENT.md` after init. Do not hand-edit inside markers. Read `AGENT.md` before any sprint row.

<!-- product-brief-sync:begin -->
> Read `AGENT.md` before any sprint row.

**One-liner:** Local-first, self-hosted browser extension that unifies bookmarks across browsers, checks dead links, suggests categories, and syncs via a user-owned folder + pairing code — no accounts, no cloud required.
**Do not drift:** local-first, self-hosted, browser-extension, webextensions, bookmarks, dead-link-checker, category-suggestions, folder-sync, pairing-code, p2p-ish, privacy, foss, no-cloud, no-login

**Rules:**
- Pure FOSS under MIT. No proprietary SDKs, no mandatory cloud, no user accounts, no OAuth in the core product.
- Local-first: all bookmark data lives in a user-chosen folder on disk. The extension never sends bookmark content to any remote server operated by the project.
- Pairing is done with a short human-enterable code (or QR) that lets another browser/device join the same SyncMark space by pointing at the same (or synced) folder and sharing a secret for integrity.
- Auto-categorization only **suggests**; the user always makes the final decision. Suggestions appear on every new save and in a bulk “Review existing bookmarks” flow.
- Target mainstream users who hop between browsers and devices. Prefer simple, obvious UX over power-user complexity in v1.
- Follow every rule in the parent template’s `AGENTS.md`, `docs/INITIALIZATION_PROMPT.md`, `docs/ux-ui-guidelines.md`, file-size budgets, test-first policy, Conventional Commits, and security defaults.
- After `init-project`, keep this file as the Sacred product brief. Update `docs/spec.md`, `docs/plan.md`, and `BUILD_PLAN.md` from it; do not let the product drift.

**First milestone:** 1. Scaffold the extension (Chromium + Firefox) that can request a folder and write a minimal SyncMark data structure into it.
<!-- product-brief-sync:end -->

### Sprint 0 — Customize

<!-- parallel_exception: stack not selected until init -->

1. ✅ [AGENT][LOCAL] Copy Sacred brief → `AGENT.md` before init — scope: AGENT.md
2. ✅ [AGENT][LOCAL] Run `scripts/init-project.ps1` non-interactive (`web`, SyncMark, MIT, prune) — scope: scripts/
3. ✅ [AGENT][LOCAL] Fill `branding/product.json` (`mode: product`); sync tokens + README — scope: branding/
4. ✅ [AGENT][LOCAL] Run `scripts/setup-github-repo.ps1` (`gh` admin) — scope: scripts/
5. ✅ [AUTO] Sprint 0 sign-off on `main`: `validate-bootstrap --quick` · `feature-gate --stack web` · `check-github-ci --wait 300` · `check-license-compliance` (web job green on CI)
6. ✅ [HUMAN] Create GitHub child from template (via `gh repo create --template`)
7. ✅ [HUMAN] FOSS tier selected at init
8. 🔲 [HUMAN] Skim `docs/INITIALIZATION_PROMPT.md` / `docs/CURSOR_MODES.md`
9. 🔲 [HUMAN] Bookmark `docs/help/BATCH_COMMANDS.md` (`/tour`, `/coach`)
10. 🔲 [HUMAN] Approve Sprint 0 when AUTO gates are green

### Sprint 1–4 — MVP extension (shipped)

<!-- parallel_exception: MVP vertical slices completed; archive in COMPLETED_TASKS -->

1. ✅ [AGENT][LOCAL] Extension scaffold + SyncMark space file layout — scope: extension/
2. ✅ [AGENT][LOCAL] Import + dedupe + pairing code join — scope: extension/src/core/
3. ✅ [AGENT][LOCAL] Dead-link checker + suggest + review UI — scope: extension/src/
4. ✅ [AGENT][LOCAL] Search, export HTML/JSON/MD, protocol docs — scope: extension/,docs/
5. ✅ [AUTO] `cd extension && npm test && npm run build`
6. 🔲 [HUMAN] Approve ADR-0001 and product smoke (install → import → pair → suggest → health → export)

### Sprint 5 — Two-way sync + shared-folder DB

<!-- parallel_exception: sequential vertical slice; Parallel N/A for this feature -->

1. ✅ [AGENT][LOCAL] True 2-way sync (in-place folders, tombstones, per-writer logs, suggest+scan) — scope: extension/,docs/features/two-way-sync.md
2. ✅ [AUTO] `cd extension && npm test && npm run build` after reload smoke
3. 🔲 [HUMAN] Smoke Sync Now across Chrome + Firefox on existing bookmark folders (no SyncMark mirror dump)

### Waiting on a person

_None for Android; SyncMark is web-extension only in MVP._

### Open PRs (synced)

<!-- open-prs-sync:begin -->
- 🔲 [AUTO] Merge Dependabot [#1](https://github.com/edwardlthompson/SyncMark/pull/1) (Bump anchore/sbom-action from 0.24.2 to 0.24.3 in the github-actions group)
<!-- open-prs-sync:end -->

### Template gaps (synced)

<!-- template-gaps-sync:begin -->
_No template gaps; .template-version matches upstream (or template maintainer N/A)._
<!-- template-gaps-sync:end -->

### UX & UI inventory

<!-- ux-inventory:begin -->
_No UX inventory items._
<!-- ux-inventory:end -->

### Local agent (This Computer)

<!-- local-agent-lane:begin -->
_No local agent items._
<!-- local-agent-lane:end -->

### Cloud agent (Cursor Cloud)

<!-- cloud-agent-lane:begin -->
_No cloud agent items._
<!-- cloud-agent-lane:end -->

---

## Ongoing Maintenance

Not a checklist. GitHub Monday cron (`.github/workflows/weekly-health-check.yml`) already runs CI wait, security triage, parent template-gap BUILD_PLAN sync, radar, `update-deps` dry-run, Dependabot leftover list, open-PR BUILD_PLAN sync, and latest-release SBOM. `/ship` owns pre-release and the release tag.

---

## Archive

Older sprints: [`COMPLETED_TASKS.md`](COMPLETED_TASKS.md).

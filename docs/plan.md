# Implementation Plan — SyncMark

> Active work lives in `BUILD_PLAN.md`. Status: 🔲 open · ✅ done · ❌ blocked.

## Milestone M0 — Bootstrap (Sprint 0)

| Task | Owner | Tests / fallback |
|------|-------|------------------|
| Create GitHub child from template + `AGENT.md` + init `web` | AGENT | `bootstrap.config.json` present |
| Branding, spec, plan, BUILD_PLAN, ADR-0001 | AGENT | docs review + `check-build-plan-parallel` |
| setup-github-repo + CI green on `main` | AGENT/AUTO | `check-github-ci --wait 300` |

## Milestone M1 — Extension + folder (Sprint 1)

| Task | Owner | Tests / fallback |
|------|-------|------------------|
| MV3 Chromium + Firefox scaffold | AGENT | `extension` build scripts exit 0 |
| Space create/open + folder schema | AGENT | unit: `space.test.ts`, `folder.test.ts` |

## Milestone M2 — Import + pairing (Sprint 2)

| Task | Owner | Tests / fallback |
|------|-------|------------------|
| Browser bookmark import + URL dedupe | AGENT | unit: `dedupe.test.ts`, `importBookmarks.test.ts` |
| Pairing code generate/join | AGENT | unit: `pairing.test.ts` |

## Milestone M3 — Health + suggestions (Sprint 3)

| Task | Owner | Tests / fallback |
|------|-------|------------------|
| On-demand dead-link checker (advisory) | AGENT | unit: `health.test.ts` |
| Suggest + Review existing flows | AGENT | unit: `suggest.test.ts` |

## Milestone M4 — Search, export, MVP UI (Sprint 4)

| Task | Owner | Tests / fallback |
|------|-------|------------------|
| Search/tags + export HTML/JSON/MD | AGENT | unit: `export.test.ts`, `search.test.ts` |
| Popup/options UX + protocol docs | AGENT | build + manual load-unpacked smoke |

## Follow-ons (not MVP)

CRDT merge, LAN discovery, Drive/Dropbox/Syncthing adapters + E2EE, Safari, on-device LLM suggestions, native messaging host.

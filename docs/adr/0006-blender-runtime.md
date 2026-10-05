# ADR-0006: Blender as a GPL runtime (OptiX optional)

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Template maintainer

## Context

Child repos need a Golden Path to batch photoreal app icons (Cycles, optional NVIDIA OptiX on a local RTX GPU). Blender is GPL. NVIDIA OptiX is proprietary. Template gates must not require CUDA (`docs/LINUX_DEV.md`). Git LFS is forbidden without `[HUMAN]` approval, so binary `.blend` files stay out of git.

## Decision

1. **Blender is a runtime**, not a vendored library. MIT Python under `examples/blender/` talks to `blender --background --python`. Do not link `libblender`.
2. **OptiX is env-gated** (`BLENDER_CYCLES_DEVICE=OPTIX`). CI and feature-gate use Cycles **CPU** or skip when `blender` is missing.
3. **Optional stack** (`modules/blender/`, `examples/blender/`): not in the init `--stack` picker.
4. **`AGENT.md` is Sacred** product brief. Init stamps `AGENTS.md` only.

## Alternatives considered

- Vendor Blender in the repo — rejected: GPL combined work + huge binaries.
- Require OptiX in CI — rejected: proprietary SDK and no GitHub GPU.
- Commit `.blend` via Git LFS — rejected: needs `[HUMAN]` LFS approval.

### Critique

| Issue | Resolution |
|-------|------------|
| Null/empty at boundary | Manifest schema requires `id`/`seed`; CLI exit 2 |
| Network timeout | N/A — local Blender only |
| Race conditions | One Blender process per CLI; `--resume` uses content hashes |
| Unhandled exceptions | Render failures mark the job failed; CLI non-zero |

## Consequences

- GPL runtime exception is recorded in `THIRD_PARTY_LICENSES.md`.
- 4000-icon batches stay gitignored; CI smokes `--limit 1`.

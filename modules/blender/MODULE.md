# Module H: Blender (icon factory)

> Optional stack — not in the default init stack picker. See `docs/OPTIONAL_STACKS.md`.

## Requirements (Verbatim)

- **Runtime only:** Call `blender --background --python`. Do not vendor Blender or link `libblender` (GPL).
- **Determinism:** Manifest `seed`, camera, and lighting are the only variation. No human review of 4000 frames.
- **GPU:** `BLENDER_CYCLES_DEVICE=OPTIX` is local. CI stays CPU or skip.

## Activation Checklist

> **Child-activation:** Keep `examples/blender/` (`--keep-optional`). Gate: `python3 -m unittest tests.test_blender_icon_factory`.

- 🔲 Keep `examples/blender/` and `modules/blender/`
- 🔲 Install Blender 4.x on PATH for local renders
- 🔲 Set `BLENDER_CYCLES_DEVICE=OPTIX` when `nvidia-smi` shows a GPU (skip if missing)
- 🔲 Document GPU device in `AGENT_MEMORY.md`

## Golden Path Reference

See `examples/blender/` for manifest + QA. Feature spec: `docs/features/icon-factory.md`.

## Feature gate (Sprint 2+)

| Stage | Command |
|-------|---------|
| Schema + stub QA | `python3 examples/blender/cli.py --stub --limit 1` |
| Cycles CPU (if blender) | `blender --background --python examples/blender/cli.py -- --limit 1` |

## Owner Labels for This Module

| Task type | Label |
|-----------|-------|
| Manifest, QA, CLI | `AGENT` |
| OptiX env probe (`nvidia-smi` / `BLENDER_CYCLES_DEVICE`) | `AGENT` |
| 4000-icon local batch | `AUTO` |

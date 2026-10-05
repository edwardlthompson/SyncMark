# Golden Path Blender (icon factory)

Procedural Cycles stills from a JSON manifest. No `.blend` in git. Blender is a **GPL runtime** (see `docs/adr/0006-blender-runtime.md`).

## Commands

```bash
# Machine QA without Blender
python3 examples/blender/cli.py --stub --limit 1

# Local RTX 4090
export BLENDER_CYCLES_DEVICE=OPTIX
python3 scripts/agent-run.py blender-icons -- --manifest examples/blender/fixtures/icon-manifest.sample.json

```

`nice`/`ionice` long batches per [`docs/LINUX_DEV.md`](../../docs/LINUX_DEV.md). Output is gitignored `examples/blender/out/`.

## CI

Path-filtered job runs schema + stub QA. Cycles CPU `--limit 1` only when `blender` is on PATH. OptiX is never required in CI.

## Local 4000+ batch

Do not commit a 4000-job manifest. Expand from a seed range on This Computer, then:

```bash
export BLENDER_CYCLES_DEVICE=OPTIX
python3 scripts/agent-run.py blender-icons -- --manifest examples/blender/fixtures/icon-manifest.4k.json --out examples/blender/out --resume
```

`--resume` skips ids whose PNG content hash still matches the sidecar. Any QA failure fails the batch (exit 1).

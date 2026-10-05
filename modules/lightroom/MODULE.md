# Module D: Adobe Lightroom Classic Plugins

> Activate when your stack includes an Adobe Lightroom Classic plugin.

## Requirements (Verbatim)

- **Lightroom SDK Compliance:** Code written for Adobe Lightroom Classic must conform strictly to the Adobe Lightroom SDK object-oriented Lua API framework. Do not import generic Lua modules or attempt direct OS system actions without routing through the explicit Lr naming boundaries (e.g., `LrTasks`, `LrDialogs`, `LrLogger`, `LrView`).

## Activation Checklist

- 🔲 Verify all code uses `Lr*` SDK namespaces only
- 🔲 No generic Lua module imports (stdlib exceptions documented in ADR)
- 🔲 No direct OS system calls outside SDK boundaries
- 🔲 Configure `Info.lua` with correct `.lrplugin` wrapper parameters
- 🔲 Set up `LrLogger` for structured debug output
- 🔲 Document SDK version compatibility in AGENT_MEMORY.md
- 🔲 Add Lua lint rules if applicable (`scripts/check-lightroom-lua.sh`)

## Golden Path Reference

See `examples/lightroom/` for `Info.lua` metadata stub and SDK version documentation. Adobe SDK is proprietary; CI and feature-gate check Lr* namespaces and Lua lint only.

## Feature gate (Sprint 2+)

Lightroom plugins are optional; when active, `scripts/feature-gate.sh --stack lightroom` runs SDK grep, Lua lint, the SDK playbook, and tagset fuzz. That **is** the Golden Path load smoke. Opening Classic Plug-in Manager is an optional host check, not a BUILD_PLAN `[HUMAN]` row.

| Stage | Command |
|-------|---------|
| Hygiene + encoding | `bash scripts/feature-gate.sh --stack multi` |
| SDK compliance | `bash scripts/verify-lightroom.sh` |
| Lua lint | `bash scripts/check-lightroom-lua.sh` (`.luacheckrc` + Lr* import rules) |
| SDK bump playbook | `bash scripts/check-lightroom-sdk-playbook.sh` + [`docs/LIGHTROOM_SDK_BUMP.md`](../../docs/LIGHTROOM_SDK_BUMP.md) |

## Owner Labels for This Module

| Task type | Label |
|-----------|-------|
| Scaffold plugin Lua structure | `AGENT` |
| SDK version/target in Info.lua + playbook gate | `AGENT` |
| Optional Adobe Classic host click | `AUTO` |

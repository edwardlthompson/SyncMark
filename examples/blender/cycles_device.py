"""Pick Cycles device: OPTIX only when env asks; else CPU."""
from __future__ import annotations

import os


def cycles_device(env: dict[str, str] | None = None) -> str:
    source = env if env is not None else os.environ
    raw = (source.get("BLENDER_CYCLES_DEVICE") or "CPU").strip().upper()
    if raw == "OPTIX":
        return "OPTIX"
    return "CPU"

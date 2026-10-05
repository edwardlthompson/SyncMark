"""Render one manifest job to PNG via Cycles."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from cycles_device import cycles_device

try:
    import bpy  # type: ignore
except ImportError:  # pragma: no cover
    bpy = None


def render_png(job: dict[str, Any], dest: Path, *, device: str | None = None) -> Path:
    if bpy is None:
        raise RuntimeError("bpy is only available inside Blender")
    from scene import build_scene

    dest.parent.mkdir(parents=True, exist_ok=True)
    build_scene(job)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(job["samples"])
    scene.cycles.seed = int(job["seed"])
    scene.render.resolution_x = int(job["resolution"])
    scene.render.resolution_y = int(job["resolution"])
    scene.render.film_transparent = bool(job["film_transparent"])
    scene.render.filepath = str(dest)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    pref = bpy.context.preferences.addons.get("cycles")
    if pref:
        pref.preferences.compute_device_type = cycles_device() if device is None else device
    bpy.ops.render.render(write_still=True)
    return dest

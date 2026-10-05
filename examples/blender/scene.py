"""Procedural photoreal still (bpy). No binary .blend in git."""
from __future__ import annotations

from typing import Any

try:
    import bpy  # type: ignore
except ImportError:  # pragma: no cover - unit tests
    bpy = None


def _look_at(cam, target: list[float]) -> None:
    import mathutils  # type: ignore

    loc = cam.location
    direction = mathutils.Vector(target) - loc
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def _add_lights(job: dict[str, Any]) -> None:
    lights = job["lighting"].get("area_lights") or []
    intensity = float(job["lighting"]["intensity"])
    if not lights:
        lights = [{"location": [2.5, -1.5, 3.0], "energy": 250}]
    for item in lights:
        bpy.ops.object.light_add(type="AREA", location=item["location"])
        bpy.context.active_object.data.energy = float(item["energy"]) * intensity
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Strength"].default_value = 0.4


def build_scene(job: dict[str, Any]) -> None:
    if bpy is None:
        raise RuntimeError("bpy is only available inside Blender")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.mesh.primitive_cube_add(size=1.4, location=(0, 0, 0.2))
    cube = bpy.context.active_object
    bpy.ops.object.modifier_add(type="BEVEL")
    cube.modifiers["Bevel"].width = 0.08
    mat = bpy.data.materials.new("Hero")
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Metallic"].default_value = 0.35
        principled.inputs["Roughness"].default_value = 0.22
        principled.inputs["Base Color"].default_value = (0.12, 0.55, 0.95, 1)
    cube.data.materials.append(mat)
    cube.rotation_euler[2] = float(job.get("yaw_deg") or 0) * 3.14159 / 180
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    loc = job["camera"]["location"]
    cam.location = loc
    cam.data.lens = float(job["camera"]["focal_mm"])
    _look_at(cam, job["camera"]["look_at"])
    bpy.context.scene.camera = cam
    _add_lights(job)
